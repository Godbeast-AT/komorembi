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
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`,
    "i",
  ).exec(sql);
  assert.ok(match, `${functionName} function exists`);
  return match[0];
}

test("Phase 11 block_user resolves by peer id and closes conversations", () => {
  const sql = readSql();
  const block = functionBlock(sql, "block_user");

  assert.match(sql, /DROP FUNCTION IF EXISTS public\.block_user\(uuid\)/i);
  assert.match(block, /p_blocked_peer_id text/i);
  assert.match(block, /WHERE peer_id = p_blocked_peer_id/i);
  assert.match(block, /INSERT INTO public\.blocks/i);
  assert.match(block, /blocker_peer_id/i);
  assert.match(block, /blocked_peer_id/i);
  assert.match(block, /UPDATE public\.conversations[\s\S]*status = 'closed'/i);
  assert.match(block, /INSERT INTO public\.admin_actions/i);
});

test("Phase 11 unblock_user removes only the caller's block", () => {
  const sql = readSql();
  const unblock = functionBlock(sql, "unblock_user");

  assert.match(unblock, /p_blocked_peer_id text/i);
  assert.match(unblock, /DELETE FROM public\.blocks/i);
  assert.match(unblock, /blocker_user_id = auth\.uid\(\)/i);
  assert.match(unblock, /blocked_user_id = v_blocked\.user_id/i);
});

test("Phase 11 submit_report validates reason, details, and high-volume reporters", () => {
  const sql = readSql();
  const report = functionBlock(sql, "submit_report");

  assert.match(sql, /DROP FUNCTION IF EXISTS public\.submit_report\(uuid,\s*text,\s*text\)/i);
  assert.match(report, /p_reported_peer_id text/i);
  assert.match(report, /p_reason NOT IN \('fake_profile', 'harassment', 'inappropriate_photos', 'scammer', 'underage_user', 'other'\)/i);
  assert.match(report, /char_length\(coalesce\(p_details,\s*''\)\) > 300/i);
  assert.match(report, /SELECT count\(\*\) >= 10 INTO v_high_volume/i);
  assert.match(report, /reported_id/i);
  assert.match(report, /high_volume_reporter/i);
  assert.match(report, /INSERT INTO public\.admin_actions/i);
  assert.match(report, /PERFORM public\.evaluate_report_thresholds\(v_reported\.user_id\)/i);
  assert.doesNotMatch(report, /INSERT INTO public\.blocks/i);
});

test("Phase 11 report thresholds count unique non-dismissed reporters and apply bans", () => {
  const sql = readSql();
  const evaluate = functionBlock(sql, "evaluate_report_thresholds");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS account_banned_until timestamptz/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS high_risk_flag boolean NOT NULL DEFAULT false/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS phone_hash_blocked boolean NOT NULL DEFAULT false/i);
  assert.match(evaluate, /SELECT DISTINCT reporter_user_id/i);
  assert.match(evaluate, /status NOT IN \('dismissed', 'archived'\)/i);
  assert.match(evaluate, /v_confirmed_count >= 5[\s\S]*report_5_24h/i);
  assert.match(evaluate, /v_confirmed_count >= 20[\s\S]*report_20_7d/i);
  assert.match(evaluate, /v_confirmed_count >= 30[\s\S]*report_30_permanent/i);
  assert.match(evaluate, /account_banned_until = v_banned_until/i);
  assert.match(evaluate, /phone_hash_blocked = true/i);
  assert.match(evaluate, /An account you reported has been reviewed and action has been taken/i);
  assert.match(sql, /cron\.schedule\('mvp_expired_account_ban_reinstatement'/i);
});

test("Phase 11 appeal and contextual pre-ban RPCs enforce caps and audit decisions", () => {
  const sql = readSql();
  const submitAppeal = functionBlock(sql, "submit_account_appeal");
  const resolveAppeal = functionBlock(sql, "resolve_account_appeal");
  const submitContext = functionBlock(sql, "submit_pre_ban_context");
  const startContext = functionBlock(sql, "start_contextual_pre_ban_review");

  assert.match(submitAppeal, /char_length\(coalesce\(p_what_happened,\s*''\)\) \+ char_length\(coalesce\(p_why_wrong,\s*''\)\) > 500/i);
  assert.match(submitAppeal, /v_profile\.is_banned = false AND v_profile\.flagged_for_review = false/i);
  assert.match(submitAppeal, /INSERT INTO public\.appeals_queue/i);
  assert.match(resolveAppeal, /p_decision NOT IN \('upheld', 'overturned'\)/i);
  assert.match(resolveAppeal, /status = p_decision/i);
  assert.match(resolveAppeal, /appeal_overturned/i);
  assert.match(resolveAppeal, /appeal_upheld/i);
  assert.match(resolveAppeal, /INSERT INTO public\.admin_actions/i);
  assert.match(submitContext, /char_length\(coalesce\(p_context_text,\s*''\)\) > 500/i);
  assert.match(startContext, /now\(\) \+ interval '48 hours'/i);
  assert.match(startContext, /human-reviewed ban longer than 24 hours/i);
});

test("Phase 11 admin dashboard views exist and use security invoker", () => {
  const sql = readSql();

  for (const view of [
    "admin_users",
    "admin_reports",
    "admin_blocked_messages",
    "admin_waitlists",
    "admin_signup_stats",
    "admin_gender_ratios",
    "admin_message_volume",
    "admin_appeals_queue",
    "admin_pre_ban_context_submissions",
  ]) {
    assert.match(
      sql,
      new RegExp(`CREATE OR REPLACE VIEW public\\.${view}\\s+WITH \\(security_invoker = true\\)`, "i"),
      view,
    );
  }

  assert.match(sql, /high_volume_reporter/i);
  assert.match(sql, /WHERE m\.delivery_state = 'flagged'/i);
  assert.match(sql, /male_to_female_ratio/i);
  assert.match(sql, /total_messages/i);
});
