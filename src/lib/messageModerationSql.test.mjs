import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSql() {
  return readFileSync(join(root, "supabase_schema_mvp_core.sql"), "utf8");
}

function functionBlock(sql, functionName) {
  const match = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
    "i",
  ).exec(sql);
  assert.ok(match, `${functionName} function exists`);
  return match[0];
}

test("message moderation queue holds every accepted message before delivery", () => {
  const sql = readSql();
  const opening = functionBlock(sql, "send_opening_message");
  const chat = functionBlock(sql, "send_chat_message");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.message_moderation_queue/i);
  assert.match(sql, /ALTER TABLE public\.message_moderation_queue ENABLE ROW LEVEL SECURITY/i);
  assert.match(opening, /delivery_state\)\s*VALUES[\s\S]*'sent'[\s\S]*RETURNING id INTO v_message_id/i);
  assert.match(chat, /delivery_state\)\s*VALUES[\s\S]*'sent'[\s\S]*RETURNING id INTO v_message_id/i);
  assert.match(opening, /INSERT INTO public\.message_moderation_queue\s*\(message_id,\s*dating_mode\)\s*VALUES\s*\(v_message_id,\s*v_sender\.intention\)/i);
  assert.match(chat, /INSERT INTO public\.message_moderation_queue\s*\(message_id,\s*dating_mode\)\s*VALUES\s*\(v_message_id,\s*v_conversation\.dating_mode\)/i);
});

test("apply_message_moderation delivers safe and warn verdicts but flags blocks", () => {
  const sql = readSql();
  const apply = functionBlock(sql, "apply_message_moderation");

  assert.match(apply, /p_verdict\s+text/i);
  assert.match(apply, /v_verdict NOT IN \('safe',\s*'warn',\s*'block'\)/i);
  assert.match(apply, /delivery_state\s*=\s*CASE WHEN v_verdict = 'block' THEN 'flagged' ELSE 'delivered' END/i);
  assert.match(apply, /moderation_verdict\s*=\s*v_verdict/i);
  assert.match(apply, /INSERT INTO public\.moderation_events/i);
  assert.match(apply, /strike_delta[\s\S]*CASE WHEN v_verdict IN \('warn',\s*'block'\) THEN 1 ELSE 0 END/i);
  assert.match(apply, /UPDATE public\.message_moderation_queue[\s\S]*status\s*=\s*'processed'/i);
});

test("safe or warn delivery starts the pending expiry timer from moderation time", () => {
  const sql = readSql();
  const opening = functionBlock(sql, "send_opening_message");
  const apply = functionBlock(sql, "apply_message_moderation");

  assert.doesNotMatch(opening, /pending_expires_at[\s\S]*now\(\)\s*\+\s*interval\s+'3 days'/i);
  assert.match(apply, /UPDATE public\.conversations[\s\S]*delivered_at\s*=\s*COALESCE\(delivered_at,\s*now\(\)\)/i);
  assert.match(apply, /pending_expires_at\s*=\s*COALESCE\(pending_expires_at,\s*now\(\)\s*\+\s*interval\s+'3 days'\)/i);
});

test("strike escalation applies warning, message bans, and permanent ban thresholds", () => {
  const sql = readSql();
  const apply = functionBlock(sql, "apply_message_moderation");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS message_banned_until timestamptz/i);
  assert.match(apply, /v_new_warning_count\s*>=\s*10[\s\S]*is_banned\s*=\s*true/i);
  assert.match(apply, /v_new_warning_count\s*>=\s*8[\s\S]*message_banned_until\s*=\s*now\(\)\s*\+\s*interval\s+'7 days'/i);
  assert.match(apply, /v_new_warning_count\s*>=\s*5[\s\S]*message_banned_until\s*=\s*now\(\)\s*\+\s*interval\s+'24 hours'/i);
  assert.match(apply, /v_new_warning_count\s*=\s*3[\s\S]*Your account has been flagged/i);
});

test("blocked messages stay invisible to recipients and can be admin-overridden", () => {
  const sql = readSql();
  const override = functionBlock(sql, "admin_override_blocked_message");

  assert.match(sql, /delivery_state <> 'flagged' OR auth\.uid\(\) = sender_user_id/i);
  assert.match(override, /delivery_state\s*=\s*'delivered'/i);
  assert.match(override, /warning_count\s*=\s*GREATEST\(warning_count - 1,\s*0\)/i);
  assert.match(override, /reviewed_by\s*=\s*auth\.uid\(\)/i);
});
