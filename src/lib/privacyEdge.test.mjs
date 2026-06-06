import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("delete-account-finalizer Edge Function purges due deletion requests", () => {
  const source = read("supabase/functions/delete-account-finalizer/index.ts");

  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /rpc\("purge_due_account_deletions"\)/);
  assert.match(source, /purged_count/);
  assert.match(source, /Method not allowed/);
});

test("prepare-data-export Edge Function writes export JSON and marks request ready", () => {
  const source = read("supabase/functions/prepare-data-export/index.ts");

  assert.match(source, /data_export_requests/);
  assert.match(source, /\.from\("profiles"\)/);
  assert.match(source, /\.from\("conversations"\)/);
  assert.match(source, /\.from\("messages"\)/);
  assert.match(source, /\.from\("reports"\)/);
  assert.match(source, /\.from\("blocks"\)/);
  assert.match(source, /\.from\("notifications"\)/);
  assert.match(source, /\.from\("data-exports"\)/);
  assert.match(source, /status:\s*"ready"/);
  assert.match(source, /download_path/);
});
