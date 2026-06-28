import type { EngineId, EngineRole, LeaseEvent } from "./events";

export interface ActiveLeaseState {
  leaseId: string | null;
  holderEngineId: EngineId | null;
  expiresAtMs: number | null;
  lastEventId: string | null;
}

export const EMPTY_LEASE_STATE: ActiveLeaseState = {
  leaseId: null,
  holderEngineId: null,
  expiresAtMs: null,
  lastEventId: null,
};

export type LeaseEvidenceHolder = EngineRole | "none" | "unknown";
export type LeaseEvidenceSource = "remote_event_log" | "phone_native_store" | "peer_challenge" | "none";

export interface LeaseEvidenceSnapshot {
  holder: LeaseEvidenceHolder;
  leaseId: string | null;
  holderEngineId: string | null;
  expiresAt: string | null;
  observedAt: string | null;
  stale: boolean;
  conflict: boolean;
  source: LeaseEvidenceSource;
  usable: boolean;
  reason: string;
}

export type LeaseEvidenceSnapshotInput =
  | Partial<Record<keyof Omit<LeaseEvidenceSnapshot, "usable" | "reason">, unknown>>
  | null
  | undefined;

export const EMPTY_LEASE_EVIDENCE_SNAPSHOT: LeaseEvidenceSnapshot = {
  holder: "unknown",
  leaseId: null,
  holderEngineId: null,
  expiresAt: null,
  observedAt: null,
  stale: false,
  conflict: false,
  source: "none",
  usable: false,
  reason: "Lease evidence missing.",
};

export function normalizeLeaseEvidenceSnapshot(
  input: LeaseEvidenceSnapshotInput,
): LeaseEvidenceSnapshot {
  if (!input || typeof input !== "object") {
    return EMPTY_LEASE_EVIDENCE_SNAPSHOT;
  }

  const holder = normalizeLeaseEvidenceHolder(input.holder);
  const source = normalizeLeaseEvidenceSource(input.source);
  const stale = input.stale === true;
  const conflict = input.conflict === true;
  const leaseId = nullableString(input.leaseId);
  const holderEngineId = nullableString(input.holderEngineId);
  const expiresAt = nullableString(input.expiresAt);
  const observedAt = nullableString(input.observedAt);

  if (conflict) {
    return {
      holder: "unknown",
      leaseId,
      holderEngineId,
      expiresAt,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "Lease conflict detected.",
    };
  }

  if (stale) {
    return {
      holder: "unknown",
      leaseId,
      holderEngineId,
      expiresAt,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "Lease evidence is stale.",
    };
  }

  if (holder === "none") {
    return {
      holder,
      leaseId: null,
      holderEngineId: null,
      expiresAt: null,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "No active lease observed.",
    };
  }

  if (holder === "unknown") {
    return {
      holder,
      leaseId,
      holderEngineId,
      expiresAt,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "Lease holder is unknown.",
    };
  }

  if (!leaseId || !holderEngineId || !expiresAt || !observedAt) {
    return {
      holder: "unknown",
      leaseId,
      holderEngineId,
      expiresAt,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "Lease holder proof is incomplete.",
    };
  }

  if (!parseEventTime(expiresAt) || !parseEventTime(observedAt)) {
    return {
      holder: "unknown",
      leaseId,
      holderEngineId,
      expiresAt,
      observedAt,
      stale,
      conflict,
      source,
      usable: false,
      reason: "Lease timestamp proof is invalid.",
    };
  }

  return {
    holder,
    leaseId,
    holderEngineId,
    expiresAt,
    observedAt,
    stale,
    conflict,
    source,
    usable: true,
    reason: "Lease evidence usable.",
  };
}

export function parseEventTime(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLeaseEvidenceHolder(value: unknown): LeaseEvidenceHolder {
  return value === "phone" || value === "remote" || value === "none" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeLeaseEvidenceSource(value: unknown): LeaseEvidenceSource {
  return value === "remote_event_log" ||
    value === "phone_native_store" ||
    value === "peer_challenge" ||
    value === "none"
    ? value
    : "none";
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isLeaseActive(state: ActiveLeaseState, nowMs: number): boolean {
  return (
    state.leaseId !== null &&
    state.holderEngineId !== null &&
    state.expiresAtMs !== null &&
    state.expiresAtMs > nowMs
  );
}

export function canEngineExecute(
  state: ActiveLeaseState,
  engineId: EngineId,
  nowMs: number,
): boolean {
  return isLeaseActive(state, nowMs) && state.holderEngineId === engineId;
}

export function reduceLeaseEvent(
  state: ActiveLeaseState,
  event: LeaseEvent,
): ActiveLeaseState {
  if (event.type === "lease.acquired.v1" || event.type === "lease.renewed.v1") {
    return {
      leaseId: event.payload.leaseId,
      holderEngineId: event.payload.holderEngineId,
      expiresAtMs: parseEventTime(event.payload.expiresAt),
      lastEventId: event.id,
    };
  }

  if (event.type === "lease.relinquished.v1" || event.type === "lease.expired.v1") {
    return {
      leaseId: null,
      holderEngineId: null,
      expiresAtMs: null,
      lastEventId: event.id,
    };
  }

  return {
    ...state,
    lastEventId: event.id,
  };
}
