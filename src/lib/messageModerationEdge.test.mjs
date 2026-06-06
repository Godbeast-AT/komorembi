import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readEdgeFunction() {
  return readFileSync(join(root, "supabase/functions/moderate-message/index.ts"), "utf8");
}

test("moderate-message Edge Function checks all MVP moderation categories", () => {
  const source = readEdgeFunction();

  for (const category of [
    "direct_threats",
    "sexual_content",
    "personal_info",
    "hateful_language",
    "spam",
  ]) {
    assert.match(source, new RegExp(category, "i"), category);
  }

  assert.match(source, /type ModerationVerdict = "safe" \| "warn" \| "block"/i);
  assert.match(source, /normalizeVerdict/i);
});

test("moderate-message times out after five seconds and keeps messages queued", () => {
  const source = readEdgeFunction();

  assert.match(source, /const MESSAGE_MODERATION_TIMEOUT_MS = 5000/i);
  assert.match(source, /new AbortController\(\)/i);
  assert.match(source, /setTimeout\([\s\S]*MESSAGE_MODERATION_TIMEOUT_MS/i);
  assert.match(source, /signal,\s*$/im);
  assert.match(source, /catch[\s\S]*message_moderation_queue[\s\S]*status:\s*"queued"/i);
});

test("moderate-message applies completed verdicts through the atomic RPC", () => {
  const source = readEdgeFunction();

  assert.match(source, /rpc\("apply_message_moderation"/i);
  assert.match(source, /p_message_id:\s*message\.id/i);
  assert.match(source, /p_verdict:\s*moderation\.verdict/i);
  assert.match(source, /p_categories:\s*moderation\.categories/i);
});
