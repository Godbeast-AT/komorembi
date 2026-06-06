export const PROFILE_THEME_MODES = Object.freeze(["calm", "bold"]);

export const DATING_MODES = Object.freeze(["long_term", "short_term"]);

export const MODE_PARTITIONED_TABLES = Object.freeze([
  "waitlist_entries",
  "waitlist_referrals",
  "feed_impressions",
  "feed_filters",
  "conversations",
  "messages",
  "moderation_events",
  "message_moderation_queue",
  "notifications",
]);

export const MODE_SPECIFIC_NOTIFICATION_CATEGORIES = Object.freeze(["messages", "streaks", "waitlist"]);

export const THEME_MODE_BY_INTENTION = Object.freeze({
  long_term: "calm",
  short_term: "bold",
});

export const TIMELINE_PROMPT_DAYS = Object.freeze({
  daily: 3,
  one_week: 7,
  two_weeks: 14,
  one_month: 30,
  two_months: 60,
});

export const HOBBY_OPTIONS = Object.freeze([
  "photography",
  "cooking",
  "hiking",
  "gaming",
  "reading",
  "travel",
  "fitness",
  "art",
  "music",
  "film",
  "dancing",
  "yoga",
  "cycling",
  "swimming",
  "writing",
  "theatre",
  "coffee",
  "baking",
  "gardening",
  "running",
  "football",
  "cricket",
  "badminton",
  "tennis",
  "basketball",
  "poetry",
  "standup",
  "podcasts",
  "fashion",
  "design",
  "languages",
  "volunteering",
  "meditation",
  "board_games",
  "anime",
  "tech",
  "startups",
  "foodie",
  "pets",
  "road_trips",
  "karaoke",
  "crafts",
  "museums",
  "beaches",
  "mountains",
]);

export const INTEREST_LIMITS = Object.freeze({
  hobbies: 6,
  movies: 4,
  musicArtists: 4,
});

export const CALM_THEME_TOKENS = Object.freeze({
  mode: "calm",
  animationMs: 300,
  cardLayout: "text_first",
  showSecurityIndicator: true,
  palette: {
    background: "#f8f7fb",
    surface: "#ffffff",
    primary: "#5b4a8f",
    accent: "#24324f",
    text: "#171827",
    muted: "#6d7280",
  },
  typography: {
    headingWeight: 600,
    bodyLineHeight: 1.65,
    letterSpacing: 0,
  },
  bold: {
    mode: "bold",
    animationMs: 150,
    cardLayout: "photo_first",
    showSecurityIndicator: false,
    palette: {
      background: "#0c0a0d",
      surface: "#171216",
      primary: "#ff3f6c",
      accent: "#ff8a3d",
      text: "#fff7f8",
      muted: "#f2b7c2",
    },
    typography: {
      headingWeight: 800,
      bodyLineHeight: 1.35,
      letterSpacing: 0,
    },
    parallax: {
      enabled: true,
      targetFps: 60,
      androidProfile: "mid_range",
    },
  },
});

export const PREMIUM_ENTITLEMENTS = Object.freeze([
  "ai_message_enhancement",
  "profile_views",
  "immediate_city_change",
  "priority_feed_boost",
]);

export const CANVAS2_RPC_INTERFACES = Object.freeze([
  "merge_auth_identities",
  "search_movie_interests",
  "search_music_interests",
  "save_profile_interests",
  "set_timeline_preference",
  "calculate_preference_waitlist_ratio",
  "create_premium_checkout_session",
  "sync_premium_subscription",
  "record_profile_view",
  "get_profile_viewers",
]);

export const CANVAS2_EDGE_FUNCTIONS = Object.freeze([
  "search-movies",
  "search-music",
  "enhance-message",
  "premium-webhook",
]);

export const CANVAS2_NOTIFICATION_EVENTS = Object.freeze(["onboarding_interest_reminder"]);
export const TMDB_PROVIDER_KEYS = Object.freeze(["TMDB_API_KEY"]);
export const MUSIC_PROVIDER_KEYS = Object.freeze(["LASTFM_API_KEY", "MUSIC_SEARCH_PROVIDER"]);
export const AI_ENHANCEMENT_PROVIDER_KEYS = Object.freeze([
  "AI_MESSAGE_ENHANCEMENT_URL",
  "AI_MESSAGE_ENHANCEMENT_API_KEY",
]);

export function deriveThemeModeFromIntention(intention) {
  return THEME_MODE_BY_INTENTION[String(intention || "").trim()] || "calm";
}

export function normalizeDatingPreference(preference) {
  const value = String(preference || "").trim().toLowerCase();
  if (value === "men" || value === "male" || value === "man") return "men";
  if (value === "women" || value === "female" || value === "woman") return "women";
  if (value === "both" || value === "everyone") return "everyone";
  throw new Error("invalid_preference");
}

export function normalizeDatingMode(mode) {
  const value = String(mode || "").trim().toLowerCase();
  if (DATING_MODES.includes(value)) return value;
  throw new Error("invalid_dating_mode");
}

export function normalizeTimelinePreference(preference) {
  const value = String(preference || "one_week").trim().toLowerCase();
  if (Object.hasOwn(TIMELINE_PROMPT_DAYS, value)) return value;
  throw new Error("invalid_timeline_preference");
}
