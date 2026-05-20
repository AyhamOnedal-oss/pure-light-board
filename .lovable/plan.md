## Finding

The widget is not failing to read `store.id`; it is doing exactly what the current data allows:

- The storefront script sees `storeUuid=cb2b687a-7d88-4ecf-8027-806782ac5cbe`.
- The matching `public.zid_connections` row has `store_id = null` and `store_url = null`.
- Recent OAuth/profile logs do not show a successful profile payload containing a numeric `store.id` for this store.

So the loader can only print `storeId=null` unless Zid Liquid renders `{{store.id}}` into the snippet or the backend stores the numeric ID after OAuth/API lookup.

## Plan

1. **Fix the snippet guidance**
   - Keep the merchant snippet as:
     ```html
     <script src="https://widget.fuqah.net/widget.js?v=20"
             charset="UTF-8"
             data-platform="zid"
             data-store-id="{{store.id}}"
             data-store-uuid="{{store.uuid}}"
             async></script>
     ```
   - Update repo docs/onboarding copy so both values are always requested.

2. **Make the widget log more diagnostic, not misleading**
   - If `data-store-id` is absent/unrendered but UUID is present, log that numeric `store.id` was not provided by the snippet instead of implying a loader bug.
   - Continue sending `store_uuid` and `domain` so tenant resolution still works.

3. **Backfill numeric `store_id` server-side where possible**
   - Improve `zid-oauth-callback` to search more profile response paths for numeric ID fields.
   - Add a small helper in the callback that recognizes likely fields such as `store.id`, `merchant.id`, `store_id`, and `merchant_id` while avoiding UUID values.
   - Save the numeric ID into `zid_connections.store_id` when found.

4. **Expose resolved DB identifiers back to the widget**
   - Update `widget-resolve` to return `store_id` and `store_uuid` from `zid_connections` along with `tenant_id`.
   - Update the generated widget so after `/widget-resolve`, if `STORE_ID` is still null but the backend returns a numeric `store_id`, it fills `STORE_ID` before chat/events.

5. **Generate v4.7.5 artifacts**
   - Produce `/mnt/documents/widget-4.7.5.js` and refresh `/mnt/documents/widget.js`.
   - Add a short `/mnt/documents/widget-v4.7.5-notes.md` explaining that UUID/domain still work, while numeric ID depends on rendered Liquid or OAuth/API backfill.

## Important note

This will make the widget robust, but for the current store the numeric ID will remain null until one of these happens:

- Zid actually renders `data-store-id="{{store.id}}"` in the snippet context, or
- a successful Zid OAuth/API response includes the numeric ID so we can backfill it into `zid_connections.store_id`.