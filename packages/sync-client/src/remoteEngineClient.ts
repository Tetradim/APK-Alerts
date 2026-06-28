import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
  type RemoteEngineHealthSnapshot,
} from "@apk-alerts/contracts";
import { fetchRemoteJson, type FetchLike } from "./remoteHttp";

export type { FetchLike };

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

export function normalizeRemoteApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.endsWith("/api")) {
      url.pathname = `${url.pathname}/api`.replace(/\/+/g, "/");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
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
  const baseApiUrl = normalizeRemoteApiBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return {
      ok: false,
      snapshot: buildOfflineSnapshot(checkedAt),
      error: "Remote API URL is invalid.",
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      ok: false,
      snapshot: buildOfflineSnapshot(checkedAt),
      error: "Fetch is not available.",
    };
  }

  try {
    const [healthPayload, statusPayload] = await Promise.all([
      fetchRemoteJson(fetchImpl, `${baseApiUrl}/health`, {
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
      }),
      fetchRemoteJson(fetchImpl, `${baseApiUrl}/status`, {
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
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
