export const CHROME_DISCORD_MESSAGE_CONTRACT_VERSION = "chrome.discord.message.v1";

export type ParserConfidence = "none" | "low" | "medium" | "high";
export type BridgeEvidenceStatus = "accepted" | "skipped" | "duplicate" | "unknown";

export interface BridgeIngestionResult {
  status: BridgeEvidenceStatus;
  alertInserted: boolean;
  alertId: string;
  tradeRequested: boolean;
  tradeRequestReason: string;
  skipReason: string;
}

export interface BridgeSignalEvidence {
  busEventId: string;
  eventType: string;
  sourceBot: string;
  createdAt: string;
  correlationId: string;
  dedupeKey: string;
  contractVersion: string;
  eventId: string;
  source: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  messageUrl: string;
  observedAt: string;
  bridgeTargetId: string;
  bridgeTargetName: string;
  authorId: string;
  authorName: string;
  rawText: string;
  parsed: Record<string, unknown> | null;
  parserMetadata: Record<string, unknown>;
  parserConfidence: ParserConfidence;
  ingestion: BridgeIngestionResult;
  capturePath: string;
}

export interface BridgeSourcePolicyProof {
  key: string;
  name: string;
  overrideMatched: boolean;
  paperOnly: boolean;
  requireManualConfirm: boolean;
  minParserConfidence: ParserConfidence;
  observedParserConfidence: ParserConfidence;
  parserConfidenceAllowed: boolean;
  allowedChannelUrlCount: number;
  allowedChannelUrlCountProvided: boolean;
  channelUrlAllowed: boolean;
  allowedAuthorIdCount: number;
  allowedAuthorIdCountProvided: boolean;
  authorIdAllowed: boolean;
  metadataPolicyPassed: boolean;
}

export interface BridgeAlertDecisionEvidence {
  auditEventId: string;
  category: string;
  action: string;
  summary: string;
  severity: string;
  createdAt: string;
  contractVersion: string;
  eventId: string;
  channel: {
    id: string;
    name: string;
    url: string;
    messageUrl: string;
  };
  author: {
    id: string;
    name: string;
  };
  bridgeTarget: {
    id: string;
    name: string;
  };
  rawText: string;
  capturePath: string;
  parsed: Record<string, unknown> | null;
  parserMetadata: Record<string, unknown>;
  parserConfidence: ParserConfidence;
  source: BridgeSourcePolicyProof;
  decision: BridgeIngestionResult;
  status: BridgeEvidenceStatus;
}

export interface BridgeHeartbeat {
  status: string;
  bridgeEnabled: boolean;
  url: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  bridgeTargetId: string;
  bridgeTargetName: string;
  observedAt: string;
  lastForwardAt: string;
  lastForwardStatus: string;
  details: Record<string, unknown>;
}

export type BridgeSupervisorState = "healthy" | "backoff" | "disabled" | "attention" | "unknown";

export interface BridgeSupervisorHealth {
  state: BridgeSupervisorState;
  source: string;
  reason: string;
  supervisedTabs: number | null;
  restartedTabs: number | null;
  discordTabs: number | null;
  configuredTargets: number | null;
  restartAttempt: number | null;
  nextRestartAt: string;
  failures: string[];
  error: string;
  lastEventId: string;
}

export interface BridgeHealth {
  healthy: boolean;
  status: "healthy" | "unhealthy" | "unknown";
  issues: string[];
  lastHeartbeat: BridgeHeartbeat;
  ageSeconds: number | null;
  staleAfterSeconds: number | null;
  supervisor: BridgeSupervisorHealth;
}

export interface AlertEvidenceChain {
  eventId: string;
  observedAt: string;
  status: BridgeEvidenceStatus;
  executable: boolean;
  latestReason: string;
  rawText: string;
  parserConfidence: ParserConfidence;
  channelName: string;
  authorName: string;
  signal: BridgeSignalEvidence | null;
  decision: BridgeAlertDecisionEvidence | null;
}

export interface BuildAlertEvidenceChainsInput {
  signals?: BridgeSignalEvidence[];
  decisions?: BridgeAlertDecisionEvidence[];
}

