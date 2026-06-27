import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReconciliationPayload, summarizeReconciliationRows } from "@apk-alerts/contracts";
import {
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
