import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Supabase service exposes meet prompt responses", () => {
  const service = readProjectFile("src/services/supabase.ts");

  assert.match(service, /export async function recordMeetPromptResponse/i);
  assert.match(service, /rpc\("record_meet_prompt_response"/i);
  assert.match(service, /p_conversation_id:\s*conversationId/i);
  assert.match(service, /p_response:\s*response/i);
});

test("ChatView renders streak badge and locked meet prompt controls", () => {
  const chatView = readProjectFile("src/components/ChatView.tsx");

  assert.match(chatView, /Day \{selectedChat\.current_streak\}/i);
  assert.match(chatView, /Yes, let's meet/i);
  assert.match(chatView, /Keep chatting/i);
  assert.match(chatView, /recordMeetPromptResponse\(selectedChat\.id,\s*"yes"\)/i);
  assert.match(chatView, /recordMeetPromptResponse\(selectedChat\.id,\s*"keep_chatting"\)/i);
  assert.match(chatView, /selectedChat\.status === "locked"/i);
});
