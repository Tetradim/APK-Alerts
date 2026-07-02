import { create } from "zustand";
import {
  buildEnginePriorityLabel,
  buildTransportLabel,
  type FailoverSettingsInput,
  normalizeFailoverSettings,
} from "@sentinel-nexus/contracts";

export type ActiveEngine = "phone" | "remote" | "none";
export type EngineHealth = "healthy" | "degraded" | "offline" | "unknown";
export type LeaseState = "phone_held" | "remote_held" | "none" | "unclear";
export type TransportState = "tailscale" | "same_wifi" | "cloud_relay" | "none";
export type ReadinessState = "live_ready" | "paper_ready" | "not_ready" | "unclear";
export type SyncStatus = "synced" | "syncing" | "stale" | "unknown";

export interface OperatorSnapshot {
  activeEngine: ActiveEngine;
  phoneHealth: EngineHealth;
  remoteHealth: EngineHealth;
  leaseState: LeaseState;
  transport: TransportState;
  readiness: ReadinessState;
  syncStatus: SyncStatus;
  lastSyncLabel: string;
}

export interface CockpitSummary {
  activeEngineLabel: string;
  remoteLabel: string;
  leaseLabel: string;
  readinessLabel: string;
  transportLabel: string;
  syncLabel: string;
  primaryActionLabel: string;
  policyLabel: string;
  transportPolicyLabel: string;
  canExecute: boolean;
}

export interface EngineCommunicationProofItem {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  blocking: boolean;
}

export interface EngineCommunicationProofSummary {
  gateLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  blocking: boolean;
  items: EngineCommunicationProofItem[];
}

export const NOT_PAIRED_OPERATOR_SNAPSHOT: OperatorSnapshot = {
  activeEngine: "none",
  phoneHealth: "unknown",
  remoteHealth: "unknown",
  leaseState: "none",
  transport: "none",
  readiness: "not_ready",
  syncStatus: "unknown",
  lastSyncLabel: "never",
};

export function buildCockpitSummary(
  snapshot: OperatorSnapshot,
  failoverSettings?: FailoverSettingsInput,
): CockpitSummary {
  const hasFailoverSettings = failoverSettings !== undefined;
  const normalizedFailoverSettings = normalizeFailoverSettings(failoverSettings);
  const communicationProof = buildEngineCommunicationProofSummary(snapshot);
  const activeEngineLabel =
    snapshot.activeEngine === "phone"
      ? "Phone Engine"
      : snapshot.activeEngine === "remote"
        ? "Remote Engine"
        : "No active engine";

  const remoteLabel =
    snapshot.leaseState === "phone_held"
      ? "Dormant"
      : snapshot.remoteHealth === "healthy"
        ? "Available"
        : "Unknown";

  const leaseLabel =
    snapshot.leaseState === "phone_held" || snapshot.leaseState === "remote_held"
      ? "Lease held"
      : snapshot.leaseState === "unclear"
        ? "Lease unclear"
        : "No lease";

  const readinessLabel =
    snapshot.readiness === "live_ready"
      ? "Live gates satisfied"
      : snapshot.readiness === "paper_ready"
        ? "Paper ready"
        : snapshot.readiness === "unclear"
          ? "Readiness unclear"
          : "Not ready";

  const transportLabel =
    snapshot.transport === "tailscale"
      ? "Tailscale"
      : snapshot.transport === "same_wifi"
        ? "Same Wi-Fi"
        : snapshot.transport === "cloud_relay"
          ? "Cloud relay"
          : "No transport";

  const holderCanExecute =
    (snapshot.leaseState === "phone_held" &&
      snapshot.activeEngine === "phone" &&
      snapshot.phoneHealth === "healthy") ||
    (snapshot.leaseState === "remote_held" &&
      snapshot.activeEngine === "remote" &&
      snapshot.remoteHealth === "healthy");
  const activeEngineEnabled =
    snapshot.activeEngine === "phone"
      ? normalizedFailoverSettings.phoneEngineEnabled
      : snapshot.activeEngine === "remote"
        ? normalizedFailoverSettings.remoteEngineEnabled
        : false;
  const readinessCanExecute = snapshot.readiness === "live_ready" || snapshot.readiness === "paper_ready";
  const canExecute =
    holderCanExecute && activeEngineEnabled && readinessCanExecute && !communicationProof.blocking;

  return {
    activeEngineLabel,
    remoteLabel,
    leaseLabel,
    readinessLabel,
    transportLabel,
    syncLabel: snapshot.syncStatus === "synced" ? `Synced ${snapshot.lastSyncLabel}` : "Sync unavailable",
    primaryActionLabel: snapshot.activeEngine === "none" ? "Pair Remote Engine" : "View Engine Health",
    policyLabel: hasFailoverSettings
      ? buildEnginePriorityLabel(normalizedFailoverSettings)
      : "No failover policy",
    transportPolicyLabel: hasFailoverSettings
      ? buildTransportLabel(normalizedFailoverSettings)
      : "No transport policy",
    canExecute,
  };
}

