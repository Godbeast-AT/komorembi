export const DISCOVERY_PAGE_SIZE = 20;

export const DEFAULT_FEED_FILTERS = {
  minAge: 18,
  maxAge: 60,
  city: "",
};

const FORBIDDEN_DISCOVERY_KEYS = new Set([
  "like_count",
  "likes_count",
  "match_count",
  "matches_count",
  "common_interests_count",
]);

export function normalizeFeedFilters(filters = {}) {
  const minAge = Math.max(18, Math.min(100, Number(filters.minAge) || DEFAULT_FEED_FILTERS.minAge));
  const maxAge = Math.max(minAge, Math.min(100, Number(filters.maxAge) || DEFAULT_FEED_FILTERS.maxAge));

  return {
    minAge,
    maxAge,
    city: String(filters.city || "").trim(),
  };
}

export function createDiscoverySessionId(random = globalThis.crypto?.randomUUID?.()) {
  return random || `feed-${Date.now()}`;
}

export function sanitizeDiscoveryProfile(row) {
  const clean = { ...row };
  for (const key of FORBIDDEN_DISCOVERY_KEYS) {
    delete clean[key];
  }

  return {
    peer_id: String(clean.peer_id || ""),
    display_name: String(clean.display_name || ""),
    birth_date: clean.birth_date || clean.date_of_birth || null,
    city: String(clean.city || ""),
    photos: Array.isArray(clean.photos) ? clean.photos.slice(0, 1) : [],
    profile_prompt: String(clean.profile_prompt || clean.bio || ""),
    last_seen_at: clean.last_seen_at || clean.last_active_at || null,
    created_at: clean.created_at || null,
  };
}

export function discoveryPayloadHasNoCountMetrics(profile) {
  return !Object.keys(profile || {}).some((key) => FORBIDDEN_DISCOVERY_KEYS.has(key));
}
