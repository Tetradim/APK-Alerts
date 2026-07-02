import assert from "node:assert/strict";
import test from "node:test";
import { buildPhoneAlertPeerResponseEvent, createEvent } from "@sentinel-nexus/contracts";
import {
  normalizePeerAlertFailsafeBaseUrl,
  requestPhoneAlertPeerResponse,
  type FetchLike,
} from "./peerAlertFailsafeClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const challenge = createEvent({
  id: "peer-challenge-1",
  type: "alert.peer.challenge.v1",
  sourceEngineId: "remote:windows-pc",
  observedAt: "2026-06-27T18:00:00.000Z",
  sequence: 100,
  idempotencyKey: "peer-alert:challenge:discord-message-1",
  payload: {
    challengeId: "challenge-1",
    targetEngineId: "phone:pixel-1",
    leaseId: "lease-phone-1",
    remoteObservedAt: "2026-06-27T18:00:00.000Z",
    discordMessageId: "discord-message-1",
    channelId: "chrome-alerts",
    authorId: "mike",
    messageUrl: "https://discord.com/channels/server/chrome-alerts/discord-message-1",
    normalizedTextSha256: "hash-spy-500c",
    sourceKey: "chrome-alerts",
  },
});

const phoneResponse = buildPhoneAlertPeerResponseEvent({
  challenge,
  responseEventId: "peer-response-1",
  responderEngineId: "phone:pixel-1",
  observedAt: "2026-06-27T18:00:03.000Z",
  sequence: 101,
  phoneObservedAt: "2026-06-27T18:00:02.000Z",
  phoneReceivedAt: "2026-06-27T18:00:02.250Z",
  respondedAt: "2026-06-27T18:00:03.000Z",
  lastAlert: {
    eventId: "phone-alert-event-1",
    discordMessageId: "discord-message-1",
    channelId: "chrome-alerts",
    authorId: "mike",
    messageUrl: "https://discord.com/channels/server/chrome-alerts/discord-message-1",
    normalizedTextSha256: "hash-spy-500c",
    sourceKey: "chrome-alerts",
    parserConfidence: "high",
    decisionStatus: "accepted",
    queuedAlertId: "alert-1",
  },
});

test("peer alert failsafe API URL normalization accepts root or api URLs", () => {
  assert.equal(normalizePeerAlertFailsafeBaseUrl("http://100.90.10.11:8001"), "http://100.90.10.11:8001/api");
  assert.equal(normalizePeerAlertFailsafeBaseUrl("http://100.90.10.11:8001/api/"), "http://100.90.10.11:8001/api");
  assert.equal(normalizePeerAlertFailsafeBaseUrl("not a url"), "");
});

test("remote peer alert client posts challenge and evaluates phone response", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ response: phoneResponse });
  };

  const result = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://100.90.10.11:8001/api",
    apiKey: "secret",
    fetchImpl,
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);

  assert.equal(result.ok, true);
  assert.equal(result.checkedAt, "2026-06-27T18:00:04.000Z");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://100.90.10.11:8001/api/peer-alert/challenges");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(calls[0]?.init?.headers, {
    "Content-Type": "application/json",
    "X-API-Key": "secret",
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), challenge);
  assert.equal(result.response?.id, "peer-response-1");
  assert.equal(result.evaluation.status, "matched");
  assert.equal(result.evaluation.blocking, false);
});

test("remote peer alert client accepts raw response event and omits blank API key", async () => {
  let headers: HeadersInit | undefined;
  const fetchImpl: FetchLike = async (_url, init) => {
    headers = init?.headers;
    return jsonResponse(phoneResponse);
  };

  const result = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001",
    apiKey: "   ",
    fetchImpl,
  }, challenge);

  assert.deepEqual(headers, { "Content-Type": "application/json" });
  assert.equal(result.ok, true);
  assert.equal(result.evaluation.status, "matched");
});

test("remote peer alert client returns evaluated mismatch for valid blocked phone response", async () => {
  const blockedResponse = createEvent({
    id: "peer-response-blocked",
    type: "alert.peer.response.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T18:00:03.000Z",
    sequence: 102,
    idempotencyKey: "peer-alert:response:challenge-1",
    payload: {
      ...phoneResponse.payload,
      lastAlert: {
        ...phoneResponse.payload.lastAlert!,
        sourceKey: "other-alerts",
      },
    },
  });
  const result = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ response: blockedResponse }),
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);

  assert.equal(result.ok, false);
  assert.equal(result.error, "");
  assert.equal(result.response?.id, "peer-response-blocked");
  assert.equal(result.evaluation.status, "mismatch");
  assert.equal(result.evaluation.blockingCodes.includes("source_key_mismatch"), true);
});

test("remote peer alert client rejects fractional response sequence", async () => {
  const fractionalSequenceResponse = {
    ...phoneResponse,
    sequence: 101.5,
  };
  const result = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ response: fractionalSequenceResponse }),
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);

  assert.equal(result.ok, false);
  assert.equal(result.error, "Peer alert response payload invalid.");
  assert.equal(result.response, null);
  assert.equal(result.evaluation.status, "missing_response");
});

test("remote peer alert client fails closed for HTTP network and invalid response payloads", async () => {
  const httpResult = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ detail: "no" }, 503),
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);
  const networkResult = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);
  const invalidResult = await requestPhoneAlertPeerResponse({
    baseApiUrl: "http://127.0.0.1:8001/api",
    fetchImpl: async () => jsonResponse({ response: { type: "wrong" } }),
    now: () => "2026-06-27T18:00:04.000Z",
  }, challenge);

  assert.equal(httpResult.ok, false);
  assert.equal(httpResult.error, "HTTP 503");
  assert.equal(httpResult.evaluation.status, "missing_response");
  assert.equal(networkResult.ok, false);
  assert.equal(networkResult.error, "connection refused");
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error, "Peer alert response payload invalid.");
  assert.equal(invalidResult.evaluation.blocking, true);
});
