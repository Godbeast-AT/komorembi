import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSql() {
  return readFileSync(join(root, "supabase_schema_mvp_core.sql"), "utf8");
}

test("complete_onboarding_profile is atomic and enforces age and two photos server-side", () => {
  const sql = readSql();
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.complete_onboarding_profile[\s\S]+?\$\$;/i)?.[0] ?? "";

  assert.match(fn, /p_photo_paths\s+text\[\]/i);
  assert.match(fn, /current_date\s+-\s*interval\s+'18 years'/i);
  assert.match(fn, /cardinality\(p_photo_paths\)\s*<\s*2/i);
  assert.match(fn, /INSERT INTO public\.profiles/i);
  assert.match(fn, /INSERT INTO public\.profile_photos/i);
  assert.match(fn, /INSERT INTO public\.onboarding_progress/i);
});

test("username availability is server-side and never exposes the banned list", () => {
  const sql = readSql();
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.check_username_availability[\s\S]+?\$\$;/i)?.[0] ?? "";

  assert.match(fn, /\^\[a-z\]\[a-z0-9_\]\{2,19\}\$/i);
  assert.match(fn, /RETURN jsonb_build_object\('status', 'banned'\)/i);
  assert.doesNotMatch(fn, /SELECT\s+\*\s+FROM\s+public\.banned/i);
});

test("discovery RPC excludes incomplete profiles", () => {
  const sql = readSql();
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.discover_profiles[\s\S]+?\$\$;/i)?.[0] ?? "";

  assert.match(fn, /target\.is_complete\s*=\s*true/i);
  assert.match(fn, /target\.is_waitlisted\s*=\s*false/i);
});

