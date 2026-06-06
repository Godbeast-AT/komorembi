import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSource(relativePath) {
  return readFileSync(join(root, "src", relativePath), "utf8");
}

test("Supabase service exposes server-redacted waitlist preview and own queue position", () => {
  const service = readSource("services/supabase.ts");

  assert.match(service, /export type WaitlistPreviewCard/);
  assert.match(service, /\.rpc\("discover_waitlist_preview"/);
  assert.match(service, /label:\s*"Someone nearby"/);
  assert.match(service, /\.from\("waitlist_entries"\)/);
  assert.match(service, /\.select\("queue_position, status, dating_mode"\)/);
  assert.match(service, /\.rpc\("leave_waitlist"\)/);
});

test("page sends waitlisted onboarding completions to the waitlist preview screen", () => {
  const page = readSource("app/page.tsx");

  assert.match(page, /discoverWaitlistPreview\(20,\s*themeMode === "bold" \? "short_term" : "long_term"\)/);
  assert.match(page, /loadOwnWaitlistEntry\(themeMode === "bold" \? "short_term" : "long_term"\)/);
  assert.match(page, /completedProfile\?\.is_waitlisted\s*\?\s*"waitlist"\s*:\s*"completed"/);
  assert.match(page, /<WaitlistView/);
  assert.match(page, /previewCards=\{waitlistPreviewCards\}/);
  assert.match(page, /onLeaveWaitlist=\{handleLeaveWaitlist\}/);
});

test("waitlist view renders cosmetic blur over already-redacted preview data", () => {
  const view = readSource("components/WaitlistView.tsx");

  assert.match(view, /previewCards\.slice\(0,\s*4\)/);
  assert.match(view, /card\.label/);
  assert.match(view, /card\.age_bucket/);
  assert.match(view, /blur-\[/);
  assert.doesNotMatch(view, /peer_id|username|display_name|bio|photos|message action|profile open/i);
});
