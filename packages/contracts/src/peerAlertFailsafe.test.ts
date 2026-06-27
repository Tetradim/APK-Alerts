import assert from "node:assert/strict";
import test from "node:test";
import { createEvent } from "./events";
import { buildPhoneAlertPeerResponseEvent, evaluateAlertPeerResponse } from "./peerAlertFailsafe";

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

function response(overrides: Partial<ReturnType<typeof baseResponsePayload>> = {}) {
  return createEvent({
    id: `peer-response-${overrides.challengeId ?? "1"}`,
    type: "alert.peer.response.v1",
    sourceEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T18:00:03.000Z",
    sequence: 101,
    idempotencyKey: "peer-alert:response:challenge-1",
    payload: {
      ...baseResponsePayload(),
      ...overrides,
    },
  });
}

function baseResponsePayload() {
  return {
    challengeId: "challenge-1",
    leaseId: "lease-phone-1",
    responderEngineId: "phone:pixel-1" as const,
    respondedAt: "2026-06-27T18:00:03.000Z",
    phoneObservedAt: "2026-06-27T18:00:02.000Z",
    phoneReceivedAt: "2026-06-27T18:00:02.250Z",
    lastAlert: {
      eventId: "phone-alert-event-1",
      discordMessageId: "discord-message-1",
      channelId: "chrome-alerts",
      authorId: "mike",
      messageUrl: "https://discord.com/channels/server/chrome-alerts/discord-message-1",
      normalizedTextSha256: "hash-spy-500c",
      sourceKey: "chrome-alerts",
      parserConfidence: "high" as const,
      decisionStatus: "accepted" as const,
      queuedAlertId: "alert-1",
    },
  };
}

test("phone alert peer response builder echoes challenge identity and last alert copy", () => {
  const built = buildPhoneAlertPeerResponseEvent({
    challenge,
    responseEventId: "peer-response-built",
    responderEngineId: "phone:pixel-1",
    observedAt: "2026-06-27T18:00:03.000Z",
    sequence: 101,
    phoneObservedAt: "2026-06-27T18:00:02.000Z",
    phoneReceivedAt: "2026-06-27T18:00:02.250Z",
    respondedAt: "2026-06-27T18:00:03.000Z",
    lastAlert: baseResponsePayload().lastAlert,
  });

  assert.equal(built.id, "peer-response-built");
  assert.equal(built.type, "alert.peer.response.v1");
  assert.equal(built.sourceEngineId, "phone:pixel-1");
  assert.equal(built.idempotencyKey, "peer-alert:response:challenge-1");
  assert.equal(built.payload.challengeId, "challenge-1");
  assert.equal(built.payload.leaseId, "lease-phone-1");
  assert.equal(built.payload.responderEngineId, "phone:pixel-1");
  assert.equal(built.payload.lastAlert?.sourceKey, "chrome-alerts");
});

test("peer alert failsafe matches exact phone response within timestamp skew", () => {
  const match = evaluateAlertPeerResponse(challenge, response());

  assert.equal(match.status, "matched");
  assert.equal(match.blocking, false);
  assert.deepEqual(match.blockingCodes, []);
  assert.equal(match.skewMs, 2000);
  assert.equal(match.detailLabel, "Phone saw matching alert within 2000ms");
});

test("peer alert failsafe blocks when phone response is missing", () => {
  const missing = evaluateAlertPeerResponse(challenge, null);

  assert.equal(missing.status, "missing_response");
  assert.equal(missing.blocking, true);
  assert.deepEqual(missing.blockingCodes, ["peer_response_missing"]);
  assert.equal(missing.detailLabel, "Phone did not answer alert challenge challenge-1");
});

test("peer alert failsafe blocks invalid respondedAt proof", () => {
  const invalid = evaluateAlertPeerResponse(
    challenge,
    response({
      respondedAt: "not a timestamp",
    }),
  );

  assert.equal(invalid.status, "stale");
  assert.equal(invalid.blocking, true);
  assert.deepEqual(invalid.blockingCodes, ["responded_at_invalid"]);
});

test("peer alert failsafe blocks blank required identity proof", () => {
  const blankSourceChallenge = createEvent({
    ...challenge,
    id: "peer-challenge-blank-source",
    payload: {
      ...challenge.payload,
      sourceKey: "",
    },
  });
  const blank = evaluateAlertPeerResponse(
    blankSourceChallenge,
    response({
      lastAlert: {
        ...baseResponsePayload().lastAlert,
        sourceKey: "",
      },
    }),
  );

  assert.equal(blank.status, "mismatch");
  assert.equal(blank.blocking, true);
  assert.equal(blank.blockingCodes.includes("source_key_missing"), true);
});

test("peer alert failsafe blocks mismatched source and alert fingerprint", () => {
  const mismatch = evaluateAlertPeerResponse(
    challenge,
    response({
      lastAlert: {
        ...baseResponsePayload().lastAlert,
        normalizedTextSha256: "hash-qqq-400c",
        sourceKey: "unknown-source",
      },
    }),
  );

  assert.equal(mismatch.status, "mismatch");
  assert.equal(mismatch.blocking, true);
  assert.equal(mismatch.blockingCodes.includes("source_key_mismatch"), true);
  assert.equal(mismatch.blockingCodes.includes("normalized_text_hash_mismatch"), true);
});

test("peer alert failsafe blocks stale phone alert observation", () => {
  const stale = evaluateAlertPeerResponse(
    challenge,
    response({
      phoneObservedAt: "2026-06-27T17:59:48.000Z",
    }),
    { maxAlertSkewMs: 5000 },
  );

  assert.equal(stale.status, "stale");
  assert.equal(stale.blocking, true);
  assert.deepEqual(stale.blockingCodes, ["alert_timestamp_skew_exceeded"]);
  assert.equal(stale.skewMs, 12000);
});
