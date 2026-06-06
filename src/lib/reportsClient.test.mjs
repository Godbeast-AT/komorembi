import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Phase 11 report and block actions use RPC service boundaries", () => {
  const service = readProjectFile("src/services/supabase.ts");

  assert.match(service, /export async function submitReport/i);
  assert.match(service, /rpc\("submit_report"/i);
  assert.match(service, /p_reported_peer_id:\s*reportedPeerId/i);
  assert.match(service, /export async function blockUser/i);
  assert.match(service, /rpc\("block_user"/i);
  assert.match(service, /p_blocked_peer_id:\s*blockedPeerId/i);
  assert.match(service, /export async function unblockUser/i);
  assert.match(service, /rpc\("unblock_user"/i);
  assert.match(service, /export async function loadOwnAccountSafetyStatus/i);
  assert.match(service, /export async function submitAccountAppeal/i);
  assert.match(service, /rpc\("submit_account_appeal"/i);
  assert.match(service, /export async function submitPreBanContext/i);
  assert.match(service, /rpc\("submit_pre_ban_context"/i);
});

test("Phase 11 replaces prompt-based reports with the bottom sheet", () => {
  const page = readProjectFile("src/app/page.tsx");
  const sheet = readProjectFile("src/components/ReportProfileSheet.tsx");

  assert.match(page, /ReportProfileSheet/i);
  assert.match(page, /setReportTargetPeerId\(idToReport\)/i);
  assert.match(page, /submitReport\(\{/i);
  assert.match(page, /REPORT_SUBMISSION_CONFIRMATION/i);
  assert.doesNotMatch(page, /Report reason:/i);
  assert.doesNotMatch(page, /Optional details for the moderation team/i);
  assert.doesNotMatch(page, /\.from\("reports"\)\.insert/i);
  assert.doesNotMatch(page, /\.from\("blocked_users"\)\.insert/i);

  assert.match(sheet, /REPORT_REASON_OPTIONS/i);
  assert.match(sheet, /maxLength=\{REPORT_DETAILS_MAX_LENGTH\}/i);
  assert.match(sheet, /Reports are reviewed separately from blocks/i);
});

test("Phase 11 shows banned-user messages on boot and appeal UI in settings", () => {
  const bootHook = readProjectFile("src/hooks/useAppBoot.ts");
  const page = readProjectFile("src/app/page.tsx");
  const settings = readProjectFile("src/components/SettingsView.tsx");

  assert.match(bootHook, /account_banned_until/i);
  assert.match(bootHook, /createTemporaryBanMessage/i);
  assert.match(bootHook, /createPermanentBanMessage/i);
  assert.match(page, /banMessage \|\|/i);

  assert.match(settings, /function AccountAppealsPanel/i);
  assert.match(settings, /loadOwnAccountSafetyStatus/i);
  assert.match(settings, /submitAccountAppeal/i);
  assert.match(settings, /What happened\?/i);
  assert.match(settings, /Why do you think this decision was wrong\?/i);
  assert.match(settings, /APPEAL_COMBINED_MAX_LENGTH/i);
  assert.match(settings, /canSubmitAppeal/i);
});

test("Phase 11 block list unblocks through the RPC", () => {
  const panel = readProjectFile("src/components/BlockListPanel.tsx");
  const helpers = readProjectFile("src/lib/profileSettings.mjs");

  assert.match(helpers, /"blocks"/i);
  assert.match(panel, /unblockUser\(account\.blockedPeerId\)/i);
  assert.doesNotMatch(panel, /\.delete\(\)[\s\S]*blocked_peer_id/i);
});

test("Phase 11 founder dashboard reads all admin views", () => {
  const dashboard = readProjectFile("src/components/AdminDashboardView.tsx");

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
    assert.match(dashboard, new RegExp(view, "i"), view);
  }
});
