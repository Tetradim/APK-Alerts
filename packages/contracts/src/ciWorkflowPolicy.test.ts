import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = new URL("../../../.github/workflows/ci.yml", import.meta.url);

test("repository CI runs typecheck and test commands", () => {
  assert.equal(existsSync(workflow), true);
  const yaml = readFileSync(workflow, "utf8");

  assert.match(yaml, /npm ci/);
  assert.match(yaml, /npm run typecheck/);
  assert.match(yaml, /npm test/);
  assert.match(yaml, /npm run lint/);
});