export function normalizeBridgeSignalEvent(input: unknown): BridgeSignalEvidence {
  const event = asRecord(input);
  const payload = asRecord(event.payload);
  const parserMetadata = asRecord(payload.parser_metadata);
  const eventType = text(event.event_type);
  const fallbackStatus = eventType === "signal.duplicate" ? "duplicate" : "unknown";

  return {
    busEventId: text(event.event_id),
    eventType,
    sourceBot: text(event.source_bot),
    createdAt: text(event.created_at),
    correlationId: text(event.correlation_id),
    dedupeKey: text(event.dedupe_key),
    contractVersion: text(payload.contract_version),
    eventId: text(payload.event_id),
    source: text(payload.source),
    channelId: text(payload.channel_id),
    channelName: text(payload.channel_name),
    channelUrl: text(payload.channel_url),
    messageUrl: text(payload.url),
    observedAt: text(payload.observed_at),
    bridgeTargetId: text(payload.bridge_target_id),
    bridgeTargetName: text(payload.bridge_target_name),
    authorId: text(payload.author_id),
    authorName: text(payload.author_name),
    rawText: text(payload.raw_text),
    parsed: nullableRecord(payload.parsed),
    parserMetadata,
    parserConfidence: normalizeParserConfidence(parserMetadata.confidence),
    ingestion: normalizeIngestionResult(payload.ingestion_result, fallbackStatus),
    capturePath: text(payload.capture_path),
  };
}

export function normalizeBridgeAlertDecisionEvent(input: unknown): BridgeAlertDecisionEvidence {
  const event = asRecord(input);
  const details = asRecord(event.details);
  const channel = asRecord(details.channel);
  const author = asRecord(details.author);
  const bridgeTarget = asRecord(details.bridge_target);
  const parserMetadata = asRecord(details.parser);
  const decision = normalizeIngestionResult(details.decision);

  return {
    auditEventId: text(event.id),
    category: text(event.category),
    action: text(event.action),
    summary: text(event.summary),
    severity: text(event.severity),
    createdAt: text(event.created_at),
    contractVersion: text(details.contract_version),
    eventId: text(details.event_id),
    channel: {
      id: text(channel.id),
      name: text(channel.name),
      url: text(channel.url),
      messageUrl: text(channel.message_url),
    },
    author: {
      id: text(author.id),
      name: text(author.name),
    },
    bridgeTarget: {
      id: text(bridgeTarget.id),
      name: text(bridgeTarget.name),
    },
    rawText: text(details.raw_text),
    capturePath: text(details.capture_path),
    parsed: nullableRecord(details.parsed),
    parserMetadata,
    parserConfidence: normalizeParserConfidence(parserMetadata.confidence),
    source: normalizeSourcePolicyProof(details.source),
    decision,
    status: decision.status,
  };
}

export function normalizeBridgeHealthPayload(input: unknown): BridgeHealth {
  const payload = asRecord(input);
  const lastHeartbeat = normalizeBridgeHeartbeat(payload.last_heartbeat);
  const status = normalizeBridgeHealthStatus(payload.status);
  return {
    healthy: exactBoolean(payload.healthy),
    status,
    issues: stringArray(payload.issues),
    lastHeartbeat,
    ageSeconds: finiteNumberOrNull(payload.age_seconds),
    staleAfterSeconds: finiteNumberOrNull(payload.stale_after_seconds),
    supervisor: normalizeBridgeSupervisorHealth(lastHeartbeat, status),
  };
}

