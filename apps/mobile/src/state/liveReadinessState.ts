import { normalizeLiveReadinessPayload } from "@apk-alerts/contracts";
import {
  fetchRemoteLiveReadiness,
  type RemoteLiveReadinessClientConfig,
  type RemoteLiveReadinessResult,
  type RemoteLiveReadinessSnapshot,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { classifyRemoteTransport, type RemoteTransport } from "./remoteEngineState";

export type LiveReadinessChecker = (
  config: RemoteLiveReadinessClientConfig,
) => Promise<RemoteLiveReadinessResult>;

export interface LiveReadinessConnection {
  baseApiUrl: string;
  apiKey: string;
  transport: RemoteTransport;
}

export interface LiveReadinessConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface LiveReadinessSnapshot {
  connection: LiveReadinessConnection;
  remote: RemoteLiveReadinessSnapshot;
  checking: boolean;
  lastError: string;
}

export interface LiveReadinessSummary {
  connectionLabel: string;
  readinessLabel: string;
  liveMoneyLabel: string;
  primaryReason: string;
  brokerLabel: string;
  ingestionLabel: string;
  replayLabel: string;
  reconciliationLabel: string;
  exitAutomationLabel: string;
  runtimeLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface ReplayAcceptanceEvidenceSummary {
  statusLabel: string;
  gateLabel: string;
  detailLabel: string;
  proofLabel: string;
  failedEventsLabel: string;
  missingEventsLabel: string;
  blocking: boolean;
}

export interface LiveReadinessState {
  snapshot: LiveReadinessSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: LiveReadinessConnectionDraft) => void;
  checkReadiness: () => Promise<void>;
}

function buildEmptyRemoteSnapshot(): RemoteLiveReadinessSnapshot {
  const readiness = normalizeLiveReadinessPayload(null);
  return {
    checkedAt: "",
    readiness,
    liveMoneyReady: false,
  };
}

export function getDefaultLiveReadinessSnapshot(): LiveReadinessSnapshot {
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

export function buildLiveReadinessSummary(snapshot: LiveReadinessSnapshot): LiveReadinessSummary {
  const readiness = snapshot.remote.readiness;
  const checks = readiness.checks;
  return {
    connectionLabel: formatTransportLabel(snapshot.connection),
    readinessLabel: snapshot.remote.liveMoneyReady
      ? "Ready"
      : readiness.readyForLive
        ? "Ready to arm"
        : "Blocked",
    liveMoneyLabel: snapshot.remote.liveMoneyReady ? "Live money ready" : "Live money blocked",
    primaryReason: buildPrimaryReason(snapshot),
    brokerLabel: `${checks.broker.activeBroker} - ${checks.broker.connected ? "broker connected" : "broker offline"}`,
    ingestionLabel: checks.signalIngestion.chromeBridgeHealthy
      ? "Chrome bridge healthy"
      : checks.signalIngestion.discordConnected
        ? "Discord bot connected"
        : "No live ingestion healthy",
    replayLabel: `Replay ${checks.simulationReplay.acceptanceStatus} (${checks.simulationReplay.passedCount}/${checks.simulationReplay.expectedCount})`,
    reconciliationLabel: checks.reconciliation.unresolvedCount === 0
      ? "Reconciliation clear"
      : `${checks.reconciliation.unresolvedCount} unresolved reconciliation item(s)`,
    exitAutomationLabel: checks.exitAutomation.ocoExitsConfigured
      ? "OCO exits configured"
      : "OCO exits missing",
    runtimeLabel: checks.runtime.liveTradingArmed
      ? `Armed until ${checks.runtime.liveTradingArmedUntil || "unknown"}`
      : "Not armed",
    lastCheckLabel: snapshot.remote.checkedAt ? `Checked ${snapshot.remote.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function buildReplayAcceptanceEvidenceSummary(
  snapshot: LiveReadinessSnapshot,
): ReplayAcceptanceEvidenceSummary {
  const replay = snapshot.remote.readiness.checks.simulationReplay;
  const hasFailedEvents =
    replay.failedCount > 0 ||
    replay.failedEventCount > 0 ||
    replay.failedEventIds.length > 0;
  const hasMissingEvents = replay.missingEventCount > 0 || replay.missingEventIds.length > 0;
  const hasReplayProof = replay.updatedAt.length > 0 && replay.replayUrl.length > 0;
  const acceptedExpectedAlerts = replay.expectedCount > 0 && replay.passedCount >= replay.expectedCount;
  const passed =
    replay.acceptanceStatus === "passed" &&
    acceptedExpectedAlerts &&
    !hasFailedEvents &&
    !hasMissingEvents &&
    hasReplayProof;
  const failed = replay.acceptanceStatus === "failed" || hasFailedEvents || hasMissingEvents;

  return {
    statusLabel: passed ? "Replay proof passed" : failed ? "Replay proof failed" : "Replay proof missing",
    gateLabel: passed ? "Replay gate clear" : "Blocks live",
    detailLabel: `${replay.passedCount}/${replay.expectedCount} expected alert(s) accepted`,
    proofLabel: formatReplayProofLabel(replay.updatedAt, replay.replayUrl),
    failedEventsLabel: formatReplayEventEvidenceLabel("Failed", replay.failedEventIds, replay.failedEventCount),
    missingEventsLabel: formatReplayEventEvidenceLabel("Missing", replay.missingEventIds, replay.missingEventCount),
    blocking: !passed,
  };
}

export function createLiveReadinessStore(checker: LiveReadinessChecker = fetchRemoteLiveReadiness) {
  return createStore<LiveReadinessState>()((set, get) => ({
    snapshot: getDefaultLiveReadinessSnapshot(),
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
    checkReadiness: async () => {
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

export const liveReadinessStore = createLiveReadinessStore();

export function useLiveReadinessState(): LiveReadinessState;
export function useLiveReadinessState<T>(selector: (state: LiveReadinessState) => T): T;
export function useLiveReadinessState<T>(selector?: (state: LiveReadinessState) => T) {
  return selector ? useStore(liveReadinessStore, selector) : useStore(liveReadinessStore);
}

function buildPrimaryReason(snapshot: LiveReadinessSnapshot): string {
  const readiness = snapshot.remote.readiness;
  if (!snapshot.remote.checkedAt) {
    return "No live-readiness evidence";
  }
  if (snapshot.remote.liveMoneyReady) {
    return "Endpoint passed and live trading is armed.";
  }
  if (readiness.readyForLive) {
    return "Endpoint passed, but live trading is not armed.";
  }
  const firstIssue = readiness.blockingIssues[0];
  if (firstIssue) {
    return `${firstIssue.code}: ${firstIssue.message}`;
  }
  return "No blocking issue detail returned.";
}

function normalizeConnectionDraft(draft: LiveReadinessConnectionDraft): LiveReadinessConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function connectionKey(connection: LiveReadinessConnection): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

function formatTransportLabel(connection: LiveReadinessConnection): string {
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

function formatReplayProofLabel(updatedAt: string, replayUrl: string): string {
  if (updatedAt && replayUrl) {
    return `Proof ${updatedAt} - ${replayUrl}`;
  }
  if (updatedAt) {
    return `Proof ${updatedAt} - missing replay URL`;
  }
  if (replayUrl) {
    return `Proof timestamp missing - ${replayUrl}`;
  }
  return "No replay proof timestamp or URL";
}

function formatReplayEventEvidenceLabel(label: "Failed" | "Missing", eventIds: string[], eventCount: number): string {
  if (eventIds.length > 0) {
    return `${label} events: ${eventIds.join(", ")}`;
  }
  if (eventCount > 0) {
    return `${label} events: ${eventCount} unlisted`;
  }
  return `${label} events: none`;
}
