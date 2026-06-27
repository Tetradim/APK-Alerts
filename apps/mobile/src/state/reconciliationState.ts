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

export interface OrderLifecycleEvidenceItem {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  blocking: boolean;
}

export interface OrderLifecycleEvidenceSummary {
  gateLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  blocking: boolean;
  items: OrderLifecycleEvidenceItem[];
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

export function buildOrderLifecycleEvidenceSummary(row: ReconciliationRow): OrderLifecycleEvidenceSummary {
  const filled = row.tradeExecuted || row.tradeStatus === "filled";
  const terminalNoFill = isTerminalOrderStatus(row.tradeStatus) && !filled;
  const requestClear = row.tradeRequested || (!row.attentionReason && row.processed);
  const brokerOrderClear = !row.tradeRequested || Boolean(row.orderId || row.tradeId);
  const fillTerminalClear = !row.tradeRequested || filled || terminalNoFill;
  const positionClear =
    !row.tradeRequested ||
    terminalNoFill ||
    (filled && Boolean(row.positionId));

  const items: OrderLifecycleEvidenceItem[] = [
    {
      key: "request",
      label: "Trade request",
      statusLabel: formatTradeRequestStatusLabel(row.tradeRequested, requestClear),
      detailLabel: row.tradeRequested
        ? formatTradeRequestDetail(row.tradeId)
        : "No trade request recorded",
      blocking: !requestClear,
    },
    {
      key: "broker_order",
      label: "Broker order",
      statusLabel: !row.tradeRequested
        ? "Broker order not required"
        : brokerOrderClear
          ? "Broker order acknowledged"
          : "Broker order missing",
      detailLabel: formatBrokerOrderDetail(row.orderId, row.tradeId),
      blocking: !brokerOrderClear,
    },
    {
      key: "fill_terminal",
      label: "Fill or terminal",
      statusLabel: !row.tradeRequested
        ? "No fill expected"
        : filled
          ? "Fill terminal"
          : terminalNoFill
            ? "Order terminal"
            : "Fill not terminal",
      detailLabel: row.tradeStatus || "No trade status",
      blocking: !fillTerminalClear,
    },
    {
      key: "position",
      label: "Position link",
      statusLabel: formatPositionStatusLabel(row.tradeRequested, filled, terminalNoFill, row.positionId),
      detailLabel: formatPositionDetail(row.positionId, row.positionStatus),
      blocking: !positionClear,
    },
    {
      key: "attention",
      label: "Attention state",
      statusLabel: row.liveBlocking
        ? "Live blocker"
        : row.attentionReason
          ? row.simulated
            ? "Simulated attention"
            : "Non-live attention"
          : "No attention reason",
      detailLabel: row.attentionReason || "No attention reason",
      blocking: row.liveBlocking,
    },
  ];
  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;

  return {
    gateLabel: blockingCount === 0 ? "Lifecycle clear" : "Lifecycle blocked",
    readyCountLabel: `${readyCount}/${items.length} proof(s) clear`,
    blockingCountLabel: blockingCount === 0 ? "No lifecycle blockers" : `${blockingCount} lifecycle blocker(s)`,
    blocking: blockingCount > 0,
    items,
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

function isTerminalOrderStatus(status: string): boolean {
  return [
    "filled",
    "failed",
    "rejected",
    "canceled",
    "cancelled",
    "expired",
    "closed",
  ].includes(status);
}

function formatTradeRequestDetail(tradeId: string): string {
  return tradeId ? `Trade ${tradeId}` : "Trade requested without trade id";
}

function formatTradeRequestStatusLabel(tradeRequested: boolean, requestClear: boolean): string {
  if (tradeRequested) {
    return "Trade requested";
  }
  return requestClear ? "No trade requested" : "Trade request missing";
}

function formatBrokerOrderDetail(orderId: string, tradeId: string): string {
  if (orderId && tradeId) {
    return `Order ${orderId}; trade ${tradeId}`;
  }
  if (orderId) {
    return `Order ${orderId}`;
  }
  if (tradeId) {
    return `Trade ${tradeId}; broker order id missing`;
  }
  return "No broker order or trade id";
}

function formatPositionStatusLabel(
  tradeRequested: boolean,
  filled: boolean,
  terminalNoFill: boolean,
  positionId: string,
): string {
  if (!tradeRequested || terminalNoFill) {
    return "No position expected";
  }
  if (filled) {
    return positionId ? "Position linked" : "Position missing";
  }
  return "Position pending";
}

function formatPositionDetail(positionId: string, positionStatus: string): string {
  if (positionId && positionStatus) {
    return `${positionId} - ${positionStatus}`;
  }
  if (positionId) {
    return positionId;
  }
  if (positionStatus) {
    return `No position id - ${positionStatus}`;
  }
  return "No position id";
}
