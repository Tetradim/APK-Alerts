import assert from "node:assert/strict";
import test from "node:test";
import {
  CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
  buildAlertEvidenceChains,
  normalizeBridgeAlertDecisionEvent,
  normalizeBridgeHealthPayload,
  normalizeBridgeSignalEvent,
} from "./bridgeEvidence";

const signalEvent = {
  version: "bot-event.v1",
  event_id: "bus-1",
  event_type: "signal.observed",
  source_bot: "chrome-discord-bridge",
  created_at: "2026-06-27T17:00:00.000Z",
  correlation_id: "chrome-message-1",
  dedupe_key: "chrome-discord:chrome-message-1",
  target_bots: ["sentinel-echo", "sentinel-edge", "sentinel-archive"],
  payload: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    source: "chrome-discord-bridge",
    channel_id: "chrome-alerts",
    channel_name: "chrome-alerts",
    channel_url: "https://discord.com/channels/1/approved",
    url: "https://discord.com/channels/1/approved/999",
    observed_at: "2026-06-27T17:00:00.000Z",
    bridge_target_id: "sentinel-echo",
    bridge_target_name: "Sentinel Echo",
    author_id: "mike",
    author_name: "MikeInvesting",
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    parsed: {
      alert_type: "buy",
      ticker: "SPY",
      strike: 500,
      option_type: "CALL",
      expiration: "2026-06-21",
      entry_price: 1.25,
    },
    parser_metadata: {
      confidence: "high",
      ignored: false,
    },
    ingestion_result: {
      status: "accepted",
      alert_inserted: true,
      alert_id: "alert-1",
      trade_requested: false,
      trade_request_reason: "auto trading disabled",
      skip_reason: "",
    },
    capture_path: "C:/captures/chrome-message-1.json",
  },
};

const auditEvent = {
  id: "audit-1",
  category: "alert_ingestion",
  action: "bridge_alert_decision",
  summary: "Chrome bridge alert accepted.",
  severity: "info",
  created_at: "2026-06-27T17:00:01.000Z",
  details: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    channel: {
      id: "chrome-alerts",
      name: "chrome-alerts",
      url: "https://discord.com/channels/1/approved",
      message_url: "https://discord.com/channels/1/approved/999",
    },
    author: {
      id: "mike",
      name: "MikeInvesting",
    },
    bridge_target: {
      id: "sentinel-echo",
      name: "Sentinel Echo",
    },
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    capture_path: "C:/captures/chrome-message-1.json",
    parsed: {
      alert_type: "buy",
      ticker: "SPY",
      strike: 500,
      option_type: "CALL",
      expiration: "2026-06-21",
      entry_price: 1.25,
    },
    parser: {
      confidence: "high",
      ignored: false,
    },
    source: {
      key: "chrome-alerts",
      name: "Chrome Alerts",
      override_matched: true,
      paper_only: true,
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
};

test("normalizes accepted bridge signal and audit evidence into one chain", () => {
  const signal = normalizeBridgeSignalEvent(signalEvent);
  const decision = normalizeBridgeAlertDecisionEvent(auditEvent);
  const chains = buildAlertEvidenceChains({
    signals: [signal],
    decisions: [decision],
  });

  assert.equal(signal.contractVersion, CHROME_DISCORD_MESSAGE_CONTRACT_VERSION);
  assert.equal(signal.eventId, "chrome-message-1");
  assert.equal(signal.parserConfidence, "high");
  assert.equal(signal.ingestion.status, "accepted");
  assert.equal(decision.source.metadataPolicyPassed, true);
  assert.equal(decision.decision.alertInserted, true);
  assert.equal(chains.length, 1);
  assert.equal(chains[0]?.eventId, "chrome-message-1");
  assert.equal(chains[0]?.status, "accepted");
  assert.equal(chains[0]?.executable, false);
  assert.equal(chains[0]?.latestReason, "auto trading disabled");
});

test("skipped low-confidence audit preserves source policy proof", () => {
  const lowConfidenceDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    id: "audit-low-confidence",
    severity: "warning",
    details: {
      ...auditEvent.details,
      event_id: "chrome-low-confidence",
      parser: { confidence: "low" },
      source: {
        ...auditEvent.details.source,
        observed_parser_confidence: "low",
        parser_confidence_allowed: false,
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

  assert.equal(lowConfidenceDecision.status, "skipped");
  assert.equal(lowConfidenceDecision.parserConfidence, "low");
  assert.equal(lowConfidenceDecision.source.parserConfidenceAllowed, false);
  assert.equal(lowConfidenceDecision.source.metadataPolicyPassed, false);
  assert.equal(lowConfidenceDecision.decision.skipReason, "parser confidence low below required medium");
});

test("bridge source policy count proof distinguishes explicit zero from missing counts", () => {
  const zeroCountDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    details: {
      ...auditEvent.details,
      source: {
        ...auditEvent.details.source,
        allowed_channel_url_count: 0,
        allowed_author_id_count: 0,
      },
    },
  });
  const missingCountDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    details: {
      ...auditEvent.details,
      source: {
        ...auditEvent.details.source,
        allowed_channel_url_count: undefined,
        allowed_author_id_count: undefined,
      },
    },
  });

  assert.equal(zeroCountDecision.source.allowedChannelUrlCount, 0);
  assert.equal(zeroCountDecision.source.allowedChannelUrlCountProvided, true);
  assert.equal(zeroCountDecision.source.allowedAuthorIdCount, 0);
  assert.equal(zeroCountDecision.source.allowedAuthorIdCountProvided, true);
  assert.equal(missingCountDecision.source.allowedChannelUrlCount, 0);
  assert.equal(missingCountDecision.source.allowedChannelUrlCountProvided, false);
  assert.equal(missingCountDecision.source.allowedAuthorIdCount, 0);
  assert.equal(missingCountDecision.source.allowedAuthorIdCountProvided, false);
});

