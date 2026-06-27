import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type {
  AlertPeerChallengeEvent,
  AlertPeerFailsafeEvaluation,
  AlertPeerResponseEvent,
} from "@apk-alerts/contracts";

export interface PeerAlertChallengeOutcome {
  ok: boolean;
  checkedAt: string;
  challenge: AlertPeerChallengeEvent;
  response: AlertPeerResponseEvent | null;
  evaluation: AlertPeerFailsafeEvaluation;
  error: string;
}

export interface PeerAlertFailsafeSnapshot {
  latestOutcome: PeerAlertChallengeOutcome | null;
}

export interface PeerAlertOutcomeSummary {
  statusLabel: string;
  gateLabel: string;
  sourceLabel: string;
  timingLabel: string;
  responseLabel: string;
  detailLabel: string;
  blockerLabel: string;
  errorLabel: string;
  blocking: boolean;
}

export interface PeerAlertFailsafeState {
  snapshot: PeerAlertFailsafeSnapshot;
  recordOutcome: (outcome: PeerAlertChallengeOutcome) => void;
  clearOutcome: () => void;
}

export function getDefaultPeerAlertFailsafeSnapshot(): PeerAlertFailsafeSnapshot {
  return {
    latestOutcome: null,
  };
}

export function buildPeerAlertOutcomeSummary(
  snapshot: PeerAlertFailsafeSnapshot,
): PeerAlertOutcomeSummary {
  const outcome = snapshot.latestOutcome;
  if (!outcome) {
    return {
      statusLabel: "No peer challenge evidence",
      gateLabel: "Blocks live",
      sourceLabel: "No source proof",
      timingLabel: "No peer timing proof",
      responseLabel: "No peer response event",
      detailLabel: "Remote has not challenged Phone alert visibility.",
      blockerLabel: "Peer challenge missing",
      errorLabel: "",
      blocking: true,
    };
  }

  const evaluation = outcome.evaluation;
  return {
    statusLabel: formatStatusLabel(evaluation.status),
    gateLabel: evaluation.blocking ? "Peer check blocked" : "Peer check clear",
    sourceLabel: `${evaluation.sourceKey || "unknown-source"} - ${evaluation.discordMessageId || "unknown-message"}`,
    timingLabel: `${formatSkewLabel(evaluation.skewMs)}; checked ${outcome.checkedAt}`,
    responseLabel: outcome.response
      ? `Response ${outcome.response.id} from ${outcome.response.sourceEngineId}`
      : "No peer response event",
    detailLabel: evaluation.detailLabel,
    blockerLabel: evaluation.blockingCodes.length > 0
      ? evaluation.blockingCodes.join(", ")
      : "No peer blockers",
    errorLabel: outcome.error,
    blocking: evaluation.blocking || !outcome.ok,
  };
}

export function createPeerAlertFailsafeStore() {
  return createStore<PeerAlertFailsafeState>()((set) => ({
    snapshot: getDefaultPeerAlertFailsafeSnapshot(),
    recordOutcome: (outcome) =>
      set({
        snapshot: {
          latestOutcome: outcome,
        },
      }),
    clearOutcome: () =>
      set({
        snapshot: getDefaultPeerAlertFailsafeSnapshot(),
      }),
  }));
}

export const peerAlertFailsafeStore = createPeerAlertFailsafeStore();

export function usePeerAlertFailsafeState(): PeerAlertFailsafeState;
export function usePeerAlertFailsafeState<T>(selector: (state: PeerAlertFailsafeState) => T): T;
export function usePeerAlertFailsafeState<T>(selector?: (state: PeerAlertFailsafeState) => T) {
  return selector ? useStore(peerAlertFailsafeStore, selector) : useStore(peerAlertFailsafeStore);
}

function formatStatusLabel(status: AlertPeerFailsafeEvaluation["status"]): string {
  switch (status) {
    case "matched":
      return "Matched peer alert";
    case "missing_response":
      return "Missing peer response";
    case "stale":
      return "Stale peer alert";
    case "mismatch":
      return "Mismatched peer alert";
  }
}

function formatSkewLabel(skewMs: number | null): string {
  return skewMs === null ? "Skew unknown" : `Skew ${skewMs}ms`;
}
