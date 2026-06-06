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

test("conversation schema stores streak and meet prompt state", () => {
  const sql = readSql();

  assert.match(sql, /last_streak_date date/i);
  assert.match(sql, /next_meet_prompt_day integer NOT NULL DEFAULT 7/i);
  assert.match(sql, /meet_prompt_user1_response text/i);
  assert.match(sql, /meet_prompt_user2_response text/i);
  assert.match(sql, /meet_prompt_private_note_user_id uuid/i);
  assert.match(sql, /planning_banner_until timestamptz/i);
});

test("update_conversation_streaks counts mutual delivered-message days in IST", () => {
  const sql = readSql();
  const update = functionBlock(sql, "update_conversation_streaks");

  assert.match(update, /AT TIME ZONE 'Asia\/Kolkata'/i);
  assert.match(update, /bool_or\(m\.sender_user_id = c\.user1_id\)/i);
  assert.match(update, /bool_or\(m\.sender_user_id = c\.user2_id\)/i);
  assert.match(update, /delivery_state IN \('delivered',\s*'read'\)/i);
  assert.match(update, /current_streak\s*=\s*scored\.next_streak/i);
  assert.match(update, /last_streak_date\s*=\s*CASE WHEN scored\.both_sent THEN v_streak_date ELSE c\.last_streak_date END/i);
});

test("day-7 streak locks chat and queues lock notifications", () => {
  const sql = readSql();
  const update = functionBlock(sql, "update_conversation_streaks");

  assert.match(update, /status\s*=\s*CASE WHEN scored\.next_streak >= c\.next_meet_prompt_day THEN 'locked'/i);
  assert.match(update, /locked_at\s*=\s*CASE WHEN scored\.next_streak >= c\.next_meet_prompt_day THEN COALESCE\(c\.locked_at,\s*now\(\)\)/i);
  assert.match(update, /INSERT INTO public\.notifications[\s\S]*'Your chat with someone is locked'/i);
});

test("long streak milestones queue day 30, 60, and 100 notifications", () => {
  const sql = readSql();
  const update = functionBlock(sql, "update_conversation_streaks");

  assert.match(update, /current_streak IN \(30,\s*60,\s*100\)/i);
  assert.match(update, /You two have been talking for a while/i);
});

test("record_meet_prompt_response unlocks all prompt outcomes correctly", () => {
  const sql = readSql();
  const record = functionBlock(sql, "record_meet_prompt_response");

  assert.match(record, /p_response NOT IN \('yes',\s*'keep_chatting'\)/i);
  assert.match(record, /meet_prompt_user1_response\s*=\s*CASE WHEN auth\.uid\(\) = user1_id THEN p_response/i);
  assert.match(record, /meet_prompt_user2_response\s*=\s*CASE WHEN auth\.uid\(\) = user2_id THEN p_response/i);
  assert.match(record, /planning_banner_until\s*=\s*now\(\)\s*\+\s*interval '7 days'/i);
  assert.match(record, /meet_prompt_private_note_user_id\s*=\s*CASE WHEN v_conversation\.meet_prompt_user1_response = 'yes'/i);
  assert.match(record, /next_meet_prompt_day\s*=\s*CASE WHEN current_streak < 14 THEN 14 WHEN current_streak < 30 THEN 30 ELSE current_streak \+ 30 END/i);
  assert.match(record, /'You both said yes! Time to plan something.'/i);
});
