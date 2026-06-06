import test from "node:test";
import assert from "node:assert/strict";

import {
  createBootState,
  shouldScheduleNotification,
} from "./appReadiness.mjs";

test("createBootState resolves to limited when native boot work times out", () => {
  assert.deepEqual(
    createBootState({
      authResolved: false,
      sessionResolved: true,
      bootTimedOut: true,
      isBanned: false,
    }),
    { bootState: "limited", bootReason: "timeout" },
  );
});

test("createBootState waits for Supabase session resolution before ready", () => {
  assert.deepEqual(
    createBootState({
      authResolved: true,
      sessionResolved: false,
      bootTimedOut: false,
      isBanned: false,
    }),
    { bootState: "booting" },
  );

  assert.deepEqual(
    createBootState({
      authResolved: true,
      sessionResolved: true,
      bootTimedOut: false,
      isBanned: false,
    }),
    { bootState: "ready" },
  );
});

test("shouldScheduleNotification only returns true for granted display permission", () => {
  assert.equal(shouldScheduleNotification({ display: "granted" }), true);
  assert.equal(shouldScheduleNotification({ display: "denied" }), false);
  assert.equal(shouldScheduleNotification({ display: "prompt" }), false);
});
