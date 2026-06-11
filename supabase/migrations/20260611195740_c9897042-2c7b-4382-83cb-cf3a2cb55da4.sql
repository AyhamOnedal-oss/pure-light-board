-- RLS policies for the ticket-notes storage bucket.
-- Path convention: {tenant_id}/{ticket_id}/{uuid}-{filename}
-- A user can read/write a file iff they are a member of the tenant whose
-- UUID is the first folder of the object name.

DROP POLICY IF EXISTS "ticket-notes: tenant members can read" ON storage.objects;
CREATE POLICY "ticket-notes: tenant members can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-notes'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "ticket-notes: tenant members can insert" ON storage.objects;
CREATE POLICY "ticket-notes: tenant members can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-notes'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "ticket-notes: tenant members can delete" ON storage.objects;
CREATE POLICY "ticket-notes: tenant members can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-notes'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );