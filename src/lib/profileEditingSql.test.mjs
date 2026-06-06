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

test("Phase 12 schema stores edit timing, visibility, and display preferences", () => {
  const sql = readSql();

  assert.match(sql, /display_preferences jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS username_changed_at timestamptz/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS pending_city text/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS city_change_effective_at timestamptz/i);
  assert.match(sql, /is_visible boolean NOT NULL DEFAULT true/i);
});

test("Phase 12 public profile edits enforce photo minimum and completeness", () => {
  const sql = readSql();
  const updatePublic = functionBlock(sql, "update_profile_public_fields");

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.calculate_profile_completeness/i);
  assert.match(updatePublic, /coalesce\(array_length\(v_next_photos,\s*1\),\s*0\) < 2/i);
  assert.match(updatePublic, /p_is_visible boolean/i);
  assert.match(updatePublic, /display_preferences = COALESCE\(p_display_preferences, display_preferences\)/i);
  assert.match(updatePublic, /completeness_score = public\.calculate_profile_completeness/i);
});

test("Phase 12 username changes and city changes are time-gated", () => {
  const sql = readSql();
  const username = functionBlock(sql, "change_username");
  const city = functionBlock(sql, "request_city_change");
  const applyCity = functionBlock(sql, "apply_due_city_changes");

  assert.match(username, /username_changed_at > now\(\) - interval '30 days'/i);
  assert.match(username, /username_changed_at = now\(\)/i);
  assert.match(city, /city_change_effective_at = now\(\) \+ interval '1 hour'/i);
  assert.match(applyCity, /city = pending_city/i);
  assert.match(applyCity, /feed_invalidated_at = now\(\)/i);
  assert.match(sql, /cron\.schedule\('mvp_due_city_change_apply'/i);
});

test("Phase 12 data export keeps the 48-hour preparation target", () => {
  const sql = readSql();

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.data_export_requests/i);
  assert.match(sql, /due_at timestamptz NOT NULL DEFAULT \(now\(\) \+ interval '48 hours'\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.request_data_export/i);
});
