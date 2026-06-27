import assert from "node:assert/strict";
import test from "node:test";
import {
  CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
  buildAlertEvidenceChains,
  normalizeReconciliationPayload,
  normalizeBridgeAlertDecisionEvent,
  normalizeBridgeHealthPayload,
  normalizeBridgeSignalEvent,
} from "@apk-alerts/contracts";
import {
  buildAlertReconciliationTraceSummary,
  buildAlertTestEvidenceSummary,
  buildBridgeSupervisorSummary,
  buildQueuePlaceEvidenceSummary,
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

test("queue place summary exposes audited inserted alert and queued trade request", () => {
  const queuedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-queued",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert accepted and queued.",
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
        override_matched: true,
        parser_confidence_allowed: true,
        channel_url_allowed: true,
        author_id_allowed: true,
        metadata_policy_passed: true,
      },
      decision: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-queued",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [signal], decisions: [queuedDecision] })[0];
  const summary = buildQueuePlaceEvidenceSummary(chain);

  assert.equal(summary.statusLabel, "Order request queued");
  assert.equal(summary.gateLabel, "Queue proof clear");
  assert.equal(summary.alertInsertLabel, "Alert inserted: alert-queued");
  assert.equal(summary.queueLabel, "Trade request queued");
  assert.equal(summary.reasonLabel, "risk approved; order intent queued");
  assert.equal(summary.auditLabel, "Audited decision: audit-queued");
  assert.equal(summary.blocking, false);
});

test("queue place summary exposes audited alert insertion without queued execution", () => {
  const chain = evidenceSnapshot().chains[0];
  const summary = buildQueuePlaceEvidenceSummary(chain);

  assert.equal(summary.statusLabel, "Alert captured only");
  assert.equal(summary.gateLabel, "No order queued");
  assert.equal(summary.alertInsertLabel, "Alert inserted: alert-1");
  assert.equal(summary.queueLabel, "Trade request not queued");
  assert.equal(summary.reasonLabel, "auto trading disabled");
  assert.equal(summary.auditLabel, "Audited decision: audit-1");
  assert.equal(summary.blocking, true);
});

test("queue place summary exposes skipped alert as not inserted or queued", () => {
  const skippedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-skipped",
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
      source: { metadata_policy_passed: false },
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
  const chain = buildAlertEvidenceChains({ signals: [signal], decisions: [skippedDecision] })[0];
  const summary = buildQueuePlaceEvidenceSummary(chain);

  assert.equal(summary.statusLabel, "Alert skipped");
  assert.equal(summary.gateLabel, "No order queued");
  assert.equal(summary.alertInsertLabel, "Alert not inserted");
  assert.equal(summary.queueLabel, "Trade request not queued");
  assert.equal(summary.reasonLabel, "parser confidence low below required medium");
  assert.equal(summary.blocking, true);
});

test("queue place summary fails closed when ingestion proof is missing", () => {
  const summary = buildQueuePlaceEvidenceSummary(null);

  assert.equal(summary.statusLabel, "Execution proof missing");
  assert.equal(summary.gateLabel, "Blocks execution");
  assert.equal(summary.alertInsertLabel, "Alert insert proof missing");
  assert.equal(summary.queueLabel, "Queue proof missing");
  assert.equal(summary.reasonLabel, "No execution decision evidence");
  assert.equal(summary.auditLabel, "No audited decision");
  assert.equal(summary.blocking, true);
});

