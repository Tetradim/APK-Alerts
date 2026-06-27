import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeReconciliationPayload,
  normalizeReconciliationRow,
  summarizeReconciliationRows,
} from "./reconciliation";

test("normalizes reconciled alert trade position row", () => {
  const row = normalizeReconciliationRow({
    alert_id: "alert-1",
    ticker: "SPY",
    alert_type: "buy",
    strike: 500,
    option_type: "CALL",
    expiration: "2026-06-21",
    entry_price: 1.25,
    processed: true,
    trade_executed: true,
    trade_id: "trade-1",
    trade_status: "filled",
    order_id: "order-1",
    position_id: "position-1",
    position_status: "open",
    simulated: false,
    attention_reason: "",
  });

  assert.equal(row.alertId, "alert-1");
  assert.equal(row.contractKey, "SPY-2026-06-21-500-CALL");
  assert.equal(row.status, "reconciled");
  assert.equal(row.attentionReason, "");
  assert.equal(row.liveBlocking, false);
});

test("summarizes unresolved real rows separately from simulated unresolved rows", () => {
  const rows = normalizeReconciliationPayload([
    { alert_id: "alert-live", trade_status: "pending", simulated: false, attention_reason: "order pending fill" },
    { alert_id: "alert-paper", trade_status: "pending", simulated: true, attention_reason: "entry trade has no position" },
    { alert_id: "alert-clear", simulated: false, attention_reason: "" },
  ]);
  const summary = summarizeReconciliationRows(rows);

  assert.equal(summary.rowCount, 3);
  assert.equal(summary.unresolvedCount, 1);
  assert.equal(summary.simulatedUnresolvedCount, 1);
  assert.deepEqual(summary.unresolvedReasons, ["order pending fill"]);
  assert.equal(summary.allClear, false);
});

test("terminal no-fill row without attention is reconciled for operator display", () => {
  const row = normalizeReconciliationRow({
    alert_id: "alert-failed",
    trade_status: "failed",
    simulated: false,
    attention_reason: "",
  });

  assert.equal(row.status, "reconciled");
  assert.equal(row.liveBlocking, false);
});

test("malformed reconciliation payload normalizes to empty fail-closed list", () => {
  const rows = normalizeReconciliationPayload({ rows: "bad" });
  const summary = summarizeReconciliationRows(rows);

  assert.deepEqual(rows, []);
  assert.equal(summary.rowCount, 0);
  assert.equal(summary.allClear, false);
});

test("structural proof attention is live blocking only when trade was requested", () => {
  const requested = normalizeReconciliationRow({
    alert_id: "alert-proof",
    simulated: true,
    trade_requested: true,
    attention_reason: "accepted bridge alert missing source metadata policy proof",
  });
  const notRequested = normalizeReconciliationRow({
    alert_id: "alert-proof-paper",
    simulated: false,
    trade_requested: false,
    attention_reason: "accepted bridge alert missing source metadata policy proof",
  });

  assert.equal(requested.status, "attention");
  assert.equal(requested.liveBlocking, true);
  assert.equal(notRequested.liveBlocking, false);
});
