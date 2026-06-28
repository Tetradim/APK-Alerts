import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRemotePairingStatus,
  runRemotePairingDoctor,
  type FetchLike,
} from "./index.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

test("pairing client fetches public status through normalized API base URL", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    return jsonResponse({
      version: 1,
      server_time: "2026-06-27T18:00:00Z",
      api_auth_configured: true,
      api_key_required: true,
      remote_bind: { host: "0.0.0.0", port: 8003, remote_accessible: true },
      chrome_bridge_remote_enabled: true,
      required_endpoints: [],
      blocking_issues: [],
    });
  };

  const result = await fetchRemotePairingStatus({
    baseApiUrl: "http://100.90.10.11:8003",
    apiKey: "secret",
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status?.serverTime, "2026-06-27T18:00:00Z");
  assert.equal(calls[0]?.url, "http://100.90.10.11:8003/api/pairing/status");
  assert.deepEqual(calls[0]?.headers, { "X-API-Key": "secret" });
});

test("pairing doctor probes required endpoints and reports failures individually", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/pairing/status")) {
      return jsonResponse({
        version: 1,
        server_time: "2026-06-27T18:00:00Z",
        api_auth_configured: true,
        api_key_required: true,
        remote_bind: { host: "0.0.0.0", port: 8003, remote_accessible: true },
        chrome_bridge_remote_enabled: true,
        required_endpoints: [
          { key: "health", method: "GET", path: "/health", requires_api_key: false, label: "Health" },
          { key: "reconciliation", method: "GET", path: "/operator/reconciliation", requires_api_key: true, label: "Broker reconciliation" },
        ],
        blocking_issues: [],
      });
    }
    if (String(url).endsWith("/operator/reconciliation")) {
      return jsonResponse({ detail: "no" }, 503);
    }
    return jsonResponse({ ok: true });
  };

  const result = await runRemotePairingDoctor({
    baseApiUrl: "http://100.90.10.11:8003/api",
    apiKey: "secret",
    fetchImpl,
    now: () => "2026-06-27T18:02:00Z",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, [
    "http://100.90.10.11:8003/api/pairing/status",
    "http://100.90.10.11:8003/api/health",
    "http://100.90.10.11:8003/api/operator/reconciliation",
  ]);
  assert.equal(result.checks[0]?.ok, true);
  assert.equal(result.checks[1]?.ok, false);
  assert.match(result.checks[1]?.error ?? "", /HTTP 503/);
});

test("pairing doctor skips keyed endpoint probes when the phone has no key", async () => {
  const fetchImpl: FetchLike = async () =>
    jsonResponse({
      version: 1,
      server_time: "2026-06-27T18:00:00Z",
      api_auth_configured: true,
      api_key_required: true,
      remote_bind: { host: "0.0.0.0", port: 8003, remote_accessible: true },
      chrome_bridge_remote_enabled: true,
      required_endpoints: [
        { key: "health", method: "GET", path: "/health", requires_api_key: false, label: "Health" },
        { key: "status", method: "GET", path: "/status", requires_api_key: true, label: "Runtime status" },
      ],
      blocking_issues: [],
    });

  const result = await runRemotePairingDoctor({
    baseApiUrl: "http://100.90.10.11:8003/api",
    fetchImpl,
  });

  assert.equal(result.checks[1]?.skipped, true);
  assert.equal(result.checks[1]?.error, "API key required before probing this endpoint.");
});
