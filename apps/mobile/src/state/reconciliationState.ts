import { summarizeReconciliationRows, type ReconciliationRow } from "@apk-alerts/contracts";
import {
  fetchRemoteReconciliation,
  type RemoteReconciliationClientConfig,
  type RemoteReconciliationResult,
  type RemoteReconciliationSnapshot,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { classifyRemoteTransport, type RemoteTransport } from "./remoteEngineState";

export type ReconciliationChecker = (
  config: RemoteReconciliationClientConfig,
) => Promise<RemoteReconciliationResult>;

export interface ReconciliationConnection {
  baseApiUrl: string;
  apiKey: string;
  transport: RemoteTransport;
}

export interface ReconciliationConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface ReconciliationSnapshot {
  connection: ReconciliationConnection;
  remote: RemoteReconciliationSnapshot;
  checking: boolean;
  lastError: string;
}

export interface ReconciliationDisplaySummary {
  connectionLabel: string;
  statusLabel: string;
  primaryReason: string;
  rowCountLabel: string;
  unresolvedLabel: string;
  simulatedLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface ReconciliationState {
  snapshot: ReconciliationSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: ReconciliationConnectionDraft) => void;
  checkReconciliation: () => Promise<void>;
}

function buildEmptyRemoteSnapshot(): RemoteReconciliationSnapshot {
  const rows: ReconciliationRow[] = [];
  return {
    checkedAt: "",
    rows,
    summary: summarizeReconciliationRows(rows),
  };
}

export function getDefaultReconciliationSnapshot(): ReconciliationSnapshot {
  return {
    connection: {
      baseApiUrl: "",
      apiKey: "",
      transport: "none",
    },
    remote: buildEmptyRemoteSnapshot(),
    checking: false,
    lastError: "",
  };
}

export function buildReconciliationSummary(snapshot: ReconciliationSnapshot): ReconciliationDisplaySummary {
  const summary = snapshot.remote.summary;
  const firstReason = summary.unresolvedReasons[0] ?? "";
  return {
    connectionLabel: formatTransportLabel(snapshot.connection),
    statusLabel: !snapshot.remote.checkedAt
      ? "No evidence"
      : summary.unresolvedCount > 0
        ? "Attention"
        : summary.allClear
          ? "Reconciled"
          : "No evidence",
    primaryReason: !snapshot.remote.checkedAt
      ? "No reconciliation evidence"
      : firstReason || `${summary.rowCount} ${summary.rowCount === 1 ? "row" : "rows"} reconciled`,
    rowCountLabel: `${summary.rowCount} ${summary.rowCount === 1 ? "row" : "rows"}`,
    unresolvedLabel: `${summary.unresolvedCount} unresolved real ${summary.unresolvedCount === 1 ? "row" : "rows"}`,
    simulatedLabel: `${summary.simulatedUnresolvedCount} simulated unresolved ${summary.simulatedUnresolvedCount === 1 ? "row" : "rows"}`,
    lastCheckLabel: snapshot.remote.checkedAt ? `Checked ${snapshot.remote.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function createReconciliationStore(checker: ReconciliationChecker = fetchRemoteReconciliation) {
  return createStore<ReconciliationState>()((set, get) => ({
    snapshot: getDefaultReconciliationSnapshot(),
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
          remote: buildEmptyRemoteSnapshot(),
          checking: false,
          lastError: "",
        },
      }));
    },
    checkReconciliation: async () => {
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
            remote: result.snapshot,
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const reconciliationStore = createReconciliationStore();

export function useReconciliationState(): ReconciliationState;
export function useReconciliationState<T>(selector: (state: ReconciliationState) => T): T;
export function useReconciliationState<T>(selector?: (state: ReconciliationState) => T) {
  return selector ? useStore(reconciliationStore, selector) : useStore(reconciliationStore);
}

function normalizeConnectionDraft(draft: ReconciliationConnectionDraft): ReconciliationConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function connectionKey(connection: ReconciliationConnection): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

function formatTransportLabel(connection: ReconciliationConnection): string {
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
