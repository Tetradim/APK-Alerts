import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { readNativePhoneEngineRuntime } from "@/native/PhoneEngineRuntimeNative";
import { expoSecureSettingsStorage } from "@/state/expoSecureSettingsStorage";
import {
  hydratePersistentMobileState,
  installPersistentMobileState,
} from "@/state/persistentMobileState";
import { phoneEngineRuntimeStore } from "@/state/phoneEngineRuntimeState";

export default function RootLayout() {
  useEffect(() => {
    let active = true;
    let phoneRuntimeInterval: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;

    const refreshPhoneRuntime = async () => {
      const snapshot = await readNativePhoneEngineRuntime();
      if (active) {
        phoneEngineRuntimeStore.getState().updateRuntime(snapshot);
      }
    };

    void refreshPhoneRuntime().catch(() => undefined);
    phoneRuntimeInterval = setInterval(() => {
      void refreshPhoneRuntime().catch(() => undefined);
    }, 15_000);

    void hydratePersistentMobileState(expoSecureSettingsStorage)
      .catch(() => undefined)
      .finally(() => {
        if (!active) {
          return;
        }
        unsubscribe = installPersistentMobileState(expoSecureSettingsStorage);
      });

    return () => {
      active = false;
      if (phoneRuntimeInterval) {
        clearInterval(phoneRuntimeInterval);
      }
      unsubscribe?.();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
