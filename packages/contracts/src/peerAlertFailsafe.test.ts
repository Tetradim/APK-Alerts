import assert from "node:assert/strict";
import test from "node:test";
import { createEvent, type AlertPeerChallengeEvent, type AlertPeerResponseEvent } from "./events";
import {
  buildPhoneAlertPeerResponseEvent,
  evaluateAlertPeerResponse,
  type AlertPeerFailsafeBlockingCode,
} from "./peerAlertFailsafe";

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

function response(
  overrides: Partial<AlertPeerResponseEvent["payload"]> = {},
  eventOverrides: Partial<Pick<AlertPeerResponseEvent, "sourceEngineId" | "observedAt">> = {},
) {
  return createEvent({
    id: `peer-response-${overrides.challengeId ?? "1"}`,
    type: "alert.peer.response.v1",
    sourceEngineId: eventOverrides.sourceEngineId ?? "phone:pixel-1",
    observedAt: eventOverrides.observedAt ?? "2026-06-27T18:00:03.000Z",
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

function challengeWith(overrides: Partial<AlertPeerChallengeEvent["payload"]>) {
  return createEvent({
    ...challenge,
    id: `peer-challenge-${overrides.challengeId ?? "override"}`,
    payload: {
      ...challenge.payload,
      ...overrides,
    },
  });
}

function assertBlocks(
  name: string,
  evaluation: ReturnType<typeof evaluateAlertPeerResponse>,
  code: AlertPeerFailsafeBlockingCode,
  status: "mismatch" | "stale" = "mismatch",
) {
  assert.equal(evaluation.status, status, name);
  assert.equal(evaluation.blocking, true, name);
  assert.equal(evaluation.blockingCodes.includes(code), true, name);
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

test("phone alert peer response builder rejects challenges addressed to another phone", () => {
  assert.throws(
    () =>
      buildPhoneAlertPeerResponseEvent({
        challenge,
        responseEventId: "peer-response-wrong-phone",
        responderEngineId: "phone:other",
        observedAt: "2026-06-27T18:00:03.000Z",
        sequence: 101,
        phoneObservedAt: "2026-06-27T18:00:02.000Z",
        phoneReceivedAt: "2026-06-27T18:00:02.250Z",
        respondedAt: "2026-06-27T18:00:03.000Z",
        lastAlert: baseResponsePayload().lastAlert,
      }),
    /Responder phone:other does not match challenge target phone:pixel-1/,
  );
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

test("peer alert failsafe covers challenge response envelope blockers", () => {
  const cases: Array<{
    name: string;
    evaluation: ReturnType<typeof evaluateAlertPeerResponse>;
    code: AlertPeerFailsafeBlockingCode;
  }> = [
    {
      name: "challenge id mismatch",
      evaluation: evaluateAlertPeerResponse(challenge, response({ challengeId: "challenge-2" })),
      code: "challenge_id_mismatch",
    },
    {
      name: "lease id mismatch",
      evaluation: evaluateAlertPeerResponse(challenge, response({ leaseId: "lease-remote-2" })),
      code: "lease_id_mismatch",
    },
    {
      name: "responder engine mismatch",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ responderEngineId: "phone:other" }, { sourceEngineId: "phone:other" }),
      ),
      code: "responder_engine_mismatch",
    },
    {
      name: "phone alert missing",
      evaluation: evaluateAlertPeerResponse(challenge, response({ lastAlert: null })),
      code: "phone_alert_missing",
    },
  ];

  for (const item of cases) {
    assertBlocks(item.name, item.evaluation, item.code);
  }
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

test("peer alert failsafe covers alert fingerprint blockers", () => {
  const baseAlert = baseResponsePayload().lastAlert;
  const cases: Array<{
    name: string;
    evaluation: ReturnType<typeof evaluateAlertPeerResponse>;
    code: AlertPeerFailsafeBlockingCode;
  }> = [
    {
      name: "discord message id mismatch",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ lastAlert: { ...baseAlert, discordMessageId: "discord-message-2" } }),
      ),
      code: "discord_message_id_mismatch",
    },
    {
      name: "channel id mismatch",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ lastAlert: { ...baseAlert, channelId: "other-alerts" } }),
      ),
      code: "channel_id_mismatch",
    },
    {
      name: "author id mismatch",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ lastAlert: { ...baseAlert, authorId: "other-author" } }),
      ),
      code: "author_id_mismatch",
    },
    {
      name: "message url mismatch",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ lastAlert: { ...baseAlert, messageUrl: "https://discord.com/channels/server/chrome-alerts/2" } }),
      ),
      code: "message_url_mismatch",
    },
  ];

  for (const item of cases) {
    assertBlocks(item.name, item.evaluation, item.code);
  }
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

test("peer alert failsafe ignores fractional max skew settings", () => {
  const stale = evaluateAlertPeerResponse(
    challenge,
    response({
      phoneObservedAt: "2026-06-27T18:00:12.000Z",
      phoneReceivedAt: "2026-06-27T18:00:12.250Z",
      respondedAt: "2026-06-27T18:00:13.000Z",
    }, { observedAt: "2026-06-27T18:00:13.000Z" }),
    { maxAlertSkewMs: 15000.5 },
  );

  assert.equal(stale.status, "stale");
  assert.equal(stale.blocking, true);
  assert.deepEqual(stale.blockingCodes, ["alert_timestamp_skew_exceeded"]);
  assert.equal(stale.skewMs, 12000);
});

test("peer alert failsafe covers timing blockers", () => {
  const cases: Array<{
    name: string;
    evaluation: ReturnType<typeof evaluateAlertPeerResponse>;
    code: AlertPeerFailsafeBlockingCode;
  }> = [
    {
      name: "remote observed at invalid",
      evaluation: evaluateAlertPeerResponse(challengeWith({ remoteObservedAt: "not a timestamp" }), response()),
      code: "remote_observed_at_invalid",
    },
    {
      name: "phone observed at invalid",
      evaluation: evaluateAlertPeerResponse(challenge, response({ phoneObservedAt: "not a timestamp" })),
      code: "phone_observed_at_invalid",
    },
    {
      name: "phone received at invalid",
      evaluation: evaluateAlertPeerResponse(challenge, response({ phoneReceivedAt: "not a timestamp" })),
      code: "phone_received_at_invalid",
    },
    {
      name: "response observed at invalid",
      evaluation: evaluateAlertPeerResponse(challenge, response({}, { observedAt: "not a timestamp" })),
      code: "response_observed_at_invalid",
    },
    {
      name: "phone received before observed",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ phoneReceivedAt: "2026-06-27T18:00:01.900Z" }),
      ),
      code: "phone_received_before_observed",
    },
    {
      name: "responded before received",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({ respondedAt: "2026-06-27T18:00:02.100Z" }),
      ),
      code: "responded_before_received",
    },
    {
      name: "response observed before responded",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({}, { observedAt: "2026-06-27T18:00:02.900Z" }),
      ),
      code: "response_observed_before_responded",
    },
    {
      name: "response observed before received",
      evaluation: evaluateAlertPeerResponse(
        challenge,
        response({}, { observedAt: "2026-06-27T18:00:02.100Z" }),
      ),
      code: "response_observed_before_received",
    },
  ];

  for (const item of cases) {
    assertBlocks(item.name, item.evaluation, item.code, "stale");
  }
});
