import type { EngineId } from "@sentinel-nexus/contracts";
import {
  handlePeerAlertChallengeRequest,
  type PeerAlertChallengeEndpointConfig,
  type PeerAlertChallengeEndpointOutcome,
  type PeerAlertChallengeEndpointRequest,
  type PeerAlertChallengeEndpointResponse,
  type PeerAlertPhoneAlertSnapshot,
} from "@sentinel-nexus/peer-alert-server";
import {
  peerAlertFailsafeStore,
  type PeerAlertFailsafeState,
} from "./peerAlertFailsafeState";

interface PeerAlertFailsafeStoreLike {
  getState: () => Pick<PeerAlertFailsafeState, "recordOutcome">;
}

export interface MobilePeerAlertChallengeHandlerConfig {
  phoneEngineId: EngineId;
  apiKey?: string;
  store?: PeerAlertFailsafeStoreLike;
  getLastAlert: () => PeerAlertPhoneAlertSnapshot | null | Promise<PeerAlertPhoneAlertSnapshot | null>;
  now?: () => string;
  nextResponseEventId?: PeerAlertChallengeEndpointConfig["nextResponseEventId"];
  nextSequence?: PeerAlertChallengeEndpointConfig["nextSequence"];
  previousEventId?: PeerAlertChallengeEndpointConfig["previousEventId"];
  recordOutcome?: (outcome: PeerAlertChallengeEndpointOutcome) => void | Promise<void>;
  maxAlertSkewMs?: number;
}

export type MobilePeerAlertChallengeHandler = (
  request: PeerAlertChallengeEndpointRequest,
) => Promise<PeerAlertChallengeEndpointResponse>;

export function createMobilePeerAlertChallengeHandler(
  config: MobilePeerAlertChallengeHandlerConfig,
): MobilePeerAlertChallengeHandler {
  const store = config.store ?? peerAlertFailsafeStore;

  return async (request) =>
    await handlePeerAlertChallengeRequest(
      {
        phoneEngineId: config.phoneEngineId,
        apiKey: config.apiKey,
        getLastAlert: config.getLastAlert,
        now: config.now,
        nextResponseEventId: config.nextResponseEventId,
        nextSequence: config.nextSequence,
        previousEventId: config.previousEventId,
        maxAlertSkewMs: config.maxAlertSkewMs,
        recordOutcome: async (outcome) => {
          store.getState().recordOutcome(outcome);
          await config.recordOutcome?.(outcome);
        },
      },
      request,
    );
}
