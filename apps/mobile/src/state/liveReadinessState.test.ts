import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLiveReadinessPayload } from "@sentinel-nexus/contracts";
import {
  buildExitProtectionAuditDigest,
  buildExitProtectionEvidenceSummary,
  buildLiveArmChecklistSummary,
  buildReplayAcceptanceEvidenceSummary,
  buildLiveReadinessSummary,
  createLiveReadinessStore,
  getDefaultLiveReadinessSnapshot,
  type LiveReadinessChecker,
} from "./liveReadinessState.js";

const readyPayload = {
  ready_for_live: true,
  blocking_issues: [] as Array<{ code: string; message: string }>,
  blocking_codes: [] as string[],
  warnings: [] as Array<{ code: string; message: string }>,
  checks: {
    role: { active_role: "live_executioner", valid: true, live_execution_allowed: true },
    api_auth: { configured: true, authless_desktop_mode: false },
    credential_key: { configured: true, valid: true },
    broker: {
      active_broker: "alpaca",
      configured: true,
      connected: true,
      missing_required_fields: [] as string[],
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
    reconciliation: { unresolved_count: 0, unresolved_reasons: [] as string[] },
    alert_chains: { live_blocking_attention_count: 0, live_blocking_attention_reasons: [] as string[] },
    simulation_replay: {
      proof_required: true,
      acceptance_status: "passed",
      expected_count: 4,
      passed_count: 4,
      failed_count: 0,
      failed_event_count: 0,
      failed_event_ids: [] as string[],
      missing_event_count: 0,
      missing_event_ids: [] as string[],
      updated_at: "2026-06-27T17:00:00Z",
      replay_url: "http://127.0.0.1:8001/api/simulation/replay-events",
    },
    readiness_gates: { missing_gate_keys: [] as string[], states: {} },
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

test("replay acceptance evidence summarizes a passing proof as non-blocking", () => {
  const summary = buildReplayAcceptanceEvidenceSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(),
  });

  assert.equal(summary.statusLabel, "Replay proof passed");
  assert.equal(summary.gateLabel, "Replay gate clear");
  assert.equal(summary.detailLabel, "4/4 expected alert(s) accepted");
  assert.equal(summary.proofLabel, "Proof 2026-06-27T17:00:00Z - http://127.0.0.1:8001/api/simulation/replay-events");
  assert.equal(summary.failedEventsLabel, "Failed events: none");
  assert.equal(summary.missingEventsLabel, "Missing events: none");
  assert.equal(summary.blocking, false);
});

test("replay acceptance evidence exposes failed and missing event IDs as blocking", () => {
  const failedPayload = {
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [{ code: "simulation_replay_acceptance_failed", message: "Simulation replay acceptance failed." }],
    blocking_codes: ["simulation_replay_acceptance_failed"],
    checks: {
      ...readyPayload.checks,
      simulation_replay: {
        ...readyPayload.checks.simulation_replay,
        acceptance_status: "failed",
        passed_count: 2,
        failed_count: 1,
        failed_event_count: 1,
        failed_event_ids: ["alert-1"],
        missing_event_count: 1,
        missing_event_ids: ["alert-2"],
      },
    },
  };
  const summary = buildReplayAcceptanceEvidenceSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(failedPayload),
  });

  assert.equal(summary.statusLabel, "Replay proof failed");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.detailLabel, "2/4 expected alert(s) accepted");
  assert.equal(summary.failedEventsLabel, "Failed events: alert-1");
  assert.equal(summary.missingEventsLabel, "Missing events: alert-2");
  assert.equal(summary.blocking, true);
});

test("replay acceptance evidence treats empty proof as blocking", () => {
  const summary = buildReplayAcceptanceEvidenceSummary(getDefaultLiveReadinessSnapshot());

  assert.equal(summary.statusLabel, "Replay proof missing");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.detailLabel, "0/0 expected alert(s) accepted");
  assert.equal(summary.proofLabel, "No replay proof timestamp or URL");
  assert.equal(summary.blocking, true);
});

test("exit protection evidence summarizes all-clear OCO coverage as non-blocking", () => {
  const summary = buildExitProtectionEvidenceSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(),
  });

  assert.equal(summary.statusLabel, "OCO exits protected");
  assert.equal(summary.gateLabel, "Exit gate clear");
  assert.equal(summary.capabilityLabel, "Broker can monitor and cancel exits");
  assert.equal(summary.unprotectedPositionsLabel, "Unprotected positions: none");
  assert.equal(summary.metadataOnlyPositionsLabel, "Metadata-only positions: none");
  assert.equal(summary.blocking, false);
});

