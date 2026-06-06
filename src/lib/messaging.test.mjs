import test from "node:test";
import assert from "node:assert/strict";

import {
  DAILY_MESSAGE_CAP,
  MESSAGE_MAX_CHARACTERS,
  canRetryExpiredConversation,
  canSendToday,
  validateMessageContent,
} from "./messaging.mjs";

test("message content is server-compatible at 1-500 characters", () => {
  assert.equal(MESSAGE_MAX_CHARACTERS, 500);
  assert.deepEqual(validateMessageContent(""), { ok: false, reason: "empty" });
  assert.deepEqual(validateMessageContent(" hello "), { ok: true, text: "hello" });
  assert.deepEqual(validateMessageContent("x".repeat(501)), { ok: false, reason: "too_long" });
});

test("daily message cap blocks the eleventh message", () => {
  assert.equal(DAILY_MESSAGE_CAP, 10);
  assert.equal(canSendToday(9), true);
  assert.equal(canSendToday(10), false);
  assert.equal(canSendToday(11), false);
});

test("expired opening messages can be retried only after seven days", () => {
  const now = new Date("2026-06-10T00:00:00.000Z");

  assert.equal(canRetryExpiredConversation("2026-06-03T00:00:00.000Z", now), true);
  assert.equal(canRetryExpiredConversation("2026-06-04T00:00:00.000Z", now), false);
});
