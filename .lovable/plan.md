## Goal
Stop the desktop chat window from floating upward and being cut/distorted on Zid product pages with a bottom sticky purchase bar.

## What is actually happening
The inspect screenshot shows the host page body is being scroll-locked with:

```text
position: fixed; top: -891.2px; overflow: hidden;
```

The widget is also detecting the sticky bottom bar and adding a large `bottomOffset`, so the open chat window gets positioned around:

```text
bottom: 198.8px
```

That means the window is lifted far above the bottom bar instead of visually following it, which is why it looks like it floats and gets clipped.

## Fix plan
1. Create `public/widget-4.7.31-hostinger.js` from the current `widget-4.7.30-hostinger.js`.
2. Change desktop open-window positioning so the chat window follows the bottom bar baseline instead of stacking above it:
   - keep the bubble offset behavior if needed,
   - but set the open desktop chat window bottom to a small fixed gap above the viewport/bottom bar area, not `90 + state.bottomOffset`.
3. Make desktop height safe without distortion:
   - remove fixed forced height behavior that can make it feel stretched,
   - use `height: min(580px, available viewport height)` logic only as a cap,
   - keep `min-height` reasonable.
4. Avoid body scroll-lock moving the host page on desktop:
   - keep mobile scroll lock untouched,
   - on desktop, do not apply `position: fixed; top: -scrollY` to the body because that is visible in the inspect screenshot and can shift/cut the page/widget context.
5. Bump the header version to `4.7.31`.
6. Copy the finished file to `/mnt/documents/widget-4.7.31-hostinger.js` for you to paste into Hostinger.