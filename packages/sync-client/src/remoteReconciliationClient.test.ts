import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRemoteReconciliation,
  normalizeRemoteReconciliationBaseUrl,
  type FetchLike,
} from "./remoteReconciliationClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("remote reconciliation URL normalization accepts root or api URLs", () => {
  assert.equal(normalizeRemoteReconciliationBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteReconciliationBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteReconciliationBaseUrl("bad"), "");
});

test("remote reconciliation client fetches operator reconciliation with API key", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    return jsonResponse([
      { alert_id: "alert-1", trade_id: "trade-1", position_id: "position-1", simulated: false, attention_reason: "" },
    ]);
  };

  const result = await fetchRemoteReconciliation({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
    fetchImpl,
    limit: 50,
    now: () => "2026-06-27T17:40:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0]?.url, "http://100.90.10.11:8001/api/operator/reconciliation?limit=50");
  assert.deepEqual(calls[0]?.headers, { "X-API-Key": "secret" });
  assert.equal(result.snapshot.checkedAt, "2026-06-27T17:40:00.000Z");
  assert.equal(result.snapshot.rows[0]?.alertId, "alert-1");
  assert.equal(result.snapshot.summary.allClear, true);
});

test("remote reconciliation client omits blank API key header", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse([]);
  };

  await fetchRemoteReconciliation({
    baseApiUrl: "http://127.0.0.1:8001",
    apiKey: "   ",
    fetchImpl,
  });

  assert.deepEqual(headers, {});
});

test("remote reconciliation client fails closed on HTTP and network errors", async () => {
  const httpResult = await fetchRemoteReconciliation({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
    now: () => "2026-06-27T17:40:00.000Z",
  });
  const networkResult = await fetchRemoteReconciliation({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
    now: () => "2026-06-27T17:40:00.000Z",
  });

  assert.equal(httpResult.ok, false);
  assert.equal(httpResult.snapshot.rows.length, 0);
  assert.equal(httpResult.snapshot.summary.allClear, false);
  assert.equal(httpResult.error, "HTTP 503");
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.error, "connection refused");
});
