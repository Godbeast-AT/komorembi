import test from "node:test";
import assert from "node:assert/strict";

import {
  APPEAL_COMBINED_MAX_LENGTH,
  APPEAL_OVERTURNED_COPY,
  APPEAL_UPHELD_COPY,
  REPORT_ACTION_FOLLOW_UP,
  REPORT_SUBMISSION_CONFIRMATION,
  appealCharacterCount,
  canSubmitAppeal,
  countUniqueConfirmedReporters,
  createPermanentBanMessage,
  createTemporaryBanMessage,
  reportRestrictionForConfirmedCount,
} from "./reportsSafety.mjs";

test("report thresholds match 5, 20, and 30 unique confirmed reporters", () => {
  assert.deepEqual(reportRestrictionForConfirmedCount(4), {
    level: "none",
    kind: "none",
    permanentlyBlockPhoneHash: false,
    highRiskFlag: false,
  });
  assert.deepEqual(reportRestrictionForConfirmedCount(5), {
    level: "report_5_24h",
    kind: "temporary_ban",
    durationHours: 24,
    permanentlyBlockPhoneHash: false,
    highRiskFlag: false,
  });
  assert.deepEqual(reportRestrictionForConfirmedCount(20), {
    level: "report_20_7d",
    kind: "temporary_ban",
    durationHours: 168,
    permanentlyBlockPhoneHash: false,
    highRiskFlag: true,
  });
  assert.deepEqual(reportRestrictionForConfirmedCount(30), {
    level: "report_30_permanent",
    kind: "permanent_ban",
    permanentlyBlockPhoneHash: true,
    highRiskFlag: true,
  });
});

test("unique reporter count ignores duplicate, dismissed, and archived reports", () => {
  assert.equal(countUniqueConfirmedReporters([
    { reporter_user_id: "a", status: "open" },
    { reporter_user_id: "a", status: "reviewed" },
    { reporter_user_id: "b", status: "action_taken" },
    { reporter_user_id: "c", status: "dismissed" },
    { reporter_user_id: "d", status: "archived" },
  ]), 2);
});

test("report and appeal copy matches launch safety requirements", () => {
  assert.match(REPORT_SUBMISSION_CONFIRMATION, /review this within 24 hours/);
  assert.doesNotMatch(REPORT_ACTION_FOLLOW_UP, /reported user|banned|suspended/i);
  assert.match(createTemporaryBanMessage("2026-06-04T12:00:00.000Z"), /temporarily suspended until/);
  assert.match(createPermanentBanMessage(), /permanently suspended due to repeated violations/);
  assert.match(APPEAL_OVERTURNED_COPY, /reinstated your account/);
  assert.match(APPEAL_UPHELD_COPY, /suspension was appropriate/);
});

test("appeal form enforces two fields and a strict combined 500 character cap", () => {
  assert.equal(APPEAL_COMBINED_MAX_LENGTH, 500);
  assert.equal(appealCharacterCount({ whatHappened: "a".repeat(250), whyWrong: "b".repeat(250) }), 500);
  assert.equal(canSubmitAppeal({ whatHappened: "a", whyWrong: "b" }), true);
  assert.equal(canSubmitAppeal({ whatHappened: "", whyWrong: "b" }), false);
  assert.equal(canSubmitAppeal({ whatHappened: "a".repeat(501), whyWrong: "" }), false);
});
