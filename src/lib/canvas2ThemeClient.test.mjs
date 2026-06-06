import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const discoveryCardSource = readFileSync(new URL("../components/DiscoveryCard.tsx", import.meta.url), "utf8");
const discoveryFeedSource = readFileSync(new URL("../components/DiscoveryFeed.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("DiscoveryCard exposes calm and bold theme modes", () => {
  assert.match(discoveryCardSource, /themeMode\?:\s*"calm"\s*\|\s*"bold"/);
  assert.match(discoveryCardSource, /themeMode\s*=\s*"calm"/);
  assert.match(discoveryCardSource, /data-theme-mode=\{themeMode\}/);
  assert.match(discoveryCardSource, /data-parallax-target-fps=\{isBold\s*\?\s*60\s*:\s*undefined\}/);
  assert.match(discoveryCardSource, /photo_first|isBold/);
});

test("DiscoveryFeed passes the active theme mode to every profile card", () => {
  assert.match(discoveryFeedSource, /themeMode\?:\s*"calm"\s*\|\s*"bold"/);
  assert.match(discoveryFeedSource, /themeMode\s*=\s*"calm"/);
  assert.match(discoveryFeedSource, /themeMode=\{themeMode\}/);
});

test("App shell derives theme mode from intention and applies it to discovery", () => {
  assert.match(pageSource, /deriveThemeModeFromIntention/);
  assert.match(pageSource, /const themeMode = deriveThemeModeFromIntention\(intention\)/);
  assert.match(pageSource, /theme-\$\{themeMode\}/);
  assert.match(pageSource, /themeMode=\{themeMode\}/);
});

test("Global CSS defines calm and bold theme token scopes", () => {
  assert.match(globalsSource, /\.theme-calm/);
  assert.match(globalsSource, /\.theme-bold/);
  assert.match(globalsSource, /--profile-card-layout:\s*text_first/);
  assert.match(globalsSource, /--profile-card-layout:\s*photo_first/);
  assert.match(globalsSource, /--bold-card-parallax-target-fps:\s*60/);
});
