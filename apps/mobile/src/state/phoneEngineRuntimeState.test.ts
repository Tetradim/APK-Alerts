import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhoneEngineRuntimeSummary,
  createPhoneEngineRuntimeStore,
  getDefaultPhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState.js";

test("default phone engine runtime is unavailable and cannot own lease", () => {
  const summary = buildPhoneEngineRuntimeSummary(getDefaultPhoneEngineRuntimeSnapshot());

  assert.equal(summary.statusLabel, "Phone runtime unavailable");
  assert.equal(summary.leaseLabel, "Cannot own lease");
  assert.equal(summary.detailLabel, "Native Android foreground engine is not installed.");
  assert.equal(summary.canOwnLease, false);
  assert.equal(summary.blocking, true);
});

test("phone engine runtime can own lease only when native foreground service is healthy", () => {
  const store = createPhoneEngineRuntimeStore();

  store.getState().updateRuntime({
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
    liveExecutionArmed: false,
    health: "healthy",
    lastHeartbeatAt: "2026-06-27T18:20:00.000Z",
    blockingReason: "",
  });
  const summary = buildPhoneEngineRuntimeSummary(store.getState().snapshot);

  assert.equal(summary.statusLabel, "Phone engine healthy");
  assert.equal(summary.leaseLabel, "Lease eligible");
  assert.equal(summary.detailLabel, "Foreground service heartbeat 2026-06-27T18:20:00.000Z");
  assert.equal(summary.canOwnLease, true);
  assert.equal(summary.blocking, false);
});

test("phone engine runtime cannot own lease when embedded adapters are not ready", () => {
  const store = createPhoneEngineRuntimeStore();

  store.getState().updateRuntime({
    nativeRuntimeAvailable: true,
    serviceEnabled: true,
    foregroundServiceActive: true,
    discordEngineEmbedded: true,
    brokerEngineEmbedded: true,
    discordEngineReady: false,
    discordGatewayConnected: true,
    discordIngestionEvidenceReady: false,
    discordGatewayStatus: "ready_waiting_for_alert",
    peerAlertServerActive: true,
    peerAlertServerStatus: "listening",
    brokerEngineReady: false,
    liveExecutionArmed: false,
    health: "healthy",
    lastHeartbeatAt: "2026-06-27T18:21:00.000Z",
    blockingReason: "",
  });
  const summary = buildPhoneEngineRuntimeSummary(store.getState().snapshot);

  assert.equal(summary.statusLabel, "Phone engine healthy");
  assert.equal(summary.leaseLabel, "Cannot own lease");
  assert.equal(summary.detailLabel, "Native Discord and broker adapters are not ready.");
  assert.equal(summary.canOwnLease, false);
  assert.equal(summary.blocking, true);
});
