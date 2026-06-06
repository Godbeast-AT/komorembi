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

test("discover_profiles enforces MVP eligibility and mutual preferences", () => {
  const sql = readSql();
  const discover = functionBlock(sql, "discover_profiles");

  assert.match(discover, /target\.intention\s*=\s*viewer\.intention/i);
  assert.match(discover, /public\.preference_allows_gender\(viewer\.gender_preference,\s*target\.gender\)/i);
  assert.match(discover, /public\.preference_allows_gender\(target\.gender_preference,\s*viewer\.gender\)/i);
  assert.match(discover, /target\.is_waitlisted\s*=\s*false/i);
  assert.match(discover, /target\.is_complete\s*=\s*true/i);
  assert.match(discover, /target\.is_visible\s*=\s*true/i);
  assert.match(discover, /target\.is_banned\s*=\s*false/i);
  assert.match(discover, /target\.last_active_at\s*>=\s*now\(\)\s*-\s*interval\s+'30 days'/i);
  assert.match(discover, /public\.blocks/i);
  assert.match(discover, /public\.reports/i);
});

test("discover_profiles ranks and paginates with session-level impressions", () => {
  const sql = readSql();
  const discover = functionBlock(sql, "discover_profiles");

  assert.match(discover, /p_limit integer DEFAULT 20/i);
  assert.match(discover, /p_session_id text/i);
  assert.match(discover, /public\.feed_impressions/i);
  assert.match(discover, /session_id\s*=\s*COALESCE\(p_session_id/i);
  assert.match(discover, /NOT EXISTS\s*\([\s\S]*public\.feed_impressions/i);
  assert.match(discover, /\(city\s*=\s*viewer_city\) DESC/i);
  assert.match(discover, /\(target_state\s*=\s*viewer_state\) DESC/i);
  assert.match(discover, /preferred_age_match DESC/i);
  assert.match(discover, /unseen_this_session DESC/i);
  assert.match(discover, /last_seen_at DESC/i);
  assert.match(discover, /created_at\s*>=\s*now\(\)\s*-\s*interval\s+'7 days'/i);
  assert.match(discover, /completeness_score DESC/i);
  assert.match(discover, /LIMIT COALESCE\(p_limit,\s*20\)/i);
});

test("discover_profiles returns prompt-first cards without like or match counts", () => {
  const sql = readSql();
  const discover = functionBlock(sql, "discover_profiles");

  assert.match(discover, /RETURNS TABLE\([\s\S]*profile_prompt text/i);
  assert.match(discover, /target\.bio AS profile_prompt/i);
  assert.doesNotMatch(discover, /common_interests_count|like_count|match_count|likes_count|matches_count/i);
});
