import {
  normalizeLeaseEvidenceSnapshot,
  type EngineHealthStatus,
  type LeaseEvidenceSnapshot,
  type LeaseEvidenceSnapshotInput,
} from "@sentinel-nexus/contracts";
import type { AlertEvidenceSnapshot } from "./alertEvidenceState";
import type { LiveReadinessSnapshot } from "./liveReadinessState";
import type { ActiveEngine, LeaseState, OperatorSnapshot, ReadinessState, SyncStatus } from "./operatorState";
import {
  buildPhoneEngineRuntimeSummary,
  type PhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState";
import type { RemoteEngineSnapshot } from "./remoteEngineState";

export interface OperatorSnapshotEvidenceInput {
  remoteEngine: RemoteEngineSnapshot;
  alertEvidence: AlertEvidenceSnapshot;
  liveReadiness: LiveReadinessSnapshot;
  phoneEngine?: PhoneEngineRuntimeSnapshot;
  leaseEvidence?: LeaseEvidenceSnapshotInput;
}

export function buildOperatorSnapshotFromEvidence(
  input: OperatorSnapshotEvidenceInput,
): OperatorSnapshot {
  const phoneRuntime = input.phoneEngine
    ? buildPhoneEngineRuntimeSummary(input.phoneEngine)
    : null;
  const phoneHealth = derivePhoneHealth(input.remoteEngine, input.phoneEngine, phoneRuntime?.canOwnLease ?? false);
  const remoteHealth = normalizeOperatorHealth(input.remoteEngine.remote.engineHealth);
  const leaseEvidence = deriveLeaseEvidence(input);
  const activeEngine = deriveActiveEngine(input.remoteEngine, phoneHealth, remoteHealth, leaseEvidence);

  return {
    activeEngine,
    phoneHealth,
    remoteHealth,
    leaseState: deriveLeaseState(leaseEvidence),
    transport: input.remoteEngine.connection.transport,
    readiness: deriveReadiness(input.liveReadiness),
    syncStatus: deriveSyncStatus(input.alertEvidence),
    lastSyncLabel: input.alertEvidence.evidence.checkedAt || "never",
  };
}

function deriveActiveEngine(
  remoteEngine: RemoteEngineSnapshot,
  phoneHealth: EngineHealthStatus,
  remoteHealth: EngineHealthStatus,
  leaseEvidence: LeaseEvidenceSnapshot,
): ActiveEngine {
  if (!leaseEvidence.usable) {
    return "none";
  }
  if (leaseEvidence.holder === "phone" && phoneHealth === "healthy") {
    return "phone";
  }
  if (
    leaseEvidence.holder === "remote" &&
    remoteEngine.remote.checkedAt &&
    remoteHealth === "healthy" &&
    remoteEngine.remote.executionReady
  ) {
    return "remote";
  }
  return "none";
}

function derivePhoneHealth(
  remoteEngine: RemoteEngineSnapshot,
  phoneEngine: PhoneEngineRuntimeSnapshot | undefined,
  canOwnLease: boolean,
): EngineHealthStatus {
  if (canOwnLease) {
    return "healthy";
  }
  if (phoneEngine?.nativeRuntimeAvailable) {
    return phoneEngine.health === "unknown" ? "offline" : phoneEngine.health;
  }
  return remoteEngine.phoneEngineOnline ? "degraded" : "offline";
}

function deriveLeaseEvidence(input: OperatorSnapshotEvidenceInput): LeaseEvidenceSnapshot {
  if (input.leaseEvidence !== undefined) {
    return normalizeLeaseEvidenceSnapshot(input.leaseEvidence);
  }

  const hasRemoteEvidence = Boolean(
    input.remoteEngine.remote.checkedAt ||
      input.alertEvidence.evidence.checkedAt ||
      input.liveReadiness.remote.checkedAt ||
      input.phoneEngine?.lastHeartbeatAt,
  );
  return normalizeLeaseEvidenceSnapshot({
    holder: hasRemoteEvidence ? "unknown" : "none",
    source: "none",
  });
}

function deriveLeaseState(leaseEvidence: LeaseEvidenceSnapshot): LeaseState {
  if (!leaseEvidence.usable) {
    return leaseEvidence.holder === "none" ? "none" : "unclear";
  }
  if (leaseEvidence.holder === "phone") {
    return "phone_held";
  }
  if (leaseEvidence.holder === "remote") {
    return "remote_held";
  }
  return "unclear";
}

function deriveReadiness(liveReadiness: LiveReadinessSnapshot): ReadinessState {
  if (liveReadiness.remote.liveMoneyReady) {
    return "live_ready";
  }
  if (liveReadiness.remote.checkedAt && liveReadiness.remote.readiness.readyForLive) {
    return "paper_ready";
  }
  return "not_ready";
}

function deriveSyncStatus(alertEvidence: AlertEvidenceSnapshot): SyncStatus {
  if (alertEvidence.lastError) {
    return "stale";
  }
  return alertEvidence.evidence.checkedAt ? "synced" : "unknown";
}

function normalizeOperatorHealth(health: EngineHealthStatus | "unknown"): EngineHealthStatus {
  return health === "unknown" ? "offline" : health;
}
