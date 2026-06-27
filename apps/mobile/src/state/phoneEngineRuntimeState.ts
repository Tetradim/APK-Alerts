import type { EngineHealthStatus } from "@apk-alerts/contracts";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type PhoneEngineRuntimeHealth = EngineHealthStatus | "unknown";

export interface PhoneEngineRuntimeSnapshot {
  nativeRuntimeAvailable: boolean;
  serviceEnabled: boolean;
  foregroundServiceActive: boolean;
  discordEngineEmbedded: boolean;
  brokerEngineEmbedded: boolean;
  discordEngineReady: boolean;
  brokerEngineReady: boolean;
  liveExecutionArmed: boolean;
  health: PhoneEngineRuntimeHealth;
  lastHeartbeatAt: string;
  blockingReason: string;
}

export interface PhoneEngineRuntimeSummary {
  statusLabel: string;
  leaseLabel: string;
  detailLabel: string;
  canOwnLease: boolean;
  blocking: boolean;
}

export interface PhoneEngineRuntimeState {
  snapshot: PhoneEngineRuntimeSnapshot;
  updateRuntime: (patch: Partial<PhoneEngineRuntimeSnapshot>) => void;
  clearRuntime: () => void;
}

export function getDefaultPhoneEngineRuntimeSnapshot(): PhoneEngineRuntimeSnapshot {
  return {
    nativeRuntimeAvailable: false,
    serviceEnabled: false,
    foregroundServiceActive: false,
    discordEngineEmbedded: false,
    brokerEngineEmbedded: false,
    discordEngineReady: false,
    brokerEngineReady: false,
    liveExecutionArmed: false,
    health: "unknown",
    lastHeartbeatAt: "",
    blockingReason: "Native Android foreground engine is not installed.",
  };
}

export function buildPhoneEngineRuntimeSummary(
  snapshot: PhoneEngineRuntimeSnapshot,
): PhoneEngineRuntimeSummary {
  const canOwnLease =
    snapshot.nativeRuntimeAvailable &&
    snapshot.serviceEnabled &&
    snapshot.foregroundServiceActive &&
    snapshot.discordEngineEmbedded &&
    snapshot.brokerEngineEmbedded &&
    snapshot.discordEngineReady &&
    snapshot.brokerEngineReady &&
    snapshot.health === "healthy" &&
    Boolean(snapshot.lastHeartbeatAt);

  return {
    statusLabel: formatPhoneRuntimeStatus(snapshot),
    leaseLabel: canOwnLease ? "Lease eligible" : "Cannot own lease",
    detailLabel: formatPhoneRuntimeDetail(snapshot, canOwnLease),
    canOwnLease,
    blocking: !canOwnLease,
  };
}

export function createPhoneEngineRuntimeStore() {
  return createStore<PhoneEngineRuntimeState>()((set) => ({
    snapshot: getDefaultPhoneEngineRuntimeSnapshot(),
    updateRuntime: (patch) =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          ...patch,
        },
      })),
    clearRuntime: () =>
      set({
        snapshot: getDefaultPhoneEngineRuntimeSnapshot(),
      }),
  }));
}

export const phoneEngineRuntimeStore = createPhoneEngineRuntimeStore();

export function usePhoneEngineRuntimeState(): PhoneEngineRuntimeState;
export function usePhoneEngineRuntimeState<T>(selector: (state: PhoneEngineRuntimeState) => T): T;
export function usePhoneEngineRuntimeState<T>(selector?: (state: PhoneEngineRuntimeState) => T) {
  return selector ? useStore(phoneEngineRuntimeStore, selector) : useStore(phoneEngineRuntimeStore);
}

function formatPhoneRuntimeStatus(snapshot: PhoneEngineRuntimeSnapshot): string {
  if (!snapshot.nativeRuntimeAvailable) {
    return "Phone runtime unavailable";
  }
  if (!snapshot.serviceEnabled) {
    return "Phone engine disabled";
  }
  if (!snapshot.foregroundServiceActive) {
    return "Foreground service stopped";
  }
  switch (snapshot.health) {
    case "healthy":
      return "Phone engine healthy";
    case "degraded":
      return "Phone engine degraded";
    case "offline":
      return "Phone engine offline";
    case "unknown":
      return "Phone engine unknown";
  }
}

function formatPhoneRuntimeDetail(snapshot: PhoneEngineRuntimeSnapshot, canOwnLease: boolean): string {
  if (canOwnLease) {
    return `Foreground service heartbeat ${snapshot.lastHeartbeatAt}`;
  }
  if (snapshot.blockingReason) {
    return snapshot.blockingReason;
  }
  if (!snapshot.nativeRuntimeAvailable) {
    return "Native Android foreground engine is not installed.";
  }
  if (!snapshot.serviceEnabled) {
    return "Phone engine service is disabled.";
  }
  if (!snapshot.foregroundServiceActive) {
    return "Foreground service is not active.";
  }
  if (!snapshot.discordEngineEmbedded || !snapshot.brokerEngineEmbedded) {
    return "Native Discord and broker adapters are not embedded.";
  }
  if (!snapshot.discordEngineReady && !snapshot.brokerEngineReady) {
    return "Native Discord and broker adapters are not ready.";
  }
  if (!snapshot.discordEngineReady) {
    return "Native Discord adapter is not ready.";
  }
  if (!snapshot.brokerEngineReady) {
    return "Native broker adapter is not ready.";
  }
  if (!snapshot.lastHeartbeatAt) {
    return "Foreground service heartbeat missing.";
  }
  return "Phone runtime is not healthy.";
}
