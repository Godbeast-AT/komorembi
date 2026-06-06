-- MVP storage buckets and policies.
-- Apply after supabase_schema_mvp_core.sql.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profile-photos', 'profile-photos', true),
  ('data-exports', 'data-exports', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_owner_insert" ON storage.objects;
CREATE POLICY "profile_photos_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "profile_photos_owner_update" ON storage.objects;
CREATE POLICY "profile_photos_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;
CREATE POLICY "profile_photos_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "data_exports_owner_read" ON storage.objects;
CREATE POLICY "data_exports_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'data-exports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
