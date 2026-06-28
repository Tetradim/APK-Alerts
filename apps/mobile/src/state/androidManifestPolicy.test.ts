import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("release Android manifest permits private HTTP remote engine APIs", () => {
  const manifest = readFileSync(resolve("android/app/src/main/AndroidManifest.xml"), "utf8");

  assert.match(manifest, /android:usesCleartextTraffic="true"/);
});
