export type EnginePriority = "phone_then_remote" | "remote_then_phone";
export type TransportPreference = "tailscale_first" | "cloud_first";
export type DiscordIngestionRoute = "bot_engine" | "webview" | "foreground_service";

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

export interface DiscordIngestionSettings {
  webViewEnabled: boolean;
  botEngineEnabled: boolean;
  foregroundServiceEnabled: boolean;
  routePriority: DiscordIngestionRoute[];
  botToken: string;
  guildId: string;
  channelAllowlist: string;
  authorAllowlist: string;
}

export type DiscordIngestionSettingsInput =
  Partial<Record<keyof DiscordIngestionSettings, unknown>> | null | undefined;

export const DEFAULT_FAILOVER_SETTINGS: FailoverSettings = {
  enginePriority: "phone_then_remote",
  phoneEngineEnabled: true,
  remoteEngineEnabled: true,
  transportPreference: "tailscale_first",
  allowCloudFallback: true,
  notifyOnFailover: true,
  notifyWhenOffline: true,
};

export const DEFAULT_DISCORD_ROUTE_PRIORITY: DiscordIngestionRoute[] = [
  "bot_engine",
  "webview",
  "foreground_service",
];

export const DEFAULT_DISCORD_INGESTION_SETTINGS: DiscordIngestionSettings = {
  webViewEnabled: true,
  botEngineEnabled: true,
  foregroundServiceEnabled: true,
  routePriority: DEFAULT_DISCORD_ROUTE_PRIORITY,
  botToken: "",
  guildId: "",
  channelAllowlist: "",
  authorAllowlist: "",
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

function isDiscordIngestionRoute(value: unknown): value is DiscordIngestionRoute {
  return value === "bot_engine" || value === "webview" || value === "foreground_service";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

export function normalizeDiscordIngestionSettings(
  settings: DiscordIngestionSettingsInput = {},
): DiscordIngestionSettings {
  const input = settings && typeof settings === "object" ? settings : {};

  return {
    webViewEnabled: normalizeBoolean(
      input.webViewEnabled,
      DEFAULT_DISCORD_INGESTION_SETTINGS.webViewEnabled,
    ),
    botEngineEnabled: normalizeBoolean(
      input.botEngineEnabled,
      DEFAULT_DISCORD_INGESTION_SETTINGS.botEngineEnabled,
    ),
    foregroundServiceEnabled: normalizeBoolean(
      input.foregroundServiceEnabled,
      DEFAULT_DISCORD_INGESTION_SETTINGS.foregroundServiceEnabled,
    ),
    routePriority: normalizeDiscordRoutePriority(input.routePriority),
    botToken: normalizeString(input.botToken),
    guildId: normalizeString(input.guildId),
    channelAllowlist: normalizeString(input.channelAllowlist),
    authorAllowlist: normalizeString(input.authorAllowlist),
  };
}

export function buildDiscordIngestionPriorityLabel(
  settings: DiscordIngestionSettingsInput = {},
): string {
  return normalizeDiscordIngestionSettings(settings).routePriority.map(discordRouteLabel).join(" -> ");
}

function normalizeDiscordRoutePriority(value: unknown): DiscordIngestionRoute[] {
  const orderedRoutes: DiscordIngestionRoute[] = [];
  const inputRoutes = Array.isArray(value) ? value : DEFAULT_DISCORD_ROUTE_PRIORITY;

  for (const route of inputRoutes) {
    if (isDiscordIngestionRoute(route) && !orderedRoutes.includes(route)) {
      orderedRoutes.push(route);
    }
  }

  for (const route of DEFAULT_DISCORD_ROUTE_PRIORITY) {
    if (!orderedRoutes.includes(route)) {
      orderedRoutes.push(route);
    }
  }

  return orderedRoutes;
}

function discordRouteLabel(route: DiscordIngestionRoute): string {
  switch (route) {
    case "bot_engine":
      return "Bot Engine";
    case "webview":
      return "WebView";
    case "foreground_service":
      return "Foreground";
  }
}
