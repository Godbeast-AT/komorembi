export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  messages: true,
  streaks: true,
  waitlist: true,
  app_updates: true,
});

const TRIGGER_PREFERENCE_KEYS = Object.freeze({
  welcome: "app_updates",
  waitlist_admitted: "waitlist",
  waitlist_position_changed: "waitlist",
  opening_message_received: "messages",
  chat_reply_received: "messages",
  conversation_expiring: "messages",
  conversation_expired: "messages",
  streak_milestone: "streaks",
  meet_prompt_locked: "streaks",
  meet_prompt_mutual_yes: "streaks",
});

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

export function normalizeNotificationPreferences(preferences) {
  const knownPreferences = {};

  if (preferences && typeof preferences === "object") {
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
      if (typeof preferences[key] === "boolean") {
        knownPreferences[key] = preferences[key];
      }
    }
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...knownPreferences,
  };
}

export function buildInviteLink({ baseUrl, referrerPeerId }) {
  const url = new URL("/invite", stripTrailingSlash(baseUrl));
  url.searchParams.set("ref", referrerPeerId);
  return url.toString();
}

export function extractReferrerPeerId(input) {
  if (!input) return null;

  try {
    const url = String(input).startsWith("?")
      ? new URL(String(input), "https://komorembi.app")
      : new URL(String(input));
    return url.searchParams.get("ref");
  } catch {
    return null;
  }
}

export function shouldQueuePushForTrigger(triggerType, preferences) {
  const preferenceKey = TRIGGER_PREFERENCE_KEYS[triggerType];
  if (!preferenceKey) return false;

  const normalized = normalizeNotificationPreferences(preferences);
  return normalized[preferenceKey] === true;
}

export function createWaitlistJoinPayload(peerId, referredBy = null) {
  return {
    peer_id: peerId,
    referred_by: referredBy || null,
  };
}

export function createPushTokenPayload({ peerId, token, platform }) {
  return {
    peer_id: peerId,
    token,
    platform,
  };
}

export function createNotificationEventPayload({
  recipientPeerId,
  triggerType,
  title,
  body,
  data = {},
}) {
  return {
    recipient_peer_id: recipientPeerId,
    trigger_type: triggerType,
    title,
    body,
    data,
  };
}
