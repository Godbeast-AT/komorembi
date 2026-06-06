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

function viewBlock(sql, viewName) {
  const match = new RegExp(
    `CREATE OR REPLACE VIEW public\\.${viewName}[\\s\\S]*?(?=CREATE OR REPLACE VIEW public\\.|CREATE OR REPLACE FUNCTION public\\.|CREATE INDEX|$)`,
    "i",
  ).exec(sql);
  assert.ok(match, `${viewName} view exists`);
  return match[0];
}

test("mode-specific tables are partitioned by dating_mode", () => {
  const sql = readSql();
  for (const table of [
    "waitlist_entries",
    "waitlist_referrals",
    "feed_impressions",
    "feed_filters",
    "conversations",
    "messages",
    "moderation_events",
    "message_moderation_queue",
    "notifications",
  ]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table}[\\s\\S]*ADD COLUMN IF NOT EXISTS dating_mode text`, "i"), table);
  }
  assert.match(sql, /CHECK \(dating_mode IN \('long_term', 'short_term'\)\)/i);
});

test("dating_mode composite indexes cover the hot paths", () => {
  const sql = readSql();

  assert.match(sql, /CREATE INDEX IF NOT EXISTS waitlist_entries_city_state_mode_position_idx[\s\S]+ON public\.waitlist_entries \(city, state, dating_mode, queue_position\)/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS conversations_mode_status_last_message_idx[\s\S]+ON public\.conversations \(dating_mode, status, last_message_at\)/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS messages_mode_delivery_created_idx[\s\S]+ON public\.messages \(dating_mode, delivery_state, created_at\)/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS feed_impressions_viewer_mode_target_idx[\s\S]+ON public\.feed_impressions \(viewer_user_id, dating_mode, viewed_user_id\)/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS feed_filters_user_mode_idx[\s\S]+ON public\.feed_filters \(user_id, dating_mode\)/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS notifications_user_mode_status_scheduled_idx[\s\S]+ON public\.notifications \(user_id, dating_mode, status, send_after\)/i);
});

test("preference waitlist ratio is independent per city state and dating_mode", () => {
  const sql = readSql();
  const ratio = functionBlock(sql, "calculate_preference_waitlist_ratio");
  const shouldWaitlist = functionBlock(sql, "should_waitlist_preference_for_city");
  const admit = functionBlock(sql, "admit_waitlisted_users_for_city");

  assert.match(ratio, /p_dating_mode text/i);
  assert.match(ratio, /intention\s*=\s*p_dating_mode/i);
  assert.match(shouldWaitlist, /p_dating_mode text/i);
  assert.match(shouldWaitlist, /public\.calculate_preference_waitlist_ratio\(p_city,\s*p_state,\s*p_dating_mode\)/i);
  assert.match(admit, /p_dating_mode text/i);
  assert.match(admit, /dating_mode\s*=\s*p_dating_mode/i);
});

test("onboarding and waitlist writes copy active intention into dating_mode", () => {
  const sql = readSql();
  const complete = functionBlock(sql, "complete_onboarding_profile");
  const join = functionBlock(sql, "join_waitlist");
  const referral = functionBlock(sql, "apply_waitlist_referral");

  assert.match(complete, /public\.should_waitlist_preference_for_city\(p_city,\s*p_state,\s*p_intention,\s*p_gender_preference\)/i);
  assert.match(complete, /public\.join_waitlist\(p_city,\s*p_state,\s*p_intention\)/i);
  assert.match(complete, /public\.admit_waitlisted_users_for_city\(p_city,\s*p_state,\s*p_intention\)/i);
  assert.match(join, /p_dating_mode text/i);
  assert.match(join, /dating_mode\)\s*VALUES[\s\S]*p_dating_mode/i);
  assert.match(referral, /v_referrer_entry\.dating_mode\s*=\s*v_referred_profile\.intention/i);
});

test("discovery and waitlist preview are mode isolated independently", () => {
  const sql = readSql();
  const discover = functionBlock(sql, "discover_profiles");
  const preview = functionBlock(sql, "discover_waitlist_preview");

  assert.match(discover, /target\.intention\s*=\s*viewer\.intention/i);
  assert.match(discover, /fi\.dating_mode\s*=\s*viewer\.intention/i);
  assert.match(preview, /viewer\.intention/i);
  assert.match(preview, /p\.intention\s*=\s*viewer\.intention/i);
  assert.match(preview, /'Someone nearby'::text AS label/i);
  assert.doesNotMatch(preview, /peer_id|user_id|username|display_name|bio|photos|image_path|thumbnail_path/i);
});

test("messages and conversations reject or avoid cross-mode collisions", () => {
  const sql = readSql();
  const opening = functionBlock(sql, "send_opening_message");
  const chat = functionBlock(sql, "send_chat_message");
  const expire = functionBlock(sql, "expire_pending_conversations");
  const streaks = functionBlock(sql, "update_conversation_streaks");

  assert.match(opening, /v_recipient\.intention\s*<>\s*v_sender\.intention/i);
  assert.match(opening, /RAISE EXCEPTION 'Recipient is not in your active dating mode'/i);
  assert.match(opening, /INSERT INTO public\.conversations[\s\S]*dating_mode/i);
  assert.match(opening, /INSERT INTO public\.messages[\s\S]*dating_mode/i);
  assert.match(opening, /INSERT INTO public\.message_moderation_queue[\s\S]*dating_mode/i);
  assert.match(chat, /v_conversation\.dating_mode\s*=\s*v_sender\.intention/i);
  assert.match(chat, /INSERT INTO public\.messages[\s\S]*dating_mode/i);
  assert.match(expire, /GROUP BY dating_mode/i);
  assert.match(streaks, /GROUP BY c\.id,\s*c\.dating_mode/i);
});

test("intention mode switch clears old mode state and writes structured audit", () => {
  const sql = readSql();
  const fn = functionBlock(sql, "change_sensitive_profile_field");

  for (const field of [
    "old_dating_mode",
    "new_dating_mode",
    "conversations_closed",
    "messages_archived",
    "waitlist_entry_retired",
    "new_mode_waitlisted",
    "timestamp",
  ]) {
    assert.match(fn, new RegExp(field, "i"), field);
  }

  assert.match(fn, /DELETE FROM public\.feed_impressions[\s\S]*dating_mode\s*=\s*v_old_dating_mode/i);
  assert.match(fn, /DELETE FROM public\.feed_filters[\s\S]*dating_mode\s*=\s*v_old_dating_mode/i);
  assert.match(fn, /UPDATE public\.waitlist_entries[\s\S]*status\s*=\s*'left'[\s\S]*dating_mode\s*=\s*v_old_dating_mode/i);
  assert.match(fn, /public\.should_waitlist_preference_for_city\(v_profile\.city,\s*v_profile\.state,\s*v_new_dating_mode,\s*v_profile\.gender_preference\)/i);
  assert.match(fn, /public\.join_waitlist\(v_profile\.city,\s*v_profile\.state,\s*v_new_dating_mode\)/i);
});

test("double switch cannot restore old mode conversations waitlist or feed state", () => {
  const sql = readSql();
  const fn = functionBlock(sql, "change_sensitive_profile_field");

  assert.doesNotMatch(fn, /status\s*=\s*'active'[\s\S]*v_old_dating_mode/i);
  assert.doesNotMatch(fn, /queue_position[\s\S]*previous/i);
  assert.doesNotMatch(fn, /restore/i);
  assert.match(fn, /status\s*=\s*'left'/i);
  assert.match(fn, /DELETE FROM public\.feed_impressions/i);
  assert.match(fn, /DELETE FROM public\.feed_filters/i);
});

test("notifications carry dating_mode and suppress stale mode-specific events", () => {
  const sql = readSql();
  const dispatch = functionBlock(sql, "dispatch_queued_notifications");

  assert.match(sql, /ALTER TABLE public\.notifications[\s\S]*ADD COLUMN IF NOT EXISTS dating_mode text/i);
  assert.match(dispatch, /due\.dating_mode IS NOT NULL[\s\S]*recipient\.intention <> due\.dating_mode/i);
  assert.match(dispatch, /category = 'account_security'/i);
  assert.match(sql, /dating_mode, category, title, body/i);
});

test("admin views expose dating_mode for mode-specific stats", () => {
  const sql = readSql();

  for (const view of [
    "admin_waitlists",
    "admin_daily_signups",
    "admin_gender_ratios",
    "admin_message_volume",
    "admin_blocked_messages",
  ]) {
    assert.match(viewBlock(sql, view), /dating_mode/i, `${view} includes dating_mode`);
  }
});
