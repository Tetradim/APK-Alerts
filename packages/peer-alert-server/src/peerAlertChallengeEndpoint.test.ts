import assert from "node:assert/strict";
import test from "node:test";
import { createEvent, type AlertPeerChallengeEvent } from "@apk-alerts/contracts";
import {
  handlePeerAlertChallengeFetchRequest,
  handlePeerAlertChallengeRequest,
  PEER_ALERT_CHALLENGE_PATH,
  type PeerAlertChallengeEndpointConfig,
  type PeerAlertChallengeEndpointOutcome,
  type PeerAlertPhoneAlertSnapshot,
} from "./peerAlertChallengeEndpoint";

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

const lastAlert: PeerAlertPhoneAlertSnapshot = {
  observedAt: "2026-06-27T18:00:02.000Z",
  receivedAt: "2026-06-27T18:00:02.250Z",
  fingerprint: {
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
};

function endpointConfig(overrides: Partial<{
  phoneEngineId: "phone:pixel-1" | "phone:other";
  getLastAlert: () => PeerAlertPhoneAlertSnapshot | null;
  recordOutcome: (outcome: PeerAlertChallengeEndpointOutcome) => void;
}> = {}) {
  let sequence = 100;
  const config: PeerAlertChallengeEndpointConfig = {
    phoneEngineId: overrides.phoneEngineId ?? "phone:pixel-1",
    now: () => "2026-06-27T18:00:03.000Z",
    nextResponseEventId: (event: AlertPeerChallengeEvent) => `peer-response:${event.payload.challengeId}`,
    nextSequence: () => {
      sequence += 1;
      return sequence;
    },
    getLastAlert: overrides.getLastAlert ?? (() => lastAlert),
  };
  if (overrides.recordOutcome) {
    config.recordOutcome = overrides.recordOutcome;
  }
  return config;
}

test("peer alert challenge endpoint returns response evaluation and records latest outcome", async () => {
  const recorded: PeerAlertChallengeEndpointOutcome[] = [];
  const result = await handlePeerAlertChallengeRequest(
    endpointConfig({ recordOutcome: (outcome) => recorded.push(outcome) }),
    {
      method: "POST",
      path: PEER_ALERT_CHALLENGE_PATH,
      body: challenge,
    },
  );

  assert.equal(result.status, 200);
  assert.ok(result.body.evaluation);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.checkedAt, "2026-06-27T18:00:03.000Z");
  assert.equal(result.body.response?.id, "peer-response:challenge-1");
  assert.equal(result.body.response?.payload.lastAlert?.eventId, "phone-alert-event-1");
  assert.equal(result.body.evaluation.status, "matched");
  assert.equal(result.body.evaluation.blocking, false);
  assert.equal(result.body.evaluation.skewMs, 2000);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.challenge.payload.challengeId, "challenge-1");
  assert.equal(recorded[0]?.response?.payload.lastAlert?.queuedAlertId, "alert-1");
  assert.equal(recorded[0]?.evaluation.status, "matched");
});

test("peer alert challenge fetch endpoint reads JSON request and returns standard JSON response", async () => {
  const response = await handlePeerAlertChallengeFetchRequest(
    endpointConfig(),
    new Request(`http://phone.local${PEER_ALERT_CHALLENGE_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(challenge),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.response.id, "peer-response:challenge-1");
  assert.equal(body.evaluation.status, "matched");
});

test("peer alert challenge endpoint rejects route method and invalid challenge without recording outcome", async () => {
  const recorded: PeerAlertChallengeEndpointOutcome[] = [];
  const config = endpointConfig({ recordOutcome: (outcome) => recorded.push(outcome) });

  const missingRoute = await handlePeerAlertChallengeRequest(config, {
    method: "POST",
    path: "/api/not-peer-alert",
    body: challenge,
  });
  const wrongMethod = await handlePeerAlertChallengeRequest(config, {
    method: "GET",
    path: PEER_ALERT_CHALLENGE_PATH,
    body: challenge,
  });
  const invalidChallenge = await handlePeerAlertChallengeRequest(config, {
    method: "POST",
    path: PEER_ALERT_CHALLENGE_PATH,
    body: { type: "alert.peer.challenge.v1", payload: {} },
  });

  assert.equal(missingRoute.status, 404);
  assert.equal(missingRoute.body.error, "Peer alert endpoint not found.");
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.body.error, "Peer alert endpoint requires POST.");
  assert.equal(invalidChallenge.status, 400);
  assert.equal(invalidChallenge.body.error, "Peer alert challenge payload invalid.");
  assert.equal(recorded.length, 0);
});

test("peer alert challenge endpoint responds fail-closed when phone has no alert copy", async () => {
  const result = await handlePeerAlertChallengeRequest(
    endpointConfig({ getLastAlert: () => null }),
    {
      method: "POST",
      path: PEER_ALERT_CHALLENGE_PATH,
      body: challenge,
    },
  );

  assert.equal(result.status, 200);
  assert.ok(result.body.evaluation);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.response?.payload.lastAlert, null);
  assert.equal(result.body.evaluation.status, "mismatch");
  assert.deepEqual(result.body.evaluation.blockingCodes, ["phone_alert_missing"]);
});

test("peer alert challenge endpoint rejects challenges addressed to another phone", async () => {
  const result = await handlePeerAlertChallengeRequest(
    endpointConfig({ phoneEngineId: "phone:other" }),
    {
      method: "POST",
      path: PEER_ALERT_CHALLENGE_PATH,
      body: challenge,
    },
  );

  assert.equal(result.status, 409);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.response, null);
  assert.equal(result.body.evaluation, null);
  assert.equal(result.body.error, "Peer alert challenge targets phone:pixel-1, not phone:other.");
});
