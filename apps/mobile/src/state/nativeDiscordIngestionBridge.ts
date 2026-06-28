import type { DiscordIngestionSettings } from "@apk-alerts/contracts";
import type { StoreApi } from "zustand/vanilla";
import {
  configureNativeDiscordIngestion,
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

  return configured;
}
