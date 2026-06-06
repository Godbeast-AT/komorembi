import test from "node:test";
import assert from "node:assert/strict";

import {
  WAITLIST_PREVIEW_ALLOWED_KEYS,
  ageBucketFromBirthDate,
  applyReferralAcceleration,
  assertWaitlistPreviewIsRedacted,
  preferenceDemandWeight,
  redactWaitlistPreviewCard,
  shouldWaitlistPreferenceSeeker,
} from "./waitlist.mjs";

test("preference cap waitlists female-seekers who would push a city above 1.3", () => {
  assert.equal(preferenceDemandWeight("women", "female_seekers"), 1);
  assert.equal(preferenceDemandWeight("men", "female_seekers"), 0);
  assert.equal(preferenceDemandWeight("everyone", "female_seekers"), 0.5);
  assert.equal(preferenceDemandWeight("everyone", "male_seekers"), 0.5);
  assert.equal(
    shouldWaitlistPreferenceSeeker({ genderPreference: "men", femaleSeekers: 5, maleSeekers: 1 }),
    false,
  );
  assert.equal(
    shouldWaitlistPreferenceSeeker({ genderPreference: "women", femaleSeekers: 1, maleSeekers: 2 }),
    false,
  );
  assert.equal(
    shouldWaitlistPreferenceSeeker({ genderPreference: "women", femaleSeekers: 2, maleSeekers: 2 }),
    true,
  );
  assert.equal(
    shouldWaitlistPreferenceSeeker({ genderPreference: "everyone", femaleSeekers: 2, maleSeekers: 2 }),
    false,
  );
});

test("waitlist preview redacts ids, names, bios, usernames, and photos", () => {
  const preview = redactWaitlistPreviewCard(
    {
      user_id: "secret-user",
      peer_id: "secret-peer",
      username: "ari_22",
      display_name: "Ari",
      bio: "Do not leak me",
      photos: ["original.jpg"],
      date_of_birth: "2002-01-01",
      city: "Mumbai",
      intention: "long_term",
    },
    new Date("2026-06-04T00:00:00.000Z"),
  );

  assert.deepEqual(Object.keys(preview), [...WAITLIST_PREVIEW_ALLOWED_KEYS]);
  assert.deepEqual(preview, {
    label: "Someone nearby",
    age_bucket: "20s",
    city: "Mumbai",
    intention: "long_term",
  });
  assert.equal(assertWaitlistPreviewIsRedacted(preview), true);
  assert.throws(() => assertWaitlistPreviewIsRedacted({ ...preview, peer_id: "secret" }), /waitlist_preview_leaked_peer_id/);
});

test("referral acceleration moves a waiting user up exactly five positions once applied", () => {
  assert.equal(applyReferralAcceleration(12), 7);
  assert.equal(applyReferralAcceleration(5), 1);
  assert.equal(applyReferralAcceleration(1), 1);
});

test("age bucket never exposes an exact age", () => {
  const today = new Date("2026-06-04T00:00:00.000Z");

  assert.equal(ageBucketFromBirthDate("2007-06-04", today), "18-19");
  assert.equal(ageBucketFromBirthDate("1998-06-04", today), "20s");
  assert.equal(ageBucketFromBirthDate("1988-06-04", today), "30s");
  assert.equal(ageBucketFromBirthDate("1978-06-04", today), "40s");
});
