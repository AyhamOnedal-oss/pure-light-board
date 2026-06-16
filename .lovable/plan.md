## Why the dashboard flashes zeros for ~2s on reload

`src/app/hooks/useDashboardMetrics.ts` initialises its state from a `localStorage` cache keyed by `tenantId`:

```ts
const cacheKey = tenantId ? `dashboard-metrics-cache:${tenantId}` : null;
const cached = cacheKey ? readCache() : null;
const [metrics, setMetrics] = useState(cached?.metrics ?? EMPTY_METRICS);
```

On a hard reload `AppContext` resolves the tenant **asynchronously** (auth → membership → `tenantId`). The dashboard mounts before that resolves, so on the very first render `tenantId` is `null` → `cacheKey` is `null` → `cached` is `null` → state is seeded with **`EMPTY_METRICS` (all zeros)**. The state initialiser only runs once; by the time `tenantId` arrives, the hook just kicks off a network fetch and leaves the zero state in place until the response lands ~1–2 s later.

That explains both complaints:

1. **The page literally renders zeros for ~2 s.** It's the EMPTY_METRICS seed, not a skeleton.
2. **Numbers "decrease to 0 then climb up".** `AnimatedValue` snaps on its first mount (`hasMountedRef`), so the very first painted value is `0`. When the fetch resolves and the real number arrives, it animates `0 → real`. With Recharts pies/bars driven off the same metrics, the bars do the same `scaleY: 0 → 1` again because their `motion.div` initial state replays on every dataset change (they're keyed by `d.name` only, so a value change re-triggers the enter animation).

Realtime + refetch later updates work fine because by then there is a non-empty `metrics` state and the diff animation looks natural — the bug is strictly the cold-start path.

## Plan

### 1. Seed initial metrics from cache *before* `tenantId` is known
`src/app/hooks/useDashboardMetrics.ts`:
- Maintain a second key, e.g. `dashboard-metrics-last-tenant`, that is written every time we successfully cache metrics. On mount, if `tenantId` is null, look up `last-tenant` → read its cached metrics → use as the lazy `useState` seed.
- Switch all three state hooks (`metrics`, `topSubjects`, `recentFeedback`) and `loading` to lazy initialisers (`useState(() => ...)`) that perform that lookup once.
- When `tenantId` later resolves: if it matches `last-tenant`, do nothing (the seed was correct) and just kick off the background refresh; if it differs, replace state from the new tenant's cache (or `EMPTY_METRICS` if none) before fetching.
- Only set `loading = true` when we have **no** cached data to display.

Result: on reload, the first paint shows the previous numbers/charts from cache, not zeros.

### 2. Real skeletons for the first-ever load (no cache)
When `loading && metrics === EMPTY_METRICS` (i.e. brand-new account / cleared storage), avoid rendering the zero state. In `src/app/components/DashboardPage.tsx`:
- Render lightweight skeleton placeholders for the four hero cards (KPI tiles, Classification pie, Ticket Status bars, Customer Rating, AI Feedback pie). Use existing `Skeleton` primitive or a simple `animate-pulse` div with `bg-muted/40`, matching each card's footprint so the layout doesn't jump.
- Once data arrives, swap skeleton → real content with `animate-fade-in` (300ms). No number animations on this first reveal.

### 3. Don't animate `0 → real` on the initial reveal
`src/app/components/AnimatedNumber.tsx`:
- Extend the mount-snap so it also covers the case where the **first non-zero target** arrives after one or more renders with `target === 0`. Track `hasRealValueRef`: until we've seen a non-zero target, snap to the incoming target instead of animating. After that, animate normally for every subsequent change (realtime, range switch, etc.).
- Keep the existing snap on the very first mount so cached dashboards still don't animate.

### 4. Make the chart enter-animations play exactly once
`src/app/components/DashboardPage.tsx`:
- The Ticket Status bars use `motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}` keyed only by `d.name`, so any data update replays the wipe-up. Gate the `initial` on the same `animateOnce` flag already used by the surrounding card (`initial={animateOnce ? { scaleY: 0 } : false}`), and drive height from data via `animate={{ height: \`${pct}%\` }}` with a smooth transition so updates tween in place instead of replaying the enter animation.
- Same fix for the star burst in Customer Rating (`initial={{ opacity: 0, scale: 0 }}`) — gate on `animateOnce` so it doesn't re-pop every time the average changes.
- Recharts pies already have `isAnimationActive` + memoised data; leave them, the issue there was the same cold-start zero seed which step 1 removes.

### 5. Verify
- Hard reload `/dashboard` on a tenant with cached data → expect: numbers and bars appear immediately at their cached values, then silently update if the server returns something different.
- Hard reload as a brand-new account (no cache) → expect: skeletons for ~1 s, then the real data fades in with a single, smooth count-up.
- Trigger a realtime update (e.g. send a test message) → expect: the affected number animates from the old value to the new one (no `0` flash), bars tween to the new height in place.

### Out of scope
- No backend / SQL changes.
- No change to `useDashboardMetrics`'s realtime channels or refetch debouncing.
- No restyle of the cards beyond adding skeleton placeholders.
