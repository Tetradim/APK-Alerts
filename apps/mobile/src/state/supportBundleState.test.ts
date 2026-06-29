import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertEvidenceChains,
  CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
  DEFAULT_DISCORD_INGESTION_SETTINGS,
  normalizeBridgeAlertDecisionEvent,
  normalizeLiveReadinessPayload,
  normalizeReconciliationPayload,
} from "@apk-alerts/contracts";
import {
  buildSetupHealthReportSummary,
  buildMobileSupportBundle,
  serializeMobileSupportBundle,
  type MobileSupportBundleInput,
} from "./supportBundleState.js";
import { getDefaultAlertEvidenceSnapshot } from "./alertEvidenceState.js";
import { getDefaultDiscordWebViewHealthSnapshot } from "./discordWebViewState.js";
import { getDefaultLiveReadinessSnapshot } from "./liveReadinessState.js";
import { getDefaultPairingDoctorSnapshot } from "./pairingDoctorState.js";
import { getDefaultPhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState.js";
import { getDefaultReconciliationSnapshot } from "./reconciliationState.js";
import { getDefaultRemoteEngineSnapshot } from "./remoteEngineState.js";
import { getDefaultWindowsSetupEvidence } from "./setupAutomationState.js";

function buildDefaultSupportInput(): MobileSupportBundleInput {
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
          allowedChannelUrlCountProvided: true,
          channelUrlAllowed: true,
          allowedAuthorIdCount: 1,
          allowedAuthorIdCountProvided: true,
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

test("mobile support bundle includes redacted alert audit digests", () => {
  const alertText = "BTO SPY 500C 6/21 @ 1.25";
  const decision = normalizeBridgeAlertDecisionEvent({
    id: "audit-support-digest",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert accepted and queued.",
    severity: "info",
    created_at: "2026-06-28T10:03:30Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-support-digest",
      channel: {
        id: "chrome-alerts",
        name: "chrome-alerts",
        url: "https://discord.com/channels/guild/channel",
        message_url: "https://discord.com/channels/guild/channel/message",
      },
      author: { id: "author-1", name: "source" },
      raw_text: alertText,
      parsed: { ticker: "SPY" },
      parser: { confidence: "high" },
      source: {
        key: "chrome-alerts",
        name: "Chrome Alerts",
        override_matched: true,
        min_parser_confidence: "medium",
        observed_parser_confidence: "high",
        parser_confidence_allowed: true,
        allowed_channel_url_count: 1,
        channel_url_allowed: true,
        allowed_author_id_count: 1,
        author_id_allowed: true,
        metadata_policy_passed: true,
      },
      decision: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-support-digest",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const input = buildDefaultSupportInput();
  input.alertEvidence.evidence.chains = buildAlertEvidenceChains({ decisions: [decision] });
  input.reconciliation.remote.rows = normalizeReconciliationPayload([
    {
      alert_id: "alert-support-digest",
      order_id: "order-support-digest",
      position_id: "position-support-digest",
      position_status: "open",
      simulated: false,
    },
  ]);

  const bundle = buildMobileSupportBundle(input);
  const serialized = serializeMobileSupportBundle(bundle);

  assert.equal(bundle.alertEvidence.latestDigest?.eventId, "chrome-message-support-digest");
  assert.equal(bundle.alertEvidence.latestDigest?.alertId, "alert-support-digest");
  assert.equal(bundle.alertEvidence.latestDigest?.auditEventId, "audit-support-digest");
  assert.equal(bundle.alertEvidence.digests.length, 1);
  assert.match(bundle.alertEvidence.latestDigest?.rawTextFingerprint ?? "", /^fnv1a32:[0-9a-f]{8}$/);
  assert.doesNotMatch(serialized, /BTO SPY/);
});

test("mobile support bundle includes reconciliation audit digests", () => {
  const input = buildDefaultSupportInput();
  input.reconciliation.remote.rows = normalizeReconciliationPayload([
    {
      alert_id: "alert-reconcile-digest",
      ticker: "AAPL",
      expiration: "2026-07-17",
      strike: 210,
      option_type: "CALL",
      processed: true,
      trade_requested: true,
      trade_executed: true,
      trade_id: "trade-reconcile-digest",
      trade_status: "filled",
      order_id: "order-reconcile-digest",
      position_id: "position-reconcile-digest",
      position_status: "open",
      simulated: false,
      attention_reason: "",
    },
  ]);

  const bundle = buildMobileSupportBundle(input);

  assert.equal(bundle.reconciliation.latestDigest?.alertId, "alert-reconcile-digest");
  assert.equal(bundle.reconciliation.latestDigest?.contractKey, "AAPL-2026-07-17-210-CALL");
  assert.equal(bundle.reconciliation.latestDigest?.tradeId, "trade-reconcile-digest");
  assert.equal(bundle.reconciliation.latestDigest?.orderId, "order-reconcile-digest");
  assert.equal(bundle.reconciliation.latestDigest?.positionId, "position-reconcile-digest");
  assert.equal(bundle.reconciliation.latestDigest?.lifecycleGateLabel, "Lifecycle clear");
  assert.equal(bundle.reconciliation.latestDigest?.blocking, false);
  assert.equal(bundle.reconciliation.digests.length, 1);
});

test("mobile support bundle includes exit protection audit digest", () => {
  const input = buildDefaultSupportInput();
  input.remote.connection.apiKey = "mobile-api-key";
  input.liveReadiness.remote = {
    checkedAt: "2026-06-28T12:15:00Z",
    liveMoneyReady: false,
    readiness: normalizeLiveReadinessPayload({
      ready_for_live: false,
      blocking_issues: [{ code: "oco_exit_protection_missing", message: "Open positions are missing OCO exits." }],
      blocking_codes: ["oco_exit_protection_missing"],
      checks: {
        exit_automation: {
          oco_exits_configured: false,
          broker_order_status_supported: true,
          broker_cancel_supported: false,
          unprotected_open_position_count: 1,
          unprotected_open_position_ids: ["position-support-1"],
          metadata_only_open_position_count: 0,
        },
      },
    }),
  };

  const bundle = buildMobileSupportBundle(input);
  const serialized = serializeMobileSupportBundle(bundle);

  assert.equal(bundle.liveReadiness.exitProtectionDigest.checkedAt, "2026-06-28T12:15:00Z");
  assert.equal(bundle.liveReadiness.exitProtectionDigest.gateLabel, "Blocks live");
  assert.equal(bundle.liveReadiness.exitProtectionDigest.unprotectedOpenPositionCount, 1);
  assert.deepEqual(bundle.liveReadiness.exitProtectionDigest.blockingLabels, [
    "OCO exits missing",
    "Broker exit automation capabilities missing",
    "Unprotected positions: position-support-1",
  ]);
  assert.doesNotMatch(serialized, /mobile-api-key/);
});

test("mobile support bundle includes Discord ingestion route digest without token", () => {
  const input = buildDefaultSupportInput();
  input.discordIngestionSettings = {
    ...DEFAULT_DISCORD_INGESTION_SETTINGS,
    botToken: "discord-secret-token",
    guildId: "guild-1",
    routePriority: ["bot_engine", "webview"],
  };
  Object.assign(input.phoneRuntime, {
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    discordEngineReady: true,
    discordGatewayConnected: false,
    discordIngestionEvidenceReady: false,
    discordGatewayStatus: "connecting",
  });

  const bundle = buildMobileSupportBundle(input);
  const serialized = serializeMobileSupportBundle(bundle);

  assert.equal(bundle.discordIngestion.routeDigest.priorityLabel, "Bot Engine -> WebView");
  assert.equal(bundle.discordIngestion.routeDigest.gateLabel, "Discord route blocked");
  assert.equal(bundle.discordIngestion.routeDigest.botTokenConfigured, true);
  assert.equal(bundle.discordIngestion.routeDigest.evidenceLabels[0], "Bot Gateway: waiting");
  assert.deepEqual(bundle.discordIngestion.routeDigest.blockingRouteLabels, [
    "Bot Engine: Bot Engine Gateway not ready.",
    "WebView: WebView session has not produced alert evidence.",
  ]);
  assert.doesNotMatch(serialized, /discord-secret-token/);
});
