import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

const readSource = (relativePath) => readFileSync(join(root, relativePath), "utf8");

test("app source uses phone OTP auth, allows Google merge auth, and blocks guest login", () => {
  const sources = [
    "app/page.tsx",
    "components/LandingPage.tsx",
    "components/SettingsView.tsx",
    "hooks/useAppBoot.ts",
    "services/supabase.ts",
  ]
    .map(readSource)
    .join("\n");

  assert.equal(existsSync(join(root, "hooks/useAuth.ts")), false);
  assert.match(sources, /supabase\.auth\.signInWithOtp/);
  assert.match(sources, /supabase\.auth\.verifyOtp/);
  assert.match(sources, /supabase\.auth\.getSession/);
  assert.match(sources, /supabase\.auth\.onAuthStateChange/);
  assert.match(sources, /buildGoogleOAuthSignInPayload/);
  assert.match(sources, /supabase\.auth\.signInWithOAuth\(googlePayload\)/);

  for (const forbidden of [
    "signInAnonymously",
    "linkIdentity",
    "useAuth",
    "Create Full Account",
    "auth:",
    "Guest User",
    "onGuest",
    "komorembi_guest_id",
  ]) {
    assert.equal(
      sources.includes(forbidden),
      false,
      `Expected source not to include ${forbidden}`,
    );
  }
});