test("exit protection evidence exposes unprotected and metadata-only position IDs as blocking", () => {
  const blockedPayload = {
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [{ code: "oco_exit_protection_missing", message: "Open positions are missing OCO exits." }],
    blocking_codes: ["oco_exit_protection_missing"],
    checks: {
      ...readyPayload.checks,
      exit_automation: {
        ...readyPayload.checks.exit_automation,
        oco_exits_configured: false,
        unprotected_open_position_count: 2,
        unprotected_open_position_ids: ["pos-1", "pos-2"],
        metadata_only_open_position_count: 1,
        metadata_only_open_position_ids: ["pos-3"],
      },
    },
  };
  const summary = buildExitProtectionEvidenceSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(blockedPayload),
  });

  assert.equal(summary.statusLabel, "OCO exits blocking");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.configurationLabel, "OCO exits missing");
  assert.equal(summary.unprotectedPositionsLabel, "Unprotected positions: pos-1, pos-2");
  assert.equal(summary.metadataOnlyPositionsLabel, "Metadata-only positions: pos-3");
  assert.equal(summary.blocking, true);
});

test("exit protection evidence treats default empty readiness as blocking", () => {
  const summary = buildExitProtectionEvidenceSummary(getDefaultLiveReadinessSnapshot());

  assert.equal(summary.statusLabel, "OCO exits blocking");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.configurationLabel, "OCO exits missing");
  assert.equal(summary.capabilityLabel, "Broker exit automation capabilities missing");
  assert.equal(summary.unprotectedPositionsLabel, "Unprotected positions: none");
  assert.equal(summary.metadataOnlyPositionsLabel, "Metadata-only positions: none");
  assert.equal(summary.blocking, true);
});

test("exit protection audit digest records blocking OCO evidence without raw position detail", () => {
  const blockedPayload = {
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [{ code: "oco_exit_protection_missing", message: "Open positions are missing OCO exits." }],
    blocking_codes: ["oco_exit_protection_missing"],
    checks: {
      ...readyPayload.checks,
      exit_automation: {
        ...readyPayload.checks.exit_automation,
        oco_exits_configured: false,
        broker_cancel_supported: false,
        unprotected_open_position_count: 2,
        unprotected_open_position_ids: ["pos-1", "pos-2"],
        metadata_only_open_position_count: 1,
        metadata_only_open_position_ids: ["pos-3"],
      },
    },
  };
  const digest = buildExitProtectionAuditDigest({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(blockedPayload),
  });

  assert.equal(digest.checkedAt, "2026-06-27T17:25:00.000Z");
  assert.equal(digest.statusLabel, "OCO exits blocking");
  assert.equal(digest.gateLabel, "Blocks live");
  assert.equal(digest.configurationLabel, "OCO exits missing");
  assert.equal(digest.capabilityLabel, "Broker exit automation capabilities missing");
  assert.equal(digest.unprotectedOpenPositionCount, 2);
  assert.deepEqual(digest.unprotectedOpenPositionIds, ["pos-1", "pos-2"]);
  assert.equal(digest.metadataOnlyOpenPositionCount, 1);
  assert.deepEqual(digest.metadataOnlyOpenPositionIds, ["pos-3"]);
  assert.deepEqual(digest.blockingLabels, [
    "OCO exits missing",
    "Broker exit automation capabilities missing",
    "Unprotected positions: pos-1, pos-2",
    "Metadata-only positions: pos-3",
  ]);
  assert.equal(digest.blocking, true);
});

test("live arm checklist clears only when every endpoint and runtime gate passes", () => {
  const summary = buildLiveArmChecklistSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: readinessSnapshot(),
  });

  assert.equal(summary.gateLabel, "Live checklist clear");
  assert.equal(summary.readyCountLabel, "14/14 gate(s) clear");
  assert.equal(summary.blockingCountLabel, "No live-arm blockers");
  assert.equal(summary.blocking, false);
  assert.equal(summary.items.length, 14);
  assert.equal(summary.items.find((item) => item.key === "endpoint")?.statusLabel, "Endpoint verdict ready");
  assert.equal(summary.items.find((item) => item.key === "credential")?.statusLabel, "Credential key valid");
  assert.equal(summary.items.find((item) => item.key === "broker")?.statusLabel, "Broker ready");
  assert.equal(summary.items.find((item) => item.key === "runtime")?.statusLabel, "Runtime armed");
});

test("live arm checklist blocks endpoint-ready payload until runtime arming is present", () => {
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
  const summary = buildLiveArmChecklistSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: normalizeLiveReadinessPayload(unarmedPayload),
      liveMoneyReady: false,
    },
  });
  const endpoint = summary.items.find((item) => item.key === "endpoint");
  const runtime = summary.items.find((item) => item.key === "runtime");

  assert.equal(summary.gateLabel, "Live checklist blocked");
  assert.equal(summary.readyCountLabel, "13/14 gate(s) clear");
  assert.equal(summary.blockingCountLabel, "1 live-arm blocker(s)");
  assert.equal(summary.blocking, true);
  assert.equal(endpoint?.blocking, false);
  assert.equal(endpoint?.statusLabel, "Endpoint verdict ready");
  assert.equal(runtime?.blocking, true);
  assert.equal(runtime?.statusLabel, "Runtime not armed");
  assert.equal(runtime?.detailLabel, "Not armed");
});

