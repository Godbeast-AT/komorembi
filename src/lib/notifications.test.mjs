import test from "node:test";
import assert from "node:assert/strict";
import {
  canDisableNotificationCategory,
  canSendWithinHourlyCap,
  isQuietHourIst,
  normalizeMvpNotificationPreferences,
  shouldDeliverNotificationCategory,
} from "./notifications.mjs";

test("security notifications cannot be disabled", () => {
  assert.equal(canDisableNotificationCategory("account_security"), false);
  assert.equal(shouldDeliverNotificationCategory("account_security", { account_security: false }), true);
});

test("optional notification categories respect preferences", () => {
  const preferences = normalizeMvpNotificationPreferences({ messages: false, streaks: true });

  assert.equal(shouldDeliverNotificationCategory("messages", preferences), false);
  assert.equal(shouldDeliverNotificationCategory("streaks", preferences), true);
  assert.equal(shouldDeliverNotificationCategory("waitlist", preferences), true);
});

test("quiet hours are 11pm through 8am IST unless disabled", () => {
  assert.equal(isQuietHourIst("2026-06-04T17:29:00.000Z"), false);
  assert.equal(isQuietHourIst("2026-06-04T17:31:00.000Z"), true);
  assert.equal(isQuietHourIst("2026-06-05T02:29:00.000Z"), true);
  assert.equal(isQuietHourIst("2026-06-05T02:31:00.000Z"), false);
  assert.equal(isQuietHourIst("2026-06-04T17:31:00.000Z", { quiet_hours_enabled: false }), false);
});

test("notification cap allows at most three sends per hour", () => {
  assert.equal(canSendWithinHourlyCap(0, 1), true);
  assert.equal(canSendWithinHourlyCap(2, 1), true);
  assert.equal(canSendWithinHourlyCap(2, 2), false);
  assert.equal(canSendWithinHourlyCap(3, 1), false);
});
