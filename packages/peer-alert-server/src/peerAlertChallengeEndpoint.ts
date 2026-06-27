import {
  buildPhoneAlertPeerResponseEvent,
  evaluateAlertPeerResponse,
  type AlertPeerChallengeEvent,
  type AlertPeerFailsafeEvaluation,
  type AlertPeerResponseEvent,
  type EngineId,
  type PeerAlertFingerprint,
} from "@apk-alerts/contracts";

export const PEER_ALERT_CHALLENGE_PATH = "/api/peer-alert/challenges";

export interface PeerAlertPhoneAlertSnapshot {
  observedAt: string;
  receivedAt: string;
  fingerprint: PeerAlertFingerprint;
}

export interface PeerAlertChallengeEndpointOutcome {
  ok: boolean;
  checkedAt: string;
  challenge: AlertPeerChallengeEvent;
  response: AlertPeerResponseEvent | null;
  evaluation: AlertPeerFailsafeEvaluation;
  error: string;
}

export interface PeerAlertChallengeEndpointErrorBody {
  ok: false;
  checkedAt: string;
  challenge: null;
  response: null;
  evaluation: null;
  error: string;
}

export type PeerAlertChallengeEndpointBody =
  | PeerAlertChallengeEndpointOutcome
  | PeerAlertChallengeEndpointErrorBody;

export interface PeerAlertChallengeEndpointResponse {
  status: number;
  body: PeerAlertChallengeEndpointBody;
}

export interface PeerAlertChallengeEndpointRequest {
  method: string;
  path: string;
  headers?: HeadersInit;
  body: unknown;
}

export interface PeerAlertChallengeEndpointConfig {
  phoneEngineId: EngineId;
  apiKey?: string;
  getLastAlert: () => PeerAlertPhoneAlertSnapshot | null | Promise<PeerAlertPhoneAlertSnapshot | null>;
  now?: () => string;
  nextResponseEventId?: (challenge: AlertPeerChallengeEvent) => string;
  nextSequence?: () => number;
  previousEventId?: () => string | null;
  recordOutcome?: (outcome: PeerAlertChallengeEndpointOutcome) => void | Promise<void>;
  maxAlertSkewMs?: number;
}

export async function handlePeerAlertChallengeRequest(
  config: PeerAlertChallengeEndpointConfig,
  request: PeerAlertChallengeEndpointRequest,
): Promise<PeerAlertChallengeEndpointResponse> {
  const checkedAt = config.now?.() ?? new Date().toISOString();

  if (request.path !== PEER_ALERT_CHALLENGE_PATH) {
    return errorResponse(404, checkedAt, "Peer alert endpoint not found.");
  }

  if (request.method.toUpperCase() !== "POST") {
    return errorResponse(405, checkedAt, "Peer alert endpoint requires POST.");
  }

  if (!isAuthorized(config.apiKey, request.headers)) {
    return errorResponse(401, checkedAt, "Peer alert endpoint authentication failed.");
  }

  if (!isAlertPeerChallengeEvent(request.body)) {
    return errorResponse(400, checkedAt, "Peer alert challenge payload invalid.");
  }

  const challenge = request.body;
  if (challenge.payload.targetEngineId !== config.phoneEngineId) {
    return errorResponse(
      409,
      checkedAt,
      `Peer alert challenge targets ${challenge.payload.targetEngineId}, not ${config.phoneEngineId}.`,
    );
  }

  const phoneAlert = await config.getLastAlert();
  const response = buildPhoneAlertPeerResponseEvent({
    challenge,
    responseEventId: config.nextResponseEventId?.(challenge) ?? `peer-response:${challenge.payload.challengeId}`,
    responderEngineId: config.phoneEngineId,
    observedAt: checkedAt,
    sequence: config.nextSequence?.() ?? challenge.sequence + 1,
    previousEventId: config.previousEventId?.() ?? null,
    phoneObservedAt: phoneAlert?.observedAt ?? checkedAt,
    phoneReceivedAt: phoneAlert?.receivedAt ?? checkedAt,
    respondedAt: checkedAt,
    lastAlert: phoneAlert?.fingerprint ?? null,
  });
  const evaluation = evaluateAlertPeerResponse(
    challenge,
    response,
    buildEvaluationOptions(config.maxAlertSkewMs),
  );
  const outcome: PeerAlertChallengeEndpointOutcome = {
    ok: !evaluation.blocking && evaluation.status === "matched",
    checkedAt,
    challenge,
    response,
    evaluation,
    error: "",
  };

  await config.recordOutcome?.(outcome);

  return {
    status: 200,
    body: outcome,
  };
}

export async function handlePeerAlertChallengeFetchRequest(
  config: PeerAlertChallengeEndpointConfig,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const result = await handlePeerAlertChallengeRequest(config, {
    method: request.method,
    path: url.pathname,
    headers: request.headers,
    body: await readJsonBody(request),
  });

  return Response.json(result.body, { status: result.status });
}

function buildEvaluationOptions(maxAlertSkewMs: number | undefined) {
  return maxAlertSkewMs === undefined ? {} : { maxAlertSkewMs };
}

function errorResponse(
  status: number,
  checkedAt: string,
  error: string,
): PeerAlertChallengeEndpointResponse {
  return {
    status,
    body: {
      ok: false,
      checkedAt,
      challenge: null,
      response: null,
      evaluation: null,
      error,
    },
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (request.method.toUpperCase() !== "POST") {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isAuthorized(expectedApiKey: string | undefined, headers: HeadersInit | undefined): boolean {
  const expected = expectedApiKey?.trim();
  if (!expected) {
    return true;
  }

  return getHeaderValue(headers, "x-api-key") === expected;
}

function getHeaderValue(headers: HeadersInit | undefined, name: string): string {
  if (!headers) {
    return "";
  }
  if (headers instanceof Headers) {
    return headers.get(name)?.trim() ?? "";
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name);
    return found?.[1].trim() ?? "";
  }

  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1]?.trim() ?? "";
}

function isAlertPeerChallengeEvent(input: unknown): input is AlertPeerChallengeEvent {
  if (!isRecord(input) || input.type !== "alert.peer.challenge.v1" || input.schemaVersion !== 1) {
    return false;
  }
  if (
    !isNonEmptyString(input.id) ||
    !isNonEmptyString(input.sourceEngineId) ||
    !isNonEmptyString(input.observedAt) ||
    typeof input.sequence !== "number" ||
    !Number.isFinite(input.sequence)
  ) {
    return false;
  }

  const payload = input.payload;
  if (!isRecord(payload)) {
    return false;
  }

  return (
    isNonEmptyString(payload.challengeId) &&
    isNonEmptyString(payload.targetEngineId) &&
    isNonEmptyString(payload.leaseId) &&
    isNonEmptyString(payload.remoteObservedAt) &&
    isNonEmptyString(payload.discordMessageId) &&
    isNonEmptyString(payload.channelId) &&
    (payload.authorId === null || isString(payload.authorId)) &&
    isString(payload.messageUrl) &&
    isNonEmptyString(payload.normalizedTextSha256) &&
    isNonEmptyString(payload.sourceKey)
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function isString(input: unknown): input is string {
  return typeof input === "string";
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}
