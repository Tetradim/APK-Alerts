import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReconciliationPayload, summarizeReconciliationRows } from "@apk-alerts/contracts";
import {
  buildOrderLifecycleEvidenceSummary,
  buildReconciliationSummary,
  createReconciliationStore,
  getDefaultReconciliationSnapshot,
  type ReconciliationChecker,
} from "./reconciliationState.js";

function remoteSnapshot(rowsInput: unknown[]) {
  const rows = normalizeReconciliationPayload(rowsInput);
  return {
    checkedAt: "2026-06-27T17:45:00.000Z",
    rows,
    summary: summarizeReconciliationRows(rows),
  };
}

test("default reconciliation summary is unpaired and has no invented rows", () => {
  const summary = buildReconciliationSummary(getDefaultReconciliationSnapshot());

  assert.equal(summary.connectionLabel, "Not paired");
  assert.equal(summary.statusLabel, "No evidence");
  assert.equal(summary.primaryReason, "No reconciliation evidence");
});

test("clear reconciliation rows summarize as reconciled", () => {
  const summary = buildReconciliationSummary({
    ...getDefaultReconciliationSnapshot(),
    connection: { baseApiUrl: "http://100.90.10.11:8001/api", apiKey: "secret", transport: "tailscale" },
    remote: remoteSnapshot([
      { alert_id: "alert-1", trade_id: "trade-1", order_id: "order-1", position_id: "position-1", simulated: false, attention_reason: "" },
    ]),
  });

  assert.equal(summary.connectionLabel, "Tailscale");
  assert.equal(summary.statusLabel, "Reconciled");
  assert.equal(summary.primaryReason, "1 row reconciled");
});

test("unresolved real reconciliation rows surface blocker reason", () => {
  const summary = buildReconciliationSummary({
    ...getDefaultReconciliationSnapshot(),
    remote: remoteSnapshot([
      { alert_id: "alert-live", trade_status: "pending", simulated: false, attention_reason: "order pending fill" },
      { alert_id: "alert-paper", trade_status: "pending", simulated: true, attention_reason: "entry trade has no position" },
    ]),
  });

  assert.equal(summary.statusLabel, "Attention");
  assert.equal(summary.primaryReason, "order pending fill");
  assert.equal(summary.rowCountLabel, "2 rows");
  assert.equal(summary.unresolvedLabel, "1 unresolved real row");
});

test("order lifecycle evidence clears filled real trade with broker and position proof", () => {
  const [row] = normalizeReconciliationPayload([
    {
      alert_id: "alert-filled",
      processed: true,
      trade_requested: true,
      trade_executed: true,
      trade_id: "trade-1",
      trade_status: "filled",
      order_id: "order-1",
      position_id: "position-1",
      position_status: "open",
      simulated: false,
      attention_reason: "",
    },
  ]);
  assert.ok(row);
  const summary = buildOrderLifecycleEvidenceSummary(row);

  assert.equal(summary.gateLabel, "Lifecycle clear");
  assert.equal(summary.readyCountLabel, "5/5 proof(s) clear");
  assert.equal(summary.blockingCountLabel, "No lifecycle blockers");
  assert.equal(summary.blocking, false);
  assert.equal(summary.items.find((item) => item.key === "request")?.statusLabel, "Trade requested");
  assert.equal(summary.items.find((item) => item.key === "broker_order")?.statusLabel, "Broker order acknowledged");
  assert.equal(summary.items.find((item) => item.key === "fill_terminal")?.statusLabel, "Fill terminal");
  assert.equal(summary.items.find((item) => item.key === "position")?.statusLabel, "Position linked");
  assert.equal(summary.items.find((item) => item.key === "attention")?.statusLabel, "No attention reason");
});

test("order lifecycle evidence blocks pending live order with attention", () => {
  const [row] = normalizeReconciliationPayload([
    {
      alert_id: "alert-pending",
      processed: true,
      trade_requested: true,
      trade_executed: false,
      trade_id: "trade-2",
      trade_status: "pending",
      order_id: "order-2",
      position_id: "",
      simulated: false,
      attention_reason: "order pending fill",
    },
  ]);
  assert.ok(row);
  const summary = buildOrderLifecycleEvidenceSummary(row);

  assert.equal(summary.gateLabel, "Lifecycle blocked");
  assert.equal(summary.readyCountLabel, "2/5 proof(s) clear");
  assert.equal(summary.blockingCountLabel, "3 lifecycle blocker(s)");
  assert.equal(summary.blocking, true);
  assert.equal(summary.items.find((item) => item.key === "broker_order")?.blocking, false);
  assert.equal(summary.items.find((item) => item.key === "fill_terminal")?.statusLabel, "Fill not terminal");
  assert.equal(summary.items.find((item) => item.key === "position")?.statusLabel, "Position pending");
  assert.equal(summary.items.find((item) => item.key === "attention")?.statusLabel, "Live blocker");
});

test("order lifecycle evidence clears terminal failed order without position", () => {
  const [row] = normalizeReconciliationPayload([
    {
      alert_id: "alert-failed",
      processed: true,
      trade_requested: true,
      trade_executed: false,
      trade_id: "trade-3",
      trade_status: "failed",
      order_id: "order-3",
      position_id: "",
      position_status: "",
      simulated: false,
      attention_reason: "",
    },
  ]);
  assert.ok(row);
  const summary = buildOrderLifecycleEvidenceSummary(row);

  assert.equal(summary.gateLabel, "Lifecycle clear");
  assert.equal(summary.blocking, false);
  assert.equal(summary.items.find((item) => item.key === "fill_terminal")?.statusLabel, "Order terminal");
  assert.equal(summary.items.find((item) => item.key === "position")?.statusLabel, "No position expected");
});

test("order lifecycle evidence surfaces simulated attention without live blocking", () => {
  const [row] = normalizeReconciliationPayload([
    {
      alert_id: "alert-paper",
      processed: true,
      trade_requested: true,
      trade_executed: false,
      trade_id: "trade-4",
      trade_status: "pending",
      order_id: "order-4",
      position_id: "",
      simulated: true,
      attention_reason: "entry trade has no position",
    },
  ]);
  assert.ok(row);
  const summary = buildOrderLifecycleEvidenceSummary(row);

  assert.equal(summary.items.find((item) => item.key === "attention")?.statusLabel, "Simulated attention");
  assert.equal(summary.items.find((item) => item.key === "attention")?.blocking, false);
});

test("reconciliation store refreshes and clears stale rows on connection edit", async () => {
  const checker: ReconciliationChecker = async (config) => {
    assert.equal(config.baseApiUrl, "http://100.90.10.11:8001/api");
    assert.equal(config.apiKey, "secret");
    return {
      ok: true,
      snapshot: remoteSnapshot([
        { alert_id: "alert-1", trade_id: "trade-1", position_id: "position-1", simulated: false, attention_reason: "" },
      ]),
      error: "",
    };
  };
  const store = createReconciliationStore(checker);

  store.getState().updateConnectionDraft({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
  });
  await store.getState().checkReconciliation();
  assert.equal(store.getState().snapshot.remote.rows.length, 1);

  store.getState().updateConnectionDraft({
    baseApiUrl: "https://relay.example.com/api",
    apiKey: "next",
  });

  assert.equal(store.getState().snapshot.connection.transport, "cloud_relay");
  assert.equal(store.getState().snapshot.remote.rows.length, 0);
  assert.equal(store.getState().snapshot.remote.checkedAt, "");
  assert.equal(store.getState().snapshot.lastError, "");
});
