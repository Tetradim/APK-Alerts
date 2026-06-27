import {
  buildRemoteEngineHealthSnapshot,
  normalizeRemoteHealthPayload,
  normalizeRemoteStatusPayload,
  type RemoteEngineHealthSnapshot,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RemoteEngineClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
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

function buildHeaders(apiKey?: string): HeadersInit {
  const trimmed = apiKey?.trim();
  return trimmed ? { "X-API-Key": trimmed } : {};
}

async function fetchJson(fetchImpl: FetchLike, url: string, apiKey?: string): Promise<unknown> {
  const response = await fetchImpl(url, { headers: buildHeaders(apiKey) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
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
      fetchJson(fetchImpl, `${baseApiUrl}/health`, config.apiKey),
      fetchJson(fetchImpl, `${baseApiUrl}/status`, config.apiKey),
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
