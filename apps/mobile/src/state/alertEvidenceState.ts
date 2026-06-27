import { normalizeBridgeHealthPayload, type AlertEvidenceChain } from "@apk-alerts/contracts";
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
  parserLabel: string;
  sourceLabel: string;
  queueLabel: string;
  auditLabel: string;
  captureLabel: string;
  blocking: boolean;
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
  const hasParserProof = chain.parserConfidence !== "none";
  const hasAuditProof = Boolean(chain.decision?.auditEventId);
  const clear = hasParserProof && !source.blocking && !queue.blocking && hasAuditProof;

  return {
    modeLabel: formatAlertTestModeLabel(Boolean(chain.signal), Boolean(chain.decision)),
    gateLabel: clear ? "Test proof clear" : "Blocks test",
    parserLabel: hasParserProof ? `Parser proof ${chain.parserConfidence}` : "Parser proof missing",
    sourceLabel: source.statusLabel,
    queueLabel: formatAlertTestQueueLabel(queue),
    auditLabel: chain.decision?.auditEventId ? `Audit ${chain.decision.auditEventId}` : "Audit proof missing",
    captureLabel: formatAlertTestCaptureLabel(chain),
    blocking: !clear,
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
  const queued = audited && ingestion.alertInserted && ingestion.tradeRequested;
  return {
    statusLabel: formatQueuePlaceStatusLabel(ingestion.status, ingestion.alertInserted, ingestion.tradeRequested),
    gateLabel: queued ? "Queue proof clear" : "No order queued",
    alertInsertLabel: ingestion.alertInserted
      ? `Alert inserted: ${ingestion.alertId || "id missing"}`
      : "Alert not inserted",
    queueLabel: ingestion.tradeRequested ? "Trade request queued" : "Trade request not queued",
    reasonLabel: firstNonEmptyText(ingestion.tradeRequestReason, ingestion.skipReason, "No execution reason returned"),
    auditLabel: chain?.decision?.auditEventId ? `Audited decision: ${chain.decision.auditEventId}` : "No audited decision",
    blocking: !queued,
  };
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
    source.overrideMatched &&
    source.parserConfidenceAllowed &&
    source.channelUrlAllowed &&
    source.authorIdAllowed &&
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
    channelLabel: formatPolicyAllowlistLabel("Channel", source.channelUrlAllowed, source.allowedChannelUrlCount),
    authorLabel: formatPolicyAllowlistLabel("Author", source.authorIdAllowed, source.allowedAuthorIdCount),
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

function formatSourceIdentityLabel(name: string, key: string, overrideMatched: boolean): string {
  const sourceName = name && key ? `${name} (${key})` : name || key || "Unknown source";
  return `${sourceName} - ${overrideMatched ? "override matched" : "override missing"}`;
}

function formatParserPolicyLabel(observed: string, minimum: string, allowed: boolean): string {
  const observedLabel = observed || "none";
  const minimumLabel = minimum || "none";
  return allowed
    ? `Parser ${observedLabel} >= ${minimumLabel}`
    : `Parser ${observedLabel} below ${minimumLabel}`;
}

function formatPolicyAllowlistLabel(label: "Channel" | "Author", allowed: boolean, count: number): string {
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
