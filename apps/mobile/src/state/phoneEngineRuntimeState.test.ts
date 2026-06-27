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
