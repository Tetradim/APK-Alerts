import { NativeModules, Platform } from "react-native";
import {
  readNativePhoneEngineRuntimeStatus,
  startNativePhoneEngineRuntime as startRuntime,
  stopNativePhoneEngineRuntime as stopRuntime,
  type PhoneEngineRuntimeNativeModule,
} from "./phoneEngineRuntimeBridge";

function getPhoneEngineRuntimeNativeModule(): PhoneEngineRuntimeNativeModule | null {
  if (Platform.OS !== "android") {
    return null;
  }

  const nativeModule = NativeModules.PhoneEngineRuntime as
    | PhoneEngineRuntimeNativeModule
    | undefined;
  return nativeModule ?? null;
}

export function getNativePhoneEngineRuntimeModule(): PhoneEngineRuntimeNativeModule | null {
  return getPhoneEngineRuntimeNativeModule();
}

export function readNativePhoneEngineRuntime() {
  return readNativePhoneEngineRuntimeStatus(getPhoneEngineRuntimeNativeModule());
}

export function startNativePhoneEngineRuntime() {
  return startRuntime(getPhoneEngineRuntimeNativeModule());
}

export function stopNativePhoneEngineRuntime() {
  return stopRuntime(getPhoneEngineRuntimeNativeModule());
}
