import { createEvent, type AlertPeerChallengeEvent, type AlertPeerResponseEvent, type EngineId, type PeerAlertFingerprint } from "./events";

export type AlertPeerFailsafeStatus = "matched" | "missing_response" | "mismatch" | "stale";

export type AlertPeerFailsafeBlockingCode =
  | "peer_response_missing"
  | "challenge_id_missing"
  | "challenge_id_mismatch"
  | "lease_id_missing"
  | "lease_id_mismatch"
  | "target_engine_id_missing"
  | "responder_engine_mismatch"
  | "phone_alert_missing"
  | "phone_alert_event_id_missing"
  | "discord_message_id_missing"
  | "discord_message_id_mismatch"
  | "channel_id_missing"
  | "channel_id_mismatch"
  | "author_id_mismatch"
  | "source_key_missing"
  | "source_key_mismatch"
  | "normalized_text_hash_missing"
  | "normalized_text_hash_mismatch"
  | "message_url_mismatch"
  | "remote_observed_at_invalid"
  | "phone_observed_at_invalid"
  | "phone_received_at_invalid"
  | "phone_received_before_observed"
  | "responded_at_invalid"
  | "responded_before_received"
  | "response_observed_at_invalid"
  | "response_observed_before_responded"
  | "response_observed_before_received"
  | "alert_timestamp_skew_exceeded";

export interface AlertPeerFailsafeEvaluation {
  status: AlertPeerFailsafeStatus;
  blocking: boolean;
  blockingCodes: AlertPeerFailsafeBlockingCode[];
  challengeId: string;
  remoteEngineId: string;
  targetEngineId: string;
  responderEngineId: string;
  discordMessageId: string;
  sourceKey: string;
  skewMs: number | null;
  detailLabel: string;
}

export interface AlertPeerFailsafeOptions {
  maxAlertSkewMs?: number;
}

export interface BuildPhoneAlertPeerResponseEventInput {
  challenge: AlertPeerChallengeEvent;
  responseEventId: string;
  responderEngineId: EngineId;
  observedAt: string;
  sequence: number;
  previousEventId?: string | null;
  phoneObservedAt: string;
  phoneReceivedAt: string;
  respondedAt: string;
  lastAlert: PeerAlertFingerprint | null;
}

const DEFAULT_MAX_ALERT_SKEW_MS = 10_000;

interface PeerTimingProof {
  skewMs: number | null;
}

export function buildPhoneAlertPeerResponseEvent(
  input: BuildPhoneAlertPeerResponseEventInput,
): AlertPeerResponseEvent {
  if (input.responderEngineId !== input.challenge.payload.targetEngineId) {
    throw new Error(
      `Responder ${input.responderEngineId} does not match challenge target ${input.challenge.payload.targetEngineId}`,
    );
  }

  return createEvent({
    id: input.responseEventId,
    type: "alert.peer.response.v1",
    sourceEngineId: input.responderEngineId,
    observedAt: input.observedAt,
    sequence: input.sequence,
    previousEventId: input.previousEventId ?? null,
    idempotencyKey: `peer-alert:response:${input.challenge.payload.challengeId}`,
    payload: {
      challengeId: input.challenge.payload.challengeId,
      leaseId: input.challenge.payload.leaseId,
      responderEngineId: input.responderEngineId,
      respondedAt: input.respondedAt,
      phoneObservedAt: input.phoneObservedAt,
      phoneReceivedAt: input.phoneReceivedAt,
      lastAlert: input.lastAlert,
    },
  });
}

