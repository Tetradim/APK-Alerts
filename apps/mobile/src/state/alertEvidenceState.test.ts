import assert from "node:assert/strict";
import test from "node:test";
import {
  CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
  buildAlertEvidenceChains,
  normalizeBridgeAlertDecisionEvent,
  normalizeBridgeHealthPayload,
  normalizeBridgeSignalEvent,
} from "@apk-alerts/contracts";
import {
  buildBridgeSupervisorSummary,
  buildSourcePolicySummary,
  buildAlertEvidenceSummary,
  createAlertEvidenceStore,
  getDefaultAlertEvidenceSnapshot,
  type AlertEvidenceChecker,
} from "./alertEvidenceState.js";

const signal = normalizeBridgeSignalEvent({
  event_id: "bus-1",
  event_type: "signal.observed",
  source_bot: "chrome-discord-bridge",
  created_at: "2026-06-27T17:00:00.000Z",
  correlation_id: "chrome-message-1",
  payload: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    channel_id: "chrome-alerts",
    channel_name: "chrome-alerts",
    author_id: "mike",
    author_name: "MikeInvesting",
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    parser_metadata: { confidence: "high" },
    ingestion_result: {
      status: "accepted",
      alert_inserted: true,
      alert_id: "alert-1",
      trade_requested: false,
      trade_request_reason: "auto trading disabled",
      skip_reason: "",
    },
  },
});

const acceptedDecision = normalizeBridgeAlertDecisionEvent({
  id: "audit-1",
  category: "alert_ingestion",
  action: "bridge_alert_decision",
  summary: "Chrome bridge alert accepted.",
  severity: "info",
  created_at: "2026-06-27T17:00:01.000Z",
  details: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    channel: { id: "chrome-alerts", name: "chrome-alerts" },
    author: { id: "mike", name: "MikeInvesting" },
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    parser: { confidence: "high" },
    source: {
      key: "chrome-alerts",
      name: "Chrome Alerts",
      override_matched: true,
      paper_only: false,
      require_manual_confirm: false,
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
      alert_id: "alert-1",
      trade_requested: false,
      trade_request_reason: "auto trading disabled",
      skip_reason: "",
    },
  },
});

function evidenceSnapshot(overrides = {}) {
  const chains = buildAlertEvidenceChains({ signals: [signal], decisions: [acceptedDecision] });
  return {
    checkedAt: "2026-06-27T17:02:00.000Z",
    bridgeHealth: normalizeBridgeHealthPayload({
      healthy: true,
      status: "healthy",
      issues: [],
      last_heartbeat: { bridge_enabled: true, channel_id: "chrome-alerts" },
    }),
    signals: [signal],
    decisions: [acceptedDecision],
    chains,
    ...overrides,
  };
}

test("default alert evidence summary is unpaired and does not invent alerts", () => {
  const summary = buildAlertEvidenceSummary(getDefaultAlertEvidenceSnapshot());

  assert.equal(summary.connectionLabel, "Not paired");
  assert.equal(summary.bridgeHealthLabel, "Unknown");
  assert.equal(summary.latestAlertLabel, "No alert evidence");
  assert.equal(summary.liveReadinessLabel, "Live readiness not proven");
});

test("accepted alert evidence summarizes audit-only execution state", () => {
  const summary = buildAlertEvidenceSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    connection: { baseApiUrl: "http://100.90.10.11:8001/api", apiKey: "secret", transport: "tailscale" },
    evidence: evidenceSnapshot(),
  });

  assert.equal(summary.connectionLabel, "Tailscale");
  assert.equal(summary.bridgeHealthLabel, "Healthy");
  assert.equal(summary.latestAlertLabel, "Accepted - chrome-message-1");
  assert.equal(summary.latestDecisionLabel, "auto trading disabled");
  assert.equal(summary.liveReadinessLabel, "Audit only - live readiness not proven");
});

