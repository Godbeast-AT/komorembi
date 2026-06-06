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

test("send_opening_message enforces standing, cap, duplicate pending, and length", () => {
  const sql = readSql();
  const send = functionBlock(sql, "send_opening_message");

  assert.match(send, /p_recipient_peer_id text/i);
  assert.match(send, /char_length\(trim\(p_content\)\) NOT BETWEEN 1 AND 500/i);
  assert.match(send, /v_sender\.is_banned\s*=\s*true/i);
  assert.match(send, /v_sender\.messages_sent_today\s*>=\s*10/i);
  assert.match(send, /v_existing\.status\s*=\s*'pending'/i);
  assert.match(send, /status\s*=\s*'pending'/i);
  assert.match(send, /delivery_state\)\s*VALUES[\s\S]*'sent'[\s\S]*RETURNING id INTO v_message_id/i);
  assert.match(send, /v_recipient\.intention\s*<>\s*v_sender\.intention/i);
  assert.match(send, /INSERT INTO public\.message_moderation_queue\s*\(message_id,\s*dating_mode\)\s*VALUES\s*\(v_message_id,\s*v_sender\.intention\)/i);
  assert.doesNotMatch(send, /pending_expires_at[\s\S]*now\(\)\s*\+\s*interval\s+'3 days'/i);
});

test("send_chat_message activates pending conversations only when recipient replies", () => {
  const sql = readSql();
  const send = functionBlock(sql, "send_chat_message");

  assert.match(send, /char_length\(trim\(p_content\)\) NOT BETWEEN 1 AND 500/i);
  assert.match(send, /v_sender\.messages_sent_today\s*>=\s*10/i);
  assert.match(send, /status NOT IN \('pending',\s*'active'\)/i);
  assert.match(send, /status = 'pending' AND opening_sender_id = auth\.uid\(\)/i);
  assert.match(send, /v_conversation\.dating_mode\s*=\s*v_sender\.intention/i);
  assert.match(send, /INSERT INTO public\.message_moderation_queue\s*\(message_id,\s*dating_mode\)\s*VALUES\s*\(v_message_id,\s*v_conversation\.dating_mode\)/i);
  assert.match(send, /messages_sent_today\s*=\s*messages_sent_today\s*\+\s*1/i);
});

test("expired conversations grey out for seven days and block retry until grace passes", () => {
  const sql = readSql();
  const opening = functionBlock(sql, "send_opening_message");
  const expiry = functionBlock(sql, "expire_pending_conversations");

  assert.match(opening, /v_existing\.status\s*=\s*'expired'/i);
  assert.match(opening, /v_existing\.expired_at\s*>\s*now\(\)\s*-\s*interval\s+'7 days'/i);
  assert.match(expiry, /SET status = 'expired'/i);
  assert.match(expiry, /expired_at = now\(\)/i);
  assert.match(expiry, /pending_expires_at <= now\(\)/i);
  assert.match(sql, /DELETE FROM public\.conversations[\s\S]*status = 'expired'[\s\S]*expired_at < now\(\) - interval '7 days'/i);
});
