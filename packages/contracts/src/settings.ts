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

export const DEFAULT_FAILOVER_SETTINGS: FailoverSettings = {
  enginePriority: "phone_then_remote",
  phoneEngineEnabled: true,
  remoteEngineEnabled: true,
  transportPreference: "tailscale_first",
  allowCloudFallback: true,
  notifyOnFailover: true,
  notifyWhenOffline: true,
};

export function normalizeFailoverSettings(settings: FailoverSettings): FailoverSettings {
  return {
    enginePriority: settings.enginePriority,
    phoneEngineEnabled: Boolean(settings.phoneEngineEnabled),
    remoteEngineEnabled: Boolean(settings.remoteEngineEnabled),
    transportPreference: settings.transportPreference,
    allowCloudFallback: Boolean(settings.allowCloudFallback),
    notifyOnFailover: Boolean(settings.notifyOnFailover),
    notifyWhenOffline: Boolean(settings.notifyWhenOffline),
  };
}

export function canAnyEngineRun(settings: FailoverSettings): boolean {
  return settings.phoneEngineEnabled || settings.remoteEngineEnabled;
}

export function buildEnginePriorityLabel(settings: FailoverSettings): string {
  if (!canAnyEngineRun(settings)) {
    return "Execution disabled";
  }

  if (settings.phoneEngineEnabled && !settings.remoteEngineEnabled) {
    return "Phone only";
  }

  if (!settings.phoneEngineEnabled && settings.remoteEngineEnabled) {
    return "Remote only";
  }

  return settings.enginePriority === "phone_then_remote" ? "Phone then Remote" : "Remote then Phone";
}

export function buildTransportLabel(settings: FailoverSettings): string {
  if (settings.transportPreference === "tailscale_first") {
    return settings.allowCloudFallback ? "Tailscale with cloud fallback" : "Tailscale only";
  }

  return settings.allowCloudFallback ? "Cloud relay with Tailscale fallback" : "Cloud relay only";
}
