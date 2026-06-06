import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_REASONS,
  REPORT_REASON_OPTIONS,
  getReportReasonLabel,
  isReportDetailsWithinLimit,
  isReportReason,
  normalizeReportDetails,
} from "./trustSafety.mjs";

test("report reasons are constrained to the defined moderation list", () => {
  assert.deepEqual(REPORT_REASONS, [
    "fake_profile",
    "harassment",
    "inappropriate_photos",
    "scammer",
    "underage_user",
    "other",
  ]);
  assert.equal(isReportReason("scammer"), true);
  assert.equal(isReportReason("bad vibes"), false);
  assert.equal(getReportReasonLabel("underage_user"), "Underage user");
  assert.ok(REPORT_REASON_OPTIONS.some((option) => option.label === "Fake profile"));
});

test("report details are trimmed and capped for the client form", () => {
  assert.equal(normalizeReportDetails("  context  "), "context");
  assert.equal(normalizeReportDetails("   "), null);
  assert.equal(normalizeReportDetails("x".repeat(350)), "x".repeat(300));
  assert.equal(isReportDetailsWithinLimit("x".repeat(300)), true);
  assert.equal(isReportDetailsWithinLimit("x".repeat(301)), false);
});
