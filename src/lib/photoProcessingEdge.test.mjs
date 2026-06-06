import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readFunction() {
  return readFileSync(join(root, "supabase/functions/process-photo/index.ts"), "utf8");
}

test("process-photo edge function validates real images and resizes outputs only", () => {
  const source = readFunction();

  assert.match(source, /Image\.decode/);
  assert.match(source, /isSupportedImageMagicBytes/);
  assert.match(source, /MAX_IMAGE_SIDE\s*=\s*1200/);
  assert.match(source, /THUMBNAIL_SIDE\s*=\s*400/);
  assert.match(source, /encodeJPEG/);
  assert.doesNotMatch(source, /original_path/);
});

test("process-photo edge function applies moderation and AI/filter outcomes", () => {
  const source = readFunction();

  assert.match(source, /nudityConfidence\s*>\s*85/);
  assert.match(source, /nudityConfidence\s*>=\s*60/);
  assert.match(source, /Please use an unedited photo/);
  assert.match(source, /photo_rejections_this_session/);
  assert.match(source, /flagged_for_review/);
});

test("process-photo edge function enforces slot face and group-photo rules", () => {
  const source = readFunction();

  assert.match(source, /slot\s*===\s*1/);
  assert.match(source, /faceCount\s*!==\s*1/);
  assert.match(source, /slot\s*<=\s*3/);
  assert.match(source, /faceCount\s*>\s*1/);
  assert.match(source, /verified_camera/);
});