test("malformed bridge evidence normalizes to empty fail-closed values", () => {
  const signal = normalizeBridgeSignalEvent(null);
  const decision = normalizeBridgeAlertDecisionEvent({ details: "bad" });

  assert.equal(signal.eventId, "");
  assert.equal(signal.parserConfidence, "none");
  assert.equal(signal.ingestion.status, "unknown");
  assert.equal(signal.ingestion.alertInserted, false);
  assert.equal(decision.eventId, "");
  assert.equal(decision.status, "unknown");
  assert.equal(decision.source.overrideMatched, false);
  assert.equal(decision.source.metadataPolicyPassed, false);
});

test("alert evidence chains sort timestamped evidence first and timestamp-less ties deterministically", () => {
  const datedDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    id: "audit-dated",
    created_at: "2026-06-27T17:00:03.000Z",
    details: {
      ...auditEvent.details,
      event_id: "dated-alert",
    },
  });
  const zNoTimestampDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    id: "audit-z-no-time",
    created_at: "",
    details: {
      ...auditEvent.details,
      event_id: "z-no-time-alert",
    },
  });
  const aNoTimestampDecision = normalizeBridgeAlertDecisionEvent({
    ...auditEvent,
    id: "audit-a-no-time",
    created_at: "",
    details: {
      ...auditEvent.details,
      event_id: "a-no-time-alert",
    },
  });

  const chains = buildAlertEvidenceChains({
    decisions: [zNoTimestampDecision, datedDecision, aNoTimestampDecision],
  });

  assert.deepEqual(
    chains.map((chain) => chain.eventId),
    ["dated-alert", "a-no-time-alert", "z-no-time-alert"],
  );
});

test("bridge health normalizes disabled stale heartbeat as unhealthy", () => {
  const health = normalizeBridgeHealthPayload({
    healthy: false,
    status: "unhealthy",
    issues: ["chrome bridge is disabled", "chrome bridge heartbeat is stale (120s old)"],
    age_seconds: 120,
    stale_after_seconds: 90,
    last_heartbeat: {
      status: "disabled",
      bridge_enabled: false,
      channel_id: "chrome-alerts",
      observed_at: "2026-06-27T16:58:00.000Z",
    },
  });

  assert.equal(health.healthy, false);
  assert.equal(health.status, "unhealthy");
  assert.equal(health.issues.length, 2);
  assert.equal(health.lastHeartbeat.bridgeEnabled, false);
  assert.equal(health.ageSeconds, 120);
});

