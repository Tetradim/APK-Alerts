import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRemoteEngineHealth,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./index.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("remote API URL normalization accepts root or api URLs", () => {
  assert.equal(normalizeRemoteApiBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteApiBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
});

test("remote API URL normalization rejects invalid URLs", () => {
  assert.equal(normalizeRemoteApiBaseUrl(""), "");
  assert.equal(normalizeRemoteApiBaseUrl("not a url"), "");
});

test("remote client fetches health and status with optional API key", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    return calls.length === 1
      ? jsonResponse({ status: "healthy", discord_connected: true, broker_connected: true })
      : jsonResponse({
          active_broker: "ibkr",
          auto_trading_enabled: true,
          simulation_mode: false,
          shutdown_triggered: false,
          alerts_processed: 4,
        });
  };

  const result = await checkRemoteEngineHealth({
    baseApiUrl: "http://100.90.10.11:8001",
    apiKey: "secret",
    fetchImpl,
    now: () => "2026-06-27T15:30:00Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.snapshot?.engineHealth, "healthy");
  assert.equal(result.snapshot?.checkedAt, "2026-06-27T15:30:00Z");
  assert.equal(calls[0]?.url, "http://100.90.10.11:8001/api/health");
  assert.equal(calls[1]?.url, "http://100.90.10.11:8001/api/status");
  assert.deepEqual(calls[0]?.headers, { "X-API-Key": "secret" });
});

test("remote client does not send a blank API key header", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse({});
  };

  await checkRemoteEngineHealth({ baseApiUrl: "http://127.0.0.1:8001/api", fetchImpl });

  assert.deepEqual(headers, {});
});

test("remote client returns offline failure for HTTP and network failures", async () => {
  const httpFailure = await checkRemoteEngineHealth({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
  });
  const networkFailure = await checkRemoteEngineHealth({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(httpFailure.ok, false);
  assert.equal(httpFailure.snapshot?.engineHealth, "offline");
  assert.match(httpFailure.error, /HTTP 503/);
  assert.equal(networkFailure.ok, false);
  assert.equal(networkFailure.snapshot?.engineHealth, "offline");
  assert.match(networkFailure.error, /network down/);
});
