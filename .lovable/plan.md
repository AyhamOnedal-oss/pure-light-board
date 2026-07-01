
# Make Admin Dashboard charts live and date-range aware

Every chart on `/admin` (except the 3 that must stay live-only) will respect the top-right date filter (اليوم/الشهر/…/نطاق مخصص) and use adaptive time buckets so a 1-week range shows day names (سبت، أحد، اثنين…) instead of hard-coded months.

## Scope

### Charts to make range-aware
1. **المشتركون الجدد عبر الوقت** (New Subscribers Over Time) — line, per platform
2. **المحادثات والتوكنز** (Conversations & Tokens) — bar
3. **خطط العملاء الحالية** (Current Customer Plans) — pie, subscribers whose plan was active in range
4. **الاشتراكات حسب المنصة** (Subscriptions by Platform) — bar (active/cancelled in range)
5. **نوع الاشتراك الأول** (First Subscription Type) — pie, first subs created in range
6. **المشتركون الجدد** (New Subscribers list) — replace the fixed "last 7 days" with the selected range
7. **مقارنة مصادر العملاء** (Customer Source) — pie of tenants installed in range
8. **مقارنة إلغاء التثبيت** (Uninstall Comparison) — bar of uninstalls in range
9. **المشتركين حسب الخطة – زد / سلة** — bar, plan counts in range

### Charts NOT touched (per request)
- حالة الخوادم (already live)
- مفاتيح OpenAI card
- استخدام الخوادم / الخدمات

## Adaptive bucketing

Bucket is chosen from the range span:
- ≤ 2 days → hourly buckets, label `HH:00`
- 3–14 days → daily buckets, label short weekday + day (`سبت 15`)
- 15–90 days → weekly buckets, label `Wk 12`
- > 90 days → monthly buckets, label month (يناير…)

Bucket + labels computed client-side in a single `bucketize(from, to)` helper in `AdminDashboard.tsx`. Every chart's `useMemo` iterates the buckets and looks up counts from the range-scoped RPC rows.

## Backend (single migration)

New/updated RPCs that all accept `_from timestamptz, _to timestamptz, _bucket text` (`hour|day|week|month`) and return `{ bucket_start timestamptz, ... }`:

- `admin_new_subs_series(_from,_to,_bucket)` → `{bucket_start, platform, count}` — counts rows in `zid_connections` + `salla_connections` created in range, grouped by `date_trunc(_bucket, created_at)` and platform.
- `admin_conversations_series(_from,_to,_bucket)` → `{bucket_start, count}` — from `conversations_main` excluding test chats, `started_at` in range.
- `admin_uninstalls_series(_from,_to)` → `{platform, count}` — flag rows where connection was later marked uninstalled within range (reuses existing uninstall logic used by KPI).
- `admin_platform_subs_range(_from,_to)` → `{status, platform, count}` — subs whose `status` transition falls in range.
- `admin_first_sub_type_range(_from,_to)` → `{plan, count}` — first `settings_plans` row per tenant, filtered by `created_at` in range.
- `admin_plan_distribution_range(_from,_to)` → `{platform, plan, subscribers}` — plans considered "current" during the range (period overlap on `settings_plans` + `admin_subscription_periods`).
- `admin_customer_source_range(_from,_to)` → `{platform, count}` — distinct tenants with a connection created in range.
- `admin_new_subscribers_range(_from,_to)` → same shape as today's `NewSubscriber`, honoring the selected range instead of hard-coded 7 days.

All RPCs `security definer`, `GRANT EXECUTE … TO authenticated`, and only return data when caller is `super_admin` (mirrors existing `admin_kpis` guard). No new tables; no schema changes to existing tables.

## Frontend changes

`src/app/services/adminDashboard.ts`
- Add typed wrappers: `fetchNewSubsSeries`, `fetchConversationsSeries`, `fetchUninstallsRange`, `fetchPlatformSubsRange`, `fetchFirstSubTypeRange`, `fetchPlanDistributionRange`, `fetchCustomerSourceRange`, `fetchNewSubscribersRange`.
- Each takes `from`, `to`, and optional bucket string.

`src/app/components/admin/AdminDashboard.tsx`
- Add `bucketize(from,to)` returning `{ bucket, buckets: {start, label}[] }`.
- Replace the single `fetchAdminDashboard()` effect with per-chart effects keyed on `[range.from, range.to]` (and bucket for series charts) so switching date filter refetches everything.
- Rebuild each chart's `useMemo` off the new range-scoped data:
  - `wordsData` uses `admin_conversations_series` rows.
  - `newSubsOverTime` uses `admin_new_subs_series` rows, joined onto `buckets` to guarantee empty buckets render as 0.
  - Pie/bar charts (plans, first sub type, source, uninstalls, platform subs, zid/salla plan bars) read from the range-scoped RPCs.
  - "New Subscribers" list swaps `weekAgoIso` for `range.from`/`range.to` and drops the hard-coded "last 7 days" copy — helper text becomes "المشتركون خلال الفترة المحددة".
- All existing animations (`chartsLoaded`, motion, recharts `isAnimationActive`) preserved. Charts re-mount via the existing `key={…}` pattern when data changes, so bar/line/pie sweeps replay.
- Untouched: `serverStatus` grid, `OpenAIKeysCard`, `serverUsage` panel.

## Out of scope
- No changes to KPI cards (already range-aware via `admin_kpis`).
- No changes to Admin Reports page (`AdminReports.tsx`) — separate screen.
- No design/layout changes; only data wiring + x-axis labels.

## Technical notes (for reference)
- Empty range or "custom" without both dates → treat as "all time" (matches current KPI behavior).
- Weekday labels use Arabic short names when `language === 'ar'`, English otherwise.
- Series RPCs use `generate_series(date_trunc(_bucket, _from), date_trunc(_bucket, _to), (‘1 ’||_bucket)::interval)` inside a CTE so the DB emits zero-filled rows and the client doesn't need to synthesize gaps.
