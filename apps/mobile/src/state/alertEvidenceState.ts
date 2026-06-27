import { normalizeBridgeHealthPayload } from "@apk-alerts/contracts";
import {
  fetchRemoteAlertEvidence,
  type RemoteAlertEvidenceResult,
  type RemoteAlertEvidenceSnapshot,
  type RemoteEvidenceClientConfig,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { classifyRemoteTransport, type RemoteTransport } from "./remoteEngineState";

export type AlertEvidenceChecker = (
  config: RemoteEvidenceClientConfig,
) => Promise<RemoteAlertEvidenceResult>;

export interface AlertEvidenceConnection {
  baseApiUrl: string;
  apiKey: string;
  transport: RemoteTransport;
}

export interface AlertEvidenceConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface AlertEvidenceSnapshot {
  connection: AlertEvidenceConnection;
  evidence: RemoteAlertEvidenceSnapshot;
  checking: boolean;
  lastError: string;
}

export interface AlertEvidenceSummary {
  connectionLabel: string;
  bridgeHealthLabel: string;
  bridgeHealthDetail: string;
  latestAlertLabel: string;
  latestDecisionLabel: string;
  liveReadinessLabel: string;
  evidenceCountLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface AlertEvidenceState {
  snapshot: AlertEvidenceSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: AlertEvidenceConnectionDraft) => void;
  refreshEvidence: () => Promise<void>;
}

function buildEmptyEvidenceSnapshot(checkedAt = ""): RemoteAlertEvidenceSnapshot {
  return {
    checkedAt,
    bridgeHealth: normalizeBridgeHealthPayload(null),
    signals: [],
    decisions: [],
    chains: [],
  };
}

export function getDefaultAlertEvidenceSnapshot(): AlertEvidenceSnapshot {
  return {
    connection: {
      baseApiUrl: "",
      apiKey: "",
      transport: "none",
    },
    evidence: buildEmptyEvidenceSnapshot(),
    checking: false,
    lastError: "",
  };
}

export function buildAlertEvidenceSummary(snapshot: AlertEvidenceSnapshot): AlertEvidenceSummary {
  const latest = snapshot.evidence.chains[0] ?? null;
  const bridgeHealth = snapshot.evidence.bridgeHealth;
  const bridgeIssues = bridgeHealth.issues.join("; ");

  return {
    connectionLabel: formatTransportLabel(snapshot.connection),
    bridgeHealthLabel: formatBridgeHealthLabel(bridgeHealth.status),
    bridgeHealthDetail: bridgeIssues || (bridgeHealth.healthy ? "Bridge heartbeat healthy" : "No bridge heartbeat"),
    latestAlertLabel: latest ? `${formatStatusLabel(latest.status)} - ${latest.eventId}` : "No alert evidence",
    latestDecisionLabel: latest?.latestReason || "No decision evidence",
    liveReadinessLabel: latest ? "Audit only - live readiness not proven" : "Live readiness not proven",
    evidenceCountLabel: `${snapshot.evidence.chains.length} ${
      snapshot.evidence.chains.length === 1 ? "alert chain" : "alert chains"
    }`,
    lastCheckLabel: snapshot.evidence.checkedAt ? `Checked ${snapshot.evidence.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function createAlertEvidenceStore(checker: AlertEvidenceChecker = fetchRemoteAlertEvidence) {
  return createStore<AlertEvidenceState>()((set, get) => ({
    snapshot: getDefaultAlertEvidenceSnapshot(),
    activeRequestId: 0,
    nextRequestId: 1,
    updateConnectionDraft: (draft) => {
      const normalized = normalizeConnectionDraft(draft);
      set((state) => ({
        ...state,
        activeRequestId: 0,
        snapshot: {
          ...state.snapshot,
          connection: {
            ...normalized,
            transport: classifyRemoteTransport(normalized.baseApiUrl),
          },
          evidence: buildEmptyEvidenceSnapshot(),
          checking: false,
          lastError: "",
        },
      }));
    },
    refreshEvidence: async () => {
      const connection = get().snapshot.connection;
      const requestConnectionKey = connectionKey(connection);
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

      const result = await checker({
        baseApiUrl: connection.baseApiUrl,
        apiKey: connection.apiKey,
      });

      set((state) => {
        if (
          state.activeRequestId !== requestId ||
          connectionKey(state.snapshot.connection) !== requestConnectionKey
        ) {
          return state;
        }

        return {
          ...state,
          activeRequestId: 0,
          snapshot: {
            ...state.snapshot,
            checking: false,
            evidence: result.snapshot,
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const alertEvidenceStore = createAlertEvidenceStore();

export function useAlertEvidenceState(): AlertEvidenceState;
export function useAlertEvidenceState<T>(selector: (state: AlertEvidenceState) => T): T;
export function useAlertEvidenceState<T>(selector?: (state: AlertEvidenceState) => T) {
  return selector ? useStore(alertEvidenceStore, selector) : useStore(alertEvidenceStore);
}

function normalizeConnectionDraft(draft: AlertEvidenceConnectionDraft): AlertEvidenceConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function connectionKey(connection: AlertEvidenceConnection): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

function formatTransportLabel(connection: AlertEvidenceConnection): string {
  if (!connection.baseApiUrl) {
    return "Not paired";
  }

  switch (connection.transport) {
    case "tailscale":
      return "Tailscale";
    case "same_wifi":
      return "Same Wi-Fi";
    case "cloud_relay":
      return "Cloud relay";
    case "none":
      return "Not paired";
  }
}

function formatBridgeHealthLabel(status: "healthy" | "unhealthy" | "unknown"): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unhealthy":
      return "Unhealthy";
    case "unknown":
      return "Unknown";
  }
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "skipped":
      return "Skipped";
    case "duplicate":
      return "Duplicate";
    default:
      return "Unknown";
  }
}
