import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_LEASE_STATE,
  buildIdempotencyKey,
  canEngineExecute,
  createEvent,
  normalizeLeaseEvidenceSnapshot,
  reduceLeaseEvent,
  type TradingEventType,
} from "./index.js";

createEvent({
  id: "event-invalid-payload",
  type: "lease.acquired.v1",
  sourceEngineId: "phone:pixel-1",
  observedAt: "2026-06-27T05:00:00.000Z",
  sequence: 1,
  // @ts-expect-error Known trading event types must require their contract payloads.
  payload: { unexpected: true },
});

function makeInvalidBroadEvent(type: TradingEventType) {
  return createEvent({
    id: "event-invalid-broad-payload",
    type,
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T05:00:00.000Z",
    sequence: 1,
    // @ts-expect-error Broad event type must not decouple type from payload.
    payload: { unexpected: true },
  });
}

void makeInvalidBroadEvent;

test("phone engine can execute only while it holds an active lease", () => {
  const leaseEvent = createEvent({
    id: "event-1",
    type: "lease.acquired.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T05:00:00.000Z",
    sequence: 1,
    payload: {
      leaseId: "lease-1",
      holderEngineId: "phone:pixel-1",
      expiresAt: "2026-06-27T05:05:00.000Z",
      reason: "phone engine healthy",
    },
  });

  const state = reduceLeaseEvent(EMPTY_LEASE_STATE, leaseEvent);

  assert.equal(canEngineExecute(state, "phone:pixel-1", Date.parse("2026-06-27T05:01:00.000Z")), true);
  assert.equal(canEngineExecute(state, "remote:windows-pc", Date.parse("2026-06-27T05:01:00.000Z")), false);
  assert.equal(canEngineExecute(state, "phone:pixel-1", Date.parse("2026-06-27T05:06:00.000Z")), false);
});

test("lease relinquish clears execution authority", () => {
  const acquired = reduceLeaseEvent(
    EMPTY_LEASE_STATE,
    createEvent({
      id: "event-1",
      type: "lease.acquired.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:00:00.000Z",
      sequence: 1,
      payload: {
        leaseId: "lease-1",
        holderEngineId: "phone:pixel-1",
        expiresAt: "2026-06-27T05:05:00.000Z",
        reason: "phone engine healthy",
      },
    }),
  );

  const relinquished = reduceLeaseEvent(
    acquired,
    createEvent({
      id: "event-2",
      type: "lease.relinquished.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:02:00.000Z",
      sequence: 2,
      payload: {
        leaseId: "lease-1",
        holderEngineId: null,
        expiresAt: null,
        reason: "operator stopped phone engine",
      },
    }),
  );

  assert.equal(relinquished.holderEngineId, null);
  assert.equal(canEngineExecute(relinquished, "phone:pixel-1", Date.parse("2026-06-27T05:03:00.000Z")), false);
});

test("lease requested only updates last event and does not grant authority", () => {
  const state = reduceLeaseEvent(
    EMPTY_LEASE_STATE,
    createEvent({
      id: "event-requested",
      type: "lease.requested.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:00:00.000Z",
      sequence: 1,
      payload: {
        leaseId: "lease-requested",
        holderEngineId: "phone:pixel-1",
        expiresAt: "2026-06-27T05:05:00.000Z",
        reason: "phone engine requested lease",
      },
    }),
  );

  assert.equal(state.leaseId, null);
  assert.equal(state.holderEngineId, null);
  assert.equal(state.expiresAtMs, null);
  assert.equal(state.lastEventId, "event-requested");
  assert.equal(canEngineExecute(state, "phone:pixel-1", Date.parse("2026-06-27T05:01:00.000Z")), false);
});

