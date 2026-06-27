import { create } from "zustand";
import type { SettingsSummary } from "./settingsState";

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
  settingsSummary?: SettingsSummary,
): CockpitSummary {
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
  const readinessCanExecute = snapshot.readiness === "live_ready" || snapshot.readiness === "paper_ready";
  const canExecute = holderCanExecute && readinessCanExecute && snapshot.syncStatus === "synced";

  return {
    activeEngineLabel,
    remoteLabel,
    leaseLabel,
    readinessLabel,
    transportLabel,
    syncLabel: snapshot.syncStatus === "synced" ? `Synced ${snapshot.lastSyncLabel}` : "Sync unavailable",
    primaryActionLabel: snapshot.activeEngine === "none" ? "Pair Remote Engine" : "View Engine Health",
    policyLabel: settingsSummary?.engineLabel ?? "No failover policy",
    transportPolicyLabel: settingsSummary?.transportLabel ?? "No transport policy",
    canExecute,
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
