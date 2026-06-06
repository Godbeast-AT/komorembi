import test from "node:test";
import assert from "node:assert/strict";
import {
  MESSAGE_MODERATION_TIMEOUT_MS,
  moderationRestrictionForStrikeCount,
  normalizeModerationVerdict,
  strikeDeltaForVerdict,
  verdictDeliversToRecipient,
} from "./messageModeration.mjs";

test("message moderation verdicts normalize to safe, warn, or block", () => {
  assert.equal(normalizeModerationVerdict("SAFE"), "safe");
  assert.equal(normalizeModerationVerdict("warn"), "warn");
  assert.equal(normalizeModerationVerdict("block"), "block");
  assert.equal(normalizeModerationVerdict("unexpected"), "block");
});

test("warn and block count as strikes while safe delivers without a strike", () => {
  assert.equal(strikeDeltaForVerdict("safe"), 0);
  assert.equal(strikeDeltaForVerdict("warn"), 1);
  assert.equal(strikeDeltaForVerdict("block"), 1);
  assert.equal(verdictDeliversToRecipient("safe"), true);
  assert.equal(verdictDeliversToRecipient("warn"), true);
  assert.equal(verdictDeliversToRecipient("block"), false);
});

test("strike thresholds match the MVP escalation ladder", () => {
  const now = new Date("2026-06-04T00:00:00.000Z");

  assert.deepEqual(moderationRestrictionForStrikeCount(2, now), { type: "none" });
  assert.deepEqual(moderationRestrictionForStrikeCount(3, now), { type: "warning" });
  assert.deepEqual(moderationRestrictionForStrikeCount(5, now), {
    type: "message_ban",
    until: "2026-06-05T00:00:00.000Z",
  });
  assert.deepEqual(moderationRestrictionForStrikeCount(8, now), {
    type: "message_ban",
    until: "2026-06-11T00:00:00.000Z",
  });
  assert.deepEqual(moderationRestrictionForStrikeCount(10, now), { type: "permanent_ban" });
});

test("AI moderation timeout target is five seconds", () => {
  assert.equal(MESSAGE_MODERATION_TIMEOUT_MS, 5000);
});
