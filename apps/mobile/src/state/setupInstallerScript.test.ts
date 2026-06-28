import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const installerScript = new URL("../../../../tools/windows/install-mobile-consolidation.ps1", import.meta.url);
const launcherScript = new URL("../../../../tools/windows/start-mobile-consolidation-setup.cmd", import.meta.url);

test("windows installer script exposes unattended tailscale and pairing bootstrap steps", () => {
  const script = readFileSync(installerScript, "utf8");

  assert.match(script, /function Install-TailscaleIfNeeded/);
  assert.match(script, /function Connect-TailscaleIfConfigured/);
  assert.match(script, /function Test-MobileApiPreflight/);
  assert.match(script, /function New-PairingDeepLink/);
  assert.match(script, /function Write-SetupEvidence/);
  assert.match(script, /winget install --id Tailscale\.Tailscale/);
  assert.match(script, /tailscale up --auth-key/);
  assert.match(script, /apkalerts:\/\/pair\?payload=/);
  assert.match(script, /mobile-pairing-link\.txt/);
  assert.match(script, /Invoke-WebRequest/);
  assert.match(script, /apiPreflight/);
  assert.match(script, /repairCommand/);
  assert.match(script, /MOBILE_CONSOLIDATION_API_KEY/);
  assert.match(script, /Tailscale did not report a phone-reachable IP/i);
  assert.doesNotMatch(script, /127\.0\.0\.1/);
  assert.doesNotMatch(script, /mobile-api-key|secret-value|demo/i);
});

test("windows setup launcher provides one click elevated bootstrap", () => {
  const script = readFileSync(launcherScript, "utf8");

  assert.match(script, /install-mobile-consolidation\.ps1/);
  assert.match(script, /net session/);
  assert.match(script, /Start-Process/);
  assert.match(script, /-Verb RunAs/);
  assert.match(script, /-ExecutionPolicy Bypass/);
  assert.match(script, /-NoProfile/);
  assert.match(script, /%ERRORLEVEL%/);
  assert.match(script, /pause/);
  assert.doesNotMatch(script, /mobile-api-key|secret-value|demo/i);
});
