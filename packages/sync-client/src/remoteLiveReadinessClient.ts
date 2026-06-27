import {
  canClaimLiveReady,
  normalizeLiveReadinessPayload,
  type LiveReadiness,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RemoteLiveReadinessClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
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

export function normalizeRemoteLiveReadinessBaseUrl(value: string): string {
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

export async function fetchRemoteLiveReadiness(
  config: RemoteLiveReadinessClientConfig,
): Promise<RemoteLiveReadinessResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const baseApiUrl = normalizeRemoteLiveReadinessBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, null),
      error: "Remote API URL is invalid.",
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, null),
      error: "Fetch is not available.",
    };
  }

  try {
    const payload = await fetchJson(
      fetchImpl,
      `${baseApiUrl}/operator/live-readiness`,
      config.apiKey,
    );
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
