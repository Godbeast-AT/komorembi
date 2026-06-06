import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInterestReminderNotification,
  normalizeHobbySelections,
  normalizeMovieSelections,
  normalizeMusicSelections,
  providerUnavailableResult,
} from "./canvas2Interests.mjs";

test("hobby selections are preset-only and capped at six", () => {
  assert.deepEqual(
    normalizeHobbySelections([
      "Photography",
      "Cooking",
      "Hiking",
      "Gaming",
      "Reading",
      "Travel",
      "Not A Preset",
    ]),
    ["photography", "cooking", "hiking", "gaming", "reading", "travel"],
  );
});

test("movie selections store provider ids and drop the oldest fifth selection", () => {
  const selected = normalizeMovieSelections([
    { provider_id: "1", title: "One", year: 2001, poster_url: "/1.jpg" },
    { provider_id: "2", title: "Two", year: 2002, poster_url: "/2.jpg" },
    { provider_id: "3", title: "Three", year: 2003, poster_url: "/3.jpg" },
    { provider_id: "4", title: "Four", year: 2004, poster_url: "/4.jpg" },
    { provider_id: "5", title: "Five", year: 2005, poster_url: "/5.jpg" },
  ]);

  assert.deepEqual(selected.map((movie) => movie.provider_id), ["2", "3", "4", "5"]);
  assert.equal(selected[0].provider, "tmdb");
});

test("music selections store artist ids and drop the oldest fifth selection", () => {
  const selected = normalizeMusicSelections([
    { provider_id: "a", name: "A", image_url: "/a.jpg" },
    { provider_id: "b", name: "B", image_url: "/b.jpg" },
    { provider_id: "c", name: "C", image_url: "/c.jpg" },
    { provider_id: "d", name: "D", image_url: "/d.jpg" },
    { provider_id: "e", name: "E", image_url: "/e.jpg" },
  ]);

  assert.deepEqual(selected.map((artist) => artist.provider_id), ["b", "c", "d", "e"]);
  assert.equal(selected[0].provider, "lastfm");
});

test("provider unavailable state is explicit and non-blocking", () => {
  assert.deepEqual(providerUnavailableResult("movies"), {
    status: "unavailable",
    message: "Search is temporarily unavailable. You can skip this step and add it later from your profile.",
    provider: "movies",
    can_skip: true,
  });
});

test("skipped media interests create a 48-hour onboarding reminder event", () => {
  assert.deepEqual(
    buildInterestReminderNotification({
      userId: "user-1",
      signupCompletedAt: "2026-06-05T00:00:00.000Z",
      skippedMovies: true,
      skippedMusic: true,
    }),
    {
      user_id: "user-1",
      event_type: "onboarding_interest_reminder",
      category: "app_updates",
      scheduled_for: "2026-06-07T00:00:00.000Z",
      payload: {
        skipped_movies: true,
        skipped_music: true,
      },
    },
  );
});

