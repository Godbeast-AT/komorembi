import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("photo processing schema stores processed outputs, moderation status, and camera badge", () => {
  const sql = readFileSync(join(root, "supabase_schema_mvp_core.sql"), "utf8");

  assert.match(sql, /image_path\s+text\s+NOT NULL/i);
  assert.match(sql, /thumbnail_path\s+text\s+NOT NULL/i);
  assert.match(sql, /moderation_status\s+text\s+NOT NULL/i);
  assert.match(sql, /verified_camera\s+boolean\s+NOT NULL\s+DEFAULT\s+false/i);
  assert.match(sql, /flagged_for_review\s+boolean\s+NOT NULL\s+DEFAULT\s+false/i);
  assert.match(sql, /is_primary\s+boolean\s+NOT NULL\s+DEFAULT\s+false/i);
});