test("invalid and null expiry fail closed for acquired and renewed leases", () => {
  const acquiredWithNullExpiry = reduceLeaseEvent(
    EMPTY_LEASE_STATE,
    createEvent({
      id: "event-null-expiry",
      type: "lease.acquired.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:00:00.000Z",
      sequence: 1,
      payload: {
        leaseId: "lease-null-expiry",
        holderEngineId: "phone:pixel-1",
        expiresAt: null,
        reason: "missing expiry",
      },
    }),
  );

  assert.equal(
    canEngineExecute(acquiredWithNullExpiry, "phone:pixel-1", Date.parse("2026-06-27T05:01:00.000Z")),
    false,
  );

  const renewedWithInvalidExpiry = reduceLeaseEvent(
    EMPTY_LEASE_STATE,
    createEvent({
      id: "event-invalid-expiry",
      type: "lease.renewed.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:00:00.000Z",
      sequence: 1,
      payload: {
        leaseId: "lease-invalid-expiry",
        holderEngineId: "phone:pixel-1",
        expiresAt: "not-a-date",
        reason: "invalid expiry",
      },
    }),
  );

  assert.equal(
    canEngineExecute(renewedWithInvalidExpiry, "phone:pixel-1", Date.parse("2026-06-27T05:01:00.000Z")),
    false,
  );
});

test("lease expired clears execution authority", () => {
  const acquired = reduceLeaseEvent(
    EMPTY_LEASE_STATE,
    createEvent({
      id: "event-acquired",
      type: "lease.acquired.v1",
      sourceEngineId: "phone:pixel-1",
      observedAt: "2026-06-27T05:00:00.000Z",
      sequence: 1,
      payload: {
        leaseId: "lease-1",
        holderEngineId: "phone:pixel-1",
        expiresAt: "2026-06-27T05:05:00.000Z",
        reason: "phone engine healthy",
      },
    }),
  );

  const expired = reduceLeaseEvent(
    acquired,
    createEvent({
      id: "event-expired",
      type: "lease.expired.v1",
      sourceEngineId: "remote:windows-pc",
      observedAt: "2026-06-27T05:05:00.000Z",
      sequence: 2,
      payload: {
        leaseId: "lease-1",
        holderEngineId: null,
        expiresAt: null,
        reason: "lease timeout",
      },
    }),
  );

  assert.equal(expired.leaseId, null);
  assert.equal(expired.holderEngineId, null);
  assert.equal(expired.expiresAtMs, null);
  assert.equal(expired.lastEventId, "event-expired");
  assert.equal(canEngineExecute(expired, "phone:pixel-1", Date.parse("2026-06-27T05:04:00.000Z")), false);
});

test("lease evidence normalizes active holder and fail-closed states", () => {
  const active = normalizeLeaseEvidenceSnapshot({
    holder: "phone",
    leaseId: " lease-1 ",
    holderEngineId: " phone:pixel-1 ",
    expiresAt: "2026-06-27T05:05:00.000Z",
    observedAt: "2026-06-27T05:00:00.000Z",
    stale: false,
    conflict: false,
    source: "phone_native_store",
  });
  const missing = normalizeLeaseEvidenceSnapshot(null);
  const conflict = normalizeLeaseEvidenceSnapshot({
    holder: "remote",
    leaseId: "lease-2",
    holderEngineId: "remote:windows-pc",
    expiresAt: "2026-06-27T05:05:00.000Z",
    observedAt: "2026-06-27T05:00:00.000Z",
    stale: false,
    conflict: true,
    source: "remote_event_log",
  });

  assert.equal(active.holder, "phone");
  assert.equal(active.leaseId, "lease-1");
  assert.equal(active.holderEngineId, "phone:pixel-1");
  assert.equal(active.usable, true);
  assert.equal(missing.holder, "unknown");
  assert.equal(missing.usable, false);
  assert.equal(conflict.holder, "unknown");
  assert.equal(conflict.usable, false);
  assert.equal(conflict.reason, "Lease conflict detected.");
});

test("idempotency keys normalize duplicate order intent identity", () => {
  assert.equal(
    buildIdempotencyKey({
      source: "discord",
      intent: "BUY",
      externalId: "Message-123",
      contractKey: "SPY-2026-06-30-500-C",
    }),
    "discord:buy:message-123:spy-2026-06-30-500-c",
  );
});

test("idempotency keys trim every identity part before joining", () => {
  assert.equal(
    buildIdempotencyKey({
      source: "discord",
      intent: " BUY ",
      externalId: " Message-123 ",
      contractKey: " SPY-2026-06-30-500-C ",
    }),
    "discord:buy:message-123:spy-2026-06-30-500-c",
  );
});
