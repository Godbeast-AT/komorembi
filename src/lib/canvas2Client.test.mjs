import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("login shell exposes Google OAuth alongside phone OTP", () => {
  const landing = read("src/components/LandingPage.tsx");
  const service = read("src/services/supabase.ts");

  assert.match(landing, /Continue with Google/i);
  assert.match(landing, /signInWithGoogle/i);
  assert.match(service, /signInWithOAuth/);
  assert.match(service, /provider:\s*"google"/);
});

test("Supabase service exposes Canvas 2 interest and timeline boundaries", () => {
  const service = read("src/services/supabase.ts");

  assert.match(service, /\.functions\.invoke\("search-movies"/);
  assert.match(service, /\.functions\.invoke\("search-music"/);
  assert.match(service, /rpc\("save_profile_interests"/);
  assert.match(service, /rpc\("set_timeline_preference"/);
  assert.match(service, /onboarding_interest_reminder/);
});

test("Supabase service exposes premium AI and subscription boundaries", () => {
  const service = read("src/services/supabase.ts");

  assert.match(service, /\.functions\.invoke\("enhance-message"/);
  assert.match(service, /rpc\("create_premium_checkout_session"/);
  assert.match(service, /rpc\("record_profile_view"/);
  assert.match(service, /rpc\("get_profile_viewers"/);
});

test("Onboarding view includes timeline, hobbies, movies, and music steps", () => {
  const onboarding = read("src/components/OnboardingView.tsx");

  assert.match(onboarding, /How quickly do you want to move toward meeting someone/i);
  assert.match(onboarding, /Photography/i);
  assert.match(onboarding, /Movies you love/i);
  assert.match(onboarding, /Music artists you love/i);
  const preferenceOptions = /const PREFERENCE_OPTIONS = \[(.*?)\];/s.exec(onboarding)?.[1] || "";
  assert.doesNotMatch(preferenceOptions, /None/i);
});