test("alert test evidence summary proves a complete physical bridge alert path", () => {
  const physicalSignal = normalizeBridgeSignalEvent({
    event_id: "bus-physical",
    event_type: "signal.observed",
    source_bot: "chrome-discord-bridge",
    created_at: "2026-06-27T17:00:00.000Z",
    correlation_id: "chrome-message-physical",
    payload: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-physical",
      channel_id: "chrome-alerts",
      channel_name: "chrome-alerts",
      channel_url: "https://discord.com/channels/1/chrome-alerts",
      url: "https://discord.com/channels/1/chrome-alerts/999",
      author_id: "mike",
      author_name: "MikeInvesting",
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parsed: { ticker: "SPY" },
      parser_metadata: { confidence: "high" },
      ingestion_result: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-physical",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
      capture_path: "C:/captures/chrome-message-physical.json",
    },
  });
  const physicalDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-physical",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert accepted and queued.",
    severity: "info",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-physical",
      channel: {
        id: "chrome-alerts",
        name: "chrome-alerts",
        url: "https://discord.com/channels/1/chrome-alerts",
        message_url: "https://discord.com/channels/1/chrome-alerts/999",
      },
      author: { id: "mike", name: "MikeInvesting" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      capture_path: "C:/captures/chrome-message-physical.json",
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
        alert_id: "alert-physical",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [physicalSignal], decisions: [physicalDecision] })[0];
  const summary = buildAlertTestEvidenceSummary(chain);

  assert.equal(summary.modeLabel, "Physical bridge test");
  assert.equal(summary.gateLabel, "Test proof clear");
  assert.equal(summary.contractLabel, "Contract chrome.discord.message.v1");
  assert.equal(summary.parserLabel, "Parser proof high");
  assert.equal(summary.sourceLabel, "Source policy passed");
  assert.equal(summary.queueLabel, "Order request queued");
  assert.equal(summary.auditLabel, "Audit audit-physical");
  assert.equal(summary.captureLabel, "Capture C:/captures/chrome-message-physical.json");
  assert.equal(summary.blocking, false);
});

