import type { DiscordIngestionSettings } from "@apk-alerts/contracts";
import type { StoreApi } from "zustand/vanilla";
import {
  configureNativeDiscordIngestion,
  startNativePhoneEngineRuntime,
  stopNativePhoneEngineRuntime,
  type PhoneEngineRuntimeNativeModule,
} from "../native/phoneEngineRuntimeBridge";
import {
  phoneEngineRuntimeStore,
  type PhoneEngineRuntimeSnapshot,
  type PhoneEngineRuntimeState,
} from "./phoneEngineRuntimeState";

export type PhoneEngineRuntimeStore = StoreApi<PhoneEngineRuntimeState>;

export async function applyNativeDiscordIngestionSettings(
  store: PhoneEngineRuntimeStore = phoneEngineRuntimeStore,
  settings: DiscordIngestionSettings,
  nativeModule?: PhoneEngineRuntimeNativeModule | null,
): Promise<PhoneEngineRuntimeSnapshot> {
  const configured = await configureNativeDiscordIngestion(nativeModule, settings);
  store.getState().updateRuntime(configured);

  const nextSnapshot = settings.foregroundServiceEnabled
    ? await startNativePhoneEngineRuntime(nativeModule)
    : await stopNativePhoneEngineRuntime(nativeModule);
  store.getState().updateRuntime(nextSnapshot);

  return nextSnapshot;
}
