import {
  normalizeRemotePairingConfigPayload,
  type RemotePairingConfig,
} from "@apk-alerts/contracts";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import {
  buildAlertTestEvidenceSummary,
  type AlertEvidenceSnapshot,
} from "./alertEvidenceState";
import {
  buildDiscordWebViewHealthSummary,
  type DiscordWebViewHealthSnapshot,
} from "./discordWebViewState";
import type { LiveReadinessSnapshot } from "./liveReadinessState";
import {
  buildPairingDoctorSummary,
  type PairingDoctorSnapshot,
} from "./pairingDoctorState";
import {
  buildPhoneEngineRuntimeSummary,
  type PhoneEngineRuntimeSnapshot,
} from "./phoneEngineRuntimeState";
import {
  buildPeerAlertOutcomeSummary,
  type PeerAlertFailsafeSnapshot,
} from "./peerAlertFailsafeState";
import type { RemoteConnectionDraft, RemoteEngineSnapshot } from "./remoteEngineState";

export interface WindowsSetupEvidence {
  installerRanAt: string;
  consolidationRepoReady: boolean;
  tailscaleInstalled: boolean;
  tailscaleLoggedIn: boolean;
  tailscaleIp: string;
  tailscaleMagicDnsName: string;
  remoteApiBound: boolean;
  windowsFirewallOpen: boolean;
  apiReachableFromPhone: boolean;
  apiPreflight: WindowsApiPreflightEvidence;
  pairingPackageCreatedAt: string;
  pairingPackageImportedAt: string;
  unattendedSmokeTestPassedAt: string;
}

export interface WindowsApiPreflightEvidence {
  checkedAt: string;
  remoteApiUrl: string;
  apiPort: number;
  firewallRuleName: string;
  firewallRulePresent: boolean;
  localHealthOk: boolean;
  phoneReachabilityOk: boolean;
  httpStatus: number;
  failureStage: string;
  repairHint: string;
  repairCommand: string;
}

export interface WindowsApiPreflightSummary {
  statusLabel: string;
  checkedAtLabel: string;
  detailLabel: string;
  repairLabel: string;
  blocking: boolean;
}

export interface SetupAutomationInput {
  remote: RemoteEngineSnapshot;
  pairing: PairingDoctorSnapshot;
  phoneRuntime: PhoneEngineRuntimeSnapshot;
  webView: DiscordWebViewHealthSnapshot;
  liveReadiness: LiveReadinessSnapshot;
  windows: WindowsSetupEvidence;
}

export interface SetupAutomationItem {
  key: string;
  label: string;
  statusLabel: string;
  detailLabel: string;
  actionLabel: string;
  blocking: boolean;
}

export interface SetupAutomationSummary {
  statusLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  nextActionLabel: string;
  blocking: boolean;
  items: SetupAutomationItem[];
}

export interface SetupSmokeTestInput {
  remote: RemoteEngineSnapshot;
  pairing: PairingDoctorSnapshot;
  phoneRuntime: PhoneEngineRuntimeSnapshot;
  alertEvidence: AlertEvidenceSnapshot;
  peerFailsafe: PeerAlertFailsafeSnapshot;
  windows: WindowsSetupEvidence;
}

export interface SetupSmokeTestSummary {
  statusLabel: string;
  readyCountLabel: string;
  blockingCountLabel: string;
  nextActionLabel: string;
  blocking: boolean;
  items: SetupAutomationItem[];
}

export interface SetupAutomationSnapshot {
  windows: WindowsSetupEvidence;
  lastImportError: string;
  lastImportedAt: string;
}

export interface SetupAutomationState {
  snapshot: SetupAutomationSnapshot;
  updateWindowsEvidence: (patch: Partial<WindowsSetupEvidence>) => void;
  replaceWindowsEvidence: (evidence: WindowsSetupEvidence) => void;
  importPairingPackage: (rawPackage: string) => MobilePairingPackageImportResult;
  clearSetupEvidence: () => void;
}

export interface MobilePairingPackageImportResult {
  ok: boolean;
  connection: RemoteConnectionDraft | null;
  config: RemotePairingConfig | null;
  evidence: WindowsSetupEvidence;
  error: string;
}

export function getDefaultSetupAutomationSnapshot(): SetupAutomationSnapshot {
  return {
    windows: getDefaultWindowsSetupEvidence(),
    lastImportError: "",
    lastImportedAt: "",
  };
}

