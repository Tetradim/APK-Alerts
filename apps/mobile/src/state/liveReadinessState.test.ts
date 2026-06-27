import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLiveReadinessPayload } from "@apk-alerts/contracts";
import {
  buildLiveReadinessSummary,
  createLiveReadinessStore,
  getDefaultLiveReadinessSnapshot,
  type LiveReadinessChecker,
} from "./liveReadinessState.js";

const readyPayload = {
  ready_for_live: true,
  blocking_issues: [],
  blocking_codes: [],
  warnings: [],
  checks: {
    role: { active_role: "live_executioner", valid: true, live_execution_allowed: true },
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
    source_policy: { valid: true, auto_live_sources: 1, enabled_sources: 1 },
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
      metadata_only_open_position_count: 0,
    },
    runtime: {
      shutdown_triggered: false,
      live_trading_armed: true,
      live_trading_armed_until: "2026-06-27T18:00:00Z",
    },
    reconciliation: { unresolved_count: 0, unresolved_reasons: [] },
    alert_chains: { live_blocking_attention_count: 0, live_blocking_attention_reasons: [] },
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
    readiness_gates: { missing_gate_keys: [], states: {} },
  },
};

function readinessSnapshot(payload = readyPayload) {
  const readiness = normalizeLiveReadinessPayload(payload);
  return {
    checkedAt: "2026-06-27T17:25:00.000Z",
    readiness,
    liveMoneyReady: payload.checks.runtime.live_trading_armed,
  };
}

test("default live-readiness summary is unpaired and blocked", () => {
  const summary = buildLiveReadinessSummary(getDefaultLiveReadinessSnapshot());

  assert.equal(summary.connectionLabel, "Not paired");
  assert.equal(summary.readinessLabel, "Blocked");
  assert.equal(summary.primaryReason, "No live-readiness evidence");
  assert.equal(summary.liveMoneyLabel, "Live money blocked");
});

test("armed passing endpoint can be labeled live money ready", () => {
  const summary = buildLiveReadinessSummary({
    ...getDefaultLiveReadinessSnapshot(),
    connection: { baseApiUrl: "http://100.90.10.11:8001/api", apiKey: "secret", transport: "tailscale" },
    remote: readinessSnapshot(),
  });

  assert.equal(summary.connectionLabel, "Tailscale");
  assert.equal(summary.readinessLabel, "Ready");
  assert.equal(summary.liveMoneyLabel, "Live money ready");
  assert.equal(summary.primaryReason, "Endpoint passed and live trading is armed.");
});

test("endpoint-ready but unarmed is ready to arm, not live money ready", () => {
  const unarmedPayload = {
    ...readyPayload,
    checks: {
      ...readyPayload.checks,
      runtime: {
        ...readyPayload.checks.runtime,
        live_trading_armed: false,
      },
    },
  };
  const summary = buildLiveReadinessSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: normalizeLiveReadinessPayload(unarmedPayload),
      liveMoneyReady: false,
    },
  });

  assert.equal(summary.readinessLabel, "Ready to arm");
  assert.equal(summary.liveMoneyLabel, "Live money blocked");
  assert.equal(summary.primaryReason, "Endpoint passed, but live trading is not armed.");
});

test("blocking issues summarize first blocker and key risk sections", () => {
  const blocked = normalizeLiveReadinessPayload({
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [{ code: "active_broker_not_configured", message: "Active broker has no saved configuration." }],
    blocking_codes: ["active_broker_not_configured"],
    checks: {
      ...readyPayload.checks,
      broker: {
        ...readyPayload.checks.broker,
        configured: false,
        connected: false,
      },
    },
  });
  const summary = buildLiveReadinessSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: blocked,
      liveMoneyReady: false,
    },
  });

  assert.equal(summary.readinessLabel, "Blocked");
  assert.equal(summary.primaryReason, "active_broker_not_configured: Active broker has no saved configuration.");
  assert.equal(summary.brokerLabel, "alpaca - broker offline");
});

test("live-readiness store refreshes and clears stale readiness on connection edit", async () => {
  const checker: LiveReadinessChecker = async (config) => {
    assert.equal(config.baseApiUrl, "http://100.90.10.11:8001/api");
    assert.equal(config.apiKey, "secret");
    return { ok: true, snapshot: readinessSnapshot(), error: "" };
  };
  const store = createLiveReadinessStore(checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  await store.getState().checkReadiness();
  assert.equal(store.getState().snapshot.remote.liveMoneyReady, true);

  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });

  assert.equal(store.getState().snapshot.connection.transport, "cloud_relay");
  assert.equal(store.getState().snapshot.remote.liveMoneyReady, false);
  assert.equal(store.getState().snapshot.remote.checkedAt, "");
  assert.equal(store.getState().snapshot.lastError, "");
});
