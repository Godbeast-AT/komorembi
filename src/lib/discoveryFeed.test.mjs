import test from "node:test";
import assert from "node:assert/strict";

import {
  DISCOVERY_PAGE_SIZE,
  createDiscoverySessionId,
  discoveryPayloadHasNoCountMetrics,
  normalizeFeedFilters,
  sanitizeDiscoveryProfile,
} from "./discoveryFeed.mjs";

test("feed filters normalize age and city constraints", () => {
  assert.equal(DISCOVERY_PAGE_SIZE, 20);
  assert.deepEqual(normalizeFeedFilters({ minAge: 17, maxAge: 120, city: " Mumbai " }), {
    minAge: 18,
    maxAge: 100,
    city: "Mumbai",
  });
  assert.deepEqual(normalizeFeedFilters({ minAge: 35, maxAge: 22 }), {
    minAge: 35,
    maxAge: 35,
    city: "",
  });
});

test("discovery payload sanitizer removes like and match count metrics", () => {
  const sanitized = sanitizeDiscoveryProfile({
    peer_id: "peer-1",
    display_name: "Ari",
    date_of_birth: "2000-01-01",
    city: "Mumbai",
    photos: ["slot1.jpg", "slot2.jpg"],
    bio: "Ask me about pottery.",
    common_interests_count: 4,
    like_count: 9,
    match_count: 2,
  });

  assert.deepEqual(sanitized, {
    peer_id: "peer-1",
    display_name: "Ari",
    birth_date: "2000-01-01",
    city: "Mumbai",
    photos: ["slot1.jpg"],
    profile_prompt: "Ask me about pottery.",
    last_seen_at: null,
    created_at: null,
  });
  assert.equal(discoveryPayloadHasNoCountMetrics(sanitized), true);
  assert.equal(discoveryPayloadHasNoCountMetrics({ ...sanitized, match_count: 1 }), false);
});

test("discovery session id is stable when supplied and generated otherwise", () => {
  assert.equal(createDiscoverySessionId("session-1"), "session-1");
  assert.match(createDiscoverySessionId(""), /^feed-\d+$/);
});
