import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "storage_setup.sql"), "utf8");

test("MVP storage setup creates the production buckets used by Edge Functions", () => {
  assert.match(sql, /'profile-photos'\s*,\s*'profile-photos'\s*,\s*true/i);
  assert.match(sql, /'data-exports'\s*,\s*'data-exports'\s*,\s*false/i);
  assert.doesNotMatch(sql, /bucket_id\s*=\s*'avatars'/i);
});

test("MVP storage setup keeps photo writes owner-scoped and export reads private", () => {
  assert.match(sql, /profile_photos_public_read/i);
  assert.match(sql, /profile_photos_owner_insert/i);
  assert.match(sql, /profile_photos_owner_update/i);
  assert.match(sql, /profile_photos_owner_delete/i);
  assert.match(sql, /auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/i);
  assert.match(sql, /data_exports_owner_read/i);
  assert.match(sql, /bucket_id\s*=\s*'data-exports'/i);
  assert.match(sql, /TO authenticated/i);
});

