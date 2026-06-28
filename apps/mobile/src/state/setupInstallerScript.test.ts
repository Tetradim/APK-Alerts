import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const installerScript = new URL("../../../../tools/windows/install-mobile-consolidation.ps1", import.meta.url);

test("windows installer script exposes unattended tailscale and pairing bootstrap steps", () => {
  const script = readFileSync(installerScript, "utf8");

  assert.match(script, /function Install-TailscaleIfNeeded/);
  assert.match(script, /function Connect-TailscaleIfConfigured/);
  assert.match(script, /function Test-MobileApiPreflight/);
  assert.match(script, /function Write-SetupEvidence/);
  assert.match(script, /winget install --id Tailscale\.Tailscale/);
  assert.match(script, /tailscale up --auth-key/);
  assert.match(script, /Invoke-WebRequest/);
  assert.match(script, /apiPreflight/);
  assert.match(script, /repairCommand/);
  assert.match(script, /MOBILE_CONSOLIDATION_API_KEY/);
  assert.doesNotMatch(script, /mobile-api-key|secret-value|demo/i);
});
