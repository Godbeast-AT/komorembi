import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(fileName) {
  return readFileSync(join(root, fileName), "utf8");
}

test("phase 7 schema creates waitlist entries and atomic referral bump RPCs", () => {
  const sql = readProjectFile("growth_notifications_schema.sql");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.waitlist_entries/i);
  assert.match(sql, /CREATE OR REPLACE VIEW public\.waitlist/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.waitlist_referrals/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.apply_invite_referral/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.join_waitlist/i);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('waitlist_referral_bump'\)\)/i);
  assert.match(sql, /queue_position\s*=\s*GREATEST\(1,\s*queue_position\s*-\s*v_bump\)/i);
});

test("phase 7 schema adds notification preferences and push queue scaffolding", () => {
  const sql = readProjectFile("growth_notifications_schema.sql");

  assert.match(sql, /notification_preferences\s+jsonb/i);
  assert.match(sql, /"likes":\s*true/i);
  assert.match(sql, /"chat_requests":\s*true/i);
  assert.match(sql, /"live_matches":\s*true/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_push_tokens/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_events/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.queue_notification_event/i);
});

test("phase 7 schema queues welcome, like, chat, and live-match triggers", () => {
  const sql = readProjectFile("growth_notifications_schema.sql");

  assert.match(sql, /profiles_after_insert_queue_welcome/i);
  assert.match(sql, /likes_after_insert_queue_push/i);
  assert.match(sql, /chats_after_insert_queue_request/i);
  assert.match(sql, /chats_after_update_queue_status/i);
  assert.match(sql, /waiting_room_after_match_queue_push/i);
});

test("phase 7 schema is documented in Supabase apply order", () => {
  const docs = readProjectFile("docs/supabase-setup.md");

  assert.match(docs, /growth_notifications_schema\.sql/);
  assert.match(docs, /join_waitlist/);
  assert.match(docs, /notification_events/);
});
