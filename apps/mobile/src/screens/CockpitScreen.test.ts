import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FAILOVER_SETTINGS } from "@apk-alerts/contracts";
import {
  buildEngineCommunicationProofSummary,
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

test("engine communication proof clears when health lease transport and sync agree", () => {
  const summary = buildEngineCommunicationProofSummary(EXECUTABLE_PHONE_SNAPSHOT);

  assert.equal(summary.gateLabel, "Communication clear");
  assert.equal(summary.readyCountLabel, "5/5 proof(s) clear");
  assert.equal(summary.blockingCountLabel, "No communication blockers");
  assert.equal(summary.blocking, false);
  assert.equal(summary.items.find((item) => item.key === "phone_health")?.statusLabel, "Phone healthy");
  assert.equal(summary.items.find((item) => item.key === "remote_health")?.statusLabel, "Remote reachable");
  assert.equal(summary.items.find((item) => item.key === "lease")?.statusLabel, "Lease matches Phone Engine");
  assert.equal(summary.items.find((item) => item.key === "transport")?.statusLabel, "Transport connected");
  assert.equal(summary.items.find((item) => item.key === "sync")?.statusLabel, "Event log synced");
});

test("engine communication proof blocks stale sync evidence", () => {
  const summary = buildEngineCommunicationProofSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    syncStatus: "stale",
    lastSyncLabel: "4m ago",
  });

  assert.equal(summary.gateLabel, "Communication blocked");
  assert.equal(summary.readyCountLabel, "4/5 proof(s) clear");
  assert.equal(summary.blockingCountLabel, "1 communication blocker(s)");
  assert.equal(summary.blocking, true);
  assert.equal(summary.items.find((item) => item.key === "sync")?.statusLabel, "Event log not synced");
  assert.equal(summary.items.find((item) => item.key === "sync")?.detailLabel, "stale - 4m ago");
});

test("engine communication proof blocks lease holder mismatch", () => {
  const summary = buildEngineCommunicationProofSummary({
    ...EXECUTABLE_PHONE_SNAPSHOT,
    activeEngine: "remote",
    leaseState: "phone_held",
  });

  assert.equal(summary.gateLabel, "Communication blocked");
  assert.equal(summary.items.find((item) => item.key === "lease")?.statusLabel, "Lease mismatch");
  assert.equal(summary.items.find((item) => item.key === "lease")?.detailLabel, "Phone lease but active engine is Remote Engine");
  assert.equal(summary.blocking, true);
});

test("missing transport blocks communication proof and cockpit execution", () => {
  const snapshot = {
    ...EXECUTABLE_PHONE_SNAPSHOT,
    transport: "none",
  } satisfies OperatorSnapshot;
  const communication = buildEngineCommunicationProofSummary(snapshot);
  const cockpit = buildCockpitSummary(snapshot);

  assert.equal(communication.items.find((item) => item.key === "transport")?.statusLabel, "Transport missing");
  assert.equal(communication.blocking, true);
  assert.equal(cockpit.canExecute, false);
});

test("cockpit summary can include configured failover policy", () => {
  const summary = buildCockpitSummary(EXECUTABLE_PHONE_SNAPSHOT, {
    ...DEFAULT_FAILOVER_SETTINGS,
    enginePriority: "remote_then_phone",
    allowCloudFallback: false,
  });

  assert.equal(summary.policyLabel, "Remote then Phone");
  assert.equal(summary.transportPolicyLabel, "Tailscale only");
});

test("cockpit summary fails closed when active phone engine is disabled", () => {
  const summary = buildCockpitSummary(EXECUTABLE_PHONE_SNAPSHOT, {
    ...DEFAULT_FAILOVER_SETTINGS,
    phoneEngineEnabled: false,
  });

  assert.equal(summary.policyLabel, "Remote only");
  assert.equal(summary.canExecute, false);
});

test("cockpit summary fails closed when active remote engine is disabled", () => {
  const summary = buildCockpitSummary(
    {
      ...EXECUTABLE_PHONE_SNAPSHOT,
      activeEngine: "remote",
      leaseState: "remote_held",
    },
    {
      ...DEFAULT_FAILOVER_SETTINGS,
      remoteEngineEnabled: false,
    },
  );

  assert.equal(summary.policyLabel, "Phone only");
  assert.equal(summary.canExecute, false);
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
