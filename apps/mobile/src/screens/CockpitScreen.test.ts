import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCockpitSummary,
  NOT_PAIRED_OPERATOR_SNAPSHOT,
} from "../state/operatorState.js";

test("not paired cockpit summary fails closed", () => {
  const summary = buildCockpitSummary(NOT_PAIRED_OPERATOR_SNAPSHOT);

  assert.equal(summary.activeEngineLabel, "No active engine");
  assert.equal(summary.leaseLabel, "No lease");
  assert.equal(summary.readinessLabel, "Not ready");
  assert.equal(summary.primaryActionLabel, "Pair Remote Engine");
  assert.equal(summary.canExecute, false);
});

test("phone-owned healthy cockpit summary shows remote dormant", () => {
  const summary = buildCockpitSummary({
    activeEngine: "phone",
    phoneHealth: "healthy",
    remoteHealth: "healthy",
    leaseState: "phone_held",
    transport: "tailscale",
    readiness: "live_ready",
    syncStatus: "synced",
    lastSyncLabel: "8s ago",
  });

  assert.equal(summary.activeEngineLabel, "Phone Engine");
  assert.equal(summary.remoteLabel, "Dormant");
  assert.equal(summary.leaseLabel, "Lease held");
  assert.equal(summary.canExecute, true);
});
