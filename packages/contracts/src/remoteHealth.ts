export type RemoteEngineHealth = "healthy" | "degraded" | "offline" | "unknown";

export interface NormalizedRemoteHealth {
  status: RemoteEngineHealth;
  discordConnected: boolean;
  brokerConnected: boolean;
}

export interface NormalizedRemoteStatus {
  activeBroker: string | null;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  alertsProcessed: number;
  lastAlertTime: string | null;
}

export interface RemoteEngineHealthSnapshot {
  engineHealth: RemoteEngineHealth;
  executionReady: boolean;
  activeBroker: string | null;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  alertsProcessed: number;
  lastAlertTime: string | null;
  checkedAt: string;
}

export interface RemoteEngineHealthSnapshotInput {
  health: NormalizedRemoteHealth;
  status: NormalizedRemoteStatus;
  checkedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeStrictBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function normalizeRemoteHealthPayload(payload: unknown): NormalizedRemoteHealth {
  if (!isRecord(payload)) {
    return {
      status: "offline",
      discordConnected: false,
      brokerConnected: false,
    };
  }

  const discordConnected = normalizeStrictBoolean(payload.discord_connected);
  const brokerConnected = normalizeStrictBoolean(payload.broker_connected);
  const status =
    payload.status === "healthy" && discordConnected && brokerConnected ? "healthy" : "degraded";

  return {
    status,
    discordConnected,
    brokerConnected,
  };
}

export function normalizeRemoteStatusPayload(payload: unknown): NormalizedRemoteStatus {
  const input = isRecord(payload) ? payload : {};

  return {
    activeBroker: normalizeOptionalString(input.active_broker),
    autoTradingEnabled: normalizeStrictBoolean(input.auto_trading_enabled),
    simulationMode: normalizeStrictBoolean(input.simulation_mode),
    shutdownTriggered: normalizeStrictBoolean(input.shutdown_triggered),
    alertsProcessed: normalizeNonNegativeInteger(input.alerts_processed),
    lastAlertTime: normalizeOptionalString(input.last_alert_time),
  };
}

export function buildRemoteEngineHealthSnapshot(
  input: RemoteEngineHealthSnapshotInput,
): RemoteEngineHealthSnapshot {
  const executionReady =
    input.health.status === "healthy" &&
    input.status.activeBroker !== null &&
    input.status.autoTradingEnabled &&
    !input.status.simulationMode &&
    !input.status.shutdownTriggered;

  return {
    engineHealth: executionReady ? "healthy" : input.health.status,
    executionReady,
    activeBroker: input.status.activeBroker,
    autoTradingEnabled: input.status.autoTradingEnabled,
    simulationMode: input.status.simulationMode,
    shutdownTriggered: input.status.shutdownTriggered,
    alertsProcessed: input.status.alertsProcessed,
    lastAlertTime: input.status.lastAlertTime,
    checkedAt: input.checkedAt,
  };
}
