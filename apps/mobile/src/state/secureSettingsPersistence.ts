import {
  normalizeDiscordIngestionSettings,
  normalizeFailoverSettings,
  type DiscordIngestionSettings,
  type FailoverSettings,
} from "@sentinel-nexus/contracts";
import type { RemoteConnectionDraft } from "./remoteEngineState";
import {
  getDefaultWindowsSetupEvidence,
  type WindowsSetupEvidence,
} from "./setupAutomationState";

export const REMOTE_CONNECTION_STORAGE_KEY = "sentinel-nexus.remote-connection.v1";
export const FAILOVER_SETTINGS_STORAGE_KEY = "sentinel-nexus.failover-settings.v1";
export const DISCORD_INGESTION_SETTINGS_STORAGE_KEY = "sentinel-nexus.discord-ingestion-settings.v1";
export const SETUP_AUTOMATION_STORAGE_KEY = "sentinel-nexus.setup-automation.v1";

export interface SecureSettingsStorage {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

export async function saveRemoteConnection(
  storage: SecureSettingsStorage,
  draft: RemoteConnectionDraft,
): Promise<void> {
  const normalized = normalizeRemoteConnectionDraft(draft);
  if (!normalized.baseApiUrl && !normalized.apiKey) {
    await storage.deleteItemAsync(REMOTE_CONNECTION_STORAGE_KEY);
    return;
  }

  await storage.setItemAsync(REMOTE_CONNECTION_STORAGE_KEY, JSON.stringify(normalized));
}

export async function loadRemoteConnection(
  storage: SecureSettingsStorage,
): Promise<RemoteConnectionDraft | null> {
  const payload = await readJsonRecord(storage, REMOTE_CONNECTION_STORAGE_KEY);
  if (!payload) {
    return null;
  }
  if (typeof payload.baseApiUrl !== "string" || typeof payload.apiKey !== "string") {
    return null;
  }

  return normalizeRemoteConnectionDraft({
    baseApiUrl: payload.baseApiUrl,
    apiKey: payload.apiKey,
  });
}

export async function saveFailoverSettings(
  storage: SecureSettingsStorage,
  settings: FailoverSettings,
): Promise<void> {
  await storage.setItemAsync(
    FAILOVER_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeFailoverSettings(settings)),
  );
}

export async function saveDiscordIngestionSettings(
  storage: SecureSettingsStorage,
  settings: DiscordIngestionSettings,
): Promise<void> {
  await storage.setItemAsync(
    DISCORD_INGESTION_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeDiscordIngestionSettings(settings)),
  );
}

export async function saveSetupAutomationEvidence(
  storage: SecureSettingsStorage,
  evidence: WindowsSetupEvidence,
): Promise<void> {
  await storage.setItemAsync(SETUP_AUTOMATION_STORAGE_KEY, JSON.stringify(normalizeSetupEvidence(evidence)));
}

export async function loadSetupAutomationEvidence(
  storage: SecureSettingsStorage,
): Promise<WindowsSetupEvidence | null> {
  const payload = await readJsonRecord(storage, SETUP_AUTOMATION_STORAGE_KEY);
  return payload ? normalizeSetupEvidence(payload) : null;
}

function normalizeRemoteConnectionDraft(draft: RemoteConnectionDraft): RemoteConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
}

function normalizeSetupEvidence(payload: Record<string, unknown> | WindowsSetupEvidence): WindowsSetupEvidence {
  const defaults = getDefaultWindowsSetupEvidence();
  return {
    installerRanAt: cleanString(payload.installerRanAt) || defaults.installerRanAt,
    sentinelEchoRepoReady: payload.sentinelEchoRepoReady === true,
    tailscaleInstalled: payload.tailscaleInstalled === true,
    tailscaleLoggedIn: payload.tailscaleLoggedIn === true,
    tailscaleIp: cleanString(payload.tailscaleIp) || defaults.tailscaleIp,
    tailscaleMagicDnsName: cleanString(payload.tailscaleMagicDnsName) || defaults.tailscaleMagicDnsName,
    remoteApiBound: payload.remoteApiBound === true,
    windowsFirewallOpen: payload.windowsFirewallOpen === true,
    apiReachableFromPhone: payload.apiReachableFromPhone === true,
    apiPreflight: normalizeApiPreflight(payload.apiPreflight, defaults.apiPreflight),
    pairingPackageCreatedAt: cleanString(payload.pairingPackageCreatedAt) || defaults.pairingPackageCreatedAt,
    pairingPackageImportedAt: cleanString(payload.pairingPackageImportedAt) || defaults.pairingPackageImportedAt,
    unattendedSmokeTestPassedAt: cleanString(payload.unattendedSmokeTestPassedAt) || defaults.unattendedSmokeTestPassedAt,
  };
}

function normalizeApiPreflight(
  payload: unknown,
  defaults: WindowsSetupEvidence["apiPreflight"],
): WindowsSetupEvidence["apiPreflight"] {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return defaults;
  }
  const record = payload as Record<string, unknown>;
  return {
    checkedAt: cleanString(record.checkedAt) || defaults.checkedAt,
    remoteApiUrl: cleanString(record.remoteApiUrl) || defaults.remoteApiUrl,
    apiPort: cleanInteger(record.apiPort) || defaults.apiPort,
    firewallRuleName: cleanString(record.firewallRuleName) || defaults.firewallRuleName,
    firewallRulePresent: record.firewallRulePresent === true,
    localHealthOk: record.localHealthOk === true,
    phoneReachabilityOk: record.phoneReachabilityOk === true,
    httpStatus: cleanInteger(record.httpStatus) || defaults.httpStatus,
    failureStage: cleanString(record.failureStage) || defaults.failureStage,
    repairHint: cleanString(record.repairHint) || defaults.repairHint,
    repairCommand: cleanString(record.repairCommand) || defaults.repairCommand,
  };
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export async function loadFailoverSettings(
  storage: SecureSettingsStorage,
): Promise<FailoverSettings | null> {
  const payload = await readJsonRecord(storage, FAILOVER_SETTINGS_STORAGE_KEY);
  if (!payload) {
    return null;
  }

  return normalizeFailoverSettings(payload);
}

export async function loadDiscordIngestionSettings(
  storage: SecureSettingsStorage,
): Promise<DiscordIngestionSettings | null> {
  const payload = await readJsonRecord(storage, DISCORD_INGESTION_SETTINGS_STORAGE_KEY);
  if (!payload) {
    return null;
  }

  return normalizeDiscordIngestionSettings(payload);
}

async function readJsonRecord(
  storage: SecureSettingsStorage,
  key: string,
): Promise<Record<string, unknown> | null> {
  const raw = await storage.getItemAsync(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
