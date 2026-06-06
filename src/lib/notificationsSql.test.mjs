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

test("notification schema includes preferences and push token foundation", () => {
  const sql = readSql();

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_preferences/i);
  assert.match(sql, /quiet_hours_enabled boolean NOT NULL DEFAULT true/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_push_tokens/i);
  assert.match(sql, /category text NOT NULL CHECK \(category IN \('account_security', 'messages', 'streaks', 'waitlist', 'app_updates'\)\)/i);
});

test("dispatch_queued_notifications always permits account security notifications", () => {
  const sql = readSql();
  const dispatch = functionBlock(sql, "dispatch_queued_notifications");

  assert.match(dispatch, /category = 'account_security'/i);
  assert.match(dispatch, /Security notifications cannot be disabled/i);
});

test("dispatch_queued_notifications enforces preferences, quiet hours, and 3 per hour", () => {
  const sql = readSql();
  const dispatch = functionBlock(sql, "dispatch_queued_notifications");

  assert.match(dispatch, /AT TIME ZONE 'Asia\/Kolkata'/i);
  assert.match(dispatch, /time '23:00'/i);
  assert.match(dispatch, /time '08:00'/i);
  assert.match(dispatch, /sent_last_hour \+ due_rank <= 3/i);
  assert.match(dispatch, /THEN 'suppressed'/i);
  assert.match(dispatch, /THEN now\(\) \+ interval '1 hour'/i);
});
