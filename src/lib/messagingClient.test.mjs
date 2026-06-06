import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Supabase service exposes first-message conversation RPCs", () => {
  const service = readProjectFile("src/services/supabase.ts");

  assert.match(service, /export async function sendOpeningMessage/i);
  assert.match(service, /rpc\("send_opening_message"/i);
  assert.match(service, /p_recipient_peer_id:\s*peerId/i);
  assert.match(service, /export async function sendChatMessage/i);
  assert.match(service, /rpc\("send_chat_message"/i);
});

test("discovery action sends an opening message instead of a legacy chat request", () => {
  const page = readProjectFile("src/app/page.tsx");

  assert.match(page, /const openingText = validation\.text \|\| ""/i);
  assert.match(page, /sendOpeningMessage\(userObj\.peer_id,\s*openingText\)/i);
  assert.match(page, /validateMessageContent\(openingMessage\)/i);
  assert.doesNotMatch(page, /send_chat_request/i);
  assert.doesNotMatch(page, /vibelink_mock_chats/i);
});
