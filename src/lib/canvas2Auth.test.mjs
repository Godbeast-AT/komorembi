import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthIdentityMergePlan,
  buildGoogleOAuthSignInPayload,
  hashContactIdentifierForAppTables,
  normalizeContactIdentifier,
} from "./authLifecycle.mjs";

test("Google OAuth payload uses Supabase provider and redirect URL", () => {
  assert.deepEqual(
    buildGoogleOAuthSignInPayload("https://app.example.com/auth/callback"),
    {
      provider: "google",
      options: {
        redirectTo: "https://app.example.com/auth/callback",
      },
    },
  );
});

test("contact identifiers normalize phone and Google email without mixing meanings", () => {
  assert.deepEqual(normalizeContactIdentifier({ type: "phone", value: "98765 43210" }), {
    type: "phone",
    normalized: "+919876543210",
  });
  assert.deepEqual(normalizeContactIdentifier({ type: "email", value: "User@Example.COM " }), {
    type: "email",
    normalized: "user@example.com",
  });
  assert.throws(() => normalizeContactIdentifier({ type: "email", value: "bad" }), /invalid_email/);
});

test("contact hash supports Google email and phone identifiers", async () => {
  const phoneHash = await hashContactIdentifierForAppTables({ type: "phone", value: "98765 43210" });
  const emailHash = await hashContactIdentifierForAppTables({ type: "email", value: "User@Example.COM" });

  assert.equal(phoneHash.length, 64);
  assert.equal(emailHash.length, 64);
  assert.notEqual(phoneHash, emailHash);
});

test("identity merge plan keeps the better lower waitlist position", () => {
  assert.deepEqual(
    buildAuthIdentityMergePlan({
      primaryUserId: "google-user",
      duplicateUserId: "phone-user",
      primaryWaitlistPosition: 18,
      duplicateWaitlistPosition: 7,
    }),
    {
      primary_user_id: "google-user",
      duplicate_user_id: "phone-user",
      waitlist_position_to_keep: 7,
      retired_waitlist_position: 18,
      merge_steps: [
        "merge_profile",
        "merge_sessions",
        "merge_photos",
        "merge_waitlist_entry",
        "merge_conversations",
        "merge_reports",
      ],
    },
  );
});