test("alert test evidence summary accepts complete silent audit-only proof without pretending it was physical", () => {
  const silentDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-silent",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Silent alert accepted and queued.",
    severity: "info",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "silent-alert-1",
      channel: { id: "silent-harness", name: "silent-harness" },
      author: { id: "test-runner", name: "Test Runner" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parsed: { ticker: "SPY" },
      parser: { confidence: "high" },
      source: {
        key: "silent-harness",
        name: "Silent Harness",
        override_matched: true,
        min_parser_confidence: "medium",
        observed_parser_confidence: "high",
        parser_confidence_allowed: true,
        channel_url_allowed: true,
        author_id_allowed: true,
        metadata_policy_passed: true,
      },
      decision: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-silent",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [], decisions: [silentDecision] })[0];
  const summary = buildAlertTestEvidenceSummary(chain);

  assert.equal(summary.modeLabel, "Silent audit test");
  assert.equal(summary.gateLabel, "Test proof clear");
  assert.equal(summary.contractLabel, "Contract chrome.discord.message.v1");
  assert.equal(summary.captureLabel, "No physical capture");
  assert.equal(summary.blocking, false);
});

test("alert test evidence summary blocks missing event id and stale contract proof", () => {
  const variants = [
    {
      name: "missing event id",
      eventId: "",
      contractVersion: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      contractLabel: "Event id missing",
    },
    {
      name: "stale contract",
      eventId: "silent-alert-old-contract",
      contractVersion: "chrome.discord.message.v0",
      contractLabel: "Contract chrome.discord.message.v0 rejected",
    },
  ];

  for (const variant of variants) {
    const decision = normalizeBridgeAlertDecisionEvent({
      id: `audit-contract-${variant.name.replaceAll(" ", "-")}`,
      category: "alert_ingestion",
      action: "bridge_alert_decision",
      summary: "Silent alert accepted and queued.",
      severity: "info",
      created_at: "2026-06-27T17:00:01.000Z",
      details: {
        contract_version: variant.contractVersion,
        event_id: variant.eventId,
        channel: { id: "silent-harness", name: "silent-harness" },
        author: { id: "test-runner", name: "Test Runner" },
        raw_text: "BTO SPY 500C 6/21 @ 1.25",
        parsed: { ticker: "SPY" },
        parser: { confidence: "high" },
        source: {
          key: "silent-harness",
          name: "Silent Harness",
          override_matched: true,
          min_parser_confidence: "medium",
          observed_parser_confidence: "high",
          parser_confidence_allowed: true,
          channel_url_allowed: true,
          author_id_allowed: true,
          metadata_policy_passed: true,
        },
        decision: {
          status: "accepted",
          alert_inserted: true,
          alert_id: `alert-${variant.name.replaceAll(" ", "-")}`,
          trade_requested: true,
          trade_request_reason: "risk approved; order intent queued",
          skip_reason: "",
        },
      },
    });
    const chain = buildAlertEvidenceChains({ signals: [], decisions: [decision] })[0];
    const summary = buildAlertTestEvidenceSummary(chain);

    assert.equal(summary.modeLabel, "Silent audit test", variant.name);
    assert.equal(summary.gateLabel, "Blocks test", variant.name);
    assert.equal(summary.contractLabel, variant.contractLabel, variant.name);
    assert.equal(summary.queueLabel, "Order request queued", variant.name);
    assert.equal(summary.auditLabel.includes("Audit audit-contract-"), true, variant.name);
    assert.equal(summary.blocking, true, variant.name);
  }
});

test("alert test evidence summary blocks physical observation without audit decision", () => {
  const chain = buildAlertEvidenceChains({ signals: [signal], decisions: [] })[0];
  const summary = buildAlertTestEvidenceSummary(chain);

  assert.equal(summary.modeLabel, "Physical observation missing audit");
  assert.equal(summary.gateLabel, "Blocks test");
  assert.equal(summary.contractLabel, "Contract proof requires audit");
  assert.equal(summary.sourceLabel, "Source proof missing");
  assert.equal(summary.queueLabel, "No order queued");
  assert.equal(summary.auditLabel, "Audit proof missing");
  assert.equal(summary.blocking, true);
});

test("alert test evidence summary fails closed when no chain exists", () => {
  const summary = buildAlertTestEvidenceSummary(null);

  assert.equal(summary.modeLabel, "Alert test proof missing");
  assert.equal(summary.gateLabel, "Blocks test");
  assert.equal(summary.contractLabel, "Contract proof missing");
  assert.equal(summary.parserLabel, "Parser proof missing");
  assert.equal(summary.sourceLabel, "Source proof missing");
  assert.equal(summary.queueLabel, "Queue proof missing");
  assert.equal(summary.auditLabel, "Audit proof missing");
  assert.equal(summary.captureLabel, "No capture evidence");
  assert.equal(summary.blocking, true);
});

test("alert reconciliation trace clears queued alert with exact reconciliation row", () => {
  const queuedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-trace",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert accepted and queued.",
    severity: "info",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-trace",
      channel: { id: "chrome-alerts", name: "chrome-alerts" },
      author: { id: "mike", name: "MikeInvesting" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser: { confidence: "high" },
      source: {
        override_matched: true,
        parser_confidence_allowed: true,
        channel_url_allowed: true,
        author_id_allowed: true,
        metadata_policy_passed: true,
      },
      decision: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-trace",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const [row] = normalizeReconciliationPayload([
    {
      alert_id: "alert-trace",
      trade_id: "trade-trace",
      trade_status: "filled",
      order_id: "order-trace",
      position_id: "position-trace",
      position_status: "open",
      simulated: false,
      attention_reason: "",
    },
  ]);
  const chain = buildAlertEvidenceChains({ signals: [], decisions: [queuedDecision] })[0];
  assert.ok(row);
  const summary = buildAlertReconciliationTraceSummary(chain, [row]);

  assert.equal(summary.gateLabel, "Trace clear");
  assert.equal(summary.alertLabel, "Alert alert-trace");
  assert.equal(summary.reconciliationLabel, "Reconciled row matched");
  assert.equal(summary.orderLabel, "Order order-trace");
  assert.equal(summary.positionLabel, "Position position-trace - open");
  assert.equal(summary.auditLabel, "Audit audit-trace");
  assert.equal(summary.blocking, false);
});

