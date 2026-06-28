import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cockpitScreen = new URL("../screens/CockpitScreen.tsx", import.meta.url);

test("cockpit screen exposes first run setup wizard without hardcoded secrets", () => {
  const source = readFileSync(cockpitScreen, "utf8");

  assert.match(source, /buildFirstRunSetupWizardSummary/);
  assert.match(source, /First-run setup/);
  assert.match(source, /setupWizard\.actionLabel/);
  assert.match(source, /router\.push\(setupWizard\.route\)/);
  assert.doesNotMatch(source, /mobile-secret|apiKey=.*secret|token/i);
});
