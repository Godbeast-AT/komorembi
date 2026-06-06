import { HOBBY_OPTIONS, INTEREST_LIMITS } from "./canvas2Contracts.mjs";

const unavailableMessage =
  "Search is temporarily unavailable. You can skip this step and add it later from your profile.";

function compactString(value) {
  return String(value || "").trim();
}

function normalizeYear(value) {
  const year = Number(value);
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function normalizeMediaSelection(selection, provider, labelKey) {
  const providerId = compactString(selection?.provider_id || selection?.id || selection?.mbid);
  const label = compactString(selection?.[labelKey]);
  if (!providerId || !label) return null;

  return {
    provider,
    provider_id: providerId,
    [labelKey]: label,
    year: normalizeYear(selection?.year),
    genre: compactString(selection?.genre) || null,
    poster_url: compactString(selection?.poster_url) || null,
    image_url: compactString(selection?.image_url) || null,
  };
}

export function normalizeHobbySelections(hobbies) {
  const allowed = new Set(HOBBY_OPTIONS);
  const seen = new Set();
  const normalized = [];

  for (const hobby of Array.isArray(hobbies) ? hobbies : []) {
    const value = compactString(hobby).toLowerCase().replace(/\s+/g, "_");
    if (!allowed.has(value) || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length === INTEREST_LIMITS.hobbies) break;
  }

  return normalized;
}

export function normalizeMovieSelections(movies) {
  return (Array.isArray(movies) ? movies : [])
    .map((movie) => normalizeMediaSelection(movie, "tmdb", "title"))
    .filter(Boolean)
    .slice(-INTEREST_LIMITS.movies)
    .map(({ genre: _genre, image_url: _imageUrl, ...movie }) => movie);
}

export function normalizeMusicSelections(artists) {
  return (Array.isArray(artists) ? artists : [])
    .map((artist) => normalizeMediaSelection(artist, "lastfm", "name"))
    .filter(Boolean)
    .slice(-INTEREST_LIMITS.musicArtists)
    .map(({ year: _year, poster_url: _posterUrl, ...artist }) => artist);
}

export function providerUnavailableResult(provider) {
  return {
    status: "unavailable",
    message: unavailableMessage,
    provider,
    can_skip: true,
  };
}

export function buildInterestReminderNotification({
  userId,
  signupCompletedAt,
  skippedMovies,
  skippedMusic,
}) {
  const scheduledFor = new Date(signupCompletedAt);
  scheduledFor.setUTCHours(scheduledFor.getUTCHours() + 48);

  return {
    user_id: userId,
    event_type: "onboarding_interest_reminder",
    category: "app_updates",
    scheduled_for: scheduledFor.toISOString(),
    payload: {
      skipped_movies: Boolean(skippedMovies),
      skipped_music: Boolean(skippedMusic),
    },
  };
}

