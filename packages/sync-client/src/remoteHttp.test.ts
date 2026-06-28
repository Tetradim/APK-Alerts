import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("remote JSON fetch sends API key and abort signal", async () => {
  let signalSeen = false;
  const fetchImpl: FetchLike = async (_url, init) => {
    signalSeen = init?.signal instanceof AbortSignal;
    return jsonResponse({ ok: true });
  };

  const payload = await fetchRemoteJson(fetchImpl, "http://100.90.10.11:8001/api/health", {
    apiKey: " secret ",
  });

  assert.deepEqual(payload, { ok: true });
  assert.equal(signalSeen, true);
});

test("remote JSON fetch fails with deterministic timeout error", async () => {
  const fetchImpl: FetchLike = async (_url, init) =>
    await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      assert.ok(signal instanceof AbortSignal);
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assert.rejects(
    () =>
      fetchRemoteJson(fetchImpl, "http://100.90.10.11:8001/api/health", {
        timeoutMs: 1,
      }),
    /Timed out after 1ms/,
  );
});

test("remote endpoint client normalizes API base URLs and fails closed", () => {
  const client = buildRemoteEndpointClient({
    baseApiUrl: "http://100.90.10.11:8001//",
    apiKey: " secret ",
    fetchImpl: async () => jsonResponse({ ok: true }),
    timeoutMs: 5_000,
  });
  const invalidClient = buildRemoteEndpointClient({
    baseApiUrl: "not a url",
  });

  assert.equal(normalizeRemoteApiBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
  assert.equal(client.ok, true);
  assert.equal(client.baseApiUrl, "http://100.90.10.11:8001/api");
  assert.equal(client.apiKey, "secret");
  assert.equal(client.timeoutMs, 5_000);
  assert.equal(invalidClient.ok, false);
  assert.equal(invalidClient.error, "Remote API URL is invalid.");
});
