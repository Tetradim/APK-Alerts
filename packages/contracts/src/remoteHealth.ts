export type RemoteEngineHealth = "healthy" | "degraded" | "offline" | "unknown";

export interface NormalizedRemoteHealth {
  status: Exclude<RemoteEngineHealth, "unknown">;
  discordConnected: boolean;
  brokerConnected: boolean;
}

export interface NormalizedRemoteStatus {
  activeBroker: string;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  alertsProcessed: number;
  lastAlertTime: string;
}

export interface RemoteEngineHealthSnapshot {
  engineHealth: RemoteEngineHealth;
  executionReady: boolean;
  discordConnected: boolean;
  brokerConnected: boolean;
  activeBroker: string;
  autoTradingEnabled: boolean;
  simulationMode: boolean;
  shutdownTriggered: boolean;
  alertsProcessed: number;
  lastAlertTime: string;
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

function normalizeString(value: unknown, defaultValue: string): string {
  return typeof value === "string" && value.length > 0 ? value : defaultValue;
}

function normalizeNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
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
  const status: Exclude<RemoteEngineHealth, "unknown"> =
    payload.status === "healthy" && discordConnected && brokerConnected
      ? "healthy"
      : payload.status === "degraded" || discordConnected || brokerConnected
        ? "degraded"
        : "offline";

  return {
    status,
    discordConnected,
    brokerConnected,
  };
}

export function normalizeRemoteStatusPayload(payload: unknown): NormalizedRemoteStatus {
  const input = isRecord(payload) ? payload : {};

  return {
    activeBroker: normalizeString(input.active_broker, "unknown"),
    autoTradingEnabled: normalizeStrictBoolean(input.auto_trading_enabled),
    simulationMode: input.simulation_mode === false ? false : true,
    shutdownTriggered: normalizeStrictBoolean(input.shutdown_triggered),
    alertsProcessed: normalizeNonNegativeNumber(input.alerts_processed),
    lastAlertTime: normalizeString(input.last_alert_time, ""),
  };
}

export function buildRemoteEngineHealthSnapshot(
  input: RemoteEngineHealthSnapshotInput,
): RemoteEngineHealthSnapshot {
  const runtimeReady = input.status.autoTradingEnabled && !input.status.shutdownTriggered;
  const executionReady =
    input.health.status === "healthy" &&
    runtimeReady;
  const engineHealth =
    input.health.status === "healthy" && !runtimeReady ? "degraded" : input.health.status;

  return {
    engineHealth,
    executionReady,
    discordConnected: input.health.discordConnected,
    brokerConnected: input.health.brokerConnected,
    activeBroker: input.status.activeBroker,
    autoTradingEnabled: input.status.autoTradingEnabled,
    simulationMode: input.status.simulationMode,
    shutdownTriggered: input.status.shutdownTriggered,
    alertsProcessed: input.status.alertsProcessed,
    lastAlertTime: input.status.lastAlertTime,
    checkedAt: input.checkedAt,
  };
}