export function getDefaultWindowsSetupEvidence(): WindowsSetupEvidence {
  return {
    installerRanAt: "",
    consolidationRepoReady: false,
    tailscaleInstalled: false,
    tailscaleLoggedIn: false,
    tailscaleIp: "",
    tailscaleMagicDnsName: "",
    remoteApiBound: false,
    windowsFirewallOpen: false,
    apiReachableFromPhone: false,
    apiPreflight: getDefaultWindowsApiPreflightEvidence(),
    pairingPackageCreatedAt: "",
    pairingPackageImportedAt: "",
    unattendedSmokeTestPassedAt: "",
  };
}

export function getDefaultWindowsApiPreflightEvidence(): WindowsApiPreflightEvidence {
  return {
    checkedAt: "",
    remoteApiUrl: "",
    apiPort: 0,
    firewallRuleName: "",
    firewallRulePresent: false,
    localHealthOk: false,
    phoneReachabilityOk: false,
    httpStatus: 0,
    failureStage: "",
    repairHint: "",
    repairCommand: "",
  };
}

export function createSetupAutomationStore(now: () => string = () => new Date().toISOString()) {
  return createStore<SetupAutomationState>()((set, get) => ({
    snapshot: getDefaultSetupAutomationSnapshot(),
    updateWindowsEvidence: (patch) =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          windows: {
            ...state.snapshot.windows,
            ...patch,
          },
        },
      })),
    replaceWindowsEvidence: (evidence) =>
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          windows: evidence,
        },
      })),
    importPairingPackage: (rawPackage) => {
      const result = importMobilePairingPackage(rawPackage, get().snapshot.windows, now());
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          windows: result.ok ? result.evidence : state.snapshot.windows,
          lastImportError: result.error,
          lastImportedAt: result.ok ? result.evidence.pairingPackageImportedAt : state.snapshot.lastImportedAt,
        },
      }));
      return result;
    },
    clearSetupEvidence: () =>
      set({
        snapshot: getDefaultSetupAutomationSnapshot(),
      }),
  }));
}

export const setupAutomationStore = createSetupAutomationStore();

export function useSetupAutomationState(): SetupAutomationState;
export function useSetupAutomationState<T>(selector: (state: SetupAutomationState) => T): T;
export function useSetupAutomationState<T>(selector?: (state: SetupAutomationState) => T) {
  return selector ? useStore(setupAutomationStore, selector) : useStore(setupAutomationStore);
}

export function importMobilePairingPackage(
  rawPackage: string,
  currentEvidence: WindowsSetupEvidence,
  importedAt: string,
): MobilePairingPackageImportResult {
  const parsed = parseJsonRecord(rawPackage);
  if (!parsed) {
    return failPairingImport(currentEvidence, "Pairing package must be valid JSON.");
  }

  const config = normalizeRemotePairingConfigPayload(parsed);
  const remoteApiUrl = config.remoteApiUrl.trim();
  const apiKey = config.apiKey.trim();

  if (config.version <= 0 || config.app !== "mobile-consolidation") {
    return failPairingImport(currentEvidence, "Pairing package is not for Mobile Consolidation.");
  }

  if (!isHttpUrl(remoteApiUrl)) {
    return failPairingImport(currentEvidence, "Pairing package must include a valid remote API URL.");
  }

  if (!apiKey) {
    return failPairingImport(currentEvidence, "Pairing package must include an API key.");
  }

  return {
    ok: true,
    connection: {
      baseApiUrl: remoteApiUrl,
      apiKey,
    },
    config: {
      ...config,
      remoteApiUrl,
      apiKey,
    },
    evidence: {
      ...currentEvidence,
      pairingPackageCreatedAt: config.createdAt || currentEvidence.pairingPackageCreatedAt,
      pairingPackageImportedAt: importedAt,
      tailscaleIp: extractTailscaleIp(remoteApiUrl) || currentEvidence.tailscaleIp,
      apiPreflight: {
        ...currentEvidence.apiPreflight,
        remoteApiUrl,
        apiPort: extractPort(remoteApiUrl) || currentEvidence.apiPreflight.apiPort,
      },
    },
    error: "",
  };
}

