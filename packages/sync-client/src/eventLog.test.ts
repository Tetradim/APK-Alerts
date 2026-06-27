import assert from "node:assert/strict";
import test from "node:test";
import { buildIdempotencyKey, createEvent } from "@apk-alerts/contracts";
import { DuplicateEventError, InMemoryEventLog, UnknownCursorError } from "./eventLog.js";

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
  const beforeEvents = structuredClone(log.readAfter(null));

  assert.throws(() => log.append(event), DuplicateEventError);
  assert.equal(log.size(), 1);
  assert.equal(log.latestCursor(), "event-1");
  assert.deepEqual(log.readAfter(null), beforeEvents);
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
  const beforeEvents = structuredClone(log.readAfter(null));

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
  assert.equal(log.size(), 1);
  assert.equal(log.latestCursor(), "event-1");
  assert.deepEqual(log.readAfter(null), beforeEvents);
});

test("event log stores immutable snapshots when appending events", () => {
  const log = new InMemoryEventLog();
  const event = createEvent({
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
  });

  log.append(event);
  const mutablePayload = event.payload as {
    status: "healthy" | "degraded" | "offline";
    reason: string | null;
  };
  mutablePayload.status = "offline";
  mutablePayload.reason = "mutated after append";

  const [storedEvent] = log.readAfter(null);
  assert.ok(storedEvent);
  assert.equal(storedEvent.type, "engine.health.v1");
  assert.equal(storedEvent.payload.status, "healthy");
  assert.equal(storedEvent.payload.reason, null);
});

test("event log read results cannot mutate stored events", () => {
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

  const [readEvent] = log.readAfter(null);
  assert.ok(readEvent);
  assert.equal(readEvent.type, "engine.health.v1");

  try {
    readEvent.payload.status = "offline";
    readEvent.payload.reason = "mutated after read";
  } catch (error) {
    assert.ok(error instanceof TypeError);
  }

  const [storedEvent] = log.readAfter(null);
  assert.ok(storedEvent);
  assert.equal(storedEvent.type, "engine.health.v1");
  assert.equal(storedEvent.payload.status, "healthy");
  assert.equal(storedEvent.payload.reason, null);
});

test("event log rejects unknown cursors", () => {
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

  assert.throws(
    () => log.readAfter("missing"),
    (error) => error instanceof UnknownCursorError
      && error.message === "Unknown event cursor: missing",
  );
});
