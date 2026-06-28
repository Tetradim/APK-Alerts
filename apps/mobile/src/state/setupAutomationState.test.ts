import assert from "node:assert/strict";
import test from "node:test";
import { getDefaultDiscordWebViewHealthSnapshot } from "./discordWebViewState.js";
import { getDefaultLiveReadinessSnapshot } from "./liveReadinessState.js";
import { getDefaultPairingDoctorSnapshot } from "./pairingDoctorState.js";
import { getDefaultPhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState.js";
import { getDefaultRemoteEngineSnapshot } from "./remoteEngineState.js";
import { getDefaultAlertEvidenceSnapshot } from "./alertEvidenceState.js";
import { getDefaultPeerAlertFailsafeSnapshot } from "./peerAlertFailsafeState.js";
import {
  buildSetupSmokeTestSummary,
  buildSetupAutomationSummary,
  createSetupAutomationStore,
  getDefaultWindowsSetupEvidence,
  importMobilePairingPackage,
} from "./setupAutomationState.js";

function buildDefaultInput() {
  return {
    remote: getDefaultRemoteEngineSnapshot(),
    pairing: getDefaultPairingDoctorSnapshot(),
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    webView: getDefaultDiscordWebViewHealthSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
    windows: getDefaultWindowsSetupEvidence(),
  };
}

test("setup automation fails closed before installer tailscale pairing and smoke evidence exists", () => {
  const summary = buildSetupAutomationSummary(buildDefaultInput());

  assert.equal(summary.statusLabel, "Setup blocked");
  assert.equal(summary.readyCountLabel, "0/10 ready");
  assert.equal(summary.blockingCountLabel, "10 setup blocker(s)");
  assert.equal(summary.nextActionLabel, "Run Windows installer");
  assert.equal(summary.items[0]?.key, "windows_installer");
  assert.equal(summary.items[0]?.statusLabel, "Not run");
});

test("setup automation keeps tailscale blockers explicit after installer starts", () => {
  const input = buildDefaultInput();
  input.windows.installerRanAt = "2026-06-28T10:00:00Z";
  input.windows.consolidationRepoReady = true;

  const summary = buildSetupAutomationSummary(input);

  assert.equal(summary.items.find((item) => item.key === "windows_installer")?.blocking, false);
  assert.equal(summary.items.find((item) => item.key === "tailscale_installed")?.statusLabel, "Missing");
  assert.equal(summary.items.find((item) => item.key === "tailscale_connected")?.detailLabel, "Install and sign in to Tailscale on Windows.");
  assert.equal(summary.nextActionLabel, "Install Tailscale");
});

test("setup automation clears only with remote phone pairing health and smoke evidence", () => {
  const input = buildDefaultInput();
  input.windows = {
    installerRanAt: "2026-06-28T10:00:00Z",
    consolidationRepoReady: true,
    tailscaleInstalled: true,
    tailscaleLoggedIn: true,
    tailscaleIp: "100.90.10.11",
    tailscaleMagicDnsName: "desk.tailnet.ts.net",
    remoteApiBound: true,
    windowsFirewallOpen: true,
    apiReachableFromPhone: true,
    pairingPackageCreatedAt: "2026-06-28T10:01:00Z",
    pairingPackageImportedAt: "2026-06-28T10:02:00Z",
    unattendedSmokeTestPassedAt: "2026-06-28T10:03:00Z",
  };
  input.remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "redacted",
    transport: "tailscale",
  };
  input.remote.remote.engineHealth = "healthy";
  input.remote.remote.checkedAt = "2026-06-28T10:02:10Z";
  input.phoneRuntime.nativeRuntimeAvailable = true;
  input.phoneRuntime.serviceEnabled = true;
  input.phoneRuntime.foregroundServiceActive = true;
  input.phoneRuntime.health = "healthy";
  input.phoneRuntime.lastHeartbeatAt = "2026-06-28T10:02:20Z";
  input.webView.lastLoadedAt = "2026-06-28T10:02:30Z";
  input.liveReadiness.remote.checkedAt = "2026-06-28T10:02:40Z";
  input.liveReadiness.remote.readiness.readyForLive = true;
  input.pairing.lastCheckedAt = "2026-06-28T10:02:50Z";
  input.pairing.status = {
    version: 1,
    serverTime: "2026-06-28T10:02:50Z",
    apiAuthConfigured: true,
    apiKeyRequired: true,
    remoteBind: { host: "0.0.0.0", port: 8003, remoteAccessible: true },
    chromeBridgeRemoteEnabled: true,
    baseApiUrlHint: "http://100.90.10.11:8003/api",
    requiredEndpoints: [],
    blockingIssues: [],
  };

  const summary = buildSetupAutomationSummary(input);

  assert.equal(summary.statusLabel, "Setup ready");
  assert.equal(summary.readyCountLabel, "10/10 ready");
  assert.equal(summary.blocking, false);
  assert.equal(summary.nextActionLabel, "Run unattended smoke test regularly");
});

