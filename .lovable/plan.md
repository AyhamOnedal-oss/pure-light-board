## Problem

In dark mode, scrollbars render as bright white tracks/thumbs against the dark UI, which looks broken. The user wants them to be **black** so they blend in.

## Root cause

`src/styles/theme.css` styles scrollbars with `hsl(var(--border))` and `hsl(var(--muted-foreground) / 0.5)`, but in this project those tokens are stored as hex / `rgba(...)` values, not bare HSL channel triplets. The `hsl(...)` wrapper produces an invalid color, so the browser falls back to the default white scrollbar.

## Fix

Edit only `src/styles/theme.css` scrollbar block:

- Remove the broken `hsl(var(--...))` wrappers.
- In **dark mode**, force scrollbars to black:
  - `scrollbar-color: #000000 transparent;`
  - thumb `background-color: #000000;`
  - thumb hover: `#1a1a1a` (slightly lifted black so hover is still perceptible against the dark bg).
- In **light mode**, keep the subtle neutral look:
  - `scrollbar-color: var(--border) transparent;`
  - thumb `background-color: var(--border);`
  - thumb hover: `var(--muted-foreground)`.

Implementation:

```css
/* Light (default) */
* { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover { background-color: var(--muted-foreground); background-clip: padding-box; }
*::-webkit-scrollbar-corner { background: transparent; }

/* Dark — solid black to blend with dark surfaces */
.dark * { scrollbar-color: #000000 transparent; }
.dark *::-webkit-scrollbar-thumb { background-color: #000000; }
.dark *::-webkit-scrollbar-thumb:hover { background-color: #1a1a1a; }
```

No component files are touched.

## Verification

- Dashboard + conversations list in dark mode → scrollbar thumb is black, track transparent, blends into the dark panel.
- Light mode → scrollbar remains the subtle neutral border color.
