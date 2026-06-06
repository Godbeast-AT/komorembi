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

test("preference cap is calculated from active non-waitlisted city demand", () => {
  const sql = readSql();
  const cap = functionBlock(sql, "calculate_preference_waitlist_ratio");

  assert.match(cap, /female_seekers/i);
  assert.match(cap, /male_seekers/i);
  assert.match(cap, /preference_demand_weight\(gender_preference,\s*'female_seekers'\)/i);
  assert.match(cap, /preference_demand_weight\(gender_preference,\s*'male_seekers'\)/i);
  assert.match(cap, /is_waitlisted\s*=\s*false/i);
  assert.match(cap, /intention\s*=\s*p_dating_mode/i);
  assert.match(cap, /last_active_at\s*>=\s*now\(\)\s*-\s*interval\s+'30 days'/i);
  assert.match(cap, /'threshold',\s*v_threshold/i);
  assert.match(cap, /1\.3/i);
});

test("onboarding applies preference cap and admits waitlisted users after non-waitlisted completion", () => {
  const sql = readSql();
  const complete = functionBlock(sql, "complete_onboarding_profile");

  assert.match(complete, /public\.should_waitlist_preference_for_city\(p_city,\s*p_state,\s*p_intention,\s*p_gender_preference\)/i);
  assert.match(complete, /PERFORM public\.join_waitlist\(p_city,\s*p_state,\s*p_intention\)/i);
  assert.match(complete, /PERFORM public\.admit_waitlisted_users_for_city\(p_city,\s*p_state,\s*p_intention\)/i);
});

test("waitlist preview RPC returns only server-redacted fields", () => {
  const sql = readSql();
  const preview = functionBlock(sql, "discover_waitlist_preview");

  assert.match(preview, /RETURNS TABLE\(label text,\s*age_bucket text,\s*city text,\s*intention text\)/i);
  assert.match(preview, /'Someone nearby'::text AS label/i);
  assert.doesNotMatch(preview, /peer_id|user_id|username|display_name|bio|photos|image_path|thumbnail_path/i);
  assert.match(preview, /p\.is_waitlisted\s*=\s*false/i);
});

test("join and leave waitlist reset position instead of restoring the old one", () => {
  const sql = readSql();
  const join = functionBlock(sql, "join_waitlist");
  const leave = functionBlock(sql, "leave_waitlist");

  assert.match(join, /pg_advisory_xact_lock\(hashtext\('waitlist_city_queue:'\s*\|\|/i);
  assert.match(join, /COALESCE\(max\(queue_position\),\s*0\)\s*\+\s*1/i);
  assert.match(join, /queue_position\s*=\s*EXCLUDED\.queue_position/i);
  assert.match(join, /joined_at\s*=\s*now\(\)/i);
  assert.match(join, /admitted_at\s*=\s*NULL/i);
  assert.match(leave, /status\s*=\s*'left'/i);
  assert.match(leave, /left_at\s*=\s*now\(\)/i);
});

test("referral boost applies once per unique completed underrepresented preference signup", () => {
  const sql = readSql();
  const referral = functionBlock(sql, "apply_waitlist_referral");

  assert.match(referral, /preference_demand_weight\(v_referred_profile\.gender_preference,\s*'male_seekers'\)/i);
  assert.match(referral, /v_referred_profile\.is_complete\s*=\s*true/i);
  assert.match(referral, /ON CONFLICT\s*\(referred_user_id\)\s*DO NOTHING/i);
  assert.match(referral, /GET DIAGNOSTICS v_inserted_referrals = ROW_COUNT/i);
  assert.match(referral, /IF v_inserted_referrals = 0 THEN/i);
  assert.match(referral, /queue_position\s*=\s*GREATEST\(1,\s*queue_position\s*-\s*5\)/i);
});

test("admission loops in queue order only while post-admit ratio allows it", () => {
  const sql = readSql();
  const admit = functionBlock(sql, "admit_waitlisted_users_for_city");

  assert.match(admit, /ORDER BY queue_position ASC,\s*joined_at ASC/i);
  assert.match(admit, /preference_demand_weight\(gender_preference,\s*'female_seekers'\)\s*>\s*0/i);
  assert.match(admit, /\(v_female_seekers\s*\+\s*v_incoming_weight\)\s*\/\s*GREATEST\(v_male_seekers,\s*1\)\s*>\s*1\.3/i);
  assert.match(admit, /EXIT;/i);
  assert.match(admit, /status\s*=\s*'admitted'/i);
  assert.match(admit, /is_waitlisted\s*=\s*false/i);
});
