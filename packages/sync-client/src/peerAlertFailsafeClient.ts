import {
  evaluateAlertPeerResponse,
  type AlertPeerChallengeEvent,
  type AlertPeerFailsafeEvaluation,
  type AlertPeerFailsafeOptions,
  type AlertPeerResponseEvent,
} from "@apk-alerts/contracts";
import {
  buildRemoteEndpointClient,
  fetchRemoteJson,
  normalizeRemoteApiBaseUrl,
  type FetchLike,
} from "./remoteHttp";

export type { FetchLike };
export { normalizeRemoteApiBaseUrl as normalizePeerAlertFailsafeBaseUrl };

export interface PeerAlertFailsafeClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  maxAlertSkewMs?: number;
  timeoutMs?: number;
  now?: () => string;
}

export interface PeerAlertFailsafeResult {
  ok: boolean;
  checkedAt: string;
  response: AlertPeerResponseEvent | null;
  evaluation: AlertPeerFailsafeEvaluation;
  error: string;
}

export async function requestPhoneAlertPeerResponse(
  config: PeerAlertFailsafeClientConfig,
  challenge: AlertPeerChallengeEvent,
): Promise<PeerAlertFailsafeResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const evaluationOptions = buildEvaluationOptions(config.maxAlertSkewMs);
  const missingEvaluation = () =>
    evaluateAlertPeerResponse(challenge, null, evaluationOptions);
  const endpoint = buildRemoteEndpointClient(config);
  if (!endpoint.ok) {
    return failClosed(checkedAt, missingEvaluation(), endpoint.error);
  }

  try {
    const payload = await fetchRemoteJson(endpoint.fetchImpl, `${endpoint.baseApiUrl}/peer-alert/challenges`, {
      apiKey: endpoint.apiKey,
      body: challenge,
      method: "POST",
      timeoutMs: endpoint.timeoutMs,
    });
    const response = extractPeerAlertResponseEvent(payload);
    if (!response) {
      return failClosed(checkedAt, missingEvaluation(), "Peer alert response payload invalid.");
    }
    const evaluation = evaluateAlertPeerResponse(challenge, response, evaluationOptions);
    return {
      ok: !evaluation.blocking && evaluation.status === "matched",
      checkedAt,
      response,
      evaluation,
      error: "",
    };
  } catch (error) {
    return failClosed(
      checkedAt,
      missingEvaluation(),
      error instanceof Error ? error.message : "Peer alert challenge failed.",
    );
  }
}

function buildEvaluationOptions(maxAlertSkewMs: number | undefined): AlertPeerFailsafeOptions {
  return maxAlertSkewMs === undefined ? {} : { maxAlertSkewMs };
}

function failClosed(
  checkedAt: string,
  evaluation: AlertPeerFailsafeEvaluation,
  error: string,
): PeerAlertFailsafeResult {
  return {
    ok: false,
    checkedAt,
    response: null,
    evaluation,
    error,
  };
}

function extractPeerAlertResponseEvent(payload: unknown): AlertPeerResponseEvent | null {
  const responsePayload = isRecord(payload) && "response" in payload
    ? payload.response
    : payload;
  return isPeerAlertResponseEvent(responsePayload) ? responsePayload : null;
}

function isPeerAlertResponseEvent(input: unknown): input is AlertPeerResponseEvent {
  if (!isRecord(input) || input.type !== "alert.peer.response.v1" || input.schemaVersion !== 1) {
    return false;
  }
  if (
    !isNonEmptyString(input.id) ||
    !isNonEmptyString(input.sourceEngineId) ||
    !isNonEmptyString(input.observedAt) ||
    typeof input.sequence !== "number" ||
    !Number.isInteger(input.sequence)
  ) {
    return false;
  }

  const payload = input.payload;
  if (!isRecord(payload)) {
    return false;
  }
  if (
    !isString(payload.challengeId) ||
    !isString(payload.leaseId) ||
    !isString(payload.responderEngineId) ||
    !isString(payload.respondedAt) ||
    !isString(payload.phoneObservedAt) ||
    !isString(payload.phoneReceivedAt)
  ) {
    return false;
  }
  return payload.lastAlert === null || isPeerAlertFingerprint(payload.lastAlert);
}

function isPeerAlertFingerprint(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }
  return (
    isString(input.eventId) &&
    isString(input.discordMessageId) &&
    isString(input.channelId) &&
    (input.authorId === null || isString(input.authorId)) &&
    isString(input.messageUrl) &&
    isString(input.normalizedTextSha256) &&
    isString(input.sourceKey) &&
    ["none", "low", "medium", "high"].includes(String(input.parserConfidence)) &&
    ["accepted", "skipped", "duplicate", "unknown"].includes(String(input.decisionStatus)) &&
    isString(input.queuedAlertId)
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function isString(input: unknown): input is string {
  return typeof input === "string";
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.length > 0;
}