export function buildWindowsApiPreflightSummary(
  evidence: WindowsSetupEvidence,
): WindowsApiPreflightSummary {
  const preflight = evidence.apiPreflight;
  if (!preflight.checkedAt) {
    return {
      statusLabel: "Not checked",
      checkedAtLabel: "Not checked",
      detailLabel: "Run the Windows installer preflight for firewall and API diagnostics.",
      repairLabel: "Run tools/windows/install-mobile-consolidation.ps1 on the remote Windows computer.",
      blocking: true,
    };
  }

  const firewallReady = evidence.windowsFirewallOpen && preflight.firewallRulePresent;
  const phoneReachabilityReady = evidence.apiReachableFromPhone || preflight.phoneReachabilityOk;
  const blocking = !(firewallReady && preflight.localHealthOk && phoneReachabilityReady);
  const stage = preflight.failureStage || (blocking ? "phone_reachability" : "clear");
  const statusLabel = blocking ? "Blocked" : "Passed";
  const httpLabel = preflight.httpStatus > 0 ? `HTTP ${preflight.httpStatus}` : "No HTTP response";
  const targetLabel = preflight.remoteApiUrl || "remote API URL missing";
  const repairLabel =
    preflight.failureStage === "firewall_rule" && preflight.repairCommand
      ? preflight.repairCommand
      : preflight.repairHint || preflight.repairCommand || "Rerun Windows setup preflight.";

  return {
    statusLabel,
    checkedAtLabel: `Checked ${preflight.checkedAt}`,
    detailLabel: `${targetLabel}; port ${preflight.apiPort || "unknown"}; ${httpLabel}; stage ${stage}`,
    repairLabel,
    blocking,
  };
}

