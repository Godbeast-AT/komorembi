import test from "node:test";
import assert from "node:assert/strict";

import {
  createUserActionPayload,
  isPaidDiscoveryAction,
} from "./discoveryActions.mjs";

test("createUserActionPayload uses current user_actions column names", () => {
  assert.deepEqual(createUserActionPayload("peer-a", "peer-b", "super_like"), {
    actor_peer_id: "peer-a",
    target_peer_id: "peer-b",
    action_type: "super_like",
  });
});

test("isPaidDiscoveryAction treats all discovery actions as free", () => {
  assert.equal(isPaidDiscoveryAction("skip"), false);
  assert.equal(isPaidDiscoveryAction("like"), false);
  assert.equal(isPaidDiscoveryAction("super_like"), false);
});
