import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRemoteLiveReadiness,
  normalizeRemoteLiveReadinessBaseUrl,
  type FetchLike,
} from "./remoteLiveReadinessClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const readyPayload = {
  ready_for_live: false,
  blocking_issues: [{ code: "simulation_mode_enabled", message: "Simulation mode must be disabled before live trading." }],
  blocking_codes: ["simulation_mode_enabled"],
  warnings: [],
  checks: {
    credential_key: { configured: true, valid: true },
    broker: { active_broker: "alpaca", configured: true, connected: true, capabilities: {} },
    source_policy: { valid: true, auto_live_sources: 1 },
    signal_ingestion: { chrome_bridge_healthy: true },
    runtime: { live_trading_armed: false },
    simulation_replay: { acceptance_status: "not_provided" },
    exit_automation: { oco_exits_configured: false },
  },
};

test("remote live-readiness API URL normalization accepts root or api URLs", () => {
  assert.equal(normalizeRemoteLiveReadinessBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteLiveReadinessBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteLiveReadinessBaseUrl("not a url"), "");
});

test("remote live-readiness client fetches operator endpoint with API key", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    return jsonResponse(readyPayload);
  };

  const result = await fetchRemoteLiveReadiness({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
    fetchImpl,
    now: () => "2026-06-27T17:20:00.000Z",
  });

  assert.equal(result.ok, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://100.90.10.11:8001/api/operator/live-readiness");
  assert.deepEqual(calls[0]?.headers, { "X-API-Key": "secret" });
  assert.equal(result.snapshot.checkedAt, "2026-06-27T17:20:00.000Z");
  assert.equal(result.snapshot.readiness.blockingCodes[0], "simulation_mode_enabled");
});

test("remote live-readiness client omits blank API key header", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse(readyPayload);
  };

  await fetchRemoteLiveReadiness({
    baseApiUrl: "http://127.0.0.1:8001",
    apiKey: "   ",
    fetchImpl,
  });

  assert.deepEqual(headers, {});
});

test("remote live-readiness client fails closed on HTTP and network errors", async () => {
  const httpResult = await fetchRemoteLiveReadiness({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
    now: () => "2026-06-27T17:20:00.000Z",
  });
  const networkResult = await fetchRemoteLiveReadiness({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
    now: () => "2026-06-27T17:20:00.000Z",
  });

  assert.equal(httpResult.ok, false);
  assert.equal(httpResult.snapshot.readiness.blockingCodes[0], "readiness_payload_invalid");
  assert.equal(httpResult.error, "HTTP 503");
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.error, "connection refused");
});
