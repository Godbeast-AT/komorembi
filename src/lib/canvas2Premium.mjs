import { PREMIUM_ENTITLEMENTS } from "./canvas2Contracts.mjs";

export const PREMIUM_PRICE_INR_MONTHLY_DEFAULT = 299;

export function assertPremiumEntitlement(account, entitlement) {
  if (!PREMIUM_ENTITLEMENTS.includes(entitlement)) {
    throw new Error("unknown_premium_entitlement");
  }
  if (!account?.is_premium) {
    throw new Error("premium_required");
  }
  return true;
}

function collectSharedValues(left = [], right = [], key) {
  const rightValues = new Set(right.map((item) => String(item?.[key] || item).trim().toLowerCase()));
  return left
    .map((item) => String(item?.[key] || item).trim())
    .filter((value) => value && rightValues.has(value.toLowerCase()));
}

export function buildAiEnhancementRequest({
  roughIdea,
  senderProfile = {},
  recipientProfile = {},
}) {
  return {
    rough_idea: String(roughIdea || "").trim(),
    auto_send: false,
    shared_context: {
      hobbies: collectSharedValues(senderProfile.hobbies, recipientProfile.hobbies),
      movies: collectSharedValues(senderProfile.movies, recipientProfile.movies, "title"),
      music: collectSharedValues(senderProfile.music, recipientProfile.music, "name"),
    },
    sender_profile: senderProfile,
    recipient_profile: recipientProfile,
  };
}

export function buildPremiumCheckoutPayload({
  userId,
  amountInr = PREMIUM_PRICE_INR_MONTHLY_DEFAULT,
  provider = "placeholder",
}) {
  return {
    user_id: userId,
    amount_inr: amountInr,
    interval: "monthly",
    provider,
  };
}

export function premiumProviderUnavailable(feature) {
  return {
    status: "unavailable",
    feature,
    message: "This premium feature is temporarily unavailable.",
  };
}

