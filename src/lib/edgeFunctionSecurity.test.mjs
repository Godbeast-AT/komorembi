import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("service-worker Edge Functions require an internal shared secret", () => {
  for (const path of [
    "supabase/functions/moderate-message/index.ts",
    "supabase/functions/dispatch-notifications/index.ts",
    "supabase/functions/delete-account-finalizer/index.ts",
    "supabase/functions/prepare-data-export/index.ts",
  ]) {
    const source = read(path);

    assert.match(source, /INTERNAL_FUNCTION_SECRET/, path);
    assert.match(source, /X-Internal-Function-Secret/, path);
    assert.match(source, /Unauthorized/, path);
  }
});

test("Supabase function JWT policy separates user calls from internal workers", () => {
  const config = read("supabase/config.toml");

  for (const functionName of ["process-photo", "invite-referral", "delete-account"]) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*true`, "i"),
      functionName,
    );
  }

  for (const functionName of [
    "moderate-message",
    "dispatch-notifications",
    "delete-account-finalizer",
    "prepare-data-export",
  ]) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`, "i"),
      functionName,
    );
  }
});

