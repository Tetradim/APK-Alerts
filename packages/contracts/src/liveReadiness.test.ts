import assert from "node:assert/strict";
import test from "node:test";
import {
  canClaimLiveReady,
  normalizeLiveReadinessPayload,
} from "./liveReadiness";

const readyPayload = {
  ready_for_live: true,
  blocking_issues: [],
  blocking_codes: [],
  warnings: [],
  checks: {
    role: {
      active_role: "live_executioner",
      valid: true,
      live_execution_allowed: true,
    },
    api_auth: { configured: true, authless_desktop_mode: false },
    credential_key: { configured: true, valid: true },
    broker: {
      active_broker: "alpaca",
      configured: true,
      connected: true,
      missing_required_fields: [],
      capabilities: {
        supports_live_trading: true,
        supports_options: true,
        supports_order_status: true,
        supports_cancel_order: true,
      },
    },
    source_policy: {
      valid: true,
      auto_live_sources: 1,
      enabled_sources: 1,
      error: "",
    },
    signal_ingestion: {
      discord_connected: false,
      discord_configured: true,
      discord_channel_count: 1,
      chrome_bridge_healthy: true,
    },
    trading: {
      auto_trading_enabled: true,
      simulation_mode: false,
      max_position_size: 1000,
      max_position_size_valid: true,
    },
    exit_automation: {
      oco_exits_configured: true,
      broker_order_status_supported: true,
      broker_cancel_supported: true,
      unprotected_open_position_count: 0,
      unprotected_open_position_ids: [],
      metadata_only_open_position_count: 0,
      metadata_only_open_position_ids: [],
    },
    runtime: {
      shutdown_triggered: false,
      live_trading_armed: true,
      live_trading_armed_until: "2026-06-27T18:00:00Z",
    },
    reconciliation: {
      unresolved_count: 0,
      unresolved_reasons: [],
    },
    alert_chains: {
      attention_count: 0,
      attention_reasons: [],
      live_blocking_attention_count: 0,
      live_blocking_attention_reasons: [],
    },
    simulation_replay: {
      proof_required: true,
      acceptance_status: "passed",
      expected_count: 4,
      passed_count: 4,
      failed_count: 0,
      failed_event_count: 0,
      failed_event_ids: [],
      missing_event_count: 0,
      missing_event_ids: [],
      updated_at: "2026-06-27T17:00:00Z",
      replay_url: "http://127.0.0.1:8001/api/simulation/replay-events",
    },
    readiness_gates: {
      missing_gate_keys: [],
      states: {},
    },
  },
};

test("normalizes passing live-readiness payload and permits live-ready claim only when armed", () => {
  const readiness = normalizeLiveReadinessPayload(readyPayload);

  assert.equal(readiness.readyForLive, true);
  assert.equal(readiness.checks.broker.activeBroker, "alpaca");
  assert.equal(readiness.checks.signalIngestion.chromeBridgeHealthy, true);
  assert.equal(readiness.checks.runtime.liveTradingArmed, true);
  assert.equal(canClaimLiveReady(readiness), true);
});

test("endpoint-ready but unarmed payload cannot claim live-money readiness", () => {
  const readiness = normalizeLiveReadinessPayload({
    ...readyPayload,
    checks: {
      ...readyPayload.checks,
      runtime: {
        ...readyPayload.checks.runtime,
        live_trading_armed: false,
      },
    },
  });

  assert.equal(readiness.readyForLive, true);
  assert.equal(readiness.checks.runtime.liveTradingArmed, false);
  assert.equal(canClaimLiveReady(readiness), false);
});

test("live-ready claim fails closed when hidden required evidence is missing", () => {
  const variants = [
    {
      name: "unknown broker",
      checks: { broker: { ...readyPayload.checks.broker, active_broker: "unknown" } },
    },
    {
      name: "missing broker fields",
      checks: { broker: { ...readyPayload.checks.broker, missing_required_fields: ["api_secret"] } },
    },
    {
      name: "no enabled sources",
      checks: { source_policy: { ...readyPayload.checks.source_policy, enabled_sources: 0 } },
    },
    {
      name: "unconfigured discord ingestion",
      checks: {
        signal_ingestion: {
          ...readyPayload.checks.signal_ingestion,
          discord_configured: false,
          discord_channel_count: 0,
        },
      },
    },
    {
      name: "missing max position value",
      checks: { trading: { ...readyPayload.checks.trading, max_position_size: null } },
    },
    {
      name: "unprotected position ids",
      checks: {
        exit_automation: {
          ...readyPayload.checks.exit_automation,
          unprotected_open_position_ids: ["pos-1"],
        },
      },
    },
    {
      name: "metadata-only position ids",
      checks: {
        exit_automation: {
          ...readyPayload.checks.exit_automation,
          metadata_only_open_position_ids: ["pos-2"],
        },
      },
    },
  ];

  for (const variant of variants) {
    const readiness = normalizeLiveReadinessPayload({
      ...readyPayload,
      checks: { ...readyPayload.checks, ...variant.checks },
    });
    assert.equal(readiness.readyForLive, true, variant.name);
    assert.equal(canClaimLiveReady(readiness), false, variant.name);
  }
});

test("blocking issues and failed replay remain visible and block readiness", () => {
  const readiness = normalizeLiveReadinessPayload({
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [
      { code: "simulation_replay_acceptance_failed", message: "Simulation replay acceptance has failed expected alert outcomes." },
    ],
    blocking_codes: ["simulation_replay_acceptance_failed"],
    checks: {
      ...readyPayload.checks,
      simulation_replay: {
        ...readyPayload.checks.simulation_replay,
        acceptance_status: "failed",
        failed_count: 1,
        failed_event_count: 1,
        failed_event_ids: ["alert-1"],
      },
    },
  });

  assert.equal(readiness.readyForLive, false);
  assert.deepEqual(readiness.blockingCodes, ["simulation_replay_acceptance_failed"]);
  assert.equal(readiness.checks.simulationReplay.acceptanceStatus, "failed");
  assert.equal(readiness.checks.simulationReplay.failedEventIds[0], "alert-1");
  assert.equal(canClaimLiveReady(readiness), false);
});

test("malformed live-readiness payload fails closed with explicit invalid payload code", () => {
  const readiness = normalizeLiveReadinessPayload("bad");

  assert.equal(readiness.readyForLive, false);
  assert.deepEqual(readiness.blockingCodes, ["readiness_payload_invalid"]);
  assert.equal(readiness.checks.credentialKey.configured, false);
  assert.equal(readiness.checks.broker.connected, false);
  assert.equal(readiness.checks.runtime.liveTradingArmed, false);
  assert.equal(canClaimLiveReady(readiness), false);
});

test("missing required sections fail closed even when ready_for_live is malformed true-ish text", () => {
  const readiness = normalizeLiveReadinessPayload({ ready_for_live: "true", checks: {} });

  assert.equal(readiness.readyForLive, false);
  assert.equal(readiness.blockingCodes.includes("readiness_payload_invalid"), true);
  assert.equal(canClaimLiveReady(readiness), false);
});