test("skipped alert evidence surfaces parser and source skip reason", () => {
  const skippedDecision = normalizeBridgeAlertDecisionEvent({
    ...acceptedDecision,
    id: "audit-low-confidence",
    severity: "warning",
    details: {
      ...acceptedDecision,
      event_id: "chrome-message-1",
      parser: { confidence: "low" },
      source: {
        override_matched: true,
        min_parser_confidence: "medium",
        observed_parser_confidence: "low",
        parser_confidence_allowed: false,
        channel_url_allowed: true,
        author_id_allowed: true,
        metadata_policy_passed: false,
      },
      decision: {
        status: "skipped",
        alert_inserted: false,
        alert_id: "",
        trade_requested: false,
        trade_request_reason: "",
        skip_reason: "parser confidence low below required medium",
      },
    },
  });
  const summary = buildAlertEvidenceSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    evidence: evidenceSnapshot({
      decisions: [skippedDecision],
      chains: buildAlertEvidenceChains({ signals: [signal], decisions: [skippedDecision] }),
    }),
  });

  assert.equal(summary.latestAlertLabel, "Skipped - chrome-message-1");
  assert.equal(summary.latestDecisionLabel, "parser confidence low below required medium");
});

test("bridge health issues surface as operator warning", () => {
  const summary = buildAlertEvidenceSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    evidence: evidenceSnapshot({
      bridgeHealth: normalizeBridgeHealthPayload({
        healthy: false,
        status: "unhealthy",
        issues: ["chrome bridge is disabled"],
        last_heartbeat: { bridge_enabled: false },
      }),
    }),
  });

  assert.equal(summary.bridgeHealthLabel, "Unhealthy");
  assert.equal(summary.bridgeHealthDetail, "chrome bridge is disabled");
});

test("bridge supervisor summary surfaces healthy service worker supervision", () => {
  const summary = buildBridgeSupervisorSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    evidence: evidenceSnapshot({
      bridgeHealth: normalizeBridgeHealthPayload({
        healthy: true,
        status: "healthy",
        issues: [],
        last_heartbeat: {
          status: "ok",
          bridge_enabled: true,
          channel_id: "chrome-extension-service-worker",
          details: {
            source: "service_worker",
            reason: "alarm",
            supervised_tabs: 1,
            restarted_tabs: 0,
          },
        },
      }),
    }),
  });

  assert.equal(summary.statusLabel, "Supervisor healthy");
  assert.equal(summary.gateLabel, "Supervisor clear");
  assert.equal(summary.detailLabel, "service_worker - alarm");
  assert.equal(summary.tabLabel, "Tabs: 1 supervised, 0 restarted");
  assert.equal(summary.backoffLabel, "Backoff idle");
  assert.equal(summary.failureLabel, "Failures: none");
  assert.equal(summary.blocking, false);
});

test("bridge supervisor summary surfaces restart backoff and failures", () => {
  const summary = buildBridgeSupervisorSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    evidence: evidenceSnapshot({
      bridgeHealth: normalizeBridgeHealthPayload({
        healthy: false,
        status: "unhealthy",
        issues: ["chrome bridge reported restart_error"],
        last_heartbeat: {
          status: "restart_error",
          bridge_enabled: true,
          channel_id: "chrome-extension-service-worker",
          details: {
            source: "service_worker",
            reason: "consolidation-bridge-supervisor",
            failures: ["content script did not respond after restart"],
            restart_attempt: 2,
            next_restart_at: "2026-06-27T17:05:00.000Z",
          },
        },
      }),
    }),
  });

  assert.equal(summary.statusLabel, "Supervisor backoff");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.backoffLabel, "Backoff attempt 2, next retry 2026-06-27T17:05:00.000Z");
  assert.equal(summary.failureLabel, "Failures: content script did not respond after restart");
  assert.equal(summary.blocking, true);
});

test("bridge supervisor summary treats disabled supervisor as blocking", () => {
  const summary = buildBridgeSupervisorSummary({
    ...getDefaultAlertEvidenceSnapshot(),
    evidence: evidenceSnapshot({
      bridgeHealth: normalizeBridgeHealthPayload({
        healthy: false,
        status: "unhealthy",
        issues: ["chrome bridge is disabled"],
        last_heartbeat: {
          status: "disabled",
          bridge_enabled: false,
          details: { source: "service_worker", reason: "settings_changed", supervisor: "disabled" },
        },
      }),
    }),
  });

  assert.equal(summary.statusLabel, "Supervisor disabled");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.detailLabel, "service_worker - settings_changed");
  assert.equal(summary.blocking, true);
});

