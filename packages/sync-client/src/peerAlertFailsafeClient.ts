import {
  evaluateAlertPeerResponse,
  type AlertPeerChallengeEvent,
  type AlertPeerFailsafeEvaluation,
  type AlertPeerFailsafeOptions,
  type AlertPeerResponseEvent,
} from "@apk-alerts/contracts";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface PeerAlertFailsafeClientConfig {
  baseApiUrl: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  maxAlertSkewMs?: number;
  now?: () => string;
}

export interface PeerAlertFailsafeResult {
  ok: boolean;
  checkedAt: string;
  response: AlertPeerResponseEvent | null;
  evaluation: AlertPeerFailsafeEvaluation;
  error: string;
}

export function normalizePeerAlertFailsafeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (!url.pathname.endsWith("/api")) {
      url.pathname = `${url.pathname}/api`.replace(/\/+/g, "/");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export async function requestPhoneAlertPeerResponse(
  config: PeerAlertFailsafeClientConfig,
  challenge: AlertPeerChallengeEvent,
): Promise<PeerAlertFailsafeResult> {
  const checkedAt = config.now?.() ?? new Date().toISOString();
  const evaluationOptions = buildEvaluationOptions(config.maxAlertSkewMs);
  const missingEvaluation = () =>
    evaluateAlertPeerResponse(challenge, null, evaluationOptions);
  const baseApiUrl = normalizePeerAlertFailsafeBaseUrl(config.baseApiUrl);
  if (!baseApiUrl) {
    return failClosed(checkedAt, missingEvaluation(), "Remote API URL is invalid.");
  }

  const fetchImpl = config.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    return failClosed(checkedAt, missingEvaluation(), "Fetch is not available.");
  }

  try {
    const payload = await postJson(
      fetchImpl,
      `${baseApiUrl}/peer-alert/challenges`,
      challenge,
      config.apiKey,
    );
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

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const trimmed = apiKey?.trim();
  if (trimmed) {
    headers["X-API-Key"] = trimmed;
  }
  return headers;
}

async function postJson(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  apiKey?: string,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
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
    !Number.isFinite(input.sequence)
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
