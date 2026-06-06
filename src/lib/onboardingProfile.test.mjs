import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PROFILE_PHOTOS,
  REQUIRED_PROFILE_PHOTOS,
  buildProfileInsertPayload,
  buildCompleteOnboardingPayload,
  calculateAge,
  canCompleteAgeGate,
  hasRequiredPhotos,
  validateUsername,
} from "./onboardingProfile.mjs";

test("calculateAge treats the 18th birthday as adult", () => {
  const today = new Date("2026-05-29T12:00:00.000Z");

  assert.equal(calculateAge("2008-05-29", today), 18);
  assert.equal(calculateAge("2008-05-30", today), 17);
});

test("canCompleteAgeGate hard-blocks under-18 and invalid birth dates", () => {
  const today = new Date("2026-05-29T12:00:00.000Z");

  assert.equal(canCompleteAgeGate("2008-05-29", today), true);
  assert.equal(canCompleteAgeGate("2008-05-30", today), false);
  assert.equal(canCompleteAgeGate("", today), false);
  assert.equal(canCompleteAgeGate("not-a-date", today), false);
});

test("hasRequiredPhotos requires at least two and caps the accepted slots at six", () => {
  assert.equal(MAX_PROFILE_PHOTOS, 6);
  assert.equal(REQUIRED_PROFILE_PHOTOS, 2);
  assert.equal(hasRequiredPhotos([]), false);
  assert.equal(hasRequiredPhotos(["first.jpg"]), false);
  assert.equal(hasRequiredPhotos(["first.jpg", "second.jpg"]), true);
  assert.equal(
    hasRequiredPhotos(["1", "2", "3", "4", "5", "6", "7"]),
    false,
  );
});

test("validateUsername enforces length, characters, first letter, and banned words", () => {
  assert.deepEqual(validateUsername("ari_22", ["admin"]), {
    status: "valid",
    username: "ari_22",
  });
  assert.deepEqual(validateUsername("ar", ["admin"]), { status: "invalid" });
  assert.deepEqual(validateUsername("2ari", ["admin"]), { status: "invalid" });
  assert.deepEqual(validateUsername("ari-22", ["admin"]), { status: "invalid" });
  assert.deepEqual(validateUsername("Admin", ["admin"]), { status: "banned" });
});

test("buildCompleteOnboardingPayload creates the transactional RPC params", () => {
  assert.deepEqual(
    buildCompleteOnboardingPayload({
      peerId: "peer-123",
      username: "Ari_22",
      displayName: " Ari ",
      birthDate: "2000-02-03",
      gender: "Woman",
      genderPreference: "Men",
      intention: "long_term",
      city: "Mumbai",
      state: "Maharashtra",
      bio: "hello",
      photos: ["one.jpg", "two.jpg"],
    }),
    {
      p_peer_id: "peer-123",
      p_username: "ari_22",
      p_display_name: "Ari",
      p_date_of_birth: "2000-02-03",
      p_gender: "Woman",
      p_gender_preference: "Men",
      p_intention: "long_term",
      p_city: "Mumbai",
      p_state: "Maharashtra",
      p_bio: "hello",
      p_photo_paths: ["one.jpg", "two.jpg"],
    },
  );
});

test("buildCompleteOnboardingPayload rejects raw files before profile RPC", () => {
  assert.throws(
    () =>
      buildCompleteOnboardingPayload({
        peerId: "peer-123",
        username: "ari_22",
        displayName: "Ari",
        birthDate: "2000-02-03",
        gender: "Woman",
        genderPreference: "Men",
        intention: "long_term",
        city: "Mumbai",
        state: "Maharashtra",
        photos: [{ name: "raw.jpg" }, "two.jpg"],
      }),
    /unprocessed_photo/,
  );
});

test("buildProfileInsertPayload uses only the requested profile signup columns", () => {
  const payload = buildProfileInsertPayload({
    peerId: "peer-123",
    userId: "4f00f729-f1dd-4b91-bc32-3132d7229e7d",
    displayName: "Ari",
    birthDate: "2000-02-03",
    gender: "Agender",
    photos: ["https://example.com/one.jpg"],
    interests: undefined,
    bio: "",
    createdAt: "2026-05-29T06:30:00.000Z",
  });

  assert.deepEqual(Object.keys(payload), [
    "peer_id",
    "user_id",
    "display_name",
    "birth_date",
    "gender",
    "photos",
    "interests",
    "bio",
    "trust_score",
    "created_at",
  ]);
  assert.deepEqual(payload, {
    peer_id: "peer-123",
    user_id: "4f00f729-f1dd-4b91-bc32-3132d7229e7d",
    display_name: "Ari",
    birth_date: "2000-02-03",
    gender: "Agender",
    photos: ["https://example.com/one.jpg"],
    interests: [],
    bio: "",
    trust_score: 100,
    created_at: "2026-05-29T06:30:00.000Z",
  });
});
