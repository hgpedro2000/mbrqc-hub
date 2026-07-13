
CREATE POLICY "audit_photos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'audit-photos');
CREATE POLICY "audit_photos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "audit_photos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'audit-photos') WITH CHECK (bucket_id = 'audit-photos');
CREATE POLICY "audit_photos_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'audit-photos');
