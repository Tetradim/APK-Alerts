import type { EngineId, LeaseEvent } from "./events";

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

export function parseEventTime(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
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
