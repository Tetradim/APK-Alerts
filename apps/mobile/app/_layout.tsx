import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { expoSecureSettingsStorage } from "@/state/expoSecureSettingsStorage";
import {
  hydratePersistentMobileState,
  installPersistentMobileState,
} from "@/state/persistentMobileState";

export default function RootLayout() {
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

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
