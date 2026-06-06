import test from "node:test";
import assert from "node:assert/strict";

import {
  PREMIUM_PRICE_INR_MONTHLY_DEFAULT,
  assertPremiumEntitlement,
  buildAiEnhancementRequest,
  buildPremiumCheckoutPayload,
  premiumProviderUnavailable,
} from "./canvas2Premium.mjs";

test("premium entitlement checks are server-authoritative helpers", () => {
  assert.equal(assertPremiumEntitlement({ is_premium: true }, "ai_message_enhancement"), true);
  assert.throws(
    () => assertPremiumEntitlement({ is_premium: false }, "ai_message_enhancement"),
    /premium_required/,
  );
});

test("AI enhancement request includes shared profile context and never auto-sends", () => {
  const request = buildAiEnhancementRequest({
    roughIdea: "ask about hiking",
    senderProfile: { hobbies: ["hiking"], movies: [{ title: "Interstellar" }] },
    recipientProfile: { hobbies: ["hiking"], music: [{ name: "A. R. Rahman" }] },
  });

  assert.equal(request.auto_send, false);
  assert.equal(request.rough_idea, "ask about hiking");
  assert.deepEqual(request.shared_context.hobbies, ["hiking"]);
  assert.deepEqual(request.shared_context.movies, []);
});

test("premium checkout payload uses INR 299 monthly placeholder by default", () => {
  assert.equal(PREMIUM_PRICE_INR_MONTHLY_DEFAULT, 299);
  assert.deepEqual(buildPremiumCheckoutPayload({ userId: "user-1" }), {
    user_id: "user-1",
    amount_inr: 299,
    interval: "monthly",
    provider: "placeholder",
  });
});

test("missing premium or AI provider config returns unavailable state", () => {
  assert.deepEqual(premiumProviderUnavailable("ai_message_enhancement"), {
    status: "unavailable",
    feature: "ai_message_enhancement",
    message: "This premium feature is temporarily unavailable.",
  });
});

