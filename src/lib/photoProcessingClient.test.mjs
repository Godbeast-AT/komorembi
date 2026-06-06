import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("photo editor renders Phase 4 slot labels and guidance", () => {
  const source = readFileSync(join(root, "src/components/PhotoGridEditor.tsx"), "utf8");

  assert.match(source, /PHOTO_SLOT_RULES/);
  assert.match(source, /slotRule\.label/);
  assert.match(source, /slotRule\.description/);
  assert.match(source, /verifiedCameraSlots/);
  assert.match(source, /ShieldCheck/);
  assert.match(source, /Camera verified/);
});

test("onboarding completion processes uploaded photo files before the profile RPC", () => {
  const service = readFileSync(join(root, "src/services/supabase.ts"), "utf8");

  assert.match(service, /processProfilePhotoUpload/);
  assert.match(service, /\.functions\.invoke\("process-photo"/);
  assert.match(service, /new FormData\(\)/);
  assert.match(service, /formData\.set\("slot"/);
  assert.match(service, /processProfilePhotos\(input\.photos\)/);
  assert.match(service, /photos:\s*processedPhotoPaths/);
  assert.match(service, /\.rpc\("complete_onboarding_profile"/);
});