export function buildSetupAutomationSummary(
  input: SetupAutomationInput,
): SetupAutomationSummary {
  const pairingSummary = buildPairingDoctorSummary(input.pairing);
  const apiPreflightSummary = buildWindowsApiPreflightSummary(input.windows);
  const webViewSummary = buildDiscordWebViewHealthSummary(input.webView);
  const remoteConfigured = Boolean(input.remote.connection.baseApiUrl);
  const tailscaleAddress = input.windows.tailscaleMagicDnsName || input.windows.tailscaleIp;
  const phoneReachabilityProven =
    input.windows.apiReachableFromPhone || (Boolean(input.pairing.status) && !pairingSummary.blocking);
  const phoneServiceHealthy =
    input.phoneRuntime.nativeRuntimeAvailable &&
    input.phoneRuntime.serviceEnabled &&
    input.phoneRuntime.foregroundServiceActive &&
    input.phoneRuntime.health === "healthy" &&
    Boolean(input.phoneRuntime.lastHeartbeatAt);
  const remoteHealthSeen =
    input.remote.remote.engineHealth === "healthy" && Boolean(input.remote.remote.checkedAt);
  const liveReadinessChecked = Boolean(input.liveReadiness.remote.checkedAt);

  const items: SetupAutomationItem[] = [
    createItem({
      key: "windows_installer",
      label: "Windows installer",
      ready: Boolean(input.windows.installerRanAt) && input.windows.consolidationRepoReady,
      readyStatus: "Installed",
      blockedStatus: "Not run",
      readyDetail: `Installer completed ${input.windows.installerRanAt}`,
      blockedDetail: "Run the Windows bootstrapper on the remote Consolidation computer.",
      actionLabel: "Run Windows installer",
    }),
    createItem({
      key: "tailscale_installed",
      label: "Tailscale installed",
      ready: input.windows.tailscaleInstalled,
      readyStatus: "Installed",
      blockedStatus: "Missing",
      readyDetail: "Windows has the Tailscale client available.",
      blockedDetail: "Install Tailscale on Windows before pairing private transport.",
      actionLabel: "Install Tailscale",
    }),
    createItem({
      key: "tailscale_connected",
      label: "Tailscale connected",
      ready: input.windows.tailscaleInstalled && input.windows.tailscaleLoggedIn && Boolean(tailscaleAddress),
      readyStatus: "Connected",
      blockedStatus: "Signed out",
      readyDetail: `Reachable as ${tailscaleAddress}`,
      blockedDetail: input.windows.tailscaleInstalled
        ? "Sign in to Tailscale on Windows."
        : "Install and sign in to Tailscale on Windows.",
      actionLabel: "Sign in to Tailscale",
    }),
    createItem({
      key: "remote_api_bound",
      label: "Remote API bound",
      ready: input.windows.remoteApiBound && remoteConfigured,
      readyStatus: "Bound",
      blockedStatus: "Not bound",
      readyDetail: input.remote.connection.baseApiUrl,
      blockedDetail: "Start Consolidation with a remote API URL that the phone can reach.",
      actionLabel: "Start remote API",
    }),
    createItem({
      key: "firewall_reachability",
      label: "Firewall and reachability",
      ready: input.windows.windowsFirewallOpen && phoneReachabilityProven,
      readyStatus: "Reachable",
      blockedStatus: "Blocked",
      readyDetail: input.windows.apiReachableFromPhone
        ? "Windows firewall and phone reachability checks passed."
        : `Pairing Doctor passed from phone ${input.pairing.lastCheckedAt || "recently"}. ${apiPreflightSummary.detailLabel}`,
      blockedDetail: `${apiPreflightSummary.detailLabel}. ${apiPreflightSummary.repairLabel}`,
      actionLabel: "Repair Windows firewall",
    }),
    createItem({
      key: "pairing_package",
      label: "Pairing package",
      ready: Boolean(input.windows.pairingPackageCreatedAt),
      readyStatus: "Created",
      blockedStatus: "Missing",
      readyDetail: `Created ${input.windows.pairingPackageCreatedAt}`,
      blockedDetail: "Create a QR or deep-link pairing package from the remote.",
      actionLabel: "Create pairing QR",
    }),
    createItem({
      key: "mobile_pairing_import",
      label: "Mobile pairing import",
      ready: Boolean(input.windows.pairingPackageImportedAt) && remoteConfigured,
      readyStatus: "Imported",
      blockedStatus: "Not imported",
      readyDetail: `Imported ${input.windows.pairingPackageImportedAt}`,
      blockedDetail: "Import the pairing package on this phone.",
      actionLabel: "Import pairing package",
    }),
    createItem({
      key: "pairing_doctor",
      label: "Pairing Doctor",
      ready: Boolean(input.pairing.status) && !pairingSummary.blocking,
      readyStatus: "Passed",
      blockedStatus: pairingSummary.statusLabel,
      readyDetail: pairingSummary.detailLabel,
      blockedDetail: pairingSummary.detailLabel,
      actionLabel: "Run Pairing Doctor",
    }),
    createItem({
      key: "engine_health_exchange",
      label: "Remote and phone health",
      ready: remoteHealthSeen && phoneServiceHealthy,
      readyStatus: "Healthy",
      blockedStatus: "Unproven",
      readyDetail: `Remote checked ${input.remote.remote.checkedAt}; phone heartbeat ${input.phoneRuntime.lastHeartbeatAt}`,
      blockedDetail: "Remote and phone must both report fresh healthy status.",
      actionLabel: "Check both engines",
    }),
    createItem({
      key: "unattended_smoke_test",
      label: "Unattended smoke test",
      ready:
        Boolean(input.windows.unattendedSmokeTestPassedAt) &&
        !webViewSummary.blocking &&
        liveReadinessChecked,
      readyStatus: "Passed",
      blockedStatus: "Not proven",
      readyDetail: `Passed ${input.windows.unattendedSmokeTestPassedAt}`,
      blockedDetail: "Run an unattended alert smoke test after pairing and health checks pass.",
      actionLabel: "Run unattended smoke test",
    }),
  ];

  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;
  const firstBlocker = items.find((item) => item.blocking);

  return {
    statusLabel: blockingCount === 0 ? "Setup ready" : "Setup blocked",
    readyCountLabel: `${readyCount}/${items.length} ready`,
    blockingCountLabel: blockingCount === 0 ? "No setup blockers" : `${blockingCount} setup blocker(s)`,
    nextActionLabel: firstBlocker?.actionLabel ?? "Run unattended smoke test regularly",
    blocking: blockingCount > 0,
    items,
  };
}

