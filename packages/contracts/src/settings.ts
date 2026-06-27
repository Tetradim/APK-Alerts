export type EnginePriority = "phone_then_remote" | "remote_then_phone";
export type TransportPreference = "tailscale_first" | "cloud_first";

export interface FailoverSettings {
  enginePriority: EnginePriority;
  phoneEngineEnabled: boolean;
  remoteEngineEnabled: boolean;
  transportPreference: TransportPreference;
  allowCloudFallback: boolean;
  notifyOnFailover: boolean;
  notifyWhenOffline: boolean;
}

export type FailoverSettingsInput = Partial<Record<keyof FailoverSettings, unknown>> | null | undefined;

export const DEFAULT_FAILOVER_SETTINGS: FailoverSettings = {
  enginePriority: "phone_then_remote",
  phoneEngineEnabled: true,
  remoteEngineEnabled: true,
  transportPreference: "tailscale_first",
  allowCloudFallback: true,
  notifyOnFailover: true,
  notifyWhenOffline: true,
};

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return defaultValue;
}

function isEnginePriority(value: unknown): value is EnginePriority {
  return value === "phone_then_remote" || value === "remote_then_phone";
}

function isTransportPreference(value: unknown): value is TransportPreference {
  return value === "tailscale_first" || value === "cloud_first";
}

export function normalizeFailoverSettings(settings: FailoverSettingsInput = {}): FailoverSettings {
  const input = settings && typeof settings === "object" ? settings : {};

  return {
    enginePriority: isEnginePriority(input.enginePriority)
      ? input.enginePriority
      : DEFAULT_FAILOVER_SETTINGS.enginePriority,
    phoneEngineEnabled: normalizeBoolean(
      input.phoneEngineEnabled,
      DEFAULT_FAILOVER_SETTINGS.phoneEngineEnabled,
    ),
    remoteEngineEnabled: normalizeBoolean(
      input.remoteEngineEnabled,
      DEFAULT_FAILOVER_SETTINGS.remoteEngineEnabled,
    ),
    transportPreference: isTransportPreference(input.transportPreference)
      ? input.transportPreference
      : DEFAULT_FAILOVER_SETTINGS.transportPreference,
    allowCloudFallback: normalizeBoolean(
      input.allowCloudFallback,
      DEFAULT_FAILOVER_SETTINGS.allowCloudFallback,
    ),
    notifyOnFailover: normalizeBoolean(
      input.notifyOnFailover,
      DEFAULT_FAILOVER_SETTINGS.notifyOnFailover,
    ),
    notifyWhenOffline: normalizeBoolean(
      input.notifyWhenOffline,
      DEFAULT_FAILOVER_SETTINGS.notifyWhenOffline,
    ),
  };
}

export function canAnyEngineRun(settings: FailoverSettingsInput = {}): boolean {
  const normalizedSettings = normalizeFailoverSettings(settings);

  return normalizedSettings.phoneEngineEnabled || normalizedSettings.remoteEngineEnabled;
}

export function buildEnginePriorityLabel(settings: FailoverSettingsInput = {}): string {
  const normalizedSettings = normalizeFailoverSettings(settings);

  if (!canAnyEngineRun(normalizedSettings)) {
    return "Execution disabled";
  }

  if (normalizedSettings.phoneEngineEnabled && !normalizedSettings.remoteEngineEnabled) {
    return "Phone only";
  }

  if (!normalizedSettings.phoneEngineEnabled && normalizedSettings.remoteEngineEnabled) {
    return "Remote only";
  }

  return normalizedSettings.enginePriority === "phone_then_remote"
    ? "Phone then Remote"
    : "Remote then Phone";
}

export function buildTransportLabel(settings: FailoverSettingsInput = {}): string {
  const normalizedSettings = normalizeFailoverSettings(settings);

  if (normalizedSettings.transportPreference === "tailscale_first") {
    return normalizedSettings.allowCloudFallback ? "Tailscale with cloud fallback" : "Tailscale only";
  }

  return normalizedSettings.allowCloudFallback ? "Cloud relay with Tailscale fallback" : "Cloud relay only";
}
