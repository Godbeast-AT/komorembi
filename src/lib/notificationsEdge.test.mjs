import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readEdgeFunction() {
  return readFileSync(join(root, "supabase/functions/dispatch-notifications/index.ts"), "utf8");
}

test("dispatch-notifications Edge Function calls the database dispatcher", () => {
  const source = readEdgeFunction();

  assert.match(source, /rpc\("dispatch_queued_notifications"/i);
  assert.match(source, /notification_push_tokens/i);
  assert.match(source, /status:\s*"sent"/i);
  assert.match(source, /status:\s*"failed"/i);
});
