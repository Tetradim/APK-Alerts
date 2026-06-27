import {
  buildAlertEvidenceChains,
  normalizeBridgeAlertDecisionEvent,
  normalizeBridgeHealthPayload,
  normalizeBridgeSignalEvent,
  type AlertEvidenceChain,
  type BridgeAlertDecisionEvidence,
  type BridgeHealth,
  type BridgeSignalEvidence,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface RemoteEvidenceClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  limit?: number;
  now?: () => string;
}

export interface RemoteAlertEvidenceSnapshot {
  checkedAt: string;
  bridgeHealth: BridgeHealth;
  signals: BridgeSignalEvidence[];
  decisions: BridgeAlertDecisionEvidence[];
  chains: AlertEvidenceChain[];
}

export interface RemoteAlertEvidenceResult {
  ok: boolean;
  snapshot: RemoteAlertEvidenceSnapshot;
  error: string;
}

export function normalizeRemoteEvidenceBaseUrl(value: string): string {
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

export async function fetchRemoteAlertEvidence(
  config: RemoteEvidenceClientConfig,
): Promise<RemoteAlertEvidenceResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const baseApiUrl = normalizeRemoteEvidenceBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return {
      ok: false,
      snapshot: buildEmptySnapshot(checkedAt),
      error: "Remote API URL is invalid.",
    };
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return {
      ok: false,
      snapshot: buildEmptySnapshot(checkedAt),
      error: "Fetch is not available.",
    };
  }

  const limit = normalizeLimit(config.limit);
  try {
    const [busPayload, operatorPayload, bridgeHealthPayload] = await Promise.all([
      fetchJson(fetchImpl, `${baseApiUrl}/bus/events?limit=${limit}`, config.apiKey),
      fetchJson(fetchImpl, `${baseApiUrl}/operator/events?limit=${limit}`, config.apiKey),
      fetchJson(fetchImpl, `${baseApiUrl}/discord/chrome-bridge/health`, config.apiKey),
    ]);
    const signals = extractArray(busPayload, "events")
      .filter((event) => isBridgeSignalEvent(event))
      .map((event) => normalizeBridgeSignalEvent(event));
    const decisions = extractOperatorEvents(operatorPayload)
      .filter((event) => normalizeBridgeAlertDecisionEvent(event).action === "bridge_alert_decision")
      .map((event) => normalizeBridgeAlertDecisionEvent(event));
    const bridgeHealth = normalizeBridgeHealthPayload(bridgeHealthPayload);
    const chains = buildAlertEvidenceChains({ signals, decisions });

    return {
      ok: bridgeHealth.healthy,
      snapshot: {
        checkedAt,
        bridgeHealth,
        signals,
        decisions,
        chains,
      },
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      snapshot: buildEmptySnapshot(checkedAt),
      error: error instanceof Error ? error.message : "Remote alert evidence check failed.",
    };
  }
}

function buildEmptySnapshot(checkedAt: string): RemoteAlertEvidenceSnapshot {
  return {
    checkedAt,
    bridgeHealth: normalizeBridgeHealthPayload(null),
    signals: [],
    decisions: [],
    chains: [],
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

function normalizeLimit(limit: number | undefined): number {
  return Number.isInteger(limit) && limit && limit > 0 && limit <= 500 ? limit : 100;
}

function extractArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
  }
  return [];
}

function extractOperatorEvents(payload: unknown): unknown[] {
  return extractArray(payload, "events");
}

function isBridgeSignalEvent(input: unknown): boolean {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }
  const eventType = (input as Record<string, unknown>).event_type;
  return eventType === "signal.observed" || eventType === "signal.duplicate";
}
