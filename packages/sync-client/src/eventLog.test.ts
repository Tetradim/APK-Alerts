import assert from "node:assert/strict";
import test from "node:test";
import { buildIdempotencyKey, createEvent } from "@apk-alerts/contracts";
import { DuplicateEventError, InMemoryEventLog } from "./eventLog.js";

test("event log appends events and reads them after a cursor", () => {
  const log = new InMemoryEventLog();

  log.append(createEvent({
    id: "event-1",
    type: "engine.health.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T05:00:00.000Z",
    sequence: 1,
    payload: {
      engineRole: "phone",
      status: "healthy",
      leaseEligible: true,
      reason: null,
    },
  }));

  log.append(createEvent({
    id: "event-2",
    type: "transport.health.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T05:00:01.000Z",
    sequence: 2,
    previousEventId: "event-1",
    payload: {
      kind: "tailscale",
      status: "connected",
      remoteAddress: "remote-engine.tailnet.ts.net",
    },
  }));

  assert.deepEqual(log.readAfter(null).map((event) => event.id), ["event-1", "event-2"]);
  assert.deepEqual(log.readAfter("event-1").map((event) => event.id), ["event-2"]);
  assert.equal(log.latestCursor(), "event-2");
});

test("event log rejects duplicate event ids", () => {
  const log = new InMemoryEventLog();
  const event = createEvent({
    id: "event-1",
    type: "engine.health.v1",
    sourceEngineId: "remote:windows-pc",
    observedAt: "2026-06-27T05:00:00.000Z",
    sequence: 1,
    payload: {
      engineRole: "remote",
      status: "healthy",
      leaseEligible: false,
      reason: "phone owns lease",
    },
  });

  log.append(event);

  assert.throws(() => log.append(event), DuplicateEventError);
});

test("event log rejects duplicate idempotency keys", () => {
  const log = new InMemoryEventLog();
  const idempotencyKey = buildIdempotencyKey({
    source: "discord",
    intent: "buy",
    externalId: "message-123",
    contractKey: "spy-2026-06-30-500-c",
  });

  log.append(createEvent({
    id: "event-1",
    type: "order.intent.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T05:00:00.000Z",
    sequence: 1,
    idempotencyKey,
    payload: {
      alertEventId: "alert-1",
      broker: "alpaca",
      side: "buy",
      contractKey: "SPY-2026-06-30-500-C",
      quantity: 1,
    },
  }));

  assert.throws(
    () => log.append(createEvent({
      id: "event-2",
      type: "order.intent.v1",
      sourceEngineId: "remote:windows-pc",
      observedAt: "2026-06-27T05:00:02.000Z",
      sequence: 2,
      idempotencyKey,
      payload: {
        alertEventId: "alert-1",
        broker: "alpaca",
        side: "buy",
        contractKey: "SPY-2026-06-30-500-C",
        quantity: 1,
      },
    })),
    DuplicateEventError,
  );
});
