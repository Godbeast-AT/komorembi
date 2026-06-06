import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Canvas 2 Edge Functions exist with placeholder-key fallback states", () => {
  for (const [path, key, unavailable] of [
    ["supabase/functions/search-movies/index.ts", "TMDB_API_KEY", "Search is temporarily unavailable"],
    ["supabase/functions/search-music/index.ts", "LASTFM_API_KEY", "Search is temporarily unavailable"],
    ["supabase/functions/enhance-message/index.ts", "AI_MESSAGE_ENHANCEMENT_API_KEY", "premium_required"],
    ["supabase/functions/premium-webhook/index.ts", "PREMIUM_BILLING_WEBHOOK_SECRET", "Unauthorized"],
  ]) {
    const source = read(path);
    assert.match(source, new RegExp(key), path);
    assert.match(source, new RegExp(unavailable), path);
  }
});

test("Supabase function config declares Canvas 2 functions", () => {
  const config = read("supabase/config.toml");

  for (const functionName of ["search-movies", "search-music", "enhance-message"]) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*true`, "i"),
      functionName,
    );
  }

  assert.match(
    config,
    /\[functions\.premium-webhook\][\s\S]*?verify_jwt\s*=\s*false/i,
  );
});

