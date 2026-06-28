import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSetupHealthReportSummary,
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

function buildDefaultSupportInput() {
  return {
    createdAt: "2026-06-28T11:00:00Z",
    remote: getDefaultRemoteEngineSnapshot(),
    pairing: getDefaultPairingDoctorSnapshot(),
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    webView: getDefaultDiscordWebViewHealthSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
    alertEvidence: getDefaultAlertEvidenceSnapshot(),
    reconciliation: getDefaultReconciliationSnapshot(),
    windowsSetup: getDefaultWindowsSetupEvidence(),
  };
}

test("setup health report fails closed with basic next action and no secrets", () => {
  const input = buildDefaultSupportInput();
  input.remote.connection.apiKey = "secret-value";

  const report = buildSetupHealthReportSummary(input);
  const serialized = JSON.stringify(report);

  assert.equal(report.statusLabel, "Setup health blocked");
  assert.equal(report.readyCountLabel, "0/7 setup proof(s) clear");
  assert.equal(report.nextActionLabel, "Run Windows installer");
  assert.equal(report.rows[0]?.label, "Windows installer");
  assert.equal(report.rows[0]?.statusLabel, "Not run");
  assert.doesNotMatch(serialized, /secret-value/);
});

test("setup health report summarizes clear setup evidence for support bundle", () => {
  const input = buildDefaultSupportInput();
  input.remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret",
    transport: "tailscale",
  };
  Object.assign(input.windowsSetup, {
    installerRanAt: "2026-06-28T10:00:00Z",
    consolidationRepoReady: true,
    tailscaleInstalled: true,
    tailscaleLoggedIn: true,
    tailscaleIp: "100.90.10.11",
    remoteApiBound: true,
    windowsFirewallOpen: true,
    apiReachableFromPhone: true,
    pairingPackageCreatedAt: "2026-06-28T10:01:00Z",
    pairingPackageImportedAt: "2026-06-28T10:02:00Z",
    unattendedSmokeTestPassedAt: "2026-06-28T10:04:00Z",
  });
  input.windowsSetup.apiPreflight = {
    checkedAt: "2026-06-28T10:01:30Z",
    remoteApiUrl: "http://100.90.10.11:8003/api",
    apiPort: 8003,
    firewallRuleName: "Mobile Consolidation API 8003",
    firewallRulePresent: true,
    localHealthOk: true,
    phoneReachabilityOk: true,
    httpStatus: 200,
    failureStage: "",
    repairHint: "",
    repairCommand: "",
  };
  input.pairing.lastCheckedAt = "2026-06-28T10:02:30Z";
  input.pairing.status = {
    version: 1,
    serverTime: "2026-06-28T10:02:30Z",
    apiAuthConfigured: true,
    apiKeyRequired: true,
    remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
    chromeBridgeRemoteEnabled: true,
    baseApiUrlHint: "http://100.90.10.11:8003/api",
    requiredEndpoints: [],
    blockingIssues: [],
  };
  Object.assign(input.phoneRuntime, {
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordIngestionEvidenceReady: true,
    peerAlertServerActive: true,
    brokerEngineReady: true,
    health: "healthy",
    lastHeartbeatAt: "2026-06-28T10:03:00Z",
    blockingReason: "",
  });
  input.alertEvidence.evidence.chains = [
    {
      eventId: "evt-1",
      observedAt: "2026-06-28T10:03:30Z",
      status: "accepted",
      executable: false,
      latestReason: "queued paper trade",
      rawText: "BUY AAPL 1",
      parserConfidence: "high",
      channelName: "alerts",
      authorName: "source",
      signal: null,
      decision: {
        auditEventId: "audit-1",
        category: "alert",
        action: "accepted",
        summary: "accepted",
        severity: "info",
        createdAt: "2026-06-28T10:03:30Z",
        contractVersion: "chrome.discord.message.v1",
        eventId: "evt-1",
        channel: { id: "channel-1", name: "alerts", url: "https://discord.com/channels/g/c", messageUrl: "https://discord.com/channels/g/c/m" },
        author: { id: "author-1", name: "source" },
        bridgeTarget: { id: "target-1", name: "target" },
        rawText: "BUY AAPL 1",
        capturePath: "",
        parsed: { symbol: "AAPL", side: "buy", quantity: 1 },
        parserMetadata: { confidence: "high" },
        parserConfidence: "high",
        source: {
          key: "source-1",
          name: "Source",
          overrideMatched: true,
          paperOnly: true,
          requireManualConfirm: false,
          minParserConfidence: "medium",
          observedParserConfidence: "high",
          parserConfidenceAllowed: true,
          allowedChannelUrlCount: 1,
          channelUrlAllowed: true,
          allowedAuthorIdCount: 1,
          authorIdAllowed: true,
          metadataPolicyPassed: true,
        },
        decision: {
          status: "accepted",
          alertInserted: true,
          alertId: "alert-1",
          tradeRequested: true,
          tradeRequestReason: "paper queue accepted",
          skipReason: "",
        },
        status: "accepted",
      },
    },
  ];

  const report = buildSetupHealthReportSummary(input);

  assert.equal(report.statusLabel, "Setup health clear");
  assert.equal(report.readyCountLabel, "7/7 setup proof(s) clear");
  assert.equal(report.blocking, false);
  assert.equal(report.nextActionLabel, "Attach setup support bundle");
  assert.equal(report.rows.find((row) => row.key === "alert_route")?.statusLabel, "Test proof clear");
  assert.doesNotMatch(JSON.stringify(report), /mobile-secret/);
});

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
  assert.equal(bundle.setupHealthReport.statusLabel, "Setup health blocked");
  assert.equal(bundle.setupAssistant.windows.tailscaleIp, "100.90.10.11");
  assert.doesNotMatch(serialized, /mobile-api-key/);
});
