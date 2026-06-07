## Change

Display the "Avg Response Time" KPI on the dashboard as **seconds only**, with the Arabic suffix **ث** after the number, so merchants immediately read it as seconds.

## Edit

`src/app/components/DashboardPage.tsx` — replace the `formatSeconds` helper so it always formats in seconds (no minutes):

```ts
function formatSeconds(s: number): string {
  if (!s || s < 0) return `0 ث`;
  // round to integer seconds; show 1 decimal only when under 10s
  const value = s < 10 ? s.toFixed(1) : Math.round(s).toString();
  return `${value} ث`;
}
```

No other files touched. The KPI tile already calls `formatSeconds(metrics.avgResponseSeconds)`.

## Verify

- Dashboard "متوسط وقت الاستجابة" tile shows e.g. `42 ث` or `7.3 ث`, never `1m 12s`.