export function evaluateAlertPeerResponse(
  challenge: AlertPeerChallengeEvent,
  response: AlertPeerResponseEvent | null | undefined,
  options: AlertPeerFailsafeOptions = {},
): AlertPeerFailsafeEvaluation {
  const maxAlertSkewMs = normalizeMaxSkew(options.maxAlertSkewMs);
  const challengePayload = challenge.payload;

  if (!response) {
    return {
      status: "missing_response",
      blocking: true,
      blockingCodes: ["peer_response_missing"],
      challengeId: challengePayload.challengeId,
      remoteEngineId: challenge.sourceEngineId,
      targetEngineId: challengePayload.targetEngineId,
      responderEngineId: "",
      discordMessageId: challengePayload.discordMessageId,
      sourceKey: challengePayload.sourceKey,
      skewMs: null,
      detailLabel: `Phone did not answer alert challenge ${challengePayload.challengeId}`,
    };
  }

  const responsePayload = response.payload;
  const blockingCodes: AlertPeerFailsafeBlockingCode[] = [];

  validatePeerEnvelope(blockingCodes, challenge, response);
  validateAlertFingerprint(blockingCodes, challengePayload, responsePayload.lastAlert);
  const timing = validatePeerTiming(blockingCodes, challenge, response, maxAlertSkewMs);

  const status = classifyPeerStatus(blockingCodes);
  return {
    status,
    blocking: blockingCodes.length > 0,
    blockingCodes,
    challengeId: challengePayload.challengeId,
    remoteEngineId: challenge.sourceEngineId,
    targetEngineId: challengePayload.targetEngineId,
    responderEngineId: response.sourceEngineId,
    discordMessageId: challengePayload.discordMessageId,
    sourceKey: challengePayload.sourceKey,
    skewMs: timing.skewMs,
    detailLabel: buildDetailLabel(status, challengePayload.challengeId, timing.skewMs),
  };
}

function validatePeerEnvelope(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  challenge: AlertPeerChallengeEvent,
  response: AlertPeerResponseEvent,
): void {
  const challengePayload = challenge.payload;
  const responsePayload = response.payload;

  validateRequiredChallengeFields(blockingCodes, challengePayload);
  addIf(blockingCodes, responsePayload.challengeId !== challengePayload.challengeId, "challenge_id_mismatch");
  addIf(blockingCodes, responsePayload.leaseId !== challengePayload.leaseId, "lease_id_mismatch");
  addIf(
    blockingCodes,
    response.sourceEngineId !== challengePayload.targetEngineId ||
      responsePayload.responderEngineId !== challengePayload.targetEngineId,
    "responder_engine_mismatch",
  );
}

function validateAlertFingerprint(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  challenge: AlertPeerChallengeEvent["payload"],
  phoneAlert: PeerAlertFingerprint | null,
): void {
  if (!phoneAlert) {
    blockingCodes.push("phone_alert_missing");
    return;
  }

  validateRequiredPhoneAlertFields(blockingCodes, phoneAlert);
  compareAlertFingerprint(blockingCodes, challenge, phoneAlert);
}

function validatePeerTiming(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  challenge: AlertPeerChallengeEvent,
  response: AlertPeerResponseEvent,
  maxAlertSkewMs: number,
): PeerTimingProof {
  const challengePayload = challenge.payload;
  const responsePayload = response.payload;
  const remoteObservedAtMs = parseTimestamp(challengePayload.remoteObservedAt);
  const phoneObservedAtMs = parseTimestamp(responsePayload.phoneObservedAt);
  const phoneReceivedAtMs = parseTimestamp(responsePayload.phoneReceivedAt);
  const respondedAtMs = parseTimestamp(responsePayload.respondedAt);
  const responseObservedAtMs = parseTimestamp(response.observedAt);
  const skewMs = remoteObservedAtMs !== null && phoneObservedAtMs !== null
    ? Math.abs(phoneObservedAtMs - remoteObservedAtMs)
    : null;

  addIf(blockingCodes, remoteObservedAtMs === null, "remote_observed_at_invalid");
  addIf(blockingCodes, phoneObservedAtMs === null, "phone_observed_at_invalid");
  addIf(blockingCodes, phoneReceivedAtMs === null, "phone_received_at_invalid");
  addIf(blockingCodes, respondedAtMs === null, "responded_at_invalid");
  addIf(blockingCodes, responseObservedAtMs === null, "response_observed_at_invalid");
  addIf(
    blockingCodes,
    phoneObservedAtMs !== null && phoneReceivedAtMs !== null && phoneReceivedAtMs < phoneObservedAtMs,
    "phone_received_before_observed",
  );
  addIf(
    blockingCodes,
    phoneReceivedAtMs !== null && respondedAtMs !== null && respondedAtMs < phoneReceivedAtMs,
    "responded_before_received",
  );
  addIf(
    blockingCodes,
    respondedAtMs !== null && responseObservedAtMs !== null && responseObservedAtMs < respondedAtMs,
    "response_observed_before_responded",
  );
  addIf(
    blockingCodes,
    phoneReceivedAtMs !== null && responseObservedAtMs !== null && responseObservedAtMs < phoneReceivedAtMs,
    "response_observed_before_received",
  );
  addIf(
    blockingCodes,
    skewMs !== null && skewMs > maxAlertSkewMs,
    "alert_timestamp_skew_exceeded",
  );

  return { skewMs };
}

