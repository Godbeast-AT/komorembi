import test from "node:test";
import assert from "node:assert/strict";

import {
  canChangeUsername,
  canDeleteProfilePhoto,
  calculateCompletenessScore,
  cityChangeEffectiveAt,
  isSensitiveProfileField,
  normalizeSensitiveFieldValue,
} from "./profileEditing.mjs";

test("completeness score rewards bio, city, and up to six photos", () => {
  assert.equal(calculateCompletenessScore({ bio: "", city: "", photos: [] }), 0);
  assert.equal(calculateCompletenessScore({ bio: "hello", city: "Mumbai", photos: ["1", "2"] }), 80);
  assert.equal(calculateCompletenessScore({ bio: "hello", city: "Mumbai", photos: ["1", "2", "3", "4", "5", "6"] }), 100);
});

test("username changes are allowed only after thirty days", () => {
  const now = new Date("2026-06-04T12:00:00.000Z");
  assert.equal(canChangeUsername(null, now), true);
  assert.equal(canChangeUsername("2026-05-10T12:00:00.000Z", now), false);
  assert.equal(canChangeUsername("2026-05-01T12:00:00.000Z", now), true);
});

test("city changes take effect one hour later", () => {
  const effectiveAt = cityChangeEffectiveAt(new Date("2026-06-04T12:00:00.000Z"));
  assert.equal(effectiveAt.toISOString(), "2026-06-04T13:00:00.000Z");
});

test("photo deletion cannot drop below two profile photos", () => {
  assert.equal(canDeleteProfilePhoto(["one", "two"]), false);
  assert.equal(canDeleteProfilePhoto(["one", "two", "three"]), true);
});

test("sensitive profile fields are normalized for the destructive RPC", () => {
  assert.equal(isSensitiveProfileField("intention"), true);
  assert.equal(isSensitiveProfileField("city"), false);
  assert.equal(normalizeSensitiveFieldValue("gender", "Non-binary"), "non_binary");
  assert.equal(normalizeSensitiveFieldValue("gender_preference", "Women"), "women");
  assert.equal(normalizeSensitiveFieldValue("intention", "Long Term"), "long_term");
});
