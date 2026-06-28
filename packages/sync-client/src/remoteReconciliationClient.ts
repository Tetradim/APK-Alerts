import {
  normalizeReconciliationPayload,
  summarizeReconciliationRows,
  type ReconciliationRow,
  type ReconciliationSummary,
} from "@apk-alerts/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export type { FetchLike };
export { normalizeRemoteApiBaseUrl as normalizeRemoteReconciliationBaseUrl };

export interface RemoteReconciliationClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  limit?: number;
  timeoutMs?: number;
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

export async function fetchRemoteReconciliation(
  config: RemoteReconciliationClientConfig,
): Promise<RemoteReconciliationResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return {
      ok: false,
      snapshot: buildSnapshot(checkedAt, []),
      error: endpoint.error,
    };
  }

  try {
    const payload = await fetchRemoteJson(
      endpoint.fetchImpl,
      `${endpoint.baseApiUrl}/operator/reconciliation?limit=${normalizeLimit(config.limit)}`,
      {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      },
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
