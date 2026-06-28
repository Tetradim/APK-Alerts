import assert from "node:assert/strict";
import test from "node:test";
import type {
  BrokerOrderUpdatePayload,
  OperatorNotificationPayload,
  PositionReconciledPayload,
} from "./events.js";

test("shared event payload types document broker, position, and operator evidence", () => {
  const brokerOrder: BrokerOrderUpdatePayload = {
    broker: "alpaca",
    brokerOrderId: "order-1",
    clientOrderId: "client-1",
    status: "filled",
    symbol: "SPY",
    side: "buy",
    quantity: 1,
    filledQuantity: 1,
    averageFillPrice: 1.25,
    updatedAt: "2026-06-28T18:00:00.000Z",
  };
  const position: PositionReconciledPayload = {
    broker: "alpaca",
    positionId: "pos-1",
    symbol: "SPY",
    quantity: 1,
    averageEntryPrice: 1.25,
    marketValue: 125,
    reconciledAt: "2026-06-28T18:00:01.000Z",
    open: true,
    protectedByOco: true,
  };
  const notification: OperatorNotificationPayload = {
    severity: "info",
    code: "setup.ready",
    message: "Setup ready.",
    actionLabel: null,
  };

  assert.equal(brokerOrder.status, "filled");
  assert.equal(position.protectedByOco, true);
  assert.equal(notification.severity, "info");
});