export function buildAlertEvidenceChains(input: BuildAlertEvidenceChainsInput = {}): AlertEvidenceChain[] {
  const signals = input.signals ?? [];
  const decisions = input.decisions ?? [];
  const keys = new Set<string>();

  for (const signal of signals) {
    keys.add(chainKey(signal.eventId, signal.correlationId, signal.busEventId));
  }
  for (const decision of decisions) {
    keys.add(chainKey(decision.eventId, "", decision.auditEventId));
  }

  return [...keys]
    .filter(Boolean)
    .map((key) => {
      const signal = signals.find((candidate) => chainKey(candidate.eventId, candidate.correlationId, candidate.busEventId) === key) ?? null;
      const decision = decisions.find((candidate) => chainKey(candidate.eventId, "", candidate.auditEventId) === key) ?? null;
      const status = decision?.status ?? signal?.ingestion.status ?? "unknown";
      const latestReason = firstText(
        decision?.decision.skipReason,
        decision?.decision.tradeRequestReason,
        signal?.ingestion.skipReason,
        signal?.ingestion.tradeRequestReason,
        decision?.summary,
      );

      return {
        eventId: key,
        observedAt: firstText(decision?.createdAt, signal?.observedAt, signal?.createdAt),
        status,
        executable: false,
        latestReason,
        rawText: firstText(decision?.rawText, signal?.rawText),
        parserConfidence: decision?.parserConfidence ?? signal?.parserConfidence ?? "none",
        channelName: firstText(decision?.channel.name, signal?.channelName),
        authorName: firstText(decision?.author.name, signal?.authorName),
        signal,
        decision,
      };
    })
    .sort(compareAlertEvidenceChains);
}

function compareAlertEvidenceChains(a: AlertEvidenceChain, b: AlertEvidenceChain): number {
  if (a.observedAt && b.observedAt) {
    const timestampOrder = b.observedAt.localeCompare(a.observedAt);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }
  }
  if (a.observedAt && !b.observedAt) {
    return -1;
  }
  if (!a.observedAt && b.observedAt) {
    return 1;
  }
  return a.eventId.localeCompare(b.eventId);
}

function normalizeIngestionResult(input: unknown, fallbackStatus: BridgeEvidenceStatus = "unknown"): BridgeIngestionResult {
  const result = asRecord(input);
  return {
    status: normalizeEvidenceStatus(result.status, fallbackStatus),
    alertInserted: exactBoolean(result.alert_inserted),
    alertId: text(result.alert_id),
    tradeRequested: exactBoolean(result.trade_requested),
    tradeRequestReason: text(result.trade_request_reason),
    skipReason: text(result.skip_reason),
  };
}

function normalizeSourcePolicyProof(input: unknown): BridgeSourcePolicyProof {
  const source = asRecord(input);
  const allowedChannelUrlCount = nonNegativeIntegerOrNull(source.allowed_channel_url_count);
  const allowedAuthorIdCount = nonNegativeIntegerOrNull(source.allowed_author_id_count);
  return {
    key: text(source.key),
    name: text(source.name),
    overrideMatched: exactBoolean(source.override_matched),
    paperOnly: exactBoolean(source.paper_only),
    requireManualConfirm: exactBoolean(source.require_manual_confirm),
    minParserConfidence: normalizeParserConfidence(source.min_parser_confidence),
    observedParserConfidence: normalizeParserConfidence(source.observed_parser_confidence),
    parserConfidenceAllowed: exactBoolean(source.parser_confidence_allowed),
    allowedChannelUrlCount: allowedChannelUrlCount ?? 0,
    allowedChannelUrlCountProvided: allowedChannelUrlCount !== null,
    channelUrlAllowed: exactBoolean(source.channel_url_allowed),
    allowedAuthorIdCount: allowedAuthorIdCount ?? 0,
    allowedAuthorIdCountProvided: allowedAuthorIdCount !== null,
    authorIdAllowed: exactBoolean(source.author_id_allowed),
    metadataPolicyPassed: exactBoolean(source.metadata_policy_passed),
  };
}

function normalizeBridgeHeartbeat(input: unknown): BridgeHeartbeat {
  const heartbeat = asRecord(input);
  return {
    status: text(heartbeat.status),
    bridgeEnabled: exactBoolean(heartbeat.bridge_enabled),
    url: text(heartbeat.url),
    channelId: text(heartbeat.channel_id),
    channelName: text(heartbeat.channel_name),
    channelUrl: text(heartbeat.channel_url),
    bridgeTargetId: text(heartbeat.bridge_target_id),
    bridgeTargetName: text(heartbeat.bridge_target_name),
    observedAt: text(heartbeat.observed_at),
    lastForwardAt: text(heartbeat.last_forward_at),
    lastForwardStatus: text(heartbeat.last_forward_status),
    details: asRecord(heartbeat.details),
  };
}

