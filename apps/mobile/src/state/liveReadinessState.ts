import { normalizeLiveReadinessPayload } from "@apk-alerts/contracts";
import {
  fetchRemoteLiveReadiness,
  type RemoteLiveReadinessClientConfig,
  type RemoteLiveReadinessResult,
  type RemoteLiveReadinessSnapshot,
} from "@apk-alerts/sync-client";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { classifyRemoteTransport, type RemoteTransport } from "./remoteEngineState";

export type LiveReadinessChecker = (
  config: RemoteLiveReadinessClientConfig,
) => Promise<RemoteLiveReadinessResult>;

export interface LiveReadinessConnection {
  baseApiUrl: string;
  apiKey: string;
  transport: RemoteTransport;
}

export interface LiveReadinessConnectionDraft {
  baseApiUrl: string;
  apiKey: string;
}

export interface LiveReadinessSnapshot {
  connection: LiveReadinessConnection;
  remote: RemoteLiveReadinessSnapshot;
  checking: boolean;
  lastError: string;
}

export interface LiveReadinessSummary {
  connectionLabel: string;
  readinessLabel: string;
  liveMoneyLabel: string;
  primaryReason: string;
  brokerLabel: string;
  ingestionLabel: string;
  replayLabel: string;
  reconciliationLabel: string;
  exitAutomationLabel: string;
  runtimeLabel: string;
  lastCheckLabel: string;
  errorLabel: string;
}

export interface ReplayAcceptanceEvidenceSummary {
  statusLabel: string;
  gateLabel: string;
  detailLabel: string;
  proofLabel: string;
  failedEventsLabel: string;
  missingEventsLabel: string;
  blocking: boolean;
}

export interface ExitProtectionEvidenceSummary {
  statusLabel: string;
  gateLabel: string;
  configurationLabel: string;
  capabilityLabel: string;
  unprotectedPositionsLabel: string;
  metadataOnlyPositionsLabel: string;
  blocking: boolean;
}

export interface LiveArmChecklistItem {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  blocking: boolean;
}

export interface LiveArmChecklistSummary {
  gateLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  blocking: boolean;
  items: LiveArmChecklistItem[];
}

export interface LiveReadinessState {
  snapshot: LiveReadinessSnapshot;
  activeRequestId: number;
  nextRequestId: number;
  updateConnectionDraft: (draft: LiveReadinessConnectionDraft) => void;
  checkReadiness: () => Promise<void>;
}

function buildEmptyRemoteSnapshot(): RemoteLiveReadinessSnapshot {
  const readiness = normalizeLiveReadinessPayload(null);
  return {
    checkedAt: "",
    readiness,
    liveMoneyReady: false,
  };
}

export function getDefaultLiveReadinessSnapshot(): LiveReadinessSnapshot {
  return {
    connection: {
      baseApiUrl: "",
      apiKey: "",
      transport: "none",
    },
    remote: buildEmptyRemoteSnapshot(),
    checking: false,
    lastError: "",
  };
}

export function buildLiveReadinessSummary(snapshot: LiveReadinessSnapshot): LiveReadinessSummary {
  const readiness = snapshot.remote.readiness;
  const checks = readiness.checks;
  return {
    connectionLabel: formatTransportLabel(snapshot.connection),
    readinessLabel: snapshot.remote.liveMoneyReady
      ? "Ready"
      : readiness.readyForLive
        ? "Ready to arm"
        : "Blocked",
    liveMoneyLabel: snapshot.remote.liveMoneyReady ? "Live money ready" : "Live money blocked",
    primaryReason: buildPrimaryReason(snapshot),
    brokerLabel: `${checks.broker.activeBroker} - ${checks.broker.connected ? "broker connected" : "broker offline"}`,
    ingestionLabel: checks.signalIngestion.chromeBridgeHealthy
      ? "Chrome bridge healthy"
      : checks.signalIngestion.discordConnected
        ? "Discord bot connected"
        : "No live ingestion healthy",
    replayLabel: `Replay ${checks.simulationReplay.acceptanceStatus} (${checks.simulationReplay.passedCount}/${checks.simulationReplay.expectedCount})`,
    reconciliationLabel: checks.reconciliation.unresolvedCount === 0
      ? "Reconciliation clear"
      : `${checks.reconciliation.unresolvedCount} unresolved reconciliation item(s)`,
    exitAutomationLabel: checks.exitAutomation.ocoExitsConfigured
      ? "OCO exits configured"
      : "OCO exits missing",
    runtimeLabel: checks.runtime.liveTradingArmed
      ? `Armed until ${checks.runtime.liveTradingArmedUntil || "unknown"}`
      : "Not armed",
    lastCheckLabel: snapshot.remote.checkedAt ? `Checked ${snapshot.remote.checkedAt}` : "Never checked",
    errorLabel: snapshot.lastError,
  };
}

