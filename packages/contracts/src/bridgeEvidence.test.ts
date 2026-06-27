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
  target_bots: ["consolidation", "sentinel-edge", "simulation-engine"],
  payload: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    source: "chrome-discord-bridge",
    channel_id: "chrome-alerts",
    channel_name: "chrome-alerts",
    channel_url: "https://discord.com/channels/1/approved",
    url: "https://discord.com/channels/1/approved/999",
    observed_at: "2026-06-27T17:00:00.000Z",
    bridge_target_id: "consolidation",
    bridge_target_name: "Consolidation",
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
      id: "consolidation",
      name: "Consolidation",
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
