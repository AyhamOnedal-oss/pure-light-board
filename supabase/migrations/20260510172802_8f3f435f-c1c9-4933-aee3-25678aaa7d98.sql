do $$
declare
  target_tenant uuid := '95663988-c0b4-47d7-aa10-054d7be06fb3';
  old_tenant uuid := 'ec4fa554-c8dd-4d5b-984e-77c62f7cbe43';
  live_store_uuid text := '15afa8a9-19d9-46b2-ad12-75aa1f43e3c5';
  numeric_store_id text := '3128909';
begin
  -- Free the unique store_id from the seed row
  update public.zid_connections
  set store_id = null, is_active = false, connection_status = 'superseded', updated_at = now()
  where tenant_id = target_tenant and store_uuid = 'zid-3128909';

  -- Repoint live row (UUID) to the target workspace and assign numeric id
  update public.zid_connections
  set tenant_id = target_tenant,
      store_id = numeric_store_id,
      is_active = true,
      connection_status = 'connected',
      updated_at = now()
  where store_uuid = live_store_uuid;

  -- Sync workspace identifiers
  update public.settings_workspace
  set zid_store_uuid = live_store_uuid,
      external_store_id = numeric_store_id,
      updated_at = now()
  where id = target_tenant;

  update public.settings_workspace
  set zid_store_uuid = null, external_store_id = null, updated_at = now()
  where id = old_tenant;
end $$;