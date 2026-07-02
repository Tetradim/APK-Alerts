import {
  normalizeDiscordIngestionSettings,
  type DiscordIngestionSettings,
} from "@sentinel-nexus/contracts";
import {
  getDefaultPhoneEngineRuntimeSnapshot,
  type PhoneEngineRuntimeHealth,
  type PhoneEngineRuntimeSnapshot,
} from "../state/phoneEngineRuntimeState";

export interface PhoneEngineRuntimeNativeModule {
  getStatus: () => Promise<unknown>;
  start: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  configureDiscordIngestion?: (settings: DiscordIngestionSettings) => Promise<unknown>;
}

type PhoneEngineRuntimeMethod = "getStatus" | "start" | "stop";

export async function readNativePhoneEngineRuntimeStatus(
  nativeModule: PhoneEngineRuntimeNativeModule | null | undefined,
): Promise<PhoneEngineRuntimeSnapshot> {
  return invokeNativePhoneEngineRuntime(nativeModule, "getStatus", "status check");
}

export async function startNativePhoneEngineRuntime(
  nativeModule: PhoneEngineRuntimeNativeModule | null | undefined,
): Promise<PhoneEngineRuntimeSnapshot> {
  return invokeNativePhoneEngineRuntime(nativeModule, "start", "start");
}

export async function stopNativePhoneEngineRuntime(
  nativeModule: PhoneEngineRuntimeNativeModule | null | undefined,
): Promise<PhoneEngineRuntimeSnapshot> {
  return invokeNativePhoneEngineRuntime(nativeModule, "stop", "stop");
}

export async function configureNativeDiscordIngestion(
  nativeModule: PhoneEngineRuntimeNativeModule | null | undefined,
  settings: DiscordIngestionSettings,
): Promise<PhoneEngineRuntimeSnapshot> {
  if (!nativeModule?.configureDiscordIngestion) {
    return unavailableSnapshot("Native Android phone engine Discord configuration is unavailable.");
  }

  try {
    const status = await nativeModule.configureDiscordIngestion(
      normalizeDiscordIngestionSettings(settings),
    );
    return normalizeNativePhoneEngineRuntimeStatus(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unavailableSnapshot(
      `Native Android phone engine Discord configuration failed: ${message || "unknown error"}`,
    );
  }
}

export function normalizeNativePhoneEngineRuntimeStatus(
  payload: unknown,
  nativeRuntimeAvailable = true,
): PhoneEngineRuntimeSnapshot {
  const data = isRecord(payload) ? payload : {};
  const snapshot = getDefaultPhoneEngineRuntimeSnapshot();
  const health = normalizeHealth(data.health);

  return {
    ...snapshot,
    nativeRuntimeAvailable: booleanValue(data.nativeRuntimeAvailable, nativeRuntimeAvailable),
    serviceEnabled: booleanValue(data.serviceEnabled, false),
    foregroundServiceActive: booleanValue(data.foregroundServiceActive, false),
    discordEngineEmbedded: booleanValue(data.discordEngineEmbedded, false),
    brokerEngineEmbedded: booleanValue(data.brokerEngineEmbedded, false),
    discordEngineReady: booleanValue(data.discordEngineReady, false),
    discordGatewayConnected: booleanValue(data.discordGatewayConnected, false),
    discordIngestionEvidenceReady: booleanValue(data.discordIngestionEvidenceReady, false),
    discordGatewayStatus: stringValue(data.discordGatewayStatus),
    discordLastAlertObservedAt: stringValue(data.discordLastAlertObservedAt),
    peerAlertServerActive: booleanValue(data.peerAlertServerActive, false),
    peerAlertServerStatus: stringValue(data.peerAlertServerStatus),
    peerAlertServerPort: numberValue(data.peerAlertServerPort, 42117),
    brokerEngineReady: booleanValue(data.brokerEngineReady, false),
    liveExecutionArmed: booleanValue(data.liveExecutionArmed, false),
    health,
    lastHeartbeatAt: stringValue(data.lastHeartbeatAt),
    blockingReason: stringValue(data.blockingReason),
  };
}

async function invokeNativePhoneEngineRuntime(
  nativeModule: PhoneEngineRuntimeNativeModule | null | undefined,
  method: PhoneEngineRuntimeMethod,
  actionLabel: string,
): Promise<PhoneEngineRuntimeSnapshot> {
  if (!nativeModule) {
    return unavailableSnapshot("Native Android foreground engine module is unavailable.");
  }

  try {
    const status = await nativeModule[method]();
    return normalizeNativePhoneEngineRuntimeStatus(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unavailableSnapshot(
      `Native Android phone engine ${actionLabel} failed: ${message || "unknown error"}`,
    );
  }
}

function unavailableSnapshot(blockingReason: string): PhoneEngineRuntimeSnapshot {
  return {
    ...getDefaultPhoneEngineRuntimeSnapshot(),
    nativeRuntimeAvailable: false,
    health: "offline",
    blockingReason,
  };
}

function normalizeHealth(value: unknown): PhoneEngineRuntimeHealth {
  return value === "healthy" || value === "degraded" || value === "offline" || value === "unknown"
    ? value
    : "unknown";
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
