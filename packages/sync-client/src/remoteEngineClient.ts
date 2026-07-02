import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
  type RemoteEngineHealthSnapshot,
} from "@sentinel-nexus/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export type { FetchLike };
export { normalizeRemoteApiBaseUrl };

export interface RemoteEngineClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => string;
}

export interface RemoteEngineCheckResult {
  ok: boolean;
  snapshot: RemoteEngineHealthSnapshot;
  error: string;
}

function buildOfflineSnapshot(checkedAt: string): RemoteEngineHealthSnapshot {
  return buildRemoteEngineHealthSnapshot({
    health: normalizeRemoteHealthPayload(null),
    status: normalizeRemoteStatusPayload(null),
    checkedAt,
  });
}

export async function checkRemoteEngineHealth(
  config: RemoteEngineClientConfig,
): Promise<RemoteEngineCheckResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return {
      ok: false,
      snapshot: buildOfflineSnapshot(checkedAt),
      error: endpoint.error,
    };
  }

  try {
    const [healthPayload, statusPayload] = await Promise.all([
      fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/health`, {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }),
      fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/status`, {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }),
    ]);
    const snapshot = buildRemoteEngineHealthSnapshot({
      health: normalizeRemoteHealthPayload(healthPayload),
      status: normalizeRemoteStatusPayload(statusPayload),
      checkedAt,
    });

    return {
      ok: snapshot.executionReady,
      snapshot,
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: buildOfflineSnapshot(checkedAt),
      error: error instanceof Error ? error.message : "Remote health check failed.",
    };
  }
}
