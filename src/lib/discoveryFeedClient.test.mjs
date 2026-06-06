import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSource(relativePath) {
  return readFileSync(join(root, "src", relativePath), "utf8");
}

test("page discovery path uses discoverProfiles without production mock fallback", () => {
  const page = readSource("app/page.tsx");
  const fetchStart = page.indexOf("const fetchDiscoveryUsers");
  const fetchEnd = page.indexOf("useEffect(() => {", fetchStart);
  const fetchBlock = page.slice(fetchStart, fetchEnd);

  assert.match(page, /discoverProfiles/);
  assert.match(page, /saveFeedFilters/);
  assert.match(page, /feedSessionId/);
  assert.match(fetchBlock, /discoverProfiles\(/);
  assert.doesNotMatch(fetchBlock, /discover_users/);
  assert.doesNotMatch(fetchBlock, /getMockProfiles\(/);
});

test("DiscoveryFeed exposes persisted age and city filters plus pagination trigger", () => {
  const feed = readSource("components/DiscoveryFeed.tsx");

  assert.match(feed, /feedFilters/);
  assert.match(feed, /setFeedFilters/);
  assert.match(feed, /minAge/);
  assert.match(feed, /maxAge/);
  assert.match(feed, /city/);
  assert.match(feed, /onLoadMore/);
  assert.match(feed, /IntersectionObserver/);
});

test("DiscoveryCard is prompt-first and does not render match counts", () => {
  const card = readSource("components/DiscoveryCard.tsx");
  const detail = readSource("components/UserProfileDetail.tsx");

  assert.match(card, /profile_prompt/);
  assert.match(card, /city/);
  assert.match(card, /Slot 1/);
  assert.doesNotMatch(card, /common_interests_count|MATCH|Shared Vibes|Common Vibes/);
  assert.doesNotMatch(card, /absolute inset-0 z-0/);
  assert.doesNotMatch(detail, /common_interests_count|Shared Vibes|Common Vibes/);
});
