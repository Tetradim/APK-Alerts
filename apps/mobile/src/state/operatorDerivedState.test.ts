import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteEngineHealthSnapshot,
  normalizeBridgeHealthPayload,
  normalizeLeaseEvidenceSnapshot,
  normalizeLiveReadinessPayload,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
} from "@sentinel-nexus/contracts";
import {
  getDefaultAlertEvidenceSnapshot,
  type AlertEvidenceSnapshot,
} from "./alertEvidenceState.js";
import {
  getDefaultLiveReadinessSnapshot,
  type LiveReadinessSnapshot,
} from "./liveReadinessState.js";
import {
  getDefaultRemoteEngineSnapshot,
  type RemoteEngineSnapshot,
} from "./remoteEngineState.js";
import { buildCockpitSummary } from "./operatorState.js";
import { buildOperatorSnapshotFromEvidence } from "./operatorDerivedState.js";
import {
  getDefaultPhoneEngineRuntimeSnapshot,
  type PhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState.js";

function checkedRemoteSnapshot(): RemoteEngineSnapshot {
  return {
    ...getDefaultRemoteEngineSnapshot(),
    connection: {
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
      transport: "tailscale",
    },
    remote: buildRemoteEngineHealthSnapshot({
      checkedAt: "2026-06-27T18:10:00.000Z",
      health: normalizeRemoteHealthPayload({
        status: "healthy",
        discord_connected: true,
        broker_connected: true,
      }),
      status: normalizeRemoteStatusPayload({
        active_broker: "alpaca",
        auto_trading_enabled: true,
        simulation_mode: false,
        shutdown_triggered: false,
        alerts_processed: 12,
        last_alert_time: "2026-06-27T18:09:00.000Z",
      }),
    }),
  };
}

function checkedEvidenceSnapshot(): AlertEvidenceSnapshot {
  return {
    ...getDefaultAlertEvidenceSnapshot(),
    connection: {
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
      transport: "tailscale",
    },
    evidence: {
      checkedAt: "2026-06-27T18:10:01.000Z",
      bridgeHealth: normalizeBridgeHealthPayload({
        ok: true,
        status: "healthy",
        healthy: true,
        supervisor: {
          state: "healthy",
          source: "chrome-supervisor",
          reason: "heartbeat",
        },
      }),
      leaseEvidence: normalizeLeaseEvidenceSnapshot(null),
      signals: [],
      decisions: [],
      chains: [],
    },
  };
}

function readyToArmSnapshot(): LiveReadinessSnapshot {
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
        live_trading_armed: false,
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

  return {
    ...getDefaultLiveReadinessSnapshot(),
    connection: {
      baseApiUrl: "http://100.90.10.11:8001/api",
      apiKey: "secret",
      transport: "tailscale",
    },
    remote: {
      checkedAt: "2026-06-27T18:10:02.000Z",
      readiness: normalizeLiveReadinessPayload(readyPayload),
      liveMoneyReady: false,
    },
  };
}

test("derived operator snapshot starts not paired without remote evidence", () => {
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine: getDefaultRemoteEngineSnapshot(),
    alertEvidence: getDefaultAlertEvidenceSnapshot(),
    liveReadiness: getDefaultLiveReadinessSnapshot(),
  });
  const summary = buildCockpitSummary(snapshot);

  assert.equal(snapshot.activeEngine, "none");
  assert.equal(snapshot.leaseState, "none");
  assert.equal(snapshot.transport, "none");
  assert.equal(snapshot.syncStatus, "unknown");
  assert.equal(summary.canExecute, false);
});

test("derived operator snapshot reflects checked remote and evidence state", () => {
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine: checkedRemoteSnapshot(),
    alertEvidence: checkedEvidenceSnapshot(),
    liveReadiness: readyToArmSnapshot(),
    leaseEvidence: {
      holder: "remote",
      leaseId: "lease-remote-1",
      holderEngineId: "remote",
      expiresAt: "2026-06-27T18:15:00.000Z",
      observedAt: "2026-06-27T18:10:01.000Z",
      stale: false,
      conflict: false,
      source: "remote_event_log",
    },
  });
  const summary = buildCockpitSummary(snapshot);

  assert.equal(snapshot.activeEngine, "remote");
  assert.equal(snapshot.remoteHealth, "healthy");
  assert.equal(snapshot.phoneHealth, "offline");
  assert.equal(snapshot.leaseState, "remote_held");
  assert.equal(snapshot.transport, "tailscale");
  assert.equal(snapshot.syncStatus, "synced");
  assert.equal(snapshot.lastSyncLabel, "2026-06-27T18:10:01.000Z");
  assert.equal(snapshot.readiness, "paper_ready");
  assert.equal(summary.activeEngineLabel, "Remote Engine");
  assert.equal(summary.remoteLabel, "Available");
});

