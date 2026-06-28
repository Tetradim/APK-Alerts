import {
  normalizeRemotePairingStatusPayload,
  type RemotePairingEndpoint,
  type RemotePairingStatus,
} from "@apk-alerts/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export { normalizeRemoteApiBaseUrl };
export type { FetchLike };

export interface RemotePairingClientConfig {
  baseApiUrl: string;
  apiKey?: string | undefined;
  fetchImpl?: FetchLike | undefined;
  timeoutMs?: number | undefined;
  now?: () => string;
}

export interface RemotePairingStatusResult {
  ok: boolean;
  status: RemotePairingStatus | null;
  error: string;
}

export interface RemotePairingEndpointProbeResult {
  key: string;
  label: string;
  path: string;
  method: "GET" | "POST";
  ok: boolean;
  skipped: boolean;
  error: string;
  checkedAt: string;
}

export interface RemotePairingDoctorResult {
  ok: boolean;
  status: RemotePairingStatus | null;
  checks: RemotePairingEndpointProbeResult[];
  error: string;
}

export async function fetchRemotePairingStatus(
  config: RemotePairingClientConfig,
): Promise<RemotePairingStatusResult> {
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return { ok: false, status: null, error: endpoint.error };
  }

  try {
    const payload = await fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/pairing/status`, {
      apiKey: endpoint.apiKey,
      timeoutMs: endpoint.timeoutMs,
    });
    const status = normalizeRemotePairingStatusPayload(payload);
    return {
      ok: status.version > 0,
      status,
      error: status.version > 0 ? "" : "Remote pairing status payload was malformed.",
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "Remote pairing status failed.",
    };
  }
}

export async function runRemotePairingDoctor(
  config: RemotePairingClientConfig,
): Promise<RemotePairingDoctorResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return { ok: false, status: null, checks: [], error: endpoint.error };
  }

  const statusResult = await fetchRemotePairingStatus(config);
  if (!statusResult.status) {
    return { ok: false, status: null, checks: [], error: statusResult.error };
  }

  const checks = await probeEndpoints({
    endpoints: statusResult.status.requiredEndpoints,
    baseApiUrl: endpoint.baseApiUrl,
    apiKey: endpoint.apiKey,
    fetchImpl: endpoint.fetchImpl,
    timeoutMs: endpoint.timeoutMs,
    checkedAt,
  });

  return {
    ok:
      statusResult.ok &&
      statusResult.status.blockingIssues.length === 0 &&
      checks.every((check) => check.ok),
    status: statusResult.status,
    checks,
    error: "",
  };
}

async function probeEndpoints({
  endpoints,
  baseApiUrl,
  apiKey,
  fetchImpl,
  timeoutMs,
  checkedAt,
}: {
  endpoints: RemotePairingEndpoint[];
  baseApiUrl: string;
  apiKey: string | undefined;
  fetchImpl: FetchLike;
  timeoutMs: number | undefined;
  checkedAt: string;
}): Promise<RemotePairingEndpointProbeResult[]> {
  const results: RemotePairingEndpointProbeResult[] = [];
  for (const check of endpoints) {
    if (check.requiresApiKey && !apiKey) {
      results.push({
        key: check.key,
        label: check.label,
        path: check.path,
        method: check.method,
        ok: false,
        skipped: true,
        error: "API key required before probing this endpoint.",
        checkedAt,
      });
      continue;
    }

    try {
      await fetchRemoteJson(fetchImpl, `${baseApiUrl}${check.path}`, {
        apiKey,
        method: check.method === "POST" ? "POST" : "GET",
        timeoutMs,
      });
      results.push({
        key: check.key,
        label: check.label,
        path: check.path,
        method: check.method,
        ok: true,
        skipped: false,
        error: "",
        checkedAt,
      });
    } catch (error) {
      results.push({
        key: check.key,
        label: check.label,
        path: check.path,
        method: check.method,
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : "Endpoint probe failed.",
        checkedAt,
      });
    }
  }
  return results;
}