test("bridge supervisor summary treats missing heartbeat as unknown and blocking", () => {
  const summary = buildBridgeSupervisorSummary(getDefaultAlertEvidenceSnapshot());

  assert.equal(summary.statusLabel, "Supervisor unknown");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.detailLabel, "No supervisor heartbeat");
  assert.equal(summary.backoffLabel, "Backoff not reported");
  assert.equal(summary.blocking, true);
});

test("source policy summary exposes strict passing source, channel, author, and parser proof", () => {
  const chain = evidenceSnapshot().chains[0];
  const summary = buildSourcePolicySummary(chain);

  assert.equal(summary.statusLabel, "Source policy passed");
  assert.equal(summary.gateLabel, "Source gate clear");
  assert.equal(summary.sourceLabel, "Chrome Alerts (chrome-alerts) - override matched");
  assert.equal(summary.confidenceLabel, "Parser high >= medium");
  assert.equal(summary.channelLabel, "Channel allowed (1 allowlist entry)");
  assert.equal(summary.authorLabel, "Author allowed (1 allowlist entry)");
  assert.equal(summary.executionModeLabel, "Auto-live source allowed");
  assert.equal(summary.blocking, false);
});

test("source policy summary exposes blocked parser, channel, and author proof", () => {
  const blockedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-source-blocked",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert skipped.",
    severity: "warning",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-1",
      channel: { id: "chrome-alerts", name: "chrome-alerts" },
      author: { id: "mike", name: "MikeInvesting" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser: { confidence: "low" },
      source: {
        key: "chrome-alerts",
        name: "Chrome Alerts",
        override_matched: true,
        paper_only: true,
        require_manual_confirm: true,
        min_parser_confidence: "medium",
        observed_parser_confidence: "low",
        parser_confidence_allowed: false,
        allowed_channel_url_count: 1,
        channel_url_allowed: false,
        allowed_author_id_count: 2,
        author_id_allowed: false,
        metadata_policy_passed: false,
      },
      decision: {
        status: "skipped",
        alert_inserted: false,
        alert_id: "",
        trade_requested: false,
        trade_request_reason: "",
        skip_reason: "source metadata policy failed",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [signal], decisions: [blockedDecision] })[0];
  const summary = buildSourcePolicySummary(chain);

  assert.equal(summary.statusLabel, "Source policy blocked");
  assert.equal(summary.gateLabel, "Blocks alert");
  assert.equal(summary.sourceLabel, "Chrome Alerts (chrome-alerts) - override matched");
  assert.equal(summary.confidenceLabel, "Parser low below medium");
  assert.equal(summary.channelLabel, "Channel blocked (1 allowlist entry)");
  assert.equal(summary.authorLabel, "Author blocked (2 allowlist entries)");
  assert.equal(summary.executionModeLabel, "Paper-only source; manual confirmation required");
  assert.equal(summary.blocking, true);
});

test("source policy summary fails closed when proof is missing", () => {
  const chain = buildAlertEvidenceChains({ signals: [signal], decisions: [] })[0];
  const summary = buildSourcePolicySummary(chain);

  assert.equal(summary.statusLabel, "Source proof missing");
  assert.equal(summary.gateLabel, "Blocks alert");
  assert.equal(summary.sourceLabel, "No source policy proof");
  assert.equal(summary.confidenceLabel, "Parser proof missing");
  assert.equal(summary.channelLabel, "Channel proof missing");
  assert.equal(summary.authorLabel, "Author proof missing");
  assert.equal(summary.executionModeLabel, "Execution mode unknown");
  assert.equal(summary.blocking, true);
});

test("alert evidence store refreshes and clears stale evidence on connection edit", async () => {
  const checker: AlertEvidenceChecker = async (config) => {
    assert.equal(config.baseApiUrl, "http://100.90.10.11:8001/api");
    assert.equal(config.apiKey, "secret");
    return { ok: true, snapshot: evidenceSnapshot(), error: "" };
  };
  const store = createAlertEvidenceStore(checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  await store.getState().refreshEvidence();
  assert.equal(store.getState().snapshot.evidence.chains.length, 1);

  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });

  assert.equal(store.getState().snapshot.connection.transport, "cloud_relay");
  assert.equal(store.getState().snapshot.evidence.chains.length, 0);
  assert.equal(store.getState().snapshot.lastError, "");
});
