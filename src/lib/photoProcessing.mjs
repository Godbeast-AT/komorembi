export const PHOTO_MODERATION_REJECTION_MESSAGE =
  "This photo could not be uploaded because it may contain content that violates our guidelines. Please use a different photo.";

export const PHOTO_AI_REJECTION_MESSAGE =
  "Please use an unedited photo. Filters and AI enhancements are not allowed.";

export const PHOTO_SLOT_RULES = [
  {
    slot: 1,
    label: "Clear face photo",
    description:
      "Front facing, good lighting, no sunglasses, taken within the last year.",
    allowsGroupPhoto: false,
    requiresSingleFace: true,
  },
  {
    slot: 2,
    label: "Hobby or interest photo 1",
    description: "Show yourself doing something you love.",
    allowsGroupPhoto: false,
    requiresSingleFace: false,
  },
  {
    slot: 3,
    label: "Hobby or interest photo 2",
    description: "Represent a different interest from Slot 2.",
    allowsGroupPhoto: false,
    requiresSingleFace: false,
  },
  {
    slot: 4,
    label: "Candid or social photo",
    description: "With friends, at an event, or somewhere real.",
    allowsGroupPhoto: true,
    requiresSingleFace: false,
  },
  {
    slot: 5,
    label: "Open photo",
    description: "Anything that represents you, subject to safety checks.",
    allowsGroupPhoto: true,
    requiresSingleFace: false,
  },
  {
    slot: 6,
    label: "Open photo",
    description: "Anything that represents you, subject to safety checks.",
    allowsGroupPhoto: true,
    requiresSingleFace: false,
  },
];

export function getPhotoSlotRule(slot) {
  const rule = PHOTO_SLOT_RULES.find((item) => item.slot === slot);
  if (!rule) throw new Error("invalid_photo_slot");
  return rule;
}

export function decidePhotoModerationOutcome({
  nudity = 0,
  graphicViolence = 0,
  minorFace = 0,
}) {
  const severeConfidence = Math.max(nudity, graphicViolence, minorFace);

  if (severeConfidence > 85) {
    return {
      status: "rejected",
      message: PHOTO_MODERATION_REJECTION_MESSAGE,
    };
  }

  if (severeConfidence >= 60) {
    return {
      status: "held",
      message: null,
    };
  }

  return {
    status: "approved",
    message: null,
  };
}

export function decideAiEnhancementOutcome({
  skinSmoothing = 0,
  eyeEnlargement = 0,
  jawReshaping = 0,
}) {
  const maxConfidence = Math.max(skinSmoothing, eyeEnlargement, jawReshaping);

  if (maxConfidence >= 85) {
    return {
      status: "rejected",
      message: PHOTO_AI_REJECTION_MESSAGE,
    };
  }

  return {
    status: "approved",
    message: null,
  };
}
