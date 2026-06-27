import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCockpitSummary,
  NOT_PAIRED_OPERATOR_SNAPSHOT,
  type OperatorSnapshot,
} from "../state/operatorState.js";

const EXECUTABLE_PHONE_SNAPSHOT: OperatorSnapshot = {
  activeEngine: "phone",
  phoneHealth: "healthy",
  remoteHealth: "healthy",
  leaseState: "phone_held",
  transport: "tailscale",
  readiness: "live_ready",
  syncStatus: "synced",
  lastSyncLabel: "8s ago",
};

test("not paired cockpit summary fails closed", () => {
  const summary = buildCockpitSummary(NOT_PAIRED_OPERATOR_SNAPSHOT);

  assert.equal(summary.activeEngineLabel, "No active engine");
  assert.equal(summary.leaseLabel, "No lease");
  assert.equal(summary.readinessLabel, "Not ready");
  assert.equal(summary.primaryActionLabel, "Pair Remote Engine");
  assert.equal(summary.canExecute, false);
});

test("phone-owned healthy cockpit summary shows remote dormant", () => {
  const summary = buildCockpitSummary(EXECUTABLE_PHONE_SNAPSHOT);

  assert.equal(summary.activeEngineLabel, "Phone Engine");
  assert.equal(summary.remoteLabel, "Dormant");
  assert.equal(summary.leaseLabel, "Lease held");
  assert.equal(summary.canExecute, true);
});

test("cockpit summary can include configured failover policy", () => {
  const summary = buildCockpitSummary(EXECUTABLE_PHONE_SNAPSHOT, {
    engineLabel: "Phone then Remote",
    transportLabel: "Tailscale with cloud fallback",
    notificationsLabel: "Failover and offline alerts on",
  });

  assert.equal(summary.policyLabel, "Phone then Remote");
  assert.equal(summary.transportPolicyLabel, "Tailscale with cloud fallback");
});

test("active engine mismatch fails closed even with held lease readiness and sync", () => {
  const summary = buildCockpitSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    activeEngine: "none",
    leaseState: "remote_held",
  });

  assert.equal(summary.canExecute, false);
});

test("phone-held execution requires healthy phone engine", () => {
  for (const phoneHealth of ["unknown", "offline", "degraded"] as const) {
    const summary = buildCockpitSummary({
      ...EXECUTABLE_PHONE_SNAPSHOT,
      phoneHealth,
    });

    assert.equal(summary.canExecute, false);
  }
});

test("remote-held execution requires healthy remote engine", () => {
  for (const remoteHealth of ["unknown", "offline", "degraded"] as const) {
    const summary = buildCockpitSummary({
      ...EXECUTABLE_PHONE_SNAPSHOT,
      activeEngine: "remote",
      leaseState: "remote_held",
      remoteHealth,
    });

    assert.equal(summary.canExecute, false);
  }
});

test("remote-held healthy paper-ready cockpit summary can execute", () => {
  const summary = buildCockpitSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    activeEngine: "remote",
    leaseState: "remote_held",
    readiness: "paper_ready",
  });

  assert.equal(summary.activeEngineLabel, "Remote Engine");
  assert.equal(summary.leaseLabel, "Lease held");
  assert.equal(summary.canExecute, true);
});

test("stale or unknown sync fails closed", () => {
  for (const syncStatus of ["stale", "unknown"] as const) {
    const summary = buildCockpitSummary({
      ...EXECUTABLE_PHONE_SNAPSHOT,
      syncStatus,
    });

    assert.equal(summary.canExecute, false);
  }
});

test("unclear lease or readiness fails closed", () => {
  const unclearLeaseSummary = buildCockpitSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    leaseState: "unclear",
  });
  const unclearReadinessSummary = buildCockpitSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    readiness: "unclear",
  });

  assert.equal(unclearLeaseSummary.canExecute, false);
  assert.equal(unclearReadinessSummary.canExecute, false);
});
