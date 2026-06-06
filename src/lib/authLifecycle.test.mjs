import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeviceSessionPayload,
  buildPhoneOtpRequest,
  buildPhoneOtpVerification,
  createSoftDeletionPlan,
  hashPhoneNumberForAppTables,
  isSixDigitOtp,
  normalizePhoneNumber,
} from "./authLifecycle.mjs";

test("normalizePhoneNumber formats Indian local numbers as E.164", () => {
  assert.equal(normalizePhoneNumber("98765 43210"), "+919876543210");
  assert.equal(normalizePhoneNumber("+91 98765 43210"), "+919876543210");
  assert.equal(normalizePhoneNumber("0091-98765-43210"), "+919876543210");
});

test("normalizePhoneNumber rejects invalid phone values", () => {
  assert.equal(normalizePhoneNumber("12345"), "");
  assert.equal(normalizePhoneNumber("abcdefghij"), "");
});

test("OTP request and verification payloads match Supabase phone auth", () => {
  assert.deepEqual(buildPhoneOtpRequest("98765 43210"), {
    phone: "+919876543210",
  });
  assert.deepEqual(buildPhoneOtpVerification("98765 43210", "123456"), {
    phone: "+919876543210",
    token: "123456",
    type: "sms",
  });
});

test("hashPhoneNumberForAppTables hashes normalized phones without retaining the phone", async () => {
  const hash = await hashPhoneNumberForAppTables("98765 43210");
  const sameHash = await hashPhoneNumberForAppTables("+91 98765 43210");

  assert.equal(hash, sameHash);
  assert.equal(hash.length, 64);
  assert.equal(hash.includes("98765"), false);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test("isSixDigitOtp accepts only six numeric characters", () => {
  assert.equal(isSixDigitOtp("123456"), true);
  assert.equal(isSixDigitOtp("12345"), false);
  assert.equal(isSixDigitOtp("1234567"), false);
  assert.equal(isSixDigitOtp("12a456"), false);
});

test("buildDeviceSessionPayload records user and device metadata", () => {
  assert.deepEqual(
    buildDeviceSessionPayload({
      userId: "user-1",
      deviceId: "device-1",
      platform: "android",
      now: "2026-06-04T10:00:00.000Z",
    }),
    {
      user_id: "user-1",
      device_id: "device-1",
      platform: "android",
      last_seen_at: "2026-06-04T10:00:00.000Z",
      revoked_at: null,
    },
  );
});

test("createSoftDeletionPlan schedules final purge fourteen days later", () => {
  assert.deepEqual(
    createSoftDeletionPlan({
      userId: "user-1",
      peerId: "peer-1",
      requestedAt: "2026-06-04T00:00:00.000Z",
    }),
    {
      user_id: "user-1",
      peer_id: "peer-1",
      requested_at: "2026-06-04T00:00:00.000Z",
      purge_after: "2026-06-18T00:00:00.000Z",
      status: "pending_grace_period",
      immediate_actions: [
        "close_active_conversations",
        "hide_profile_from_feed",
        "delete_profile_photos",
        "anonymize_sender_display",
      ],
    },
  );
});
