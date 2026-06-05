## Phone field redesign

**Problems in current UI:**
- Country selector sits on the right (RTL start) and squeezes the input, hiding the "رقم الهاتف" placeholder.
- No flags — just country code letters.

**Fix:**
1. Force the phone row container to `dir="ltr"` so the flag + dial code sit on the **left** and the number input takes the remaining width on the right. Label "رقم الهاتف" above stays RTL.
2. Show a **flag emoji** next to the country code. Flags are derived from the ISO country code via Unicode regional-indicator characters — no extra library or asset needed (works in all modern browsers/OS).
   - Example: `SA` → 🇸🇦, `US` → 🇺🇸. Helper: `code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))`.
3. Make the country `<select>` compact (flag + `+966`), and give the phone input `flex-1 min-w-0` so the placeholder is always visible.
4. Country options listed as: `🇸🇦 +966 (SA)` sorted alphabetically by country code, default SA.

**Files touched:**
- `src/app/components/TeamPage.tsx` only (MemberModal phone block).

**Out of scope:** no new dependency; keeps `libphonenumber-js` for validation/formatting.