test("derived operator snapshot lets healthy phone runtime own the lease before remote", () => {
  const phoneEngine: PhoneEngineRuntimeSnapshot = {
    ...getDefaultPhoneEngineRuntimeSnapshot(),
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordEngineReady: true,
    discordGatewayConnected: true,
    discordIngestionEvidenceReady: true,
    discordGatewayStatus: "message_create",
    discordLastAlertObservedAt: "2026-06-27T18:19:59.000Z",
    peerAlertServerActive: true,
    peerAlertServerStatus: "listening",
    brokerEngineReady: true,
    health: "healthy",
    lastHeartbeatAt: "2026-06-27T18:20:00.000Z",
    blockingReason: "",
  };
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine: checkedRemoteSnapshot(),
    alertEvidence: checkedEvidenceSnapshot(),
    liveReadiness: readyToArmSnapshot(),
    phoneEngine,
    leaseEvidence: {
      holder: "phone",
      leaseId: "lease-phone-1",
      holderEngineId: "phone",
      expiresAt: "2026-06-27T18:25:00.000Z",
      observedAt: "2026-06-27T18:20:00.000Z",
      stale: false,
      conflict: false,
      source: "phone_native_store",
    },
  });

  assert.equal(snapshot.activeEngine, "phone");
  assert.equal(snapshot.phoneHealth, "healthy");
  assert.equal(snapshot.leaseState, "phone_held");
});

test("derived operator snapshot does not synthesize lease ownership from engine health", () => {
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine: checkedRemoteSnapshot(),
    alertEvidence: checkedEvidenceSnapshot(),
    liveReadiness: readyToArmSnapshot(),
    leaseEvidence: {
      holder: "unknown",
      leaseId: null,
      holderEngineId: null,
      expiresAt: null,
      observedAt: null,
      stale: false,
      conflict: false,
      source: "none",
    },
  });
  const summary = buildCockpitSummary(snapshot);

  assert.equal(snapshot.activeEngine, "none");
  assert.equal(snapshot.leaseState, "unclear");
  assert.equal(summary.canExecute, false);
  assert.equal(summary.leaseLabel, "Lease unclear");
});

test("derived operator snapshot keeps phone standby when remote owns the audited lease", () => {
  const phoneEngine: PhoneEngineRuntimeSnapshot = {
    ...getDefaultPhoneEngineRuntimeSnapshot(),
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordEngineReady: true,
    discordGatewayConnected: true,
    discordIngestionEvidenceReady: true,
    discordGatewayStatus: "message_create",
    discordLastAlertObservedAt: "2026-06-27T18:19:59.000Z",
    peerAlertServerActive: true,
    peerAlertServerStatus: "listening",
    brokerEngineReady: true,
    health: "healthy",
    lastHeartbeatAt: "2026-06-27T18:20:00.000Z",
    blockingReason: "",
  };
  const snapshot = buildOperatorSnapshotFromEvidence({
    remoteEngine: checkedRemoteSnapshot(),
    alertEvidence: checkedEvidenceSnapshot(),
    liveReadiness: readyToArmSnapshot(),
    phoneEngine,
    leaseEvidence: {
      holder: "remote",
      leaseId: "lease-remote-1",
      holderEngineId: "remote",
      expiresAt: "2026-06-27T18:25:00.000Z",
      observedAt: "2026-06-27T18:20:00.000Z",
      stale: false,
      conflict: false,
      source: "remote_event_log",
    },
  });

  assert.equal(snapshot.activeEngine, "remote");
  assert.equal(snapshot.phoneHealth, "healthy");
  assert.equal(snapshot.leaseState, "remote_held");
});
