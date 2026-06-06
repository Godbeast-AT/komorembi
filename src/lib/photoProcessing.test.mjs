import test from "node:test";
import assert from "node:assert/strict";

import {
  PHOTO_MODERATION_REJECTION_MESSAGE,
  PHOTO_SLOT_RULES,
  decideAiEnhancementOutcome,
  decidePhotoModerationOutcome,
  getPhotoSlotRule,
} from "./photoProcessing.mjs";

test("photo slot rules describe all six MVP slots", () => {
  assert.equal(PHOTO_SLOT_RULES.length, 6);
  assert.equal(getPhotoSlotRule(1).label, "Clear face photo");
  assert.equal(getPhotoSlotRule(1).allowsGroupPhoto, false);
  assert.equal(getPhotoSlotRule(2).allowsGroupPhoto, false);
  assert.equal(getPhotoSlotRule(3).allowsGroupPhoto, false);
  assert.equal(getPhotoSlotRule(4).allowsGroupPhoto, true);
});

test("photo moderation thresholds reject, hold, and approve nudity confidence", () => {
  assert.deepEqual(decidePhotoModerationOutcome({ nudity: 86 }), {
    status: "rejected",
    message: PHOTO_MODERATION_REJECTION_MESSAGE,
  });
  assert.deepEqual(decidePhotoModerationOutcome({ nudity: 70 }), {
    status: "held",
    message: null,
  });
  assert.deepEqual(decidePhotoModerationOutcome({ nudity: 59 }), {
    status: "approved",
    message: null,
  });
});

test("AI enhancement detection rejects edited photos with the required copy", () => {
  assert.deepEqual(decideAiEnhancementOutcome({ skinSmoothing: 91 }), {
    status: "rejected",
    message: "Please use an unedited photo. Filters and AI enhancements are not allowed.",
  });
});