test("pairing package import extracts remote credentials and records mobile import evidence", () => {
  const result = importMobilePairingPackage(
    JSON.stringify({
      version: 1,
      app: "mobile-consolidation",
      createdAt: "2026-06-28T10:01:00Z",
      remoteApiUrl: " http://100.90.10.11:8003/api ",
      apiKey: " mobile-secret ",
      transportHint: "tailscale",
      requiredEndpoints: [],
    }),
    getDefaultWindowsSetupEvidence(),
    "2026-06-28T10:02:00Z",
  );

  assert.equal(result.ok, true);
  assert.equal(result.connection?.baseApiUrl, "http://100.90.10.11:8003/api");
  assert.equal(result.connection?.apiKey, "mobile-secret");
  assert.equal(result.evidence.pairingPackageCreatedAt, "2026-06-28T10:01:00Z");
  assert.equal(result.evidence.pairingPackageImportedAt, "2026-06-28T10:02:00Z");
  assert.equal(result.evidence.tailscaleIp, "100.90.10.11");
  assert.equal(result.evidence.tailscaleInstalled, false);
  assert.equal(result.evidence.remoteApiBound, false);
});

test("pairing package import fails closed for malformed or incomplete package payloads", () => {
  const current = {
    ...getDefaultWindowsSetupEvidence(),
    pairingPackageImportedAt: "previous",
  };
  const result = importMobilePairingPackage(
    JSON.stringify({
      version: 1,
      app: "mobile-consolidation",
      remoteApiUrl: "http://100.90.10.11:8003/api",
      apiKey: "",
    }),
    current,
    "2026-06-28T10:02:00Z",
  );

  assert.equal(result.ok, false);
  assert.equal(result.connection, null);
  assert.equal(result.evidence.pairingPackageImportedAt, "previous");
  assert.match(result.error, /API key/);
});

test("setup automation store records valid pairing imports and preserves evidence on failures", () => {
  const store = createSetupAutomationStore(() => "2026-06-28T10:02:00Z");
  const result = store.getState().importPairingPackage(JSON.stringify({
    version: 1,
    app: "mobile-consolidation",
    createdAt: "2026-06-28T10:01:00Z",
    remoteApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "mobile-secret",
    transportHint: "tailscale",
  }));

  assert.equal(result.ok, true);
  assert.equal(store.getState().snapshot.windows.pairingPackageImportedAt, "2026-06-28T10:02:00Z");
  assert.equal(store.getState().snapshot.lastImportError, "");

  const failed = store.getState().importPairingPackage("not json");

  assert.equal(failed.ok, false);
  assert.equal(store.getState().snapshot.windows.pairingPackageImportedAt, "2026-06-28T10:02:00Z");
  assert.match(store.getState().snapshot.lastImportError, /valid JSON/);
});

