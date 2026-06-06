import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Phase 12 service exposes profile editing RPC boundaries", () => {
  const service = readProjectFile("src/services/supabase.ts");

  for (const rpc of [
    "update_profile_public_fields",
    "change_username",
    "request_city_change",
    "change_sensitive_profile_field",
    "request_data_export",
  ]) {
    assert.match(service, new RegExp(`rpc\\("${rpc}"`, "i"), rpc);
  }
});

test("Phase 12 profile screen saves public fields and invisible mode", () => {
  const profile = readProjectFile("src/components/ProfileView.tsx");

  assert.match(profile, /updateProfilePublicFields/i);
  assert.match(profile, /isVisible:\s*nextVisible/i);
  assert.match(profile, /Invisible mode/i);
  assert.match(profile, /Save Profile Changes/i);
});

test("Phase 12 field editor uses one RPC for sensitive profile edits", () => {
  const editor = readProjectFile("src/components/FieldEditor.tsx");

  assert.match(editor, /changeSensitiveProfileField\(\{/i);
  assert.match(editor, /field:\s*"intention"/i);
  assert.match(editor, /field:\s*"gender"/i);
  assert.match(editor, /field:\s*"gender_preference"/i);
  assert.match(editor, /profile photos and interests will carry forward/i);
  assert.match(editor, /old conversations will close/i);
  assert.doesNotMatch(editor, /updateProfilePublicFields\(\{\s*intention/i);
});

test("Phase 12 restricted username, city, photos, and export UI are wired", () => {
  const editor = readProjectFile("src/components/FieldEditor.tsx");
  const photos = readProjectFile("src/components/PhotoGridEditor.tsx");
  const settings = readProjectFile("src/components/SettingsView.tsx");

  assert.match(editor, /changeUsername\(username\)/i);
  assert.match(editor, /requestCityChange\(city,\s*state\)/i);
  assert.match(photos, /canDeleteProfilePhoto\(photos\)/i);
  assert.match(settings, /requestDataExport/i);
  assert.match(settings, /Prepared within 48 hours/i);
});