function validateRequiredChallengeFields(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  challenge: AlertPeerChallengeEvent["payload"],
): void {
  addIf(blockingCodes, !challenge.challengeId, "challenge_id_missing");
  addIf(blockingCodes, !challenge.leaseId, "lease_id_missing");
  addIf(blockingCodes, !challenge.targetEngineId, "target_engine_id_missing");
  addIf(blockingCodes, !challenge.discordMessageId, "discord_message_id_missing");
  addIf(blockingCodes, !challenge.channelId, "channel_id_missing");
  addIf(blockingCodes, !challenge.sourceKey, "source_key_missing");
  addIf(blockingCodes, !challenge.normalizedTextSha256, "normalized_text_hash_missing");
}

function validateRequiredPhoneAlertFields(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  phoneAlert: PeerAlertFingerprint,
): void {
  addIf(blockingCodes, !phoneAlert.eventId, "phone_alert_event_id_missing");
  addIf(blockingCodes, !phoneAlert.discordMessageId, "discord_message_id_missing");
  addIf(blockingCodes, !phoneAlert.channelId, "channel_id_missing");
  addIf(blockingCodes, !phoneAlert.sourceKey, "source_key_missing");
  addIf(blockingCodes, !phoneAlert.normalizedTextSha256, "normalized_text_hash_missing");
}

function compareAlertFingerprint(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  challenge: AlertPeerChallengeEvent["payload"],
  phoneAlert: PeerAlertFingerprint,
): void {
  addIf(blockingCodes, phoneAlert.discordMessageId !== challenge.discordMessageId, "discord_message_id_mismatch");
  addIf(blockingCodes, phoneAlert.channelId !== challenge.channelId, "channel_id_mismatch");
  addIf(blockingCodes, phoneAlert.authorId !== challenge.authorId, "author_id_mismatch");
  addIf(blockingCodes, phoneAlert.sourceKey !== challenge.sourceKey, "source_key_mismatch");
  addIf(
    blockingCodes,
    phoneAlert.normalizedTextSha256 !== challenge.normalizedTextSha256,
    "normalized_text_hash_mismatch",
  );
  addIf(
    blockingCodes,
    Boolean(challenge.messageUrl) && phoneAlert.messageUrl !== challenge.messageUrl,
    "message_url_mismatch",
  );
}

function classifyPeerStatus(blockingCodes: AlertPeerFailsafeBlockingCode[]): AlertPeerFailsafeStatus {
  if (blockingCodes.length === 0) {
    return "matched";
  }
  if (blockingCodes.length === 1 && blockingCodes[0] === "peer_response_missing") {
    return "missing_response";
  }
  if (blockingCodes.length === 1 && blockingCodes[0] === "alert_timestamp_skew_exceeded") {
    return "stale";
  }
  if (
    blockingCodes.every((code) =>
      [
        "remote_observed_at_invalid",
        "phone_observed_at_invalid",
        "phone_received_at_invalid",
        "phone_received_before_observed",
        "responded_at_invalid",
        "responded_before_received",
        "response_observed_at_invalid",
        "response_observed_before_responded",
        "response_observed_before_received",
        "alert_timestamp_skew_exceeded",
      ].includes(code),
    )
  ) {
    return "stale";
  }
  return "mismatch";
}

function buildDetailLabel(status: AlertPeerFailsafeStatus, challengeId: string, skewMs: number | null): string {
  switch (status) {
    case "matched":
      return `Phone saw matching alert within ${skewMs ?? "unknown"}ms`;
    case "missing_response":
      return `Phone did not answer alert challenge ${challengeId}`;
    case "stale":
      return skewMs === null
        ? `Phone alert timing invalid for challenge ${challengeId}`
        : `Phone alert timestamp skew ${skewMs}ms exceeds limit`;
    case "mismatch":
      return `Phone alert copy did not match challenge ${challengeId}`;
  }
}

function addIf(
  blockingCodes: AlertPeerFailsafeBlockingCode[],
  condition: boolean,
  code: AlertPeerFailsafeBlockingCode,
): void {
  if (condition && !blockingCodes.includes(code)) {
    blockingCodes.push(code);
  }
}

function parseTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeMaxSkew(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : DEFAULT_MAX_ALERT_SKEW_MS;
}
