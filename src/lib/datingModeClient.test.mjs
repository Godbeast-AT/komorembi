import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Supabase client types expose dating_mode on mode-specific rows", () => {
  const service = read("src/services/supabase.ts");

  assert.match(service, /dating_mode\?:\s*"long_term"\s*\|\s*"short_term"/);
  assert.match(service, /datingMode\?:\s*"long_term"\s*\|\s*"short_term"/);
  assert.match(service, /p_dating_mode:\s*datingMode/);
});

test("feed filters persist separately for each dating mode", () => {
  const service = read("src/services/supabase.ts");
  const page = read("src/app/page.tsx");

  assert.match(service, /loadFeedFilters\(datingMode/);
  assert.match(service, /saveFeedFilters\(filters:\s*FeedFilters,\s*datingMode/);
  assert.match(service, /dating_mode:\s*datingMode/);
  assert.match(page, /loadFeedFilters\(themeMode === "bold" \? "short_term" : "long_term"\)/);
  assert.match(page, /saveFeedFilters\(feedFilters,\s*themeMode === "bold" \? "short_term" : "long_term"\)/);
});

test("intention switch copy explains old mode state is not restored", () => {
  const editor = read("src/components/FieldEditor.tsx");

  assert.match(editor, /profile photos and interests will carry forward/i);
  assert.match(editor, /old conversations will close/i);
  assert.match(editor, /old waitlist position will be lost/i);
  assert.match(editor, /old feed state will not be restored/i);
});
