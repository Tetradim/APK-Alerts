import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_LEASE_STATE,
  buildIdempotencyKey,
  canEngineExecute,
  createEvent,
  reduceLeaseEvent,
} from "./index.js";

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
