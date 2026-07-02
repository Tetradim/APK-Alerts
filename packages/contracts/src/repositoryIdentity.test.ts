import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<string, any>;
}

test("repository and workspace packages use the Sentinel Nexus identity", () => {
  const root = readJson("../../../package.json");
  const contracts = readJson("../../../packages/contracts/package.json");
  const syncClient = readJson("../../../packages/sync-client/package.json");
  const peerServer = readJson("../../../packages/peer-alert-server/package.json");
  const mobile = readJson("../../../apps/mobile/package.json");

  assert.equal(root.name, "sentinel-nexus");
  assert.equal(contracts.name, "@sentinel-nexus/contracts");
  assert.equal(syncClient.name, "@sentinel-nexus/sync-client");
  assert.equal(peerServer.name, "@sentinel-nexus/peer-alert-server");
  assert.equal(mobile.name, "@sentinel-nexus/mobile");
  assert.equal(mobile.dependencies["@sentinel-nexus/contracts"], "0.1.0");
  assert.equal(mobile.dependencies["@sentinel-nexus/sync-client"], "0.1.0");
  assert.equal(mobile.dependencies["@sentinel-nexus/peer-alert-server"], "0.1.0");
});

test("mobile app metadata displays Sentinel Nexus", () => {
  const appJson = readJson("../../../apps/mobile/app.json");

  assert.equal(appJson.expo.name, "Sentinel Nexus");
  assert.equal(appJson.expo.slug, "sentinel-nexus");
  assert.equal(appJson.expo.scheme, "sentinelnexus");
  assert.equal(appJson.expo.android.package, "com.tetradim.sentinelnexus");
});
