import assert from "node:assert/strict";
import test from "node:test";
import { createEvent } from "./events";

const validEventInput = {
  id: "engine-health-1",
  type: "engine.health.v1" as const,
  sourceEngineId: "phone:pixel-1" as const,
  observedAt: "2026-06-27T18:00:00.000Z",
  sequence: 0,
  payload: {
    engineRole: "phone" as const,
    status: "healthy" as const,
    leaseEligible: true,
    reason: null,
  },
};

test("createEvent preserves valid non-negative integer sequence", () => {
  const event = createEvent(validEventInput);

  assert.equal(event.sequence, 0);
  assert.equal(event.previousEventId, null);
  assert.equal(event.idempotencyKey, null);
});

test("createEvent rejects invalid sequence numbers", () => {
  for (const sequence of [-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.throws(
      () => createEvent({ ...validEventInput, sequence }),
      /Event sequence must be a non-negative integer\./,
    );
  }
});
