import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInviteLink,
  createNotificationEventPayload,
  createPushTokenPayload,
  createWaitlistJoinPayload,
  extractReferrerPeerId,
  normalizeNotificationPreferences,
  shouldQueuePushForTrigger,
} from "./growthNotifications.mjs";

test("buildInviteLink embeds the referrer peer id as the ref param", () => {
  const link = buildInviteLink({
    baseUrl: "https://komorembi.app",
    referrerPeerId: "peer_alpha",
  });

  assert.equal(link, "https://komorembi.app/invite?ref=peer_alpha");
});

test("extractReferrerPeerId reads ref from an invite URL or query string", () => {
  assert.equal(extractReferrerPeerId("https://komorembi.app/invite?ref=peer_beta"), "peer_beta");
  assert.equal(extractReferrerPeerId("?utm=ad&ref=peer_gamma"), "peer_gamma");
  assert.equal(extractReferrerPeerId("https://komorembi.app/invite"), null);
});

test("normalizeNotificationPreferences fills missing fields with opt-in defaults", () => {
  assert.deepEqual(normalizeNotificationPreferences({ messages: false, unknown: false }), {
    messages: false,
    streaks: true,
    waitlist: true,
    app_updates: true,
  });
});

test("shouldQueuePushForTrigger maps triggers onto preference keys", () => {
  const preferences = normalizeNotificationPreferences({ messages: false, waitlist: true });

  assert.equal(shouldQueuePushForTrigger("opening_message_received", preferences), false);
  assert.equal(shouldQueuePushForTrigger("waitlist_admitted", preferences), true);
  assert.equal(shouldQueuePushForTrigger("meet_prompt_locked", preferences), true);
  assert.equal(shouldQueuePushForTrigger("welcome", preferences), true);
});

test("payload helpers keep Supabase column names stable", () => {
  assert.deepEqual(createWaitlistJoinPayload("peer_new", "peer_ref"), {
    peer_id: "peer_new",
    referred_by: "peer_ref",
  });

  assert.deepEqual(createPushTokenPayload({ peerId: "peer_new", token: "fcm-token", platform: "android" }), {
    peer_id: "peer_new",
    token: "fcm-token",
    platform: "android",
  });

  assert.deepEqual(
    createNotificationEventPayload({
      recipientPeerId: "peer_new",
      triggerType: "opening_message_received",
      title: "Someone sent a message",
      body: "Open Komorembi to respond.",
      data: { actor_peer_id: "peer_actor" },
    }),
    {
      recipient_peer_id: "peer_new",
      trigger_type: "opening_message_received",
      title: "Someone sent a message",
      body: "Open Komorembi to respond.",
      data: { actor_peer_id: "peer_actor" },
    },
  );
});
