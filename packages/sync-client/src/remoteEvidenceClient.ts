import {
  buildAlertEvidenceChains,
  EMPTY_LEASE_STATE,
  normalizeBridgeAlertDecisionEvent,
  normalizeBridgeHealthPayload,
  normalizeBridgeSignalEvent,
  normalizeLeaseEvidenceSnapshot,
  reduceLeaseEvent,
  type AlertEvidenceChain,
  type BridgeAlertDecisionEvidence,
  type BridgeHealth,
  type BridgeSignalEvidence,
  type EngineId,
  type LeaseEvent,
  type LeaseEvidenceSnapshot,
} from "@apk-alerts/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export type { FetchLike };
export { normalizeRemoteApiBaseUrl as normalizeRemoteEvidenceBaseUrl };

export interface RemoteEvidenceClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  limit?: number;
  timeoutMs?: number;
  now?: () => string;
}

export interface RemoteAlertEvidenceSnapshot {
  checkedAt: string;
  bridgeHealth: BridgeHealth;
  leaseEvidence: LeaseEvidenceSnapshot;
  signals: BridgeSignalEvidence[];
  decisions: BridgeAlertDecisionEvidence[];
  chains: AlertEvidenceChain[];
}

export interface RemoteAlertEvidenceResult {
  ok: boolean;
  snapshot: RemoteAlertEvidenceSnapshot;
  error: string;
}

export async function fetchRemoteAlertEvidence(
  config: RemoteEvidenceClientConfig,
): Promise<RemoteAlertEvidenceResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return {
      ok: false,
      snapshot: buildEmptySnapshot(checkedAt),
      error: endpoint.error,
    };
  }

  const limit = normalizeLimit(config.limit);
  try {
    const [busPayload, operatorPayload, bridgeHealthPayload] = await Promise.all([
      fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/bus/events?limit=${limit}`, {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }),
      fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/operator/events?limit=${limit}`, {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }),
      fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/discord/chrome-bridge/health`, {
        apiKey: endpoint.apiKey,
        timeoutMs: endpoint.timeoutMs,
      }),
    ]);
    const busEvents = extractArray(busPayload, "events");
    const operatorEvents = extractOperatorEvents(operatorPayload);
    const signals = busEvents
      .filter((event) => isBridgeSignalEvent(event))
      .map((event) => normalizeBridgeSignalEvent(event));
    const decisions = operatorEvents
      .filter((event) => normalizeBridgeAlertDecisionEvent(event).action === "bridge_alert_decision")
      .map((event) => normalizeBridgeAlertDecisionEvent(event));
    const bridgeHealth = normalizeBridgeHealthPayload(bridgeHealthPayload);
    const chains = buildAlertEvidenceChains({ signals, decisions });
    const leaseEvidence = buildLeaseEvidenceSnapshot([...busEvents, ...operatorEvents], checkedAt);

    return {
      ok: bridgeHealth.healthy,
      snapshot: {
        checkedAt,
        bridgeHealth,
        leaseEvidence,
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
    leaseEvidence: normalizeLeaseEvidenceSnapshot(null),
    signals: [],
    decisions: [],
    chains: [],
  };
}

function normalizeLimit(limit: number | undefined): number {
  return Number.isInteger(limit) && limit && limit > 0 && limit <= 500 ? limit : 100;
}

function buildLeaseEvidenceSnapshot(events: unknown[], checkedAt: string): LeaseEvidenceSnapshot {
  const leaseEvents = events
    .map((event, index) => normalizeLeaseEvent(event, index))
    .filter((event): event is LeaseEvent => event !== null)
    .sort((left, right) => left.sequence - right.sequence);

  if (leaseEvents.length === 0) {
    return normalizeLeaseEvidenceSnapshot({
      holder: "unknown",
      source: "remote_event_log",
      observedAt: checkedAt,
    });
  }

  const state = leaseEvents.reduce(reduceLeaseEvent, EMPTY_LEASE_STATE);
  const lastEvent = leaseEvents[leaseEvents.length - 1] ?? null;
  if (!state.leaseId || !state.holderEngineId || !state.expiresAtMs) {
    return normalizeLeaseEvidenceSnapshot({
      holder: "none",
      source: "remote_event_log",
      observedAt: lastEvent?.observedAt ?? checkedAt,
    });
  }

  return normalizeLeaseEvidenceSnapshot({
    holder: engineRoleFromId(state.holderEngineId),
    leaseId: state.leaseId,
    holderEngineId: state.holderEngineId,
    expiresAt: new Date(state.expiresAtMs).toISOString(),
    observedAt: lastEvent?.observedAt ?? checkedAt,
    stale: state.expiresAtMs <= Date.parse(checkedAt),
    conflict: false,
    source: "remote_event_log",
  });
}

function normalizeLeaseEvent(input: unknown, index: number): LeaseEvent | null {
  if (!isRecord(input)) {
    return null;
  }

  const type = stringField(input, "type") || stringField(input, "event_type");
  if (!isLeaseEventType(type)) {
    return null;
  }

  const payload = recordField(input, "payload");
  if (!payload) {
    return null;
  }

  const leaseId = stringField(payload, "leaseId") || stringField(payload, "lease_id");
  const holderEngineId =
    nullableStringField(payload, "holderEngineId") ?? nullableStringField(payload, "holder_engine_id");
  const expiresAt = nullableStringField(payload, "expiresAt") ?? nullableStringField(payload, "expires_at");
  if (!leaseId) {
    return null;
  }

  return {
    id: stringField(input, "id") || stringField(input, "event_id") || `lease-event-${index}`,
    type,
    schemaVersion: 1,
    sourceEngineId: (stringField(input, "sourceEngineId") ||
      stringField(input, "source_engine_id") ||
      "remote:unknown") as EngineId,
    observedAt:
      stringField(input, "observedAt") ||
      stringField(input, "observed_at") ||
      stringField(input, "created_at") ||
      "",
    sequence: numberField(input, "sequence") ?? index,
    previousEventId:
      nullableStringField(input, "previousEventId") ?? nullableStringField(input, "previous_event_id"),
    idempotencyKey:
      nullableStringField(input, "idempotencyKey") ?? nullableStringField(input, "idempotency_key"),
    payload: {
      leaseId,
      holderEngineId: holderEngineId as EngineId | null,
      expiresAt,
      reason: stringField(payload, "reason") || "remote lease event",
    },
  };
}

function isLeaseEventType(value: string): value is LeaseEvent["type"] {
  return (
    value === "lease.requested.v1" ||
    value === "lease.acquired.v1" ||
    value === "lease.renewed.v1" ||
    value === "lease.relinquished.v1" ||
    value === "lease.expired.v1"
  );
}

function engineRoleFromId(engineId: string): "phone" | "remote" | "unknown" {
  if (engineId.startsWith("phone")) {
    return "phone";
  }
  if (engineId.startsWith("remote")) {
    return "remote";
  }
  return "unknown";
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
  if (!isRecord(input)) {
    return false;
  }
  const eventType = input.event_type;
  return eventType === "signal.observed" || eventType === "signal.duplicate";
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function recordField(input: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = input[key];
  return isRecord(value) ? value : null;
}

function stringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value.trim() : "";
}

function nullableStringField(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  if (value === null) {
    return null;
  }
  const normalized = stringField(input, key);
  return normalized || null;
}

function numberField(input: Record<string, unknown>, key: string): number | null {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
