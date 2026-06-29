import {
  CHROME_DISCORD_MESSAGE_CONTRACT_VERSION,
  normalizeBridgeHealthPayload,
  normalizeLeaseEvidenceSnapshot,
  type AlertEvidenceChain,
  type ReconciliationRow,
} from "@apk-alerts/contracts";
import {
  fetchRemoteAlertEvidence,
  type RemoteAlertEvidenceResult,
  type RemoteAlertEvidenceSnapshot,
  type RemoteEvidenceClientConfig,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { classifyRemoteTransport, type RemoteTransport } from "./remoteEngineState";

export type AlertEvidenceChecker = (
  config: RemoteEvidenceClientConfig,
) => Promise<RemoteAlertEvidenceResult>;

export interface AlertEvidenceConnection {
  baseApiUrl: string;
  apiKey: string;
  transport: RemoteTransport;
}

export interface AlertEvidenceConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface AlertEvidenceSnapshot {
  connection: AlertEvidenceConnection;
  evidence: RemoteAlertEvidenceSnapshot;
  checking: boolean;
  lastError: string;
}

export interface AlertEvidenceSummary {
  connectionLabel: string;
  bridgeHealthLabel: string;
  bridgeHealthDetail: string;
  latestAlertLabel: string;
  latestDecisionLabel: string;
  liveReadinessLabel: string;
  evidenceCountLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface BridgeSupervisorDisplaySummary {
  statusLabel: string;
  gateLabel: string;
  detailLabel: string;
  tabLabel: string;
  backoffLabel: string;
  failureLabel: string;
  blocking: boolean;
}

export interface SourcePolicyDisplaySummary {
  statusLabel: string;
  gateLabel: string;
  sourceLabel: string;
  confidenceLabel: string;
  channelLabel: string;
  authorLabel: string;
  executionModeLabel: string;
  blocking: boolean;
}

export interface QueuePlaceEvidenceSummary {
  statusLabel: string;
  gateLabel: string;
  alertInsertLabel: string;
  queueLabel: string;
  reasonLabel: string;
  auditLabel: string;
  blocking: boolean;
}

export interface AlertTestEvidenceSummary {
  modeLabel: string;
  gateLabel: string;
  contractLabel: string;
  parserLabel: string;
  sourceLabel: string;
  queueLabel: string;
  auditLabel: string;
  captureLabel: string;
  blocking: boolean;
}

export interface AlertReconciliationTraceSummary {
  gateLabel: string;
  alertLabel: string;
  reconciliationLabel: string;
  orderLabel: string;
  positionLabel: string;
  auditLabel: string;
  blocking: boolean;
}

export interface AlertEvidenceTimelineItem {
  key: "see" | "parse" | "decide" | "queue" | "reconcile";
  label: string;
  statusLabel: string;
  detailLabel: string;
  blocking: boolean;
}

export interface AlertAuditDigest {
  eventId: string;
  observedAt: string;
  status: string;
  alertId: string;
  auditEventId: string;
  busEventId: string;
  sourceKey: string;
  channelId: string;
  authorId: string;
  messageUrl: string;
  parserConfidence: string;
  rawTextFingerprint: string;
  rawTextLength: number;
  contractLabel: string;
  parserLabel: string;
  sourceGateLabel: string;
  sourceLabel: string;
  queueGateLabel: string;
  queueLabel: string;
  reconciliationGateLabel: string;
  reconciliationLabel: string;
  orderLabel: string;
  positionLabel: string;
  blocking: boolean;
  blockingLabels: string[];
}

export interface AlertEvidenceState {
  snapshot: AlertEvidenceSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: AlertEvidenceConnectionDraft) => void;
  refreshEvidence: () => Promise<void>;
}

function buildEmptyEvidenceSnapshot(checkedAt = ""): RemoteAlertEvidenceSnapshot {
  return {
    checkedAt,
    bridgeHealth: normalizeBridgeHealthPayload(null),
    leaseEvidence: normalizeLeaseEvidenceSnapshot(null),
    signals: [],
    decisions: [],
    chains: [],
  };
}

export function getDefaultAlertEvidenceSnapshot(): AlertEvidenceSnapshot {
  return {
    connection: {
      baseApiUrl: "",
      apiKey: "",
      transport: "none",
    },
    evidence: buildEmptyEvidenceSnapshot(),
    checking: false,
    lastError: "",
  };
}

export function buildAlertEvidenceSummary(snapshot: AlertEvidenceSnapshot): AlertEvidenceSummary {
  const latest = snapshot.evidence.chains[0] ?? null;
  const bridgeHealth = snapshot.evidence.bridgeHealth;
  const bridgeIssues = bridgeHealth.issues.join("; ");

  return {
    connectionLabel: formatTransportLabel(snapshot.connection),
    bridgeHealthLabel: formatBridgeHealthLabel(bridgeHealth.status),
    bridgeHealthDetail: bridgeIssues || (bridgeHealth.healthy ? "Bridge heartbeat healthy" : "No bridge heartbeat"),
    latestAlertLabel: latest ? `${formatStatusLabel(latest.status)} - ${latest.eventId}` : "No alert evidence",
    latestDecisionLabel: latest?.latestReason || "No decision evidence",
    liveReadinessLabel: latest ? "Audit only - live readiness not proven" : "Live readiness not proven",
    evidenceCountLabel: `${snapshot.evidence.chains.length} ${
      snapshot.evidence.chains.length === 1 ? "alert chain" : "alert chains"
    }`,
    lastCheckLabel: snapshot.evidence.checkedAt ? `Checked ${snapshot.evidence.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function buildBridgeSupervisorSummary(snapshot: AlertEvidenceSnapshot): BridgeSupervisorDisplaySummary {
  const supervisor = snapshot.evidence.bridgeHealth.supervisor;
  const healthy = supervisor.state === "healthy";
  return {
    statusLabel: formatSupervisorStatusLabel(supervisor.state),
    gateLabel: healthy ? "Supervisor clear" : "Blocks live",
    detailLabel: formatSupervisorDetailLabel(supervisor.source, supervisor.reason),
    tabLabel: formatSupervisorTabLabel(
      supervisor.supervisedTabs,
      supervisor.restartedTabs,
      supervisor.discordTabs,
      supervisor.configuredTargets,
    ),
    backoffLabel: formatSupervisorBackoffLabel(supervisor.restartAttempt, supervisor.nextRestartAt, supervisor.state),
    failureLabel: formatSupervisorFailureLabel(supervisor.failures),
    blocking: !healthy,
  };
}

export function buildAlertTestEvidenceSummary(chain: AlertEvidenceChain | null | undefined): AlertTestEvidenceSummary {
  if (!chain) {
    return {
      modeLabel: "Alert test proof missing",
      gateLabel: "Blocks test",
      contractLabel: "Contract proof missing",
      parserLabel: "Parser proof missing",
      sourceLabel: "Source proof missing",
      queueLabel: "Queue proof missing",
      auditLabel: "Audit proof missing",
      captureLabel: "No capture evidence",
      blocking: true,
    };
  }

  const source = buildSourcePolicySummary(chain);
  const queue = buildQueuePlaceEvidenceSummary(chain);
  const contract = buildAlertContractProofSummary(chain);
  const parser = buildAlertParserProofSummary(chain);
  const capture = buildAlertCaptureProofSummary(chain);
  const hasAuditProof = Boolean(chain.decision?.auditEventId);
  const clear = contract.passed && parser.passed && !source.blocking && !queue.blocking && hasAuditProof && capture.passed;

  return {
    modeLabel: formatAlertTestModeLabel(Boolean(chain.signal), Boolean(chain.decision)),
    gateLabel: clear ? "Test proof clear" : "Blocks test",
    contractLabel: contract.label,
    parserLabel: parser.label,
    sourceLabel: source.statusLabel,
    queueLabel: formatAlertTestQueueLabel(queue),
    auditLabel: chain.decision?.auditEventId ? `Audit ${chain.decision.auditEventId}` : "Audit proof missing",
    captureLabel: capture.label,
    blocking: !clear,
  };
}

function buildAlertParserProofSummary(chain: AlertEvidenceChain): { passed: boolean; label: string } {
  if (chain.parserConfidence === "none") {
    return { passed: false, label: "Parser proof missing" };
  }
  if (!chain.decision?.parsed || (chain.signal && !chain.signal.parsed)) {
    return { passed: false, label: "Parsed payload missing" };
  }
  if (chain.signal && canonicalJson(chain.signal.parsed) !== canonicalJson(chain.decision.parsed)) {
    return { passed: false, label: "Signal/audit parsed payload mismatch" };
  }
  return { passed: true, label: `Parser proof ${chain.parserConfidence}` };
}

function buildAlertCaptureProofSummary(chain: AlertEvidenceChain): { passed: boolean; label: string } {
  if (!chain.signal) {
    return { passed: true, label: formatAlertTestCaptureLabel(chain) };
  }
  if (!chain.signal.capturePath && !chain.signal.messageUrl) {
    return { passed: false, label: "Physical capture proof missing" };
  }
  if (!chain.signal.messageUrl) {
    return { passed: false, label: "Discord message URL proof missing" };
  }
  if (chain.signal.capturePath) {
    return { passed: true, label: `Capture ${chain.signal.capturePath}` };
  }
  if (chain.signal.messageUrl) {
    return { passed: true, label: `Message ${chain.signal.messageUrl}` };
  }
  return { passed: false, label: "Physical capture proof missing" };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "null" : serialized;
}

function buildAlertContractProofSummary(chain: AlertEvidenceChain): { passed: boolean; label: string } {
  const decision = chain.decision;
  if (!decision) {
    return { passed: false, label: "Contract proof requires audit" };
  }
  if (!decision.eventId) {
    return { passed: false, label: "Event id missing" };
  }
  if (decision.contractVersion !== CHROME_DISCORD_MESSAGE_CONTRACT_VERSION) {
    return {
      passed: false,
      label: `Contract ${decision.contractVersion || "missing"} rejected`,
    };
  }
  if (chain.signal) {
    if (!chain.signal.eventId) {
      return { passed: false, label: "Signal event id missing" };
    }
    if (chain.signal.eventId !== decision.eventId) {
      return { passed: false, label: "Signal/audit event mismatch" };
    }
    if (chain.signal.channelId !== decision.channel.id) {
      return { passed: false, label: "Signal/audit channel mismatch" };
    }
    if (chain.signal.authorId !== decision.author.id) {
      return { passed: false, label: "Signal/audit author mismatch" };
    }
    if (!chain.signal.rawText || !decision.rawText) {
      return { passed: false, label: "Signal/audit raw text missing" };
    }
    if (chain.signal.rawText && decision.rawText && chain.signal.rawText !== decision.rawText) {
      return { passed: false, label: "Signal/audit raw text mismatch" };
    }
    if (chain.signal.contractVersion !== CHROME_DISCORD_MESSAGE_CONTRACT_VERSION) {
      return {
        passed: false,
        label: `Signal contract ${chain.signal.contractVersion || "missing"} rejected`,
      };
    }
  }
  return {
    passed: true,
    label: `Contract ${CHROME_DISCORD_MESSAGE_CONTRACT_VERSION}`,
  };
}

export function buildAlertReconciliationTraceSummary(
  chain: AlertEvidenceChain | null | undefined,
  rows: ReconciliationRow[],
): AlertReconciliationTraceSummary {
  if (!chain) {
    return {
      gateLabel: "Trace blocked",
      alertLabel: "Alert proof missing",
      reconciliationLabel: "No alert chain to reconcile",
      orderLabel: "Order proof missing",
      positionLabel: "Position proof missing",
      auditLabel: "Audit proof missing",
      blocking: true,
    };
  }

  const ingestion = chain.decision?.decision ?? chain.signal?.ingestion ?? null;
  const auditLabel = chain.decision?.auditEventId ? `Audit ${chain.decision.auditEventId}` : "Audit proof missing";
  if (!ingestion) {
    return {
      gateLabel: "Trace blocked",
      alertLabel: "Alert proof missing",
      reconciliationLabel: "Ingestion proof missing",
      orderLabel: "Order proof missing",
      positionLabel: "Position proof missing",
      auditLabel,
      blocking: true,
    };
  }

  if (!ingestion.tradeRequested) {
    if (!chain.decision) {
      return {
        gateLabel: "Trace blocked",
        alertLabel: ingestion.alertId ? `Alert ${ingestion.alertId}` : "No inserted alert id",
        reconciliationLabel: "Audit decision required before clearing no-order trace",
        orderLabel: "No order proven by signal only",
        positionLabel: "No position proven by signal only",
        auditLabel,
        blocking: true,
      };
    }
    return {
      gateLabel: "Trace clear",
      alertLabel: ingestion.alertId ? `Alert ${ingestion.alertId}` : "No inserted alert id",
      reconciliationLabel: "No broker reconciliation required",
      orderLabel: "No order expected",
      positionLabel: "No position expected",
      auditLabel,
      blocking: false,
    };
  }

  if (!ingestion.alertId) {
    return {
      gateLabel: "Trace blocked",
      alertLabel: "Inserted alert id missing",
      reconciliationLabel: "Cannot match reconciliation without alert id",
      orderLabel: "Order proof missing",
      positionLabel: "Position proof missing",
      auditLabel,
      blocking: true,
    };
  }

  const row = rows.find((candidate) => candidate.alertId === ingestion.alertId) ?? null;
  if (!row) {
    return {
      gateLabel: "Trace blocked",
      alertLabel: `Alert ${ingestion.alertId}`,
      reconciliationLabel: `No reconciliation row for alert ${ingestion.alertId}`,
      orderLabel: "Order proof missing",
      positionLabel: "Position proof missing",
      auditLabel,
      blocking: true,
    };
  }

  if (row.simulated) {
    return {
      gateLabel: "Trace blocked",
      alertLabel: `Alert ${ingestion.alertId}`,
      reconciliationLabel: "Simulated reconciliation cannot prove broker execution",
      orderLabel: formatTraceSimulatedOrderLabel(row),
      positionLabel: formatTraceSimulatedPositionLabel(row),
      auditLabel,
      blocking: true,
    };
  }

  const blocking = row.liveBlocking;
  return {
    gateLabel: blocking ? "Trace blocked" : "Trace clear",
    alertLabel: `Alert ${ingestion.alertId}`,
    reconciliationLabel: formatTraceReconciliationLabel(row),
    orderLabel: formatTraceOrderLabel(row),
    positionLabel: formatTracePositionLabel(row),
    auditLabel,
    blocking,
  };
}

export function buildAlertEvidenceTimeline(
  chain: AlertEvidenceChain | null | undefined,
  rows: ReconciliationRow[],
): AlertEvidenceTimelineItem[] {
  if (!chain) {
    return [
      timelineItem("see", "See", "Missing", "No alert chain evidence", true),
      timelineItem("parse", "Parse", "Missing", "No parser evidence", true),
      timelineItem("decide", "Decide", "Missing", "No audit decision", true),
      timelineItem("queue", "Queue/place", "Missing", "No queue evidence", true),
      timelineItem("reconcile", "Reconcile", "Missing", "No reconciliation evidence", true),
    ];
  }

  const ingestion = chain.decision?.decision ?? chain.signal?.ingestion ?? null;
  const parsed = chain.parserConfidence !== "none";
  const queue = buildQueuePlaceEvidenceSummary(chain);
  const reconciliation = buildAlertReconciliationTraceSummary(chain, rows);
  const noOrderExpected = Boolean(ingestion && !ingestion.tradeRequested);

  return [
    timelineItem(
      "see",
      "See",
      chain.signal || chain.decision ? "Seen" : "Missing",
      chain.signal?.busEventId || chain.decision?.auditEventId || chain.eventId,
      !(chain.signal || chain.decision),
    ),
    timelineItem(
      "parse",
      "Parse",
      parsed ? `Parsed ${chain.parserConfidence}` : "Parse missing",
      parsed ? chain.rawText || chain.eventId : "Parser output missing",
      !parsed,
    ),
    timelineItem(
      "decide",
      "Decide",
      chain.decision ? formatStatusLabel(chain.decision.decision.status) : "Decision missing",
      chain.latestReason || "No audit decision reason",
      !chain.decision,
    ),
    timelineItem(
      "queue",
      "Queue/place",
      queue.blocking
        ? noOrderExpected
          ? "No order queued"
          : "Queue blocked"
        : "Order queued",
      queue.reasonLabel,
      noOrderExpected ? false : queue.blocking,
    ),
    timelineItem(
      "reconcile",
      "Reconcile",
      reconciliation.blocking ? "Reconcile blocked" : "Reconciled",
      reconciliation.reconciliationLabel,
      reconciliation.blocking,
    ),
  ];
}

export function buildAlertAuditDigest(
  chain: AlertEvidenceChain | null | undefined,
  rows: ReconciliationRow[],
): AlertAuditDigest {
  const alertTest = buildAlertTestEvidenceSummary(chain);
  const source = buildSourcePolicySummary(chain);
  const queue = buildQueuePlaceEvidenceSummary(chain);
  const reconciliation = buildAlertReconciliationTraceSummary(chain, rows);
  const ingestion = chain?.decision?.decision ?? chain?.signal?.ingestion ?? null;
  const rawText = chain?.rawText ?? "";
  const blocking = alertTest.blocking || source.blocking || queue.blocking || reconciliation.blocking;

  return {
    eventId: chain?.eventId ?? "",
    observedAt: chain?.observedAt ?? "",
    status: chain?.status ?? "unknown",
    alertId: ingestion?.alertId ?? "",
    auditEventId: chain?.decision?.auditEventId ?? "",
    busEventId: chain?.signal?.busEventId ?? "",
    sourceKey: chain?.decision?.source.key ?? "",
    channelId: chain?.decision?.channel.id || chain?.signal?.channelId || "",
    authorId: chain?.decision?.author.id || chain?.signal?.authorId || "",
    messageUrl: chain?.decision?.channel.messageUrl || chain?.signal?.messageUrl || "",
    parserConfidence: chain?.parserConfidence ?? "none",
    rawTextFingerprint: buildRawTextFingerprint(rawText),
    rawTextLength: rawText.length,
    contractLabel: alertTest.contractLabel,
    parserLabel: alertTest.parserLabel,
    sourceGateLabel: source.gateLabel,
    sourceLabel: source.sourceLabel,
    queueGateLabel: queue.gateLabel,
    queueLabel: queue.queueLabel,
    reconciliationGateLabel: reconciliation.gateLabel,
    reconciliationLabel: reconciliation.reconciliationLabel,
    orderLabel: reconciliation.orderLabel,
    positionLabel: reconciliation.positionLabel,
    blocking,
    blockingLabels: blocking
      ? uniqueNonEmpty([
          alertTest.blocking ? alertTest.contractLabel : "",
          alertTest.blocking ? alertTest.parserLabel : "",
          source.blocking ? source.statusLabel : "",
          queue.blocking ? queue.gateLabel : "",
          reconciliation.blocking ? reconciliation.reconciliationLabel : "",
        ])
      : [],
  };
}

export function buildQueuePlaceEvidenceSummary(chain: AlertEvidenceChain | null | undefined): QueuePlaceEvidenceSummary {
  const ingestion = chain?.decision?.decision ?? chain?.signal?.ingestion ?? null;
  if (!ingestion) {
    return {
      statusLabel: "Execution proof missing",
      gateLabel: "Blocks execution",
      alertInsertLabel: "Alert insert proof missing",
      queueLabel: "Queue proof missing",
      reasonLabel: "No execution decision evidence",
      auditLabel: "No audited decision",
      blocking: true,
    };
  }

  const audited = Boolean(chain?.decision);
  const hasInsertedAlertId = Boolean(ingestion.alertId);
  const queued = audited && ingestion.alertInserted && hasInsertedAlertId && ingestion.tradeRequested;
  return {
    statusLabel: formatQueuePlaceStatusLabel(ingestion.status, ingestion.alertInserted, ingestion.tradeRequested),
    gateLabel: queued
      ? "Queue proof clear"
      : ingestion.tradeRequested
        ? "Queue proof blocked"
        : "No order queued",
    alertInsertLabel: ingestion.alertInserted
      ? hasInsertedAlertId
        ? `Alert inserted: ${ingestion.alertId}`
        : "Alert insert id missing"
      : "Alert not inserted",
    queueLabel: ingestion.tradeRequested ? "Trade request queued" : "Trade request not queued",
    reasonLabel: firstNonEmptyText(ingestion.tradeRequestReason, ingestion.skipReason, "No execution reason returned"),
    auditLabel: chain?.decision?.auditEventId ? `Audited decision: ${chain.decision.auditEventId}` : "No audited decision",
    blocking: !queued,
  };
}

function timelineItem(
  key: AlertEvidenceTimelineItem["key"],
  label: string,
  statusLabel: string,
  detailLabel: string,
  blocking: boolean,
): AlertEvidenceTimelineItem {
  return { key, label, statusLabel, detailLabel, blocking };
}

export function buildSourcePolicySummary(chain: AlertEvidenceChain | null | undefined): SourcePolicyDisplaySummary {
  const source = chain?.decision?.source;
  if (!source) {
    return {
      statusLabel: "Source proof missing",
      gateLabel: "Blocks alert",
      sourceLabel: "No source policy proof",
      confidenceLabel: "Parser proof missing",
      channelLabel: "Channel proof missing",
      authorLabel: "Author proof missing",
      executionModeLabel: "Execution mode unknown",
      blocking: true,
    };
  }

  const passed =
    Boolean(source.key) &&
    source.overrideMatched &&
    source.parserConfidenceAllowed &&
    source.observedParserConfidence !== "none" &&
    source.minParserConfidence !== "none" &&
    source.channelUrlAllowed &&
    source.allowedChannelUrlCountProvided &&
    source.authorIdAllowed &&
    source.allowedAuthorIdCountProvided &&
    source.metadataPolicyPassed;

  return {
    statusLabel: passed ? "Source policy passed" : "Source policy blocked",
    gateLabel: passed ? "Source gate clear" : "Blocks alert",
    sourceLabel: formatSourceIdentityLabel(source.name, source.key, source.overrideMatched),
    confidenceLabel: formatParserPolicyLabel(
      source.observedParserConfidence,
      source.minParserConfidence,
      source.parserConfidenceAllowed,
    ),
    channelLabel: formatPolicyAllowlistLabel(
      "Channel",
      source.channelUrlAllowed,
      source.allowedChannelUrlCount,
      source.allowedChannelUrlCountProvided,
    ),
    authorLabel: formatPolicyAllowlistLabel(
      "Author",
      source.authorIdAllowed,
      source.allowedAuthorIdCount,
      source.allowedAuthorIdCountProvided,
    ),
    executionModeLabel: formatSourceExecutionModeLabel(source.paperOnly, source.requireManualConfirm),
    blocking: !passed,
  };
}

export function createAlertEvidenceStore(checker: AlertEvidenceChecker = fetchRemoteAlertEvidence) {
  return createStore<AlertEvidenceState>()((set, get) => ({
    snapshot: getDefaultAlertEvidenceSnapshot(),
    activeRequestId: 0,
    nextRequestId: 1,
    updateConnectionDraft: (draft) => {
      const normalized = normalizeConnectionDraft(draft);
      set((state) => ({
        ...state,
        activeRequestId: 0,
        snapshot: {
          ...state.snapshot,
          connection: {
            ...normalized,
            transport: classifyRemoteTransport(normalized.baseApiUrl),
          },
          evidence: buildEmptyEvidenceSnapshot(),
          checking: false,
          lastError: "",
        },
      }));
    },
    refreshEvidence: async () => {
      const connection = get().snapshot.connection;
      const requestConnectionKey = connectionKey(connection);
      const requestId = get().nextRequestId;
      set((state) => ({
        ...state,
        activeRequestId: requestId,
        nextRequestId: state.nextRequestId + 1,
        snapshot: {
          ...state.snapshot,
          checking: true,
          lastError: "",
        },
      }));

      const result = await checker({
        baseApiUrl: connection.baseApiUrl,
        apiKey: connection.apiKey,
      });

      set((state) => {
        if (
          state.activeRequestId !== requestId ||
          connectionKey(state.snapshot.connection) !== requestConnectionKey
        ) {
          return state;
        }

        return {
          ...state,
          activeRequestId: 0,
          snapshot: {
            ...state.snapshot,
            checking: false,
            evidence: result.snapshot,
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const alertEvidenceStore = createAlertEvidenceStore();

export function useAlertEvidenceState(): AlertEvidenceState;
export function useAlertEvidenceState<T>(selector: (state: AlertEvidenceState) => T): T;
export function useAlertEvidenceState<T>(selector?: (state: AlertEvidenceState) => T) {
  return selector ? useStore(alertEvidenceStore, selector) : useStore(alertEvidenceStore);
}

function normalizeConnectionDraft(draft: AlertEvidenceConnectionDraft): AlertEvidenceConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function connectionKey(connection: AlertEvidenceConnection): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

function formatTransportLabel(connection: AlertEvidenceConnection): string {
  if (!connection.baseApiUrl) {
    return "Not paired";
  }

  switch (connection.transport) {
    case "tailscale":
      return "Tailscale";
    case "same_wifi":
      return "Same Wi-Fi";
    case "cloud_relay":
      return "Cloud relay";
    case "none":
      return "Not paired";
  }
}

function formatBridgeHealthLabel(status: "healthy" | "unhealthy" | "unknown"): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unhealthy":
      return "Unhealthy";
    case "unknown":
      return "Unknown";
  }
}

function formatSupervisorStatusLabel(state: string): string {
  switch (state) {
    case "healthy":
      return "Supervisor healthy";
    case "backoff":
      return "Supervisor backoff";
    case "disabled":
      return "Supervisor disabled";
    case "attention":
      return "Supervisor attention";
    default:
      return "Supervisor unknown";
  }
}

function formatSupervisorDetailLabel(source: string, reason: string): string {
  if (source && reason) {
    return `${source} - ${reason}`;
  }
  if (source) {
    return source;
  }
  if (reason) {
    return reason;
  }
  return "No supervisor heartbeat";
}

function formatSupervisorTabLabel(
  supervisedTabs: number | null,
  restartedTabs: number | null,
  discordTabs: number | null,
  configuredTargets: number | null,
): string {
  if (supervisedTabs !== null || restartedTabs !== null) {
    return `Tabs: ${supervisedTabs ?? 0} supervised, ${restartedTabs ?? 0} restarted`;
  }
  if (discordTabs !== null || configuredTargets !== null) {
    return `Tabs: ${discordTabs ?? 0} Discord, ${configuredTargets ?? 0} target(s)`;
  }
  return "Tabs: not reported";
}

function formatSupervisorBackoffLabel(
  restartAttempt: number | null,
  nextRestartAt: string,
  state: string,
): string {
  if (restartAttempt !== null && nextRestartAt) {
    return `Backoff attempt ${restartAttempt}, next retry ${nextRestartAt}`;
  }
  if (restartAttempt !== null) {
    return `Backoff attempt ${restartAttempt}, next retry not reported`;
  }
  if (nextRestartAt) {
    return `Backoff next retry ${nextRestartAt}`;
  }
  if (state === "healthy") {
    return "Backoff idle";
  }
  if (state === "backoff") {
    return "Backoff active, next retry not reported";
  }
  return "Backoff not reported";
}

function formatSupervisorFailureLabel(failures: string[]): string {
  return failures.length > 0 ? `Failures: ${failures.join("; ")}` : "Failures: none";
}

function formatQueuePlaceStatusLabel(status: string, alertInserted: boolean, tradeRequested: boolean): string {
  if (alertInserted && tradeRequested) {
    return "Order request queued";
  }
  if (status === "skipped") {
    return "Alert skipped";
  }
  if (alertInserted) {
    return "Alert captured only";
  }
  return "Execution blocked";
}

function formatAlertTestModeLabel(hasSignal: boolean, hasDecision: boolean): string {
  if (hasSignal && hasDecision) {
    return "Physical bridge test";
  }
  if (hasDecision) {
    return "Silent audit test";
  }
  if (hasSignal) {
    return "Physical observation missing audit";
  }
  return "Alert test proof missing";
}

function formatAlertTestQueueLabel(queue: QueuePlaceEvidenceSummary): string {
  if (!queue.blocking) {
    return queue.statusLabel;
  }
  if (queue.queueLabel === "Queue proof missing") {
    return "Queue proof missing";
  }
  return queue.gateLabel;
}

function formatAlertTestCaptureLabel(chain: AlertEvidenceChain): string {
  const capturePath = firstNonEmptyText(chain.decision?.capturePath ?? "", chain.signal?.capturePath ?? "");
  if (capturePath) {
    return `Capture ${capturePath}`;
  }
  const messageUrl = firstNonEmptyText(chain.decision?.channel.messageUrl ?? "", chain.signal?.messageUrl ?? "");
  if (messageUrl) {
    return `Message ${messageUrl}`;
  }
  if (chain.decision && !chain.signal) {
    return "No physical capture";
  }
  return "No capture evidence";
}

function formatTraceReconciliationLabel(row: ReconciliationRow): string {
  if (row.liveBlocking) {
    return `Reconciliation blocking: ${row.attentionReason || "attention required"}`;
  }
  if (row.attentionReason) {
    return `Reconciliation attention: ${row.attentionReason}`;
  }
  return "Reconciled row matched";
}

function formatTraceOrderLabel(row: ReconciliationRow): string {
  if (row.orderId) {
    return `Order ${row.orderId}`;
  }
  if (row.tradeId) {
    return `Trade ${row.tradeId}; order id missing`;
  }
  return "Order proof missing";
}

function formatTracePositionLabel(row: ReconciliationRow): string {
  if (row.positionId && row.positionStatus) {
    return `Position ${row.positionId} - ${row.positionStatus}`;
  }
  if (row.positionId) {
    return `Position ${row.positionId}`;
  }
  if (isTraceTerminalNoFill(row.tradeStatus)) {
    return `No position expected (${row.tradeStatus})`;
  }
  return "Position proof missing";
}

function formatTraceSimulatedOrderLabel(row: ReconciliationRow): string {
  if (row.orderId) {
    return `Simulated order ${row.orderId}`;
  }
  if (row.tradeId) {
    return `Simulated trade ${row.tradeId}; broker order id missing`;
  }
  return "Simulated order proof missing";
}

function formatTraceSimulatedPositionLabel(row: ReconciliationRow): string {
  if (row.positionId && row.positionStatus) {
    return `Simulated position ${row.positionId} - ${row.positionStatus}`;
  }
  if (row.positionId) {
    return `Simulated position ${row.positionId}`;
  }
  if (isTraceTerminalNoFill(row.tradeStatus)) {
    return `No position expected (${row.tradeStatus})`;
  }
  return "Simulated position proof missing";
}

function isTraceTerminalNoFill(status: string): boolean {
  return ["failed", "rejected", "canceled", "cancelled", "expired", "closed"].includes(status);
}

function formatSourceIdentityLabel(name: string, key: string, overrideMatched: boolean): string {
  if (!key) {
    return `${name || "Unknown source"} - source key missing`;
  }
  const sourceName = name && key ? `${name} (${key})` : name || key || "Unknown source";
  return `${sourceName} - ${overrideMatched ? "override matched" : "override missing"}`;
}

function formatParserPolicyLabel(observed: string, minimum: string, allowed: boolean): string {
  const observedLabel = observed || "none";
  const minimumLabel = minimum || "none";
  if (observedLabel === "none" || minimumLabel === "none") {
    return "Parser proof missing";
  }
  return allowed
    ? `Parser ${observedLabel} >= ${minimumLabel}`
    : `Parser ${observedLabel} below ${minimumLabel}`;
}

function formatPolicyAllowlistLabel(
  label: "Channel" | "Author",
  allowed: boolean,
  count: number,
  countProvided: boolean,
): string {
  if (!countProvided) {
    return `${label} allowlist proof missing`;
  }
  if (count === 0) {
    return allowed
      ? `${label} allowed (all permitted)`
      : `${label} blocked (no explicit allowlist entries)`;
  }
  return `${label} ${allowed ? "allowed" : "blocked"} (${count} ${count === 1 ? "allowlist entry" : "allowlist entries"})`;
}

function formatSourceExecutionModeLabel(paperOnly: boolean, requireManualConfirm: boolean): string {
  if (paperOnly && requireManualConfirm) {
    return "Paper-only source; manual confirmation required";
  }
  if (paperOnly) {
    return "Paper-only source";
  }
  if (requireManualConfirm) {
    return "Manual confirmation required";
  }
  return "Auto-live source allowed";
}

function firstNonEmptyText(...values: string[]): string {
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function buildRawTextFingerprint(rawText: string): string {
  const normalized = rawText.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) {
    return "";
  }
  return `fnv1a32:${fnv1a32Hex(normalized)}`;
}

function fnv1a32Hex(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "skipped":
      return "Skipped";
    case "duplicate":
      return "Duplicate";
    default:
      return "Unknown";
  }
}