export function buildSetupSmokeTestSummary(input: SetupSmokeTestInput): SetupSmokeTestSummary {
  const pairing = buildPairingDoctorSummary(input.pairing);
  const phoneRuntime = buildPhoneEngineRuntimeSummary(input.phoneRuntime);
  const latestChain = input.alertEvidence.evidence.chains[0] ?? null;
  const alertProof = buildAlertTestEvidenceSummary(latestChain);
  const peer = buildPeerAlertOutcomeSummary(input.peerFailsafe);
  const remoteHealthy =
    input.remote.remote.engineHealth === "healthy" && Boolean(input.remote.remote.checkedAt);
  const imported = Boolean(input.windows.pairingPackageImportedAt) && Boolean(input.remote.connection.baseApiUrl);

  const items: SetupAutomationItem[] = [
    createItem({
      key: "mobile_pairing_import",
      label: "Pairing imported",
      ready: imported,
      readyStatus: "Imported",
      blockedStatus: "Missing",
      readyDetail: `Imported ${input.windows.pairingPackageImportedAt}`,
      blockedDetail: "Import the Windows installer pairing package on this phone.",
      actionLabel: "Import pairing package",
    }),
    createItem({
      key: "pairing_doctor",
      label: "Pairing Doctor",
      ready: Boolean(input.pairing.status) && !pairing.blocking,
      readyStatus: "Passed",
      blockedStatus: pairing.statusLabel,
      readyDetail: pairing.detailLabel,
      blockedDetail: pairing.detailLabel,
      actionLabel: "Run Pairing Doctor",
    }),
    createItem({
      key: "remote_health",
      label: "Remote health",
      ready: remoteHealthy,
      readyStatus: "Healthy",
      blockedStatus: "Unproven",
      readyDetail: `Remote checked ${input.remote.remote.checkedAt}`,
      blockedDetail: "Check the remote Consolidation API after pairing.",
      actionLabel: "Check remote health",
    }),
    createItem({
      key: "phone_health",
      label: "Phone engine health",
      ready: phoneRuntime.canOwnLease,
      readyStatus: "Healthy",
      blockedStatus: phoneRuntime.statusLabel,
      readyDetail: phoneRuntime.detailLabel,
      blockedDetail: phoneRuntime.detailLabel,
      actionLabel: "Start Phone Engine",
    }),
    createItem({
      key: "alert_route",
      label: "Alert route proof",
      ready: !alertProof.blocking,
      readyStatus: alertProof.gateLabel,
      blockedStatus: alertProof.gateLabel,
      readyDetail: `${alertProof.contractLabel}; ${alertProof.parserLabel}; ${alertProof.queueLabel}`,
      blockedDetail: `${alertProof.contractLabel}; ${alertProof.parserLabel}; ${alertProof.queueLabel}`,
      actionLabel: "Run silent alert test",
    }),
    createItem({
      key: "peer_challenge",
      label: "Peer challenge",
      ready: !peer.blocking,
      readyStatus: peer.gateLabel,
      blockedStatus: peer.gateLabel,
      readyDetail: peer.detailLabel,
      blockedDetail: peer.detailLabel,
      actionLabel: "Run peer challenge",
    }),
  ];

  const readyCount = items.filter((item) => !item.blocking).length;
  const blockingCount = items.length - readyCount;
  const firstBlocker = items.find((item) => item.blocking);

  return {
    statusLabel: blockingCount === 0 ? "Smoke test clear" : "Smoke test blocked",
    readyCountLabel: `${readyCount}/${items.length} proof(s) clear`,
    blockingCountLabel: blockingCount === 0 ? "No smoke blockers" : `${blockingCount} smoke blocker(s)`,
    nextActionLabel: firstBlocker?.actionLabel ?? "Record unattended smoke test pass",
    blocking: blockingCount > 0,
    items,
  };
}

function parseJsonRecord(rawPackage: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(rawPackage);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function failPairingImport(
  currentEvidence: WindowsSetupEvidence,
  error: string,
): MobilePairingPackageImportResult {
  return {
    ok: false,
    connection: null,
    config: null,
    evidence: currentEvidence,
    error,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractTailscaleIp(remoteApiUrl: string): string {
  try {
    const { hostname } = new URL(remoteApiUrl);
    const parts = hostname.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
      return "";
    }
    const [first, second] = parts as [number, number, number, number];
    if (first === 100 && second >= 64 && second <= 127) {
      return hostname;
    }
    return "";
  } catch {
    return "";
  }
}

function extractPort(remoteApiUrl: string): number {
  try {
    const url = new URL(remoteApiUrl);
    const explicit = Number(url.port);
    if (Number.isInteger(explicit) && explicit > 0) {
      return explicit;
    }
    return url.protocol === "https:" ? 443 : 80;
  } catch {
    return 0;
  }
}

function createItem({
  key,
  label,
  ready,
  readyStatus,
  blockedStatus,
  readyDetail,
  blockedDetail,
  actionLabel,
}: {
  key: string;
  label: string;
  ready: boolean;
  readyStatus: string;
  blockedStatus: string;
  readyDetail: string;
  blockedDetail: string;
  actionLabel: string;
}): SetupAutomationItem {
  return {
    key,
    label,
    statusLabel: ready ? readyStatus : blockedStatus,
    detailLabel: ready ? readyDetail : blockedDetail,
    actionLabel,
    blocking: !ready,
  };
}
