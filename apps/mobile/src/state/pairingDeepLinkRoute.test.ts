import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pairRoute = new URL("../../app/pair.tsx", import.meta.url);
const rootLayout = new URL("../../app/_layout.tsx", import.meta.url);

test("pairing deep link route redirects operators to Engines after import", () => {
  assert.equal(existsSync(pairRoute), true);
  const route = readFileSync(pairRoute, "utf8");

  assert.match(route, /Redirect/);
  assert.match(route, /href="\/engines"/);
});

test("root layout installs pairing deep link handler after persistent hydration", () => {
  const layout = readFileSync(rootLayout, "utf8");

  assert.match(layout, /installPairingDeepLinkHandler/);
  assert.match(layout, /Linking\.getInitialURL/);
  assert.match(layout, /Linking\.addEventListener\("url"/);
  assert.match(layout, /remoteEngineStore/);
  assert.match(layout, /setupAutomationStore/);
});