function normalizeBridgeSupervisorHealth(
  heartbeat: BridgeHeartbeat,
  healthStatus: BridgeHealth["status"],
): BridgeSupervisorHealth {
  const details = heartbeat.details;
  const failures = stringArray(details.failures);
  const error = text(details.error);
  return {
    state: classifyBridgeSupervisorState(heartbeat, healthStatus),
    source: text(details.source),
    reason: text(details.reason),
    supervisedTabs: nonNegativeIntegerOrNull(details.supervised_tabs),
    restartedTabs: nonNegativeIntegerOrNull(details.restarted_tabs),
    discordTabs: nonNegativeIntegerOrNull(details.discord_tabs),
    configuredTargets: nonNegativeIntegerOrNull(details.configured_targets),
    restartAttempt: firstNonNegativeIntegerOrNull(details.restart_attempt, details.bridge_restart_attempt),
    nextRestartAt: firstText(text(details.next_restart_at), text(details.nextRestartAt)),
    failures: failures.length > 0 ? failures : error ? [error] : [],
    error,
    lastEventId: text(details.last_event_id),
  };
}

function classifyBridgeSupervisorState(
  heartbeat: BridgeHeartbeat,
  healthStatus: BridgeHealth["status"],
): BridgeSupervisorState {
  if (!heartbeat.status && !heartbeat.observedAt) {
    return "unknown";
  }
  if (!heartbeat.bridgeEnabled || heartbeat.status === "disabled" || text(heartbeat.details.supervisor) === "disabled") {
    return "disabled";
  }
  if (
    heartbeat.status === "restart_error" ||
    heartbeat.status === "forward_error" ||
    heartbeat.status === "no_discord_tabs" ||
    heartbeat.status === "no_matching_discord_tabs"
  ) {
    return "backoff";
  }
  if (healthStatus === "healthy" && heartbeat.status === "ok") {
    const details = heartbeat.details;
    const hasFailureEvidence = stringArray(details.failures).length > 0 || Boolean(text(details.error));
    const hasSupervisionProof = [
      nonNegativeIntegerOrNull(details.supervised_tabs),
      nonNegativeIntegerOrNull(details.discord_tabs),
      nonNegativeIntegerOrNull(details.configured_targets),
    ].some((count) => count !== null && count > 0);
    return !hasFailureEvidence && hasSupervisionProof ? "healthy" : "attention";
  }
  if (healthStatus === "unhealthy") {
    return "attention";
  }
  return "unknown";
}

function normalizeParserConfidence(input: unknown): ParserConfidence {
  const value = text(input).toLowerCase();
  return value === "low" || value === "medium" || value === "high" ? value : "none";
}

function normalizeEvidenceStatus(input: unknown, fallback: BridgeEvidenceStatus): BridgeEvidenceStatus {
  const value = text(input).toLowerCase();
  return value === "accepted" || value === "skipped" || value === "duplicate" ? value : fallback;
}

function normalizeBridgeHealthStatus(input: unknown): BridgeHealth["status"] {
  const value = text(input).toLowerCase();
  return value === "healthy" || value === "unhealthy" ? value : "unknown";
}

function chainKey(primary: string, correlationId: string, fallback: string): string {
  return firstText(primary, correlationId, fallback);
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function asRecord(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function nullableRecord(input: unknown): Record<string, unknown> | null {
  const record = asRecord(input);
  return Object.keys(record).length > 0 ? record : null;
}

function text(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function exactBoolean(input: unknown): boolean {
  return typeof input === "boolean" ? input : false;
}

function stringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((value) => text(value)).filter(Boolean)
    : [];
}

function finiteNumberOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function nonNegativeIntegerOrNull(input: unknown): number | null {
  return typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : null;
}

function firstNonNegativeIntegerOrNull(...values: unknown[]): number | null {
  for (const value of values) {
    const normalized = nonNegativeIntegerOrNull(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}
