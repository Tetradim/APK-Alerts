import {
  normalizeRemotePairingConfigPayload,
  type RemotePairingConfig,
} from "@apk-alerts/contracts";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import {
  buildDiscordWebViewHealthSummary,
  type DiscordWebViewHealthSnapshot,
} from "./discordWebViewState";
import type { LiveReadinessSnapshot } from "./liveReadinessState";
import {
  buildPairingDoctorSummary,
  type PairingDoctorSnapshot,
} from "./pairingDoctorState";
import type { PhoneEngineRuntimeSnapshot } from "./phoneEngineRuntimeState";
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
  pairingPackageCreatedAt: string;
  pairingPackageImportedAt: string;
  unattendedSmokeTestPassedAt: string;
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
    pairingPackageCreatedAt: "",
    pairingPackageImportedAt: "",
    unattendedSmokeTestPassedAt: "",
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
    },
    error: "",
  };
}

export function buildSetupAutomationSummary(
  input: SetupAutomationInput,
): SetupAutomationSummary {
  const pairingSummary = buildPairingDoctorSummary(input.pairing);
  const webViewSummary = buildDiscordWebViewHealthSummary(input.webView);
  const remoteConfigured = Boolean(input.remote.connection.baseApiUrl);
  const tailscaleAddress = input.windows.tailscaleMagicDnsName || input.windows.tailscaleIp;
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
      ready: input.windows.windowsFirewallOpen && input.windows.apiReachableFromPhone,
      readyStatus: "Reachable",
      blockedStatus: "Blocked",
      readyDetail: "Windows firewall and phone reachability checks passed.",
      blockedDetail: "Open the API port and verify the phone can reach the remote URL.",
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