export function buildReplayAcceptanceEvidenceSummary(
  snapshot: LiveReadinessSnapshot,
): ReplayAcceptanceEvidenceSummary {
  const replay = snapshot.remote.readiness.checks.simulationReplay;
  const hasFailedEvents =
    replay.failedCount > 0 ||
    replay.failedEventCount > 0 ||
    replay.failedEventIds.length > 0;
  const hasMissingEvents = replay.missingEventCount > 0 || replay.missingEventIds.length > 0;
  const hasReplayProof = replay.updatedAt.length > 0 && replay.replayUrl.length > 0;
  const acceptedExpectedAlerts = replay.expectedCount > 0 && replay.passedCount >= replay.expectedCount;
  const passed =
    replay.acceptanceStatus === "passed" &&
    acceptedExpectedAlerts &&
    !hasFailedEvents &&
    !hasMissingEvents &&
    hasReplayProof;
  const failed = replay.acceptanceStatus === "failed" || hasFailedEvents || hasMissingEvents;

  return {
    statusLabel: passed ? "Replay proof passed" : failed ? "Replay proof failed" : "Replay proof missing",
    gateLabel: passed ? "Replay gate clear" : "Blocks live",
    detailLabel: `${replay.passedCount}/${replay.expectedCount} expected alert(s) accepted`,
    proofLabel: formatReplayProofLabel(replay.updatedAt, replay.replayUrl),
    failedEventsLabel: formatReplayEventEvidenceLabel("Failed", replay.failedEventIds, replay.failedEventCount),
    missingEventsLabel: formatReplayEventEvidenceLabel("Missing", replay.missingEventIds, replay.missingEventCount),
    blocking: !passed,
  };
}

export function buildExitProtectionEvidenceSummary(
  snapshot: LiveReadinessSnapshot,
): ExitProtectionEvidenceSummary {
  const exits = snapshot.remote.readiness.checks.exitAutomation;
  const hasBrokerExitCapabilities = exits.brokerOrderStatusSupported && exits.brokerCancelSupported;
  const hasUnprotectedPositions =
    exits.unprotectedOpenPositionCount > 0 ||
    exits.unprotectedOpenPositionIds.length > 0;
  const hasMetadataOnlyPositions =
    exits.metadataOnlyOpenPositionCount > 0 ||
    exits.metadataOnlyOpenPositionIds.length > 0;
  const protectedByOco =
    exits.ocoExitsConfigured &&
    hasBrokerExitCapabilities &&
    !hasUnprotectedPositions &&
    !hasMetadataOnlyPositions;

  return {
    statusLabel: protectedByOco ? "OCO exits protected" : "OCO exits blocking",
    gateLabel: protectedByOco ? "Exit gate clear" : "Blocks live",
    configurationLabel: exits.ocoExitsConfigured ? "OCO exits configured" : "OCO exits missing",
    capabilityLabel: hasBrokerExitCapabilities
      ? "Broker can monitor and cancel exits"
      : "Broker exit automation capabilities missing",
    unprotectedPositionsLabel: formatPositionEvidenceLabel(
      "Unprotected",
      exits.unprotectedOpenPositionIds,
      exits.unprotectedOpenPositionCount,
    ),
    metadataOnlyPositionsLabel: formatPositionEvidenceLabel(
      "Metadata-only",
      exits.metadataOnlyOpenPositionIds,
      exits.metadataOnlyOpenPositionCount,
    ),
    blocking: !protectedByOco,
  };
}

