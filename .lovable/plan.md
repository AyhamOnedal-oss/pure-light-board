## Goal
Make ticket Notes notification counts behave exactly like this:

- Opening/closing/reopening a ticket adds one unread Notes activity each time.
- Opening the Notes panel for that ticket resets the count to `0`.
- Closing the Notes panel must keep the count at `0`.
- New status changes after that reset start counting again from `1`.

## Plan
1. **Stop status toggles from clearing the read marker to `0`**
   - Remove the current logic in `TicketsPage.tsx` that sets `ticketNotesSeen` to `0` after every ticket open/close.
   - This is causing old history to come back after the Notes panel is closed/reloaded.

2. **Reset using the newest visible activity timestamp**
   - When Notes is opened, set `ticketNotesSeen` slightly after the latest current activity timestamp for that ticket, not just `Date.now()`.
   - This ensures all currently shown status/note entries are marked read even if DB timestamps and browser time differ.

3. **Refresh local UI immediately**
   - After opening Notes, bump the local badge state and sidebar badge event so both the row badge and sidebar badge show `0` right away.

4. **Keep accumulation logic unchanged**
   - Continue counting every unread status activity individually: open → close → open = `3`.
   - Continue counting unread note activities too.

5. **No DB/bell/admin changes**
   - This plan only touches the frontend ticket Notes notification logic.