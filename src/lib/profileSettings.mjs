import { MAX_PROFILE_PHOTOS } from "./onboardingProfile.mjs";

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  messages: true,
  streaks: true,
  waitlist: true,
  app_updates: true,
  quiet_hours_enabled: true,
});

export const BLOCK_LIST_TABLES = Object.freeze(["blocks", "user_blocks", "blocked_users"]);

export function compactPhotos(photos, maxPhotos = MAX_PROFILE_PHOTOS) {
  return photos.filter(Boolean).slice(0, maxPhotos);
}

export function toPhotoSlots(photos, maxPhotos = MAX_PROFILE_PHOTOS) {
  const compacted = compactPhotos(photos, maxPhotos);
  return Array.from({ length: maxPhotos }, (_, index) => compacted[index] ?? null);
}

export function removePhotoAt(photos, index, maxPhotos = MAX_PROFILE_PHOTOS) {
  const compacted = compactPhotos(photos, maxPhotos);
  if (index < 0 || index >= compacted.length) return compacted;
  return compacted.filter((_, photoIndex) => photoIndex !== index);
}

export function movePhoto(photos, fromIndex, toIndex, maxPhotos = MAX_PROFILE_PHOTOS) {
  const compacted = compactPhotos(photos, maxPhotos);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= compacted.length ||
    toIndex >= maxPhotos ||
    fromIndex === toIndex
  ) {
    return compacted;
  }

  const [photo] = compacted.splice(fromIndex, 1);
  compacted.splice(Math.min(toIndex, compacted.length), 0, photo);
  return compacted.slice(0, maxPhotos);
}

export function normalizeNotificationPreferences(preferences) {
  const normalized = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!preferences || typeof preferences !== "object") return normalized;

  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
    if (typeof preferences[key] === "boolean") normalized[key] = preferences[key];
  }

  return normalized;
}

function pickBlockedProfile(row) {
  return row?.blocked_profile
    ?? row?.blocked_user
    ?? row?.blockedProfile
    ?? row?.profile
    ?? row?.profiles
    ?? {};
}

export function normalizeBlockedAccounts(rows, currentPeerId) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const profile = pickBlockedProfile(row);
      const sourceTable = row?.source_table || row?.sourceTable || "blocked_users";
      const blockerPeerId = row?.blocker_peer_id || row?.blockerPeerId || currentPeerId;
      const blockedPeerId = row?.blocked_peer_id
        || row?.blockedPeerId
        || row?.blocked_user_id
        || row?.blockedUserId
        || profile?.peer_id;

      if (!blockerPeerId || !blockedPeerId) return null;

      return {
        id: `${sourceTable}:${blockerPeerId}:${blockedPeerId}`,
        sourceTable,
        blockerPeerId,
        blockedPeerId,
        displayName: profile?.display_name || "Blocked user",
        photos: Array.isArray(profile?.photos) ? profile.photos : [],
        createdAt: row?.created_at || row?.createdAt,
      };
    })
    .filter(Boolean);
}
