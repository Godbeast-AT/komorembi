import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase_schema_mvp_core.sql"), "utf8");

function functionBlock(functionName) {
  const match = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
    "i",
  ).exec(sql);
  assert.ok(match, `${functionName} function exists`);
  return match[0];
}

test("Canvas 2 schema adds profile interests, premium, views, and identity merges", () => {
  for (const tableName of [
    "profile_hobbies",
    "profile_movies",
    "profile_music_artists",
    "premium_subscriptions",
    "profile_views",
    "auth_identity_merges",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${tableName}`, "i"), tableName);
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${tableName} ENABLE ROW LEVEL SECURITY`, "i"), tableName);
  }
});

test("Canvas 2 waitlist ratio uses preference demand threshold 1.3", () => {
  const ratio = functionBlock("calculate_preference_waitlist_ratio");
  const weight = functionBlock("preference_demand_weight");

  assert.match(ratio, /female_seekers/i);
  assert.match(ratio, /male_seekers/i);
  assert.match(ratio, /1\.3/i);
  assert.match(weight, /0\.5/i);
});

test("Canvas 2 merge RPC preserves better waitlist position transactionally", () => {
  const merge = functionBlock("merge_auth_identities");

  assert.match(merge, /LEAST/i);
  assert.match(merge, /waitlist_position_to_keep/i);
  assert.match(merge, /auth_identity_merges/i);
  assert.match(merge, /duplicate_user_id/i);
});

test("Canvas 2 notification schema includes onboarding interest reminder", () => {
  assert.match(sql, /onboarding_interest_reminder/i);
  assert.match(sql, /dispatch_queued_notifications[\s\S]*onboarding_interest_reminder/i);
});

test("Canvas 2 premium RPCs and profile views are declared", () => {
  for (const functionName of [
    "create_premium_checkout_session",
    "sync_premium_subscription",
    "record_profile_view",
    "get_profile_viewers",
    "set_timeline_preference",
    "save_profile_interests",
  ]) {
    functionBlock(functionName);
  }
});