test("alert reconciliation trace blocks queued alert without exact reconciliation row", () => {
  const queuedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-missing-trace",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert accepted and queued.",
    severity: "info",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-missing-trace",
      channel: { id: "chrome-alerts", name: "chrome-alerts" },
      author: { id: "mike", name: "MikeInvesting" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser: { confidence: "high" },
      source: { metadata_policy_passed: true },
      decision: {
        status: "accepted",
        alert_inserted: true,
        alert_id: "alert-missing-trace",
        trade_requested: true,
        trade_request_reason: "risk approved; order intent queued",
        skip_reason: "",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [], decisions: [queuedDecision] })[0];
  const summary = buildAlertReconciliationTraceSummary(chain, []);

  assert.equal(summary.gateLabel, "Trace blocked");
  assert.equal(summary.reconciliationLabel, "No reconciliation row for alert alert-missing-trace");
  assert.equal(summary.orderLabel, "Order proof missing");
  assert.equal(summary.positionLabel, "Position proof missing");
  assert.equal(summary.blocking, true);
});

test("alert reconciliation trace does not require broker row for skipped alert", () => {
  const skippedDecision = normalizeBridgeAlertDecisionEvent({
    id: "audit-skipped-trace",
    category: "alert_ingestion",
    action: "bridge_alert_decision",
    summary: "Chrome bridge alert skipped.",
    severity: "warning",
    created_at: "2026-06-27T17:00:01.000Z",
    details: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-skipped-trace",
      channel: { id: "chrome-alerts", name: "chrome-alerts" },
      author: { id: "mike", name: "MikeInvesting" },
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser: { confidence: "low" },
      source: { metadata_policy_passed: false },
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
  const chain = buildAlertEvidenceChains({ signals: [], decisions: [skippedDecision] })[0];
  const summary = buildAlertReconciliationTraceSummary(chain, []);

  assert.equal(summary.gateLabel, "Trace clear");
  assert.equal(summary.reconciliationLabel, "No broker reconciliation required");
  assert.equal(summary.orderLabel, "No order expected");
  assert.equal(summary.positionLabel, "No position expected");
  assert.equal(summary.blocking, false);
});

test("alert reconciliation trace blocks signal-only no-order alert without audit decision", () => {
  const signalOnlySkipped = normalizeBridgeSignalEvent({
    event_id: "bus-signal-only-skipped",
    event_type: "signal.observed",
    source_bot: "chrome-discord-bridge",
    created_at: "2026-06-27T17:00:00.000Z",
    correlation_id: "chrome-message-signal-only-skipped",
    payload: {
      contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
      event_id: "chrome-message-signal-only-skipped",
      channel_id: "chrome-alerts",
      channel_name: "chrome-alerts",
      author_id: "mike",
      author_name: "MikeInvesting",
      raw_text: "BTO SPY 500C 6/21 @ 1.25",
      parser_metadata: { confidence: "low" },
      ingestion_result: {
        status: "skipped",
        alert_inserted: false,
        alert_id: "",
        trade_requested: false,
        trade_request_reason: "",
        skip_reason: "parser confidence low below required medium",
      },
    },
  });
  const chain = buildAlertEvidenceChains({ signals: [signalOnlySkipped], decisions: [] })[0];
  const summary = buildAlertReconciliationTraceSummary(chain, []);

  assert.equal(summary.gateLabel, "Trace blocked");
  assert.equal(summary.reconciliationLabel, "Audit decision required before clearing no-order trace");
  assert.equal(summary.orderLabel, "No order proven by signal only");
  assert.equal(summary.positionLabel, "No position proven by signal only");
  assert.equal(summary.auditLabel, "Audit proof missing");
  assert.equal(summary.blocking, true);
});

test("alert reconciliation trace fails closed when chain is missing", () => {
  const summary = buildAlertReconciliationTraceSummary(null, []);

  assert.equal(summary.gateLabel, "Trace blocked");
  assert.equal(summary.alertLabel, "Alert proof missing");
  assert.equal(summary.reconciliationLabel, "No alert chain to reconcile");
  assert.equal(summary.orderLabel, "Order proof missing");
  assert.equal(summary.positionLabel, "Position proof missing");
  assert.equal(summary.auditLabel, "Audit proof missing");
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
