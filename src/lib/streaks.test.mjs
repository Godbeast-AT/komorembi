import test from "node:test";
import assert from "node:assert/strict";
import * as streaks from "./streaks.mjs";

const {
  countMutualDailyStreak,
  nextMeetPromptDay,
  resolveMeetPromptOutcome,
  toIstDateKey,
} = streaks;

test("streak dates are evaluated in IST", () => {
  assert.equal(toIstDateKey("2026-06-03T18:20:00.000Z"), "2026-06-03");
  assert.equal(toIstDateKey("2026-06-03T18:40:00.000Z"), "2026-06-04");
});

test("streak days count only when both users sent a message", () => {
  const rows = [
    { dateKey: "2026-06-01", user1Sent: true, user2Sent: true },
    { dateKey: "2026-06-02", user1Sent: true, user2Sent: true },
    { dateKey: "2026-06-03", user1Sent: true, user2Sent: false },
    { dateKey: "2026-06-04", user1Sent: true, user2Sent: true },
  ];

  assert.equal(countMutualDailyStreak(rows, "2026-06-02"), 2);
  assert.equal(countMutualDailyStreak(rows, "2026-06-04"), 1);
});

test("meet prompt schedule goes day 7, day 14, day 30, then monthly", () => {
  assert.equal(nextMeetPromptDay(0), 7);
  assert.equal(nextMeetPromptDay(7), 14);
  assert.equal(nextMeetPromptDay(14), 30);
  assert.equal(nextMeetPromptDay(30), 60);
  assert.equal(nextMeetPromptDay(60), 90);
});

test("timeline preferences set the first meet prompt day", () => {
  const { resolveTimelinePromptDay } = streaks;
  assert.equal(typeof resolveTimelinePromptDay, "function");
  assert.equal(resolveTimelinePromptDay("daily"), 3);
  assert.equal(resolveTimelinePromptDay("one_week"), 7);
  assert.equal(resolveTimelinePromptDay("two_weeks"), 14);
  assert.equal(resolveTimelinePromptDay("one_month"), 30);
  assert.equal(resolveTimelinePromptDay("two_months"), 60);
  assert.equal(resolveTimelinePromptDay("unknown"), 7);
});

test("conversation prompt day uses the earlier of two user timeline preferences", () => {
  const { resolveConversationPromptDay } = streaks;
  assert.equal(typeof resolveConversationPromptDay, "function");
  assert.equal(resolveConversationPromptDay("one_week", "two_weeks"), 7);
  assert.equal(resolveConversationPromptDay("one_month", "two_weeks"), 14);
  assert.equal(resolveConversationPromptDay(undefined, "two_months"), 7);
});

test("meet prompt outcomes unlock with the correct private or shared result", () => {
  assert.deepEqual(resolveMeetPromptOutcome("yes", undefined, 7), { status: "waiting" });
  assert.deepEqual(resolveMeetPromptOutcome("yes", "yes", 7), {
    status: "both_yes",
    planningBannerDays: 7,
  });
  assert.deepEqual(resolveMeetPromptOutcome("yes", "keep_chatting", 7), {
    status: "one_yes",
    privateNoteFor: "user1",
  });
  assert.deepEqual(resolveMeetPromptOutcome("keep_chatting", "keep_chatting", 7), {
    status: "keep_chatting",
    nextPromptDay: 14,
  });
});
