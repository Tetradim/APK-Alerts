import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultPairingDoctorSnapshot } from "./pairingDoctorState.js";
import { getDefaultRemoteEngineSnapshot } from "./remoteEngineState.js";
import { getDefaultWindowsSetupEvidence } from "./setupAutomationState.js";
import {
  TAILSCALE_ANDROID_PACKAGE,
  TAILSCALE_PLAY_STORE_URL,
  buildMobileTailscaleSetupAction,
} from "./tailscaleSetupState.js";

test("tailscale setup action starts with install or open guidance before pairing", () => {
  const action = buildMobileTailscaleSetupAction({
    windows: getDefaultWindowsSetupEvidence(),
    remote: getDefaultRemoteEngineSnapshot(),
    pairing: getDefaultPairingDoctorSnapshot(),
  });

  assert.equal(action.key, "install_or_open_tailscale");
  assert.equal(action.actionLabel, "Install / Open Tailscale");
  assert.equal(action.primaryUrl, TAILSCALE_PLAY_STORE_URL);
  assert.match(action.detailLabel, /same tailnet/);
  assert.equal(action.blocking, true);
  assert.doesNotMatch(JSON.stringify(action), /apiKey|secret|token/i);
});

test("tailscale setup action runs pairing doctor after pairing import", () => {
  const remote = getDefaultRemoteEngineSnapshot();
  remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret",
    transport: "tailscale",
  };
  const windows = {
    ...getDefaultWindowsSetupEvidence(),
    pairingPackageImportedAt: "2026-06-28T10:02:00Z",
    tailscaleIp: "100.90.10.11",
  };

  const action = buildMobileTailscaleSetupAction({
    windows,
    remote,
    pairing: getDefaultPairingDoctorSnapshot(),
  });

  assert.equal(action.key, "run_pairing_doctor");
  assert.equal(action.actionLabel, "Run Pairing Doctor");
  assert.equal(action.primaryUrl, "");
  assert.equal(action.blocking, true);
  assert.doesNotMatch(JSON.stringify(action), /mobile-secret/);
});

test("tailscale setup action is ready when pairing doctor passed", () => {
  const remote = getDefaultRemoteEngineSnapshot();
  remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret",
    transport: "tailscale",
  };
  const pairing = getDefaultPairingDoctorSnapshot();
  pairing.lastCheckedAt = "2026-06-28T10:03:00Z";
  pairing.status = {
    version: 1,
    serverTime: "2026-06-28T10:03:00Z",
    apiAuthConfigured: true,
    apiKeyRequired: true,
    remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
    chromeBridgeRemoteEnabled: true,
    baseApiUrlHint: "http://100.90.10.11:8003/api",
    requiredEndpoints: [],
    blockingIssues: [],
  };

  const action = buildMobileTailscaleSetupAction({
    windows: {
      ...getDefaultWindowsSetupEvidence(),
      pairingPackageImportedAt: "2026-06-28T10:02:00Z",
      tailscaleIp: "100.90.10.11",
    },
    remote,
    pairing,
  });

  assert.equal(action.key, "ready");
  assert.equal(action.actionLabel, "Tailscale ready");
  assert.equal(action.primaryUrl, "");
  assert.equal(action.blocking, false);
});

test("tailscale setup action exposes Android package metadata", () => {
  assert.equal(TAILSCALE_ANDROID_PACKAGE, "com.tailscale.ipn");
  assert.match(TAILSCALE_PLAY_STORE_URL, /id=com\.tailscale\.ipn/);
});
