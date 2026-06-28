import type { RemotePairingStatus } from "@apk-alerts/contracts";
import {
  runRemotePairingDoctor,
  type RemotePairingClientConfig,
  type RemotePairingDoctorResult,
  type RemotePairingEndpointProbeResult,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type PairingDoctorRunner = (
  config: RemotePairingClientConfig,
) => Promise<RemotePairingDoctorResult>;

export interface PairingDoctorSnapshot {
  checking: boolean;
  status: RemotePairingStatus | null;
  checks: RemotePairingEndpointProbeResult[];
  lastCheckedAt: string;
  lastError: string;
}

export interface PairingDoctorSummary {
  statusLabel: string;
  detailLabel: string;
  errorLabel: string;
  blocking: boolean;
  passedCount: number;
  totalCount: number;
}

export interface PairingDoctorState {
  snapshot: PairingDoctorSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  runDoctor: (config: RemotePairingClientConfig) => Promise<void>;
}

export function getDefaultPairingDoctorSnapshot(): PairingDoctorSnapshot {
  return {
    checking: false,
    status: null,
    checks: [],
    lastCheckedAt: "",
    lastError: "",
  };
}

export function buildPairingDoctorSummary(snapshot: PairingDoctorSnapshot): PairingDoctorSummary {
  const passedCount = snapshot.checks.filter((check) => check.ok).length;
  const totalCount = snapshot.checks.length;
  const blockerCount = snapshot.status?.blockingIssues.length ?? 0;
  const firstFailedCheck = snapshot.checks.find((check) => !check.ok);

  if (snapshot.checking) {
    return {
      statusLabel: "Checking",
      detailLabel: "Probing remote pairing endpoints.",
      errorLabel: "",
      blocking: true,
      passedCount,
      totalCount,
    };
  }

  if (!snapshot.status && !snapshot.lastError) {
    return {
      statusLabel: "Not checked",
      detailLabel: "Run Pairing Doctor after entering the remote API URL.",
      errorLabel: "",
      blocking: true,
      passedCount,
      totalCount,
    };
  }

  if (snapshot.lastError) {
    return {
      statusLabel: "Offline",
      detailLabel: snapshot.lastError,
      errorLabel: snapshot.lastError,
      blocking: true,
      passedCount,
      totalCount,
    };
  }

  const blocking = blockerCount > 0 || snapshot.checks.some((check) => !check.ok);
  const checksLabel = `${passedCount} of ${totalCount} required checks passed.`;
  const blockerLabel = blockerCount === 1 ? "1 remote blocker." : `${blockerCount} remote blockers.`;
  return {
    statusLabel: blocking ? "Blocked" : "Paired",
    detailLabel: blockerCount > 0 ? `${checksLabel} ${blockerLabel}` : checksLabel,
    errorLabel: firstFailedCheck ? `${firstFailedCheck.label}: ${firstFailedCheck.error}` : "",
    blocking,
    passedCount,
    totalCount,
  };
}

export function createPairingDoctorStore(runner: PairingDoctorRunner = runRemotePairingDoctor) {
  return createStore<PairingDoctorState>()((set, get) => ({
    snapshot: getDefaultPairingDoctorSnapshot(),
    activeRequestId: 0,
    nextRequestId: 1,
    runDoctor: async (config) => {
      const requestId = get().nextRequestId;
      set((state) => ({
        ...state,
        activeRequestId: requestId,
        nextRequestId: state.nextRequestId + 1,
        snapshot: {
          ...state.snapshot,
          checking: true,
          lastError: "",
        },
      }));

      const result = await runner(config);

      set((state) => {
        if (state.activeRequestId !== requestId) {
          return state;
        }

        return {
          ...state,
          activeRequestId: 0,
          snapshot: {
            checking: false,
            status: result.status,
            checks: result.checks,
            lastCheckedAt: result.checks[0]?.checkedAt ?? new Date().toISOString(),
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const pairingDoctorStore = createPairingDoctorStore();

export function usePairingDoctorState(): PairingDoctorState;
export function usePairingDoctorState<T>(selector: (state: PairingDoctorState) => T): T;
export function usePairingDoctorState<T>(selector?: (state: PairingDoctorState) => T) {
  return selector ? useStore(pairingDoctorStore, selector) : useStore(pairingDoctorStore);
}
