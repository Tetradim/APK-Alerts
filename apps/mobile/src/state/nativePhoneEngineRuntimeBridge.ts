import type { StoreApi } from "zustand/vanilla";
import {
  readNativePhoneEngineRuntimeStatus,
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

export async function syncPhoneEngineRuntimeStatus(
  store: PhoneEngineRuntimeStore = phoneEngineRuntimeStore,
  nativeModule?: PhoneEngineRuntimeNativeModule | null,
): Promise<PhoneEngineRuntimeSnapshot> {
  const snapshot = await readNativePhoneEngineRuntimeStatus(nativeModule);
  store.getState().updateRuntime(snapshot);
  return snapshot;
}

export async function startAndSyncPhoneEngineRuntime(
  store: PhoneEngineRuntimeStore = phoneEngineRuntimeStore,
  nativeModule?: PhoneEngineRuntimeNativeModule | null,
): Promise<PhoneEngineRuntimeSnapshot> {
  const snapshot = await startNativePhoneEngineRuntime(nativeModule);
  store.getState().updateRuntime(snapshot);
  return snapshot;
}

export async function stopAndSyncPhoneEngineRuntime(
  store: PhoneEngineRuntimeStore = phoneEngineRuntimeStore,
  nativeModule?: PhoneEngineRuntimeNativeModule | null,
): Promise<PhoneEngineRuntimeSnapshot> {
  const snapshot = await stopNativePhoneEngineRuntime(nativeModule);
  store.getState().updateRuntime(snapshot);
  return snapshot;
}
