import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const enginesScreen = new URL("../screens/EnginesScreen.tsx", import.meta.url);

test("engines screen exposes guided Tailscale setup action without hardcoded secrets", () => {
  const source = readFileSync(enginesScreen, "utf8");

  assert.match(source, /buildMobileTailscaleSetupAction/);
  assert.match(source, /Tailscale Setup/);
  assert.match(source, /Linking\.openURL/);
  assert.match(source, /tailscaleAction\.actionLabel/);
  assert.doesNotMatch(source, /mobile-secret|apiKey=.*secret|token/i);
});
