import {
  normalizeDiscordIngestionSettings,
  normalizeFailoverSettings,
  type DiscordIngestionSettings,
  type FailoverSettings,
} from "@apk-alerts/contracts";
import type { RemoteConnectionDraft } from "./remoteEngineState";

export const REMOTE_CONNECTION_STORAGE_KEY = "apk-alerts.remote-connection.v1";
export const FAILOVER_SETTINGS_STORAGE_KEY = "apk-alerts.failover-settings.v1";
export const DISCORD_INGESTION_SETTINGS_STORAGE_KEY = "apk-alerts.discord-ingestion-settings.v1";

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

function normalizeRemoteConnectionDraft(draft: RemoteConnectionDraft): RemoteConnectionDraft {
  return {
    baseApiUrl: draft.baseApiUrl.trim(),
    apiKey: draft.apiKey.trim(),
  };
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
