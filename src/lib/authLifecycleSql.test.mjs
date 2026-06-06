import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(fileName) {
  return readFileSync(join(root, fileName), "utf8");
}

test("phase 1 auth lifecycle schema stores only phone hashes and device sessions", () => {
  const sql = readProjectFile("supabase_schema_auth_lifecycle.sql");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.user_auth_records/i);
  assert.match(sql, /phone_hash\s+text\s+NOT NULL/i);
  assert.doesNotMatch(sql, /phone_number/i);
  assert.doesNotMatch(sql, /phone\s+text/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.device_sessions/i);
  assert.match(sql, /user_id\s+uuid\s+NOT NULL\s+REFERENCES auth\.users\(id\)/i);
  assert.match(sql, /device_id\s+text\s+NOT NULL/i);
  assert.match(sql, /revoked_at\s+timestamptz/i);
  assert.match(sql, /UNIQUE\s*\(\s*user_id\s*,\s*device_id\s*\)/i);
});

test("phase 1 auth lifecycle schema enables RLS and own-user policies", () => {
  const sql = readProjectFile("supabase_schema_auth_lifecycle.sql");

  for (const table of [
    "user_auth_records",
    "device_sessions",
    "account_deletion_requests",
  ]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
    assert.match(sql, new RegExp(`auth\\.uid\\(\\)\\s+IS NOT NULL[\\s\\S]+auth\\.uid\\(\\)\\s*=\\s*user_id`, "i"));
  }
});

test("phase 1 auth lifecycle schema exposes session and deletion RPCs", () => {
  const sql = readProjectFile("supabase_schema_auth_lifecycle.sql");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_device_session/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.invalidate_all_sessions/i);
  assert.match(sql, /UPDATE public\.device_sessions[\s\S]+revoked_at\s*=\s*now\(\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.request_account_deletion/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.cancel_account_deletion/i);
});

test("phase 1 deletion RPC applies immediate soft-delete actions and 14-day purge", () => {
  const sql = readProjectFile("supabase_schema_auth_lifecycle.sql");

  assert.match(sql, /purge_after[\s\S]+interval\s+'14 days'/i);
  assert.match(sql, /close_active_conversations/i);
  assert.match(sql, /hide_profile_from_feed/i);
  assert.match(sql, /delete_profile_photos/i);
  assert.match(sql, /anonymize_sender_display/i);
  assert.match(sql, /Deleted User/i);
  assert.match(sql, /to_regclass\('public\.chats'\)/i);
  assert.match(sql, /to_regclass\('public\.profiles'\)/i);
  assert.match(sql, /storage\.objects/i);
});
