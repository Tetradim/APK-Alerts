import assert from "node:assert/strict";
import test from "node:test";
import { createEvent } from "@apk-alerts/contracts";
import { PEER_ALERT_CHALLENGE_PATH } from "@apk-alerts/peer-alert-server";
import { createMobilePeerAlertChallengeHandler } from "./peerAlertChallengeBridge.js";
import {
  buildPeerAlertOutcomeSummary,
  createPeerAlertFailsafeStore,
} from "./peerAlertFailsafeState.js";

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

test("mobile peer alert challenge handler records endpoint outcome into UI state", async () => {
  const store = createPeerAlertFailsafeStore();
  const handler = createMobilePeerAlertChallengeHandler({
    phoneEngineId: "phone:pixel-1",
    apiKey: "expected-secret",
    store,
    now: () => "2026-06-27T18:00:03.000Z",
    getLastAlert: () => ({
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
    }),
  });

  const result = await handler({
    method: "POST",
    path: PEER_ALERT_CHALLENGE_PATH,
    headers: { "X-API-Key": "expected-secret" },
    body: challenge,
  });

  assert.equal(result.status, 200);
  assert.equal(store.getState().snapshot.latestOutcome?.evaluation.status, "matched");
  assert.equal(buildPeerAlertOutcomeSummary(store.getState().snapshot).gateLabel, "Peer check clear");
});

test("mobile peer alert challenge handler leaves UI state empty when auth fails", async () => {
  const store = createPeerAlertFailsafeStore();
  const handler = createMobilePeerAlertChallengeHandler({
    phoneEngineId: "phone:pixel-1",
    apiKey: "expected-secret",
    store,
    getLastAlert: () => null,
  });

  const result = await handler({
    method: "POST",
    path: PEER_ALERT_CHALLENGE_PATH,
    headers: { "X-API-Key": "wrong-secret" },
    body: challenge,
  });

  assert.equal(result.status, 401);
  assert.equal(store.getState().snapshot.latestOutcome, null);
  assert.equal(buildPeerAlertOutcomeSummary(store.getState().snapshot).gateLabel, "Blocks live");
});
