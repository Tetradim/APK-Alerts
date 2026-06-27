import {
  normalizeReconciliationPayload,
  summarizeReconciliationRows,
  type ReconciliationRow,
  type ReconciliationSummary,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RemoteReconciliationClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  limit?: number;
  now?: () => string;
}

export interface RemoteReconciliationSnapshot {
  checkedAt: string;
  rows: ReconciliationRow[];
  summary: ReconciliationSummary;
}

export interface RemoteReconciliationResult {
  ok: boolean;
  snapshot: RemoteReconciliationSnapshot;
  error: string;
}

export function normalizeRemoteReconciliationBaseUrl(value: string): string {
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

export async function fetchRemoteReconciliation(
  config: RemoteReconciliationClientConfig,
): Promise<RemoteReconciliationResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const baseApiUrl = normalizeRemoteReconciliationBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, []),
      error: "Remote API URL is invalid.",
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, []),
      error: "Fetch is not available.",
    };
  }

  try {
    const payload = await fetchJson(
      fetchImpl,
      `${baseApiUrl}/operator/reconciliation?limit=${normalizeLimit(config.limit)}`,
      config.apiKey,
    );
    const snapshot = buildSnapshot(checkedAt, normalizeReconciliationPayload(payload));
    return {
      ok: snapshot.summary.allClear,
      snapshot,
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, []),
      error: error instanceof Error ? error.message : "Remote reconciliation check failed.",
    };
  }
}

function buildSnapshot(checkedAt: string, rows: ReconciliationRow[]): RemoteReconciliationSnapshot {
  return {
    checkedAt,
    rows,
    summary: summarizeReconciliationRows(rows),
  };
}

function normalizeLimit(limit: number | undefined): number {
  return Number.isInteger(limit) && limit && limit > 0 && limit <= 500 ? limit : 100;
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