export function buildLiveArmChecklistSummary(snapshot: LiveReadinessSnapshot): LiveArmChecklistSummary {
  const readiness = snapshot.remote.readiness;
  const checks = readiness.checks;
  const missingEndpointEvidence = !snapshot.remote.checkedAt;
  const replay = buildReplayAcceptanceEvidenceSummary(snapshot);
  const exits = buildExitProtectionEvidenceSummary(snapshot);
  const brokerCapabilities = checks.broker.capabilities;
  const brokerReady =
    checks.broker.configured &&
    checks.broker.connected &&
    brokerCapabilities.supportsLiveTrading &&
    brokerCapabilities.supportsOptions &&
    brokerCapabilities.supportsOrderStatus &&
    brokerCapabilities.supportsCancelOrder &&
    checks.broker.missingRequiredFields.length === 0;
  const sourceReady = checks.sourcePolicy.valid && checks.sourcePolicy.autoLiveSources > 0;
  const ingestionReady = checks.signalIngestion.discordConnected || checks.signalIngestion.chromeBridgeHealthy;
  const tradingReady =
    checks.trading.autoTradingEnabled &&
    !checks.trading.simulationMode &&
    checks.trading.maxPositionSizeValid;
  const runtimeReady = !checks.runtime.shutdownTriggered && checks.runtime.liveTradingArmed;
  const endpointReady =
    readiness.readyForLive &&
    readiness.blockingCodes.length === 0 &&
    !readiness.blockingCodes.includes("readiness_payload_invalid");

  const items: LiveArmChecklistItem[] = [
    checklistItem({
      key: "endpoint",
      label: "Endpoint verdict",
      passed: endpointReady,
      statusLabel: missingEndpointEvidence
        ? "Endpoint evidence missing"
        : endpointReady
          ? "Endpoint verdict ready"
          : "Endpoint verdict blocked",
      detailLabel: formatEndpointChecklistDetail(snapshot),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "role",
      label: "Execution role",
      passed: checks.role.valid && checks.role.liveExecutionAllowed,
      statusLabel: checks.role.valid && checks.role.liveExecutionAllowed
        ? "Live execution role allowed"
        : "Execution role blocked",
      detailLabel: checks.role.activeRole || "No active role reported",
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "api_auth",
      label: "API auth",
      passed: checks.apiAuth.configured || checks.apiAuth.authlessDesktopMode,
      statusLabel: checks.apiAuth.configured || checks.apiAuth.authlessDesktopMode
        ? "API auth available"
        : "API auth missing",
      detailLabel: formatApiAuthChecklistDetail(
        checks.apiAuth.configured,
        checks.apiAuth.authlessDesktopMode,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "credential",
      label: "Credential key",
      passed: checks.credentialKey.configured && checks.credentialKey.valid,
      statusLabel: checks.credentialKey.configured && checks.credentialKey.valid
        ? "Credential key valid"
        : "Credential key invalid",
      detailLabel: formatCredentialChecklistDetail(checks.credentialKey.configured, checks.credentialKey.valid),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "broker",
      label: "Broker",
      passed: brokerReady,
      statusLabel: brokerReady ? "Broker ready" : "Broker blocked",
      detailLabel: formatBrokerChecklistDetail(
        checks.broker.activeBroker,
        checks.broker.connected,
        checks.broker.missingRequiredFields,
        brokerCapabilities,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "source",
      label: "Source policy",
      passed: sourceReady,
      statusLabel: sourceReady ? "Source policy clear" : "Source policy blocked",
      detailLabel: checks.sourcePolicy.error ||
        `${checks.sourcePolicy.autoLiveSources} auto-live, ${checks.sourcePolicy.enabledSources} enabled`,
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "ingestion",
      label: "Live ingestion",
      passed: ingestionReady,
      statusLabel: ingestionReady ? "Live ingestion healthy" : "Live ingestion blocked",
      detailLabel: formatIngestionChecklistDetail(
        checks.signalIngestion.chromeBridgeHealthy,
        checks.signalIngestion.discordConnected,
        checks.signalIngestion.discordConfigured,
        checks.signalIngestion.discordChannelCount,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "trading",
      label: "Trading controls",
      passed: tradingReady,
      statusLabel: tradingReady ? "Trading controls clear" : "Trading controls blocked",
      detailLabel: formatTradingChecklistDetail(
        checks.trading.autoTradingEnabled,
        checks.trading.simulationMode,
        checks.trading.maxPositionSize,
        checks.trading.maxPositionSizeValid,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "replay",
      label: "Replay acceptance",
      passed: !replay.blocking,
      statusLabel: replay.statusLabel,
      detailLabel: replay.detailLabel,
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "reconciliation",
      label: "Broker reconciliation",
      passed: checks.reconciliation.unresolvedCount === 0,
      statusLabel: checks.reconciliation.unresolvedCount === 0 ? "Reconciliation clear" : "Reconciliation blocked",
      detailLabel: formatReasonListLabel(
        checks.reconciliation.unresolvedReasons,
        `${checks.reconciliation.unresolvedCount} unresolved item(s)`,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "alert_chains",
      label: "Alert chains",
      passed: checks.alertChains.liveBlockingAttentionCount === 0,
      statusLabel: checks.alertChains.liveBlockingAttentionCount === 0 ? "Alert chains clear" : "Alert chains blocked",
      detailLabel: formatReasonListLabel(
        checks.alertChains.liveBlockingAttentionReasons,
        `${checks.alertChains.liveBlockingAttentionCount} live-blocking alert chain(s)`,
      ),
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "exits",
      label: "OCO exits",
      passed: !exits.blocking,
      statusLabel: exits.statusLabel,
      detailLabel: exits.capabilityLabel,
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "runtime",
      label: "Runtime arming",
      passed: runtimeReady,
      statusLabel: runtimeReady ? "Runtime armed" : "Runtime not armed",
      detailLabel: checks.runtime.shutdownTriggered
        ? "Shutdown triggered"
        : checks.runtime.liveTradingArmed
          ? `Armed until ${checks.runtime.liveTradingArmedUntil || "unknown"}`
          : "Not armed",
      missingEndpointEvidence,
    }),
    checklistItem({
      key: "readiness_gates",
      label: "Readiness gates",
      passed: checks.readinessGates.missingGateKeys.length === 0,
      statusLabel: checks.readinessGates.missingGateKeys.length === 0 ? "All readiness gates present" : "Readiness gates missing",
      detailLabel: checks.readinessGates.missingGateKeys.length === 0
        ? "No missing gate keys"
        : `Missing ${checks.readinessGates.missingGateKeys.join(", ")}`,
      missingEndpointEvidence,
    }),
  ];
  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;
  const clear = blockingCount === 0 && snapshot.remote.liveMoneyReady;

  return {
    gateLabel: clear ? "Live checklist clear" : "Live checklist blocked",
    readyCountLabel: `${readyCount}/${items.length} gate(s) clear`,
    blockingCountLabel: blockingCount === 0 ? "No live-arm blockers" : `${blockingCount} live-arm blocker(s)`,
    blocking: !clear,
    items,
  };
}

export function createLiveReadinessStore(checker: LiveReadinessChecker = fetchRemoteLiveReadiness) {
  return createStore<LiveReadinessState>()((set, get) => ({
    snapshot: getDefaultLiveReadinessSnapshot(),
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
          remote: buildEmptyRemoteSnapshot(),
          checking: false,
          lastError: "",
        },
      }));
    },
    checkReadiness: async () => {
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
            remote: result.snapshot,
            lastError: result.error,
          },
        };
      });
    },
  }));
}

