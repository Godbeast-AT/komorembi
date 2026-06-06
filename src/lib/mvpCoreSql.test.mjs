import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(fileName) {
  return readFileSync(join(root, fileName), "utf8");
}

test("phase 2 core schema creates every MVP table", () => {
  const sql = readProjectFile("supabase_schema_mvp_core.sql");

  for (const table of [
    "profiles",
    "onboarding_progress",
    "profile_photos",
    "feed_impressions",
    "feed_filters",
    "waitlist_entries",
    "waitlist_referrals",
    "conversations",
    "messages",
    "moderation_events",
    "message_moderation_queue",
    "reports",
    "blocks",
    "notifications",
    "notification_preferences",
    "notification_push_tokens",
    "admin_actions",
    "appeals_queue",
    "pre_ban_context_submissions",
    "data_export_requests",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"), table);
  }
});

test("phase 2 core schema enables RLS on exposed tables", () => {
  const sql = readProjectFile("supabase_schema_mvp_core.sql");

  for (const table of [
    "profiles",
    "onboarding_progress",
    "profile_photos",
    "feed_impressions",
    "feed_filters",
    "waitlist_entries",
    "waitlist_referrals",
    "conversations",
    "messages",
    "moderation_events",
    "message_moderation_queue",
    "reports",
    "blocks",
    "notifications",
    "notification_preferences",
    "notification_push_tokens",
    "admin_actions",
    "appeals_queue",
    "pre_ban_context_submissions",
    "data_export_requests",
  ]) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"), table);
  }
});

test("phase 2 uses RPC contracts for privileged operations", () => {
  const sql = readProjectFile("supabase_schema_mvp_core.sql");

  for (const fn of [
    "check_username_availability",
    "complete_onboarding_profile",
    "change_sensitive_profile_field",
    "calculate_profile_completeness",
    "update_profile_public_fields",
    "change_username",
    "request_city_change",
    "apply_due_city_changes",
    "discover_profiles",
    "discover_waitlist_preview",
    "join_waitlist",
    "leave_waitlist",
    "apply_waitlist_referral",
    "admit_waitlisted_users_for_city",
    "send_opening_message",
    "send_chat_message",
    "apply_message_moderation",
    "admin_override_blocked_message",
    "mark_messages_read",
    "expire_pending_conversations",
    "update_conversation_streaks",
    "record_meet_prompt_response",
    "dispatch_queued_notifications",
    "block_user",
    "submit_report",
    "evaluate_report_thresholds",
    "submit_account_appeal",
    "resolve_account_appeal",
    "submit_pre_ban_context",
    "start_contextual_pre_ban_review",
    "reinstate_expired_account_bans",
    "request_data_export",
  ]) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`, "i"), fn);
  }
});

test("change_sensitive_profile_field is transactional and closes conversations atomically", () => {
  const sql = readProjectFile("supabase_schema_mvp_core.sql");
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.change_sensitive_profile_field[\s\S]+?\$\$;/i)?.[0] ?? "";

  assert.match(fn, /LANGUAGE plpgsql/i);
  assert.match(fn, /p_warning_acknowledged\s+boolean/i);
  assert.match(fn, /IF\s+NOT\s+p_warning_acknowledged/i);
  assert.match(fn, /UPDATE public\.profiles[\s\S]+SET[\s\S]+intention|gender|gender_preference/i);
  assert.match(fn, /UPDATE public\.conversations[\s\S]+status\s*=\s*'closed'/i);
  assert.match(fn, /UPDATE public\.messages[\s\S]+archived_at\s*=\s*now\(\)/i);
  assert.match(fn, /UPDATE public\.profiles[\s\S]+feed_invalidated_at\s*=\s*now\(\)/i);
  assert.match(fn, /INSERT INTO public\.admin_actions/i);
});

test("phase 2 scheduled job SQL covers daily resets, expiry, purge, archival, and deletion", () => {
  const sql = readProjectFile("supabase_schema_mvp_core.sql");

  for (const job of [
    "mvp_daily_ist_message_reset",
    "mvp_pending_conversation_expiry",
    "mvp_expired_conversation_purge",
    "mvp_blocked_message_purge",
    "mvp_report_archival",
    "mvp_account_deletion_purge",
  ]) {
    assert.match(sql, new RegExp(`cron\\.schedule\\('${job}'`, "i"), job);
  }
});
