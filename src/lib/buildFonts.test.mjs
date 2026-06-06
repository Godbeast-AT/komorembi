import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

function readProjectFile(path) {
  return readFileSync(join(root, path), "utf8");
}

test("app build does not depend on fetching Google Fonts", () => {
  const layout = readProjectFile("src/app/layout.tsx");
  const globals = readProjectFile("src/app/globals.css");

  assert.doesNotMatch(layout, /next\/font\/google/i);
  assert.match(globals, /--font-inter:/i);
  assert.match(globals, /--font-display:/i);
});