export const liveReadinessStore = createLiveReadinessStore();

export function useLiveReadinessState(): LiveReadinessState;
export function useLiveReadinessState<T>(selector: (state: LiveReadinessState) => T): T;
export function useLiveReadinessState<T>(selector?: (state: LiveReadinessState) => T) {
  return selector ? useStore(liveReadinessStore, selector) : useStore(liveReadinessStore);
}

function buildPrimaryReason(snapshot: LiveReadinessSnapshot): string {
  const readiness = snapshot.remote.readiness;
  if (!snapshot.remote.checkedAt) {
    return "No live-readiness evidence";
  }
  if (snapshot.remote.liveMoneyReady) {
    return "Endpoint passed and live trading is armed.";
  }
  if (readiness.readyForLive) {
    return "Endpoint passed, but live trading is not armed.";
  }
  const firstIssue = readiness.blockingIssues[0];
  if (firstIssue) {
    return `${firstIssue.code}: ${firstIssue.message}`;
  }
  return "No blocking issue detail returned.";
}

function normalizeConnectionDraft(draft: LiveReadinessConnectionDraft): LiveReadinessConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function connectionKey(connection: LiveReadinessConnection): string {
  return `${connection.baseApiUrl}\n${connection.apiKey}`;
}

function formatTransportLabel(connection: LiveReadinessConnection): string {
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

function formatReplayProofLabel(updatedAt: string, replayUrl: string): string {
  if (updatedAt && replayUrl) {
    return `Proof ${updatedAt} - ${replayUrl}`;
  }
  if (updatedAt) {
    return `Proof ${updatedAt} - missing replay URL`;
  }
  if (replayUrl) {
    return `Proof timestamp missing - ${replayUrl}`;
  }
  return "No replay proof timestamp or URL";
}

function formatReplayEventEvidenceLabel(label: "Failed" | "Missing", eventIds: string[], eventCount: number): string {
  if (eventIds.length > 0) {
    return `${label} events: ${eventIds.join(", ")}`;
  }
  if (eventCount > 0) {
    return `${label} events: ${eventCount} unlisted`;
  }
  return `${label} events: none`;
}

function formatPositionEvidenceLabel(label: "Unprotected" | "Metadata-only", positionIds: string[], count: number): string {
  if (positionIds.length > 0) {
    return `${label} positions: ${positionIds.join(", ")}`;
  }
  if (count > 0) {
    return `${label} positions: ${count} unlisted`;
  }
  return `${label} positions: none`;
}

function checklistItem(input: {
  key: string;
  label: string;
  passed: boolean;
  statusLabel: string;
  detailLabel: string;
  missingEndpointEvidence: boolean;
}): LiveArmChecklistItem {
  return {
    key: input.key,
    label: input.label,
    statusLabel: input.statusLabel,
    detailLabel: input.detailLabel,
    blocking: input.missingEndpointEvidence || !input.passed,
  };
}

function formatEndpointChecklistDetail(snapshot: LiveReadinessSnapshot): string {
  if (!snapshot.remote.checkedAt) {
    return "Run live-readiness check before arming.";
  }
  const readiness = snapshot.remote.readiness;
  if (readiness.blockingCodes.length > 0) {
    return `Blocking codes: ${readiness.blockingCodes.join(", ")}`;
  }
  return `Checked ${snapshot.remote.checkedAt}`;
}

function formatCredentialChecklistDetail(configured: boolean, valid: boolean): string {
  if (configured && valid) {
    return "Configured and valid";
  }
  if (configured) {
    return "Configured but invalid";
  }
  return "Credential key missing";
}

function formatApiAuthChecklistDetail(configured: boolean, authlessDesktopMode: boolean): string {
  if (authlessDesktopMode) {
    return "Authless desktop mode";
  }
  return configured ? "API auth configured" : "No API auth configured";
}

function formatBrokerChecklistDetail(
  activeBroker: string,
  connected: boolean,
  missingRequiredFields: string[],
  capabilities: {
    supportsLiveTrading: boolean;
    supportsOptions: boolean;
    supportsOrderStatus: boolean;
    supportsCancelOrder: boolean;
  },
): string {
  const details = [`${activeBroker} ${connected ? "connected" : "offline"}`];
  if (missingRequiredFields.length > 0) {
    details.push(`missing ${missingRequiredFields.join(", ")}`);
  }
  const missingCapabilities = [
    capabilities.supportsLiveTrading ? "" : "live trading",
    capabilities.supportsOptions ? "" : "options",
    capabilities.supportsOrderStatus ? "" : "order status",
    capabilities.supportsCancelOrder ? "" : "cancel order",
  ].filter(Boolean);
  if (missingCapabilities.length > 0) {
    details.push(`missing ${missingCapabilities.join(", ")}`);
  }
  return details.join("; ");
}

function formatIngestionChecklistDetail(
  chromeBridgeHealthy: boolean,
  discordConnected: boolean,
  discordConfigured: boolean,
  discordChannelCount: number,
): string {
  const bridge = chromeBridgeHealthy ? "Chrome bridge healthy" : "Chrome bridge offline";
  const discord = discordConnected
    ? "Discord connected"
    : discordConfigured
      ? "Discord configured but offline"
      : "Discord not configured";
  return `${bridge}; ${discord}; ${discordChannelCount} channel(s)`;
}

function formatTradingChecklistDetail(
  autoTradingEnabled: boolean,
  simulationMode: boolean,
  maxPositionSize: number | null,
  maxPositionSizeValid: boolean,
): string {
  const mode = simulationMode ? "simulation mode" : "live mode";
  const auto = autoTradingEnabled ? "auto trading enabled" : "auto trading disabled";
  const size = maxPositionSizeValid ? `max position ${maxPositionSize ?? "not reported"}` : "max position invalid";
  return `${auto}; ${mode}; ${size}`;
}

function formatReasonListLabel(reasons: string[], fallback: string): string {
  if (reasons.length > 0) {
    return reasons.join("; ");
  }
  return fallback;
}