test("bridge health normalizes service worker supervisor backoff evidence", () => {
  const health = normalizeBridgeHealthPayload({
    healthy: false,
    status: "unhealthy",
    issues: ["chrome bridge reported restart_error"],
    age_seconds: 12,
    stale_after_seconds: 90,
    last_heartbeat: {
      status: "restart_error",
      bridge_enabled: true,
      channel_id: "chrome-extension-service-worker",
      observed_at: "2026-06-27T17:04:00.000Z",
      details: {
        source: "service_worker",
        reason: "sentinel-echo-bridge-supervisor",
        failures: ["content script did not respond after restart"],
        discord_tabs: 2,
        configured_targets: 1,
        restart_attempt: 3,
        next_restart_at: "2026-06-27T17:05:00.000Z",
      },
    },
  });

  assert.equal(health.supervisor.state, "backoff");
  assert.equal(health.supervisor.source, "service_worker");
  assert.equal(health.supervisor.reason, "sentinel-echo-bridge-supervisor");
  assert.deepEqual(health.supervisor.failures, ["content script did not respond after restart"]);
  assert.equal(health.supervisor.discordTabs, 2);
  assert.equal(health.supervisor.configuredTargets, 1);
  assert.equal(health.supervisor.restartAttempt, 3);
  assert.equal(health.supervisor.nextRestartAt, "2026-06-27T17:05:00.000Z");
});

test("bridge health normalizes healthy supervisor tab counts", () => {
  const health = normalizeBridgeHealthPayload({
    healthy: true,
    status: "healthy",
    issues: [],
    last_heartbeat: {
      status: "ok",
      bridge_enabled: true,
      channel_id: "chrome-extension-service-worker",
      observed_at: "2026-06-27T17:04:00.000Z",
      details: {
        source: "service_worker",
        reason: "alarm",
        supervised_tabs: 1,
        restarted_tabs: 0,
      },
    },
  });

  assert.equal(health.supervisor.state, "healthy");
  assert.equal(health.supervisor.supervisedTabs, 1);
  assert.equal(health.supervisor.restartedTabs, 0);
  assert.equal(health.supervisor.failures.length, 0);
});

test("bridge health requires concrete supervisor proof before healthy state", () => {
  const health = normalizeBridgeHealthPayload({
    healthy: true,
    status: "healthy",
    issues: [],
    last_heartbeat: {
      status: "ok",
      bridge_enabled: true,
      channel_id: "chrome-extension-service-worker",
      observed_at: "2026-06-27T17:04:00.000Z",
      details: {
        source: "service_worker",
        reason: "alarm",
      },
    },
  });

  assert.equal(health.supervisor.state, "attention");
  assert.equal(health.supervisor.supervisedTabs, null);
  assert.equal(health.supervisor.discordTabs, null);
  assert.equal(health.supervisor.configuredTargets, null);
});

test("duplicate bridge events remain visible but not executable evidence", () => {
  const duplicate = normalizeBridgeSignalEvent({
    ...signalEvent,
    event_id: "bus-duplicate",
    event_type: "signal.duplicate",
    payload: {
      ...signalEvent.payload,
      event_id: "chrome-message-duplicate",
      ingestion_result: {
        status: "duplicate",
        alert_inserted: false,
        alert_id: "",
        trade_requested: false,
        trade_request_reason: "",
        skip_reason: "duplicate bridge alert",
      },
    },
  });
  const chains = buildAlertEvidenceChains({ signals: [duplicate], decisions: [] });

  assert.equal(duplicate.eventType, "signal.duplicate");
  assert.equal(duplicate.ingestion.status, "duplicate");
  assert.equal(chains[0]?.status, "duplicate");
  assert.equal(chains[0]?.executable, false);
  assert.equal(chains[0]?.latestReason, "duplicate bridge alert");
});
