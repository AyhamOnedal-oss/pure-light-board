## Plan

1. **Fix the dashboard preview source of truth**
   - Update the Chat Customization preview so `settings_train_ai.bubble_visible = false` hides the entire widget mock, not only the floating icon and welcome bubble.
   - Replace the chat-panel mock with an “off” empty state or no widget content at all, so nothing chat-widget-related remains visible when disabled.

2. **Fix the standalone widget demo previews**
   - In `widget/src/app/App.tsx`, pass the fetched `settings.bubbleVisible` value into the internal device mock previews.
   - Hide the mock chat window, mini bubble, “all bubbles” overview, and live floating widget when `bubbleVisible === false`.

3. **Prevent stale on-load flashes**
   - Keep the existing `isReady` guard and make all preview rendering depend on loaded backend settings, so disabled widgets do not briefly appear with default values.

4. **Verify after implementation**
   - Reopen `/dashboard/settings/train-ai`, toggle Chat Bubble Visibility off, save, then check Chat Customization and the widget demo preview to confirm no bubble, welcome bubble, or chat panel remains visible.