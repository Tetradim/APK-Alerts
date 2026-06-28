import {
  canClaimLiveReady,
  normalizeLiveReadinessPayload,
  type LiveReadiness,
} from "@apk-alerts/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export type { FetchLike };
export { normalizeRemoteApiBaseUrl as normalizeRemoteLiveReadinessBaseUrl };

export interface RemoteLiveReadinessClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => string;
}

export interface RemoteLiveReadinessSnapshot {
  checkedAt: string;
  readiness: LiveReadiness;
  liveMoneyReady: boolean;
}

export interface RemoteLiveReadinessResult {
  ok: boolean;
  snapshot: RemoteLiveReadinessSnapshot;
  error: string;
}

export async function fetchRemoteLiveReadiness(
  config: RemoteLiveReadinessClientConfig,
): Promise<RemoteLiveReadinessResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, null),
      error: endpoint.error,
    };
  }

  try {
    const payload = await fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/operator/live-readiness`, {
      apiKey: endpoint.apiKey,
      timeoutMs: endpoint.timeoutMs,
    });
    const snapshot = buildSnapshot(checkedAt, payload);
    return {
      ok: snapshot.liveMoneyReady,
      snapshot,
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, null),
      error: error instanceof Error ? error.message : "Remote live-readiness check failed.",
    };
  }
}

function buildSnapshot(checkedAt: string, payload: unknown): RemoteLiveReadinessSnapshot {
  const readiness = normalizeLiveReadinessPayload(payload);
  return {
    checkedAt,
    readiness,
    liveMoneyReady: canClaimLiveReady(readiness),
  };
}
