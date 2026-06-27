import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhoneAlertPeerResponseEvent,
  createEvent,
  evaluateAlertPeerResponse,
} from "@apk-alerts/contracts";
import {
  buildPeerAlertOutcomeSummary,
  createPeerAlertFailsafeStore,
  getDefaultPeerAlertFailsafeSnapshot,
  type PeerAlertChallengeOutcome,
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

const response = buildPhoneAlertPeerResponseEvent({
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

const matchedOutcome: PeerAlertChallengeOutcome = {
  ok: true,
  checkedAt: "2026-06-27T18:00:04.000Z",
  challenge,
  response,
  evaluation: evaluateAlertPeerResponse(challenge, response),
  error: "",
};

test("default peer alert outcome summary fails closed without evidence", () => {
  const summary = buildPeerAlertOutcomeSummary(getDefaultPeerAlertFailsafeSnapshot());

  assert.equal(summary.statusLabel, "No peer challenge evidence");
  assert.equal(summary.gateLabel, "Blocks live");
  assert.equal(summary.detailLabel, "Remote has not challenged Phone alert visibility.");
  assert.equal(summary.blockerLabel, "Peer challenge missing");
  assert.equal(summary.blocking, true);
});

test("matched peer alert outcome summary exposes audit evidence", () => {
  const summary = buildPeerAlertOutcomeSummary({ latestOutcome: matchedOutcome });

  assert.equal(summary.statusLabel, "Matched peer alert");
  assert.equal(summary.gateLabel, "Peer check clear");
  assert.equal(summary.sourceLabel, "chrome-alerts - discord-message-1");
  assert.equal(summary.timingLabel, "Skew 2000ms; checked 2026-06-27T18:00:04.000Z");
  assert.equal(summary.responseLabel, "Response peer-response-1 from phone:pixel-1");
  assert.equal(summary.blockerLabel, "No peer blockers");
  assert.equal(summary.blocking, false);
});

test("missing peer response summary exposes fail-closed blocker evidence", () => {
  const missingOutcome: PeerAlertChallengeOutcome = {
    ok: false,
    checkedAt: "2026-06-27T18:00:04.000Z",
    challenge,
    response: null,
    evaluation: evaluateAlertPeerResponse(challenge, null),
    error: "HTTP 504",
  };
  const summary = buildPeerAlertOutcomeSummary({ latestOutcome: missingOutcome });

  assert.equal(summary.statusLabel, "Missing peer response");
  assert.equal(summary.gateLabel, "Peer check blocked");
  assert.equal(summary.detailLabel, "Phone did not answer alert challenge challenge-1");
  assert.equal(summary.blockerLabel, "peer_response_missing");
  assert.equal(summary.responseLabel, "No peer response event");
  assert.equal(summary.errorLabel, "HTTP 504");
  assert.equal(summary.blocking, true);
});

test("peer alert failsafe store records and clears latest outcome", () => {
  const store = createPeerAlertFailsafeStore();

  store.getState().recordOutcome(matchedOutcome);
  assert.equal(store.getState().snapshot.latestOutcome?.evaluation.status, "matched");
  assert.equal(buildPeerAlertOutcomeSummary(store.getState().snapshot).gateLabel, "Peer check clear");

  store.getState().clearOutcome();
  assert.equal(store.getState().snapshot.latestOutcome, null);
  assert.equal(buildPeerAlertOutcomeSummary(store.getState().snapshot).gateLabel, "Blocks live");
});
