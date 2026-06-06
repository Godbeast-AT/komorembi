import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSql(fileName) {
  return readFileSync(join(root, fileName), "utf8");
}

test("phase 6 trust engine uses launch brackets and deductions", () => {
  const trustSql = readSql("trust_engine_schema.sql");

  assert.match(trustSql, /v_deduction\s*:=\s*2;/);
  assert.match(trustSql, /v_deduction\s*:=\s*5;/);
  assert.match(trustSql, /skip_rate\s*>\s*0\.8/);
  assert.match(trustSql, /trust_score,\s*100\)\s*>=\s*80/);
  assert.doesNotMatch(trustSql, /trust_score,\s*100\)\s*>\s*120/);
});

test("phase 6 reports schema constrains reasons and auto-flags repeated reports", () => {
  const authSql = readSql("supabase_schema_auth_security.sql");

  for (const reason of [
    "harassment",
    "spam",
    "fake profile",
    "inappropriate content",
    "underage concern",
    "other",
  ]) {
    assert.match(authSql, new RegExp(`'${reason}'`));
  }

  assert.match(authSql, /reason_detail\s+text/);
  assert.match(authSql, /session_context\s+jsonb/);
  assert.match(authSql, /resolved\s+boolean\s+DEFAULT\s+false/i);
  assert.match(authSql, /count\(\*\).*interval\s+'24 hours'/s);
  assert.match(authSql, /flagged_for_review\s*=\s*true/);
});

test("phase 6 moderation and ban SQL stays admin gated", () => {
  const authSql = readSql("supabase_schema_auth_security.sql");

  assert.match(authSql, /moderation_queue\s+WITH\s+\(security_invoker\s*=\s*true\)/);
  assert.match(authSql, /public\.is_admin\(\)/);
  assert.match(authSql, /public\.moderation_clear_flag/);
  assert.match(authSql, /public\.moderation_warn_user/);
  assert.match(authSql, /public\.moderation_ban_user/);
  assert.match(authSql, /INSERT\s+INTO\s+public\.banned_devices/i);
});

test("phase 6 profile and message policies are tightened", () => {
  const coreSql = readSql("supabase_schema.sql");
  const chatSql = readSql("chat_approval_schema.sql");

  assert.doesNotMatch(coreSql, /CREATE POLICY "Allow public read"/);
  assert.doesNotMatch(coreSql, /CREATE POLICY "Allow anonymous profile management"/);
  assert.match(coreSql, /CREATE POLICY "Authenticated users can read profiles"/);
  assert.match(chatSql, /Messages approved participants can read/);
  assert.match(chatSql, /Messages approved participants can send/);
});

test("phase 6 account deletion scaffolding anonymizes and removes queues", () => {
  const authSql = readSql("supabase_schema_auth_security.sql");

  assert.match(authSql, /public\.delete_current_user_account/);
  assert.match(authSql, /UPDATE\s+public\.profiles[\s\S]*display_name\s*=/i);
  assert.match(authSql, /DELETE\s+FROM\s+storage\.objects/i);
  assert.match(authSql, /DELETE\s+FROM\s+public\.waiting_room/i);
  assert.match(authSql, /DELETE\s+FROM\s+public\.chats/i);
});
