export type EnginePriority = "phone_then_remote" | "remote_then_phone";
export type TransportPreference = "tailscale_first" | "cloud_first";
export type DiscordIngestionRoute = "bot_engine" | "webview";

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

export interface DiscordIngestionReadinessEvidence {
  botGatewayReady?: boolean;
  webViewSessionReady?: boolean;
  foregroundServiceActive?: boolean;
}

export interface DiscordIngestionReadiness {
  ready: boolean;
  activeRoute: DiscordIngestionRoute | null;
  activeRouteLabel: string;
  detailLabel: string;
}

export interface DiscordIngestionRouteAuditRow {
  route: DiscordIngestionRoute;
  routeLabel: string;
  enabled: boolean;
  ready: boolean;
  detailLabel: string;
  blocking: boolean;
}

export interface DiscordIngestionAuditDigest {
  priorityLabel: string;
  gateLabel: string;
  activeRoute: DiscordIngestionRoute | null;
  activeRouteLabel: string;
  detailLabel: string;
  routeRows: DiscordIngestionRouteAuditRow[];
  enabledRouteLabels: string[];
  disabledRouteLabels: string[];
  readyRouteLabels: string[];
  blockingRouteLabels: string[];
  evidenceLabels: string[];
  botTokenConfigured: boolean;
  guildConfigured: boolean;
  channelAllowlistConfigured: boolean;
  authorAllowlistConfigured: boolean;
  blocking: boolean;
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

export const DEFAULT_DISCORD_ROUTE_PRIORITY: DiscordIngestionRoute[] = [
  "bot_engine",
  "webview",
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
  return value === "bot_engine" || value === "webview";
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

export function evaluateDiscordIngestionReadiness(
  settings: DiscordIngestionSettingsInput = {},
  evidence: DiscordIngestionReadinessEvidence = {},
): DiscordIngestionReadiness {
  const normalized = normalizeDiscordIngestionSettings(settings);
  let firstBlockedRoute: DiscordIngestionReadiness | null = null;
  for (const route of normalized.routePriority) {
    if (!discordRouteEnabled(route, normalized)) {
      continue;
    }

    const detailLabel = discordRouteDetailLabel(route, normalized, evidence);
    if (discordRouteReady(route, normalized, evidence)) {
      return {
        ready: true,
        activeRoute: route,
        activeRouteLabel: discordRouteLabel(route),
        detailLabel,
      };
    }

    firstBlockedRoute ??= {
      ready: false,
      activeRoute: route,
      activeRouteLabel: discordRouteLabel(route),
      detailLabel,
    };
  }

  return firstBlockedRoute ?? {
    ready: false,
    activeRoute: null,
    activeRouteLabel: "No route",
    detailLabel: "All Discord ingestion routes are disabled.",
  };
}

export function buildDiscordIngestionAuditDigest(
  settings: DiscordIngestionSettingsInput = {},
  evidence: DiscordIngestionReadinessEvidence = {},
): DiscordIngestionAuditDigest {
  const normalized = normalizeDiscordIngestionSettings(settings);
  const readiness = evaluateDiscordIngestionReadiness(normalized, evidence);
  const routeRows = normalized.routePriority.map((route) => {
    const enabled = discordRouteEnabled(route, normalized);
    const ready = enabled && discordRouteReady(route, normalized, evidence);
    const routeLabel = discordRouteLabel(route);
    const detailLabel = enabled
      ? discordRouteDetailLabel(route, normalized, evidence)
      : `${routeLabel} disabled.`;

    return {
      route,
      routeLabel,
      enabled,
      ready,
      detailLabel,
      blocking: enabled && !ready,
    };
  });

  return {
    priorityLabel: buildDiscordIngestionPriorityLabel(normalized),
    gateLabel: readiness.ready ? "Discord route ready" : "Discord route blocked",
    activeRoute: readiness.activeRoute,
    activeRouteLabel: readiness.activeRouteLabel,
    detailLabel: readiness.detailLabel,
    routeRows,
    enabledRouteLabels: routeRows.filter((row) => row.enabled).map((row) => row.routeLabel),
    disabledRouteLabels: routeRows.filter((row) => !row.enabled).map((row) => row.routeLabel),
    readyRouteLabels: routeRows.filter((row) => row.ready).map((row) => row.routeLabel),
    blockingRouteLabels: routeRows
      .filter((row) => row.blocking)
      .map((row) => `${row.routeLabel}: ${row.detailLabel}`),
    evidenceLabels: [
      evidence.botGatewayReady ? "Bot Gateway: ready" : "Bot Gateway: waiting",
      evidence.webViewSessionReady ? "WebView: alert proof ready" : "WebView: alert proof waiting",
      evidence.foregroundServiceActive ? "Keepalive: active" : "Keepalive: inactive",
    ],
    botTokenConfigured: normalized.botToken.length > 0,
    guildConfigured: normalized.guildId.length > 0,
    channelAllowlistConfigured: normalized.channelAllowlist.length > 0,
    authorAllowlistConfigured: normalized.authorAllowlist.length > 0,
    blocking: !readiness.ready,
  };
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
  }
}

function discordRouteEnabled(
  route: DiscordIngestionRoute,
  settings: DiscordIngestionSettings,
): boolean {
  switch (route) {
    case "bot_engine":
      return settings.botEngineEnabled;
    case "webview":
      return settings.webViewEnabled;
  }
}

function discordRouteReady(
  route: DiscordIngestionRoute,
  settings: DiscordIngestionSettings,
  evidence: DiscordIngestionReadinessEvidence,
): boolean {
  switch (route) {
    case "bot_engine":
      return settings.botToken.length > 0 && evidence.botGatewayReady === true;
    case "webview":
      return evidence.webViewSessionReady === true;
  }
}

function discordRouteDetailLabel(
  route: DiscordIngestionRoute,
  settings: DiscordIngestionSettings,
  evidence: DiscordIngestionReadinessEvidence,
): string {
  switch (route) {
    case "bot_engine":
      if (!settings.botToken) {
        return "Bot Engine token missing.";
      }
      return evidence.botGatewayReady ? "Bot Engine Gateway ready." : "Bot Engine Gateway not ready.";
    case "webview":
      return evidence.webViewSessionReady
        ? "WebView session produced alert evidence."
        : "WebView session has not produced alert evidence.";
  }
}
