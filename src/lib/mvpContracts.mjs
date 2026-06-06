export const CONTRACT_VERSION = "2026-06-04-intention-mvp-phase-0";

export const LEGACY_DELETION_TARGETS = Object.freeze([
  "src/components/VideoCallRoom.tsx",
  "src/hooks/useWebRTC.ts",
  "src/hooks/useVideoCall.ts",
  "src/components/PermissionView.tsx",
  "peerjs",
  "mock-discovery-fallback",
  "guest-only-flow",
  "waiting_room-live-matching",
  "call-history-active-ui",
]);

export const WAITLIST_PREVIEW_ALLOWED_KEYS = Object.freeze([
  "preview_id",
  "label",
  "age_bucket",
  "city",
  "state",
  "intention",
  "card_style",
]);

export const WAITLIST_PREVIEW_FORBIDDEN_KEYS = Object.freeze([
  "peer_id",
  "user_id",
  "username",
  "display_name",
  "name",
  "bio",
  "prompt_answer",
  "photos",
  "photo_url",
  "avatar_url",
  "exact_age",
  "birth_date",
  "can_open_profile",
  "can_message",
  "can_report",
]);

export const PROFILE_INTENTIONS = Object.freeze(["long_term", "short_term"]);
export const PROFILE_GENDERS = Object.freeze(["man", "woman", "non_binary"]);
export const PROFILE_PREFERENCES = Object.freeze(["men", "women", "everyone"]);
export const CONVERSATION_STATUSES = Object.freeze([
  "pending",
  "active",
  "expired",
  "locked",
  "closed",
]);
export const MESSAGE_MODERATION_VERDICTS = Object.freeze(["safe", "warn", "block"]);
export const REPORT_REASONS_MVP = Object.freeze([
  "fake_profile",
  "harassment",
  "inappropriate_photos",
  "scammer",
  "underage_user",
  "other",
]);
export const NOTIFICATION_CATEGORIES = Object.freeze([
  "account_security",
  "messages",
  "streaks",
  "waitlist",
  "app_updates",
]);

export function isWaitlistPreviewCardRedacted(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return false;

  const keys = Object.keys(card);
  if (keys.length === 0) return false;

  return keys.every((key) => WAITLIST_PREVIEW_ALLOWED_KEYS.includes(key)) &&
    WAITLIST_PREVIEW_FORBIDDEN_KEYS.every((key) => !(key in card));
}
