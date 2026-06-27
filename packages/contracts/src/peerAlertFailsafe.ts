import type { AlertPeerChallengeEvent, AlertPeerResponseEvent, PeerAlertFingerprint } from "./events";

export type AlertPeerFailsafeStatus = "matched" | "missing_response" | "mismatch" | "stale";

export type AlertPeerFailsafeBlockingCode =
  | "peer_response_missing"
  | "challenge_id_mismatch"
  | "lease_id_mismatch"
  | "responder_engine_mismatch"
  | "phone_alert_missing"
  | "discord_message_id_mismatch"
  | "channel_id_mismatch"
  | "author_id_mismatch"
  | "source_key_mismatch"
  | "normalized_text_hash_mismatch"
  | "message_url_mismatch"
  | "remote_observed_at_invalid"
  | "phone_observed_at_invalid"
  | "phone_received_at_invalid"
  | "phone_received_before_observed"
  | "response_observed_at_invalid"
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

const DEFAULT_MAX_ALERT_SKEW_MS = 10_000;

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
  const phoneAlert = responsePayload.lastAlert;
  const remoteObservedAtMs = parseTimestamp(challengePayload.remoteObservedAt);
  const phoneObservedAtMs = parseTimestamp(responsePayload.phoneObservedAt);
  const phoneReceivedAtMs = parseTimestamp(responsePayload.phoneReceivedAt);
  const responseObservedAtMs = parseTimestamp(response.observedAt);
  const skewMs = remoteObservedAtMs !== null && phoneObservedAtMs !== null
    ? Math.abs(phoneObservedAtMs - remoteObservedAtMs)
    : null;
  const blockingCodes: AlertPeerFailsafeBlockingCode[] = [];

  addIf(blockingCodes, responsePayload.challengeId !== challengePayload.challengeId, "challenge_id_mismatch");
  addIf(blockingCodes, responsePayload.leaseId !== challengePayload.leaseId, "lease_id_mismatch");
  addIf(
    blockingCodes,
    response.sourceEngineId !== challengePayload.targetEngineId ||
      responsePayload.responderEngineId !== challengePayload.targetEngineId,
    "responder_engine_mismatch",
  );

  if (!phoneAlert) {
    blockingCodes.push("phone_alert_missing");
  } else {
    compareAlertFingerprint(blockingCodes, challengePayload, phoneAlert);
  }

  addIf(blockingCodes, remoteObservedAtMs === null, "remote_observed_at_invalid");
  addIf(blockingCodes, phoneObservedAtMs === null, "phone_observed_at_invalid");
  addIf(blockingCodes, phoneReceivedAtMs === null, "phone_received_at_invalid");
  addIf(blockingCodes, responseObservedAtMs === null, "response_observed_at_invalid");
  addIf(
    blockingCodes,
    phoneObservedAtMs !== null && phoneReceivedAtMs !== null && phoneReceivedAtMs < phoneObservedAtMs,
    "phone_received_before_observed",
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

  const status = classifyStatus(blockingCodes);
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
    skewMs,
    detailLabel: buildDetailLabel(status, challengePayload.challengeId, skewMs),
  };
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

function classifyStatus(blockingCodes: AlertPeerFailsafeBlockingCode[]): AlertPeerFailsafeStatus {
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
        "response_observed_at_invalid",
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
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_MAX_ALERT_SKEW_MS;
}
