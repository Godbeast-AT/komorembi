import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_ENHANCEMENT_PROVIDER_KEYS,
  CALM_THEME_TOKENS,
  CANVAS2_EDGE_FUNCTIONS,
  CANVAS2_NOTIFICATION_EVENTS,
  CANVAS2_RPC_INTERFACES,
  DATING_MODES,
  HOBBY_OPTIONS,
  INTEREST_LIMITS,
  MODE_PARTITIONED_TABLES,
  MODE_SPECIFIC_NOTIFICATION_CATEGORIES,
  MUSIC_PROVIDER_KEYS,
  PREMIUM_ENTITLEMENTS,
  PROFILE_THEME_MODES,
  THEME_MODE_BY_INTENTION,
  TIMELINE_PROMPT_DAYS,
  TMDB_PROVIDER_KEYS,
  deriveThemeModeFromIntention,
  normalizeDatingMode,
  normalizeDatingPreference,
  normalizeTimelinePreference,
} from "./canvas2Contracts.mjs";

test("Canvas 2 maps intention to immutable theme modes", () => {
  assert.deepEqual(PROFILE_THEME_MODES, ["calm", "bold"]);
  assert.deepEqual(THEME_MODE_BY_INTENTION, {
    long_term: "calm",
    short_term: "bold",
  });
  assert.equal(deriveThemeModeFromIntention("long_term"), "calm");
  assert.equal(deriveThemeModeFromIntention("short_term"), "bold");
  assert.equal(deriveThemeModeFromIntention("other"), "calm");
});

test("Canvas 2 defines dating mode database partitions", () => {
  assert.deepEqual(DATING_MODES, ["long_term", "short_term"]);
  assert.equal(normalizeDatingMode("long_term"), "long_term");
  assert.equal(normalizeDatingMode("short_term"), "short_term");
  assert.throws(() => normalizeDatingMode("friendship"), /invalid_dating_mode/);

  assert.deepEqual(MODE_PARTITIONED_TABLES, [
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
  assert.deepEqual(MODE_SPECIFIC_NOTIFICATION_CATEGORIES, [
    "messages",
    "streaks",
    "waitlist",
  ]);
});

test("Canvas 2 preference contract removes none as a production choice", () => {
  assert.equal(normalizeDatingPreference("men"), "men");
  assert.equal(normalizeDatingPreference("women"), "women");
  assert.equal(normalizeDatingPreference("both"), "everyone");
  assert.equal(normalizeDatingPreference("everyone"), "everyone");
  assert.throws(() => normalizeDatingPreference("none"), /invalid_preference/);
});

test("Canvas 2 timeline preferences expose day counts", () => {
  assert.deepEqual(TIMELINE_PROMPT_DAYS, {
    daily: 3,
    one_week: 7,
    two_weeks: 14,
    one_month: 30,
    two_months: 60,
  });
  assert.equal(normalizeTimelinePreference("daily"), "daily");
  assert.equal(normalizeTimelinePreference(""), "one_week");
  assert.throws(() => normalizeTimelinePreference("never"), /invalid_timeline_preference/);
});

test("Canvas 2 defines theme tokens with parallax and animation contracts", () => {
  assert.equal(CALM_THEME_TOKENS.animationMs, 300);
  assert.equal(CALM_THEME_TOKENS.cardLayout, "text_first");
  assert.equal(CALM_THEME_TOKENS.showSecurityIndicator, true);

  assert.equal(CALM_THEME_TOKENS.bold.animationMs, 150);
  assert.equal(CALM_THEME_TOKENS.bold.cardLayout, "photo_first");
  assert.equal(CALM_THEME_TOKENS.bold.showSecurityIndicator, false);
  assert.equal(CALM_THEME_TOKENS.bold.parallax.enabled, true);
  assert.equal(CALM_THEME_TOKENS.bold.parallax.targetFps, 60);
});

test("Canvas 2 interest and premium contracts expose bounded options", () => {
  assert.ok(HOBBY_OPTIONS.length >= 40);
  assert.equal(INTEREST_LIMITS.hobbies, 6);
  assert.equal(INTEREST_LIMITS.movies, 4);
  assert.equal(INTEREST_LIMITS.musicArtists, 4);
  assert.deepEqual(PREMIUM_ENTITLEMENTS, [
    "ai_message_enhancement",
    "profile_views",
    "immediate_city_change",
    "priority_feed_boost",
  ]);
});

test("Canvas 2 server interfaces and placeholder keys are explicit", () => {
  assert.deepEqual(CANVAS2_EDGE_FUNCTIONS, [
    "search-movies",
    "search-music",
    "enhance-message",
    "premium-webhook",
  ]);
  assert.ok(CANVAS2_RPC_INTERFACES.includes("merge_auth_identities"));
  assert.ok(CANVAS2_RPC_INTERFACES.includes("calculate_preference_waitlist_ratio"));
  assert.deepEqual(CANVAS2_NOTIFICATION_EVENTS, ["onboarding_interest_reminder"]);
  assert.deepEqual(TMDB_PROVIDER_KEYS, ["TMDB_API_KEY"]);
  assert.deepEqual(MUSIC_PROVIDER_KEYS, ["LASTFM_API_KEY", "MUSIC_SEARCH_PROVIDER"]);
  assert.deepEqual(AI_ENHANCEMENT_PROVIDER_KEYS, [
    "AI_MESSAGE_ENHANCEMENT_URL",
    "AI_MESSAGE_ENHANCEMENT_API_KEY",
  ]);
});
