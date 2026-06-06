import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readSource(relativePath) {
  return readFileSync(join(root, "src", relativePath), "utf8");
}

test("page wires resumable onboarding through the Supabase service boundary", () => {
  const page = readSource("app/page.tsx");
  const service = readSource("services/supabase.ts");

  assert.match(page, /loadOnboardingProgress/);
  assert.match(page, /saveOnboardingProgress/);
  assert.match(page, /currentStep:\s*onboardingStatus/);
  assert.match(page, /setOnboardingStatus\(progress\.current_step as OnboardingStatus\)/);
  assert.match(service, /\.from\("onboarding_progress"\)/);
  assert.match(service, /\.upsert\(/);
});

test("onboarding view debounces username availability checks", () => {
  const source = readSource("components/OnboardingView.tsx");

  assert.match(source, /setUsernameStatus\(value\.trim\(\)\s*\?\s*"checking"\s*:\s*"invalid"\)/);
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /1000/);
  assert.match(source, /onCheckUsername\(trimmed\)/);
});