test("live arm checklist fails closed without endpoint evidence", () => {
  const summary = buildLiveArmChecklistSummary(getDefaultLiveReadinessSnapshot());
  const endpoint = summary.items.find((item) => item.key === "endpoint");

  assert.equal(summary.gateLabel, "Live checklist blocked");
  assert.equal(summary.readyCountLabel, "0/14 gate(s) clear");
  assert.equal(summary.blockingCountLabel, "14 live-arm blocker(s)");
  assert.equal(summary.blocking, true);
  assert.equal(endpoint?.statusLabel, "Endpoint evidence missing");
  assert.equal(endpoint?.detailLabel, "Run live-readiness check before arming.");
});

test("live arm checklist exposes broker source credential and ingestion blockers", () => {
  const blockedPayload = {
    ...readyPayload,
    ready_for_live: false,
    blocking_issues: [
      { code: "credential_key_invalid", message: "Credential key is not valid." },
      { code: "active_broker_not_connected", message: "Active broker is offline." },
    ],
    blocking_codes: ["credential_key_invalid", "active_broker_not_connected"],
    checks: {
      ...readyPayload.checks,
      credential_key: { configured: true, valid: false },
      broker: {
        ...readyPayload.checks.broker,
        configured: true,
        connected: false,
        missing_required_fields: ["api_secret"],
      },
      source_policy: {
        ...readyPayload.checks.source_policy,
        valid: false,
        auto_live_sources: 0,
        error: "No strict source policy allows live execution.",
      },
      signal_ingestion: {
        ...readyPayload.checks.signal_ingestion,
        discord_connected: false,
        chrome_bridge_healthy: false,
      },
    },
  };
  const summary = buildLiveArmChecklistSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: normalizeLiveReadinessPayload(blockedPayload),
      liveMoneyReady: false,
    },
  });

  assert.equal(summary.gateLabel, "Live checklist blocked");
  assert.equal(summary.items.find((item) => item.key === "credential")?.statusLabel, "Credential key invalid");
  assert.equal(summary.items.find((item) => item.key === "broker")?.statusLabel, "Broker blocked");
  assert.equal(summary.items.find((item) => item.key === "broker")?.detailLabel, "alpaca offline; missing api_secret");
  assert.equal(summary.items.find((item) => item.key === "source")?.statusLabel, "Source policy blocked");
  assert.equal(
    summary.items.find((item) => item.key === "source")?.detailLabel,
    "No strict source policy allows live execution.",
  );
  assert.equal(summary.items.find((item) => item.key === "ingestion")?.statusLabel, "Live ingestion blocked");
});

test("live arm checklist blocks hidden missing broker source ingestion trading and OCO evidence", () => {
  const hiddenEvidencePayload = {
    ...readyPayload,
    checks: {
      ...readyPayload.checks,
      broker: {
        ...readyPayload.checks.broker,
        active_broker: "unknown",
        missing_required_fields: ["api_secret"],
      },
      source_policy: {
        ...readyPayload.checks.source_policy,
        enabled_sources: 0,
      },
      signal_ingestion: {
        ...readyPayload.checks.signal_ingestion,
        discord_configured: false,
        discord_channel_count: 0,
      },
      trading: {
        ...readyPayload.checks.trading,
        max_position_size: null,
      },
      exit_automation: {
        ...readyPayload.checks.exit_automation,
        unprotected_open_position_ids: ["pos-1"],
      },
    },
  };
  const summary = buildLiveArmChecklistSummary({
    ...getDefaultLiveReadinessSnapshot(),
    remote: {
      checkedAt: "2026-06-27T17:25:00.000Z",
      readiness: normalizeLiveReadinessPayload(hiddenEvidencePayload),
      liveMoneyReady: false,
    },
  });

  assert.equal(summary.gateLabel, "Live checklist blocked");
  assert.equal(summary.items.find((item) => item.key === "broker")?.statusLabel, "Broker blocked");
  assert.equal(summary.items.find((item) => item.key === "source")?.statusLabel, "Source policy blocked");
  assert.equal(summary.items.find((item) => item.key === "ingestion")?.statusLabel, "Live ingestion blocked");
  assert.equal(summary.items.find((item) => item.key === "trading")?.statusLabel, "Trading controls blocked");
  assert.equal(summary.items.find((item) => item.key === "exits")?.statusLabel, "OCO exits blocking");
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