export function buildEngineCommunicationProofSummary(snapshot: OperatorSnapshot): EngineCommunicationProofSummary {
  const phoneHealthy = snapshot.phoneHealth === "healthy";
  const remoteReachable = snapshot.remoteHealth === "healthy";
  const leaseMatchesActiveEngine =
    (snapshot.leaseState === "phone_held" && snapshot.activeEngine === "phone") ||
    (snapshot.leaseState === "remote_held" && snapshot.activeEngine === "remote");
  const transportConnected = snapshot.transport !== "none";
  const eventLogSynced = snapshot.syncStatus === "synced";
  const items: EngineCommunicationProofItem[] = [
    {
      key: "phone_health",
      label: "Phone health",
      statusLabel: phoneHealthy ? "Phone healthy" : "Phone not healthy",
      detailLabel: formatEngineHealthDetail("Phone", snapshot.phoneHealth),
      blocking: !phoneHealthy,
    },
    {
      key: "remote_health",
      label: "Remote health",
      statusLabel: remoteReachable ? "Remote reachable" : "Remote not reachable",
      detailLabel: formatEngineHealthDetail("Remote", snapshot.remoteHealth),
      blocking: !remoteReachable,
    },
    {
      key: "lease",
      label: "Active lease",
      statusLabel: leaseMatchesActiveEngine
        ? `Lease matches ${formatActiveEngineLabel(snapshot.activeEngine)}`
        : "Lease mismatch",
      detailLabel: formatLeaseProofDetail(snapshot.leaseState, snapshot.activeEngine),
      blocking: !leaseMatchesActiveEngine,
    },
    {
      key: "transport",
      label: "Transport",
      statusLabel: transportConnected ? "Transport connected" : "Transport missing",
      detailLabel: formatTransportProofDetail(snapshot.transport),
      blocking: !transportConnected,
    },
    {
      key: "sync",
      label: "Event log sync",
      statusLabel: eventLogSynced ? "Event log synced" : "Event log not synced",
      detailLabel: `${snapshot.syncStatus} - ${snapshot.lastSyncLabel}`,
      blocking: !eventLogSynced,
    },
  ];
  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;

  return {
    gateLabel: blockingCount === 0 ? "Communication clear" : "Communication blocked",
    readyCountLabel: `${readyCount}/${items.length} proof(s) clear`,
    blockingCountLabel: blockingCount === 0 ? "No communication blockers" : `${blockingCount} communication blocker(s)`,
    blocking: blockingCount > 0,
    items,
  };
}

interface OperatorState {
  snapshot: OperatorSnapshot;
  setSnapshot: (snapshot: OperatorSnapshot) => void;
}

export const useOperatorState = create<OperatorState>((set) => ({
  snapshot: NOT_PAIRED_OPERATOR_SNAPSHOT,
  setSnapshot: (snapshot) => set({ snapshot }),
}));

function formatActiveEngineLabel(activeEngine: ActiveEngine): string {
  if (activeEngine === "phone") {
    return "Phone Engine";
  }
  if (activeEngine === "remote") {
    return "Remote Engine";
  }
  return "No active engine";
}

function formatEngineHealthDetail(label: "Phone" | "Remote", health: EngineHealth): string {
  switch (health) {
    case "healthy":
      return `${label} heartbeat healthy`;
    case "degraded":
      return `${label} heartbeat degraded`;
    case "offline":
      return `${label} heartbeat offline`;
    case "unknown":
      return `${label} heartbeat missing`;
  }
}

function formatLeaseProofDetail(leaseState: LeaseState, activeEngine: ActiveEngine): string {
  const activeEngineLabel = formatActiveEngineLabel(activeEngine);
  switch (leaseState) {
    case "phone_held":
      return activeEngine === "phone"
        ? "Phone lease and active engine agree"
        : `Phone lease but active engine is ${activeEngineLabel}`;
    case "remote_held":
      return activeEngine === "remote"
        ? "Remote lease and active engine agree"
        : `Remote lease but active engine is ${activeEngineLabel}`;
    case "unclear":
      return `Lease unclear while active engine is ${activeEngineLabel}`;
    case "none":
      return `No lease while active engine is ${activeEngineLabel}`;
  }
}

function formatTransportProofDetail(transport: TransportState): string {
  switch (transport) {
    case "tailscale":
      return "Tailscale transport selected";
    case "same_wifi":
      return "Same Wi-Fi transport selected";
    case "cloud_relay":
      return "Cloud relay transport selected";
    case "none":
      return "No transport evidence";
  }
}
