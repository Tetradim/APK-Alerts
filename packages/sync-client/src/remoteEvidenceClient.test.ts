import assert from "node:assert/strict";
import test from "node:test";
import { CHROME_DISCORD_MESSAGE_CONTRACT_VERSION } from "@apk-alerts/contracts";
import {
  fetchRemoteAlertEvidence,
  normalizeRemoteEvidenceBaseUrl,
  type FetchLike,
} from "./remoteEvidenceClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const signalEvent = {
  event_id: "bus-1",
  event_type: "signal.observed",
  source_bot: "chrome-discord-bridge",
  created_at: "2026-06-27T17:00:00.000Z",
  correlation_id: "chrome-message-1",
  payload: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    channel_id: "chrome-alerts",
    channel_name: "chrome-alerts",
    author_id: "mike",
    author_name: "MikeInvesting",
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    parser_metadata: { confidence: "high" },
    ingestion_result: {
      status: "accepted",
      alert_inserted: true,
      alert_id: "alert-1",
      trade_requested: false,
      trade_request_reason: "auto trading disabled",
      skip_reason: "",
    },
  },
};

const leaseEvent = {
  event_id: "lease-event-1",
  event_type: "lease.acquired.v1",
  source_engine_id: "remote:windows-pc",
  observed_at: "2026-06-27T17:00:00.500Z",
  sequence: 10,
  payload: {
    lease_id: "lease-remote-1",
    holder_engine_id: "remote:windows-pc",
    expires_at: "2026-06-27T17:05:00.000Z",
    reason: "remote owns lease",
  },
};

const auditEvent = {
  id: "audit-1",
  category: "alert_ingestion",
  action: "bridge_alert_decision",
  summary: "Chrome bridge alert accepted.",
  severity: "info",
  created_at: "2026-06-27T17:00:01.000Z",
  details: {
    contract_version: CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
    event_id: "chrome-message-1",
    channel: { id: "chrome-alerts", name: "chrome-alerts" },
    author: { id: "mike", name: "MikeInvesting" },
    bridge_target: { id: "consolidation", name: "Consolidation" },
    raw_text: "BTO SPY 500C 6/21 @ 1.25",
    parser: { confidence: "high" },
    source: {
      override_matched: true,
      min_parser_confidence: "medium",
      observed_parser_confidence: "high",
      parser_confidence_allowed: true,
      channel_url_allowed: true,
      author_id_allowed: true,
      metadata_policy_passed: true,
    },
    decision: {
      status: "accepted",
      alert_inserted: true,
      alert_id: "alert-1",
      trade_requested: false,
      trade_request_reason: "auto trading disabled",
      skip_reason: "",
    },
  },
};

test("remote evidence API URL normalization accepts root or api URLs", () => {
  assert.equal(normalizeRemoteEvidenceBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteEvidenceBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
  assert.equal(normalizeRemoteEvidenceBaseUrl("not a url"), "");
});

test("remote evidence client fetches bus events, operator events, and bridge health with API key", async () => {
  const calls: Array<{ url: string; headers: HeadersInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    if (String(url).endsWith("/bus/events?limit=50")) {
      return jsonResponse({ events: [leaseEvent, signalEvent] });
    }
    if (String(url).endsWith("/operator/events?limit=50")) {
      return jsonResponse([auditEvent]);
    }
    if (String(url).endsWith("/discord/chrome-bridge/health")) {
      return jsonResponse({ healthy: true, status: "healthy", issues: [], last_heartbeat: { bridge_enabled: true } });
    }
    return jsonResponse({ detail: "missing" }, 404);
  };

  const result = await fetchRemoteAlertEvidence({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
    fetchImpl,
    limit: 50,
    now: () => "2026-06-27T17:02:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.url, "http://100.90.10.11:8001/api/bus/events?limit=50");
  assert.deepEqual(calls[0]?.headers, { "X-API-Key": "secret" });
  assert.equal(result.snapshot.checkedAt, "2026-06-27T17:02:00.000Z");
  assert.equal(result.snapshot.signals.length, 1);
  assert.equal(result.snapshot.leaseEvidence.holder, "remote");
  assert.equal(result.snapshot.leaseEvidence.leaseId, "lease-remote-1");
  assert.equal(result.snapshot.leaseEvidence.usable, true);
  assert.equal(result.snapshot.decisions.length, 1);
  assert.equal(result.snapshot.chains[0]?.eventId, "chrome-message-1");
});

test("remote evidence client omits blank API key header", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse({ events: [] });
  };

  await fetchRemoteAlertEvidence({
    baseApiUrl: "http://127.0.0.1:8001",
    apiKey: "   ",
    fetchImpl,
  });

  assert.deepEqual(headers, {});
});

test("remote evidence client fails closed for HTTP and network failures", async () => {
  const httpResult = await fetchRemoteAlertEvidence({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
    now: () => "2026-06-27T17:02:00.000Z",
  });
  const networkResult = await fetchRemoteAlertEvidence({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
    now: () => "2026-06-27T17:02:00.000Z",
  });

  assert.equal(httpResult.ok, false);
  assert.equal(httpResult.snapshot.chains.length, 0);
  assert.equal(httpResult.snapshot.bridgeHealth.healthy, false);
  assert.equal(httpResult.error, "HTTP 503");
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.error, "connection refused");
});
