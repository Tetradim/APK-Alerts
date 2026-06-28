import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMobileSupportBundle,
  serializeMobileSupportBundle,
} from "./supportBundleState.js";
import { getDefaultAlertEvidenceSnapshot } from "./alertEvidenceState.js";
import { getDefaultDiscordWebViewHealthSnapshot } from "./discordWebViewState.js";
import { getDefaultLiveReadinessSnapshot } from "./liveReadinessState.js";
import { getDefaultPairingDoctorSnapshot } from "./pairingDoctorState.js";
import { getDefaultPhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState.js";
import { getDefaultReconciliationSnapshot } from "./reconciliationState.js";
import { getDefaultRemoteEngineSnapshot } from "./remoteEngineState.js";
import { getDefaultWindowsSetupEvidence } from "./setupAutomationState.js";

test("mobile support bundle redacts remote API key while keeping pairing evidence", () => {
  const remote = getDefaultRemoteEngineSnapshot();
  remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "secret-value",
    transport: "tailscale",
  };
  const pairing = getDefaultPairingDoctorSnapshot();
  pairing.status = {
    version: 1,
    serverTime: "2026-06-27T20:00:00Z",
    apiAuthConfigured: true,
    apiKeyRequired: true,
    remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
    chromeBridgeRemoteEnabled: true,
    baseApiUrlHint: "",
    requiredEndpoints: [],
    blockingIssues: [],
  };

  const bundle = buildMobileSupportBundle({
    createdAt: "2026-06-27T20:02:00Z",
    remote,
    pairing,
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    webView: getDefaultDiscordWebViewHealthSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
    alertEvidence: getDefaultAlertEvidenceSnapshot(),
    reconciliation: getDefaultReconciliationSnapshot(),
    windowsSetup: getDefaultWindowsSetupEvidence(),
  });
  const serialized = serializeMobileSupportBundle(bundle);

  assert.equal(bundle.remoteConnection.apiKeyConfigured, true);
  assert.equal(bundle.remoteConnection.apiKeyRedacted, true);
  assert.doesNotMatch(serialized, /secret-value/);
  assert.match(serialized, /pairing/);
});

test("mobile support bundle includes setup assistant evidence without exposing install secrets", () => {
  const remote = getDefaultRemoteEngineSnapshot();
  remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-api-key",
    transport: "tailscale",
  };
  const windowsSetup = getDefaultWindowsSetupEvidence();
  Object.assign(windowsSetup, {
    installerRanAt: "2026-06-28T10:00:00Z",
    consolidationRepoReady: true,
    tailscaleInstalled: true,
    tailscaleLoggedIn: true,
    tailscaleIp: "100.90.10.11",
    pairingPackageCreatedAt: "2026-06-28T10:01:00Z",
  });

  const bundle = buildMobileSupportBundle({
    createdAt: "2026-06-28T10:02:00Z",
    remote,
    pairing: getDefaultPairingDoctorSnapshot(),
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    webView: getDefaultDiscordWebViewHealthSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
    alertEvidence: getDefaultAlertEvidenceSnapshot(),
    reconciliation: getDefaultReconciliationSnapshot(),
    windowsSetup,
  });
  const serialized = serializeMobileSupportBundle(bundle);

  assert.equal(bundle.setupAssistant.summary.nextActionLabel, "Start remote API");
  assert.equal(bundle.setupAssistant.windows.tailscaleIp, "100.90.10.11");
  assert.doesNotMatch(serialized, /mobile-api-key/);
});