test("setup smoke test fails closed until pairing health alert and peer evidence all pass", () => {
  const summary = buildSetupSmokeTestSummary({
    remote: getDefaultRemoteEngineSnapshot(),
    pairing: getDefaultPairingDoctorSnapshot(),
    phoneRuntime: getDefaultPhoneEngineRuntimeSnapshot(),
    alertEvidence: getDefaultAlertEvidenceSnapshot(),
    peerFailsafe: getDefaultPeerAlertFailsafeSnapshot(),
    windows: getDefaultWindowsSetupEvidence(),
  });

  assert.equal(summary.statusLabel, "Smoke test blocked");
  assert.equal(summary.readyCountLabel, "0/6 proof(s) clear");
  assert.equal(summary.blockingCountLabel, "6 smoke blocker(s)");
  assert.equal(summary.nextActionLabel, "Import pairing package");
  assert.equal(summary.blocking, true);
});

test("setup smoke test clears only with imported pairing, healthy engines, alert proof, and peer match", () => {
  const remote = getDefaultRemoteEngineSnapshot();
  remote.connection = {
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "redacted",
    transport: "tailscale",
  };
  remote.remote.engineHealth = "healthy";
  remote.remote.checkedAt = "2026-06-28T10:02:10Z";

  const phoneRuntime = getDefaultPhoneEngineRuntimeSnapshot();
  Object.assign(phoneRuntime, {
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordIngestionEvidenceReady: true,
    peerAlertServerActive: true,
    brokerEngineReady: true,
    health: "healthy",
    lastHeartbeatAt: "2026-06-28T10:02:20Z",
    blockingReason: "",
  });

  const pairing = getDefaultPairingDoctorSnapshot();
  pairing.lastCheckedAt = "2026-06-28T10:02:30Z";
  pairing.status = {
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

  const alertEvidence = getDefaultAlertEvidenceSnapshot();
  alertEvidence.evidence.chains = [
    {
      eventId: "evt-1",
      observedAt: "2026-06-28T10:02:40Z",
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
        createdAt: "2026-06-28T10:02:40Z",
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

  const peerFailsafe = getDefaultPeerAlertFailsafeSnapshot();
  peerFailsafe.latestOutcome = {
    ok: true,
    checkedAt: "2026-06-28T10:02:50Z",
    challenge: {
      id: "challenge-event-1",
      type: "alert.peer.challenge.v1",
      schemaVersion: 1,
      sourceEngineId: "remote:windows",
      observedAt: "2026-06-28T10:02:50Z",
      sequence: 1,
      previousEventId: null,
      idempotencyKey: "peer-alert:challenge:challenge-1",
      payload: {
        challengeId: "challenge-1",
        leaseId: "lease-1",
        targetEngineId: "phone:android",
        remoteObservedAt: "2026-06-28T10:02:50Z",
        discordMessageId: "message-1",
        channelId: "channel-1",
        authorId: "author-1",
        messageUrl: "https://discord.com/channels/g/c/m",
        sourceKey: "source-1",
        normalizedTextSha256: "hash-1",
      },
    },
    response: null,
    evaluation: {
      status: "matched",
      blocking: false,
      blockingCodes: [],
      challengeId: "challenge-1",
      remoteEngineId: "remote",
      targetEngineId: "phone:android",
      responderEngineId: "phone:android",
      discordMessageId: "message-1",
      sourceKey: "source-1",
      skewMs: 150,
      detailLabel: "Phone saw matching alert within 150ms",
    },
    error: "",
  };

  const summary = buildSetupSmokeTestSummary({
    remote,
    pairing,
    phoneRuntime,
    alertEvidence,
    peerFailsafe,
    windows: {
      ...getDefaultWindowsSetupEvidence(),
      pairingPackageImportedAt: "2026-06-28T10:02:00Z",
    },
  });

  assert.equal(summary.statusLabel, "Smoke test clear");
  assert.equal(summary.readyCountLabel, "6/6 proof(s) clear");
  assert.equal(summary.blocking, false);
  assert.equal(summary.nextActionLabel, "Record unattended smoke test pass");
});
