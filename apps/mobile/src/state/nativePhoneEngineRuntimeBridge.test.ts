import assert from "node:assert/strict";
import test from "node:test";
import { createPhoneEngineRuntimeStore } from "./phoneEngineRuntimeState.js";
import {
  startAndSyncPhoneEngineRuntime,
  stopAndSyncPhoneEngineRuntime,
  syncPhoneEngineRuntimeStatus,
} from "./nativePhoneEngineRuntimeBridge.js";

test("native phone engine runtime sync writes unavailable status to the store", async () => {
  const store = createPhoneEngineRuntimeStore();

  const snapshot = await syncPhoneEngineRuntimeStatus(store, null);

  assert.equal(snapshot.nativeRuntimeAvailable, false);
  assert.equal(store.getState().snapshot.nativeRuntimeAvailable, false);
  assert.equal(store.getState().snapshot.blockingReason, "Native Android foreground engine module is unavailable.");
});

test("native phone engine runtime sync updates the store after start and stop", async () => {
  const store = createPhoneEngineRuntimeStore();
  const module = {
    getStatus: async () => ({}),
    start: async () => ({
      nativeRuntimeAvailable: true,
      serviceEnabled: true,
      foregroundServiceActive: true,
      discordEngineEmbedded: true,
      brokerEngineEmbedded: true,
      discordEngineReady: false,
      brokerEngineReady: false,
      liveExecutionArmed: false,
      health: "degraded",
      lastHeartbeatAt: "2026-06-27T18:30:00.000Z",
      blockingReason: "Native Discord and broker adapters are embedded but not configured.",
    }),
    stop: async () => ({
      nativeRuntimeAvailable: true,
      serviceEnabled: false,
      foregroundServiceActive: false,
      discordEngineEmbedded: true,
      brokerEngineEmbedded: true,
      discordEngineReady: false,
      brokerEngineReady: false,
      liveExecutionArmed: false,
      health: "offline",
      lastHeartbeatAt: "2026-06-27T18:30:10.000Z",
      blockingReason: "Foreground service stopped.",
    }),
  };

  await startAndSyncPhoneEngineRuntime(store, module);
  assert.equal(store.getState().snapshot.foregroundServiceActive, true);
  assert.equal(store.getState().snapshot.health, "degraded");

  await stopAndSyncPhoneEngineRuntime(store, module);
  assert.equal(store.getState().snapshot.foregroundServiceActive, false);
  assert.equal(store.getState().snapshot.health, "offline");
});
