import { useEffect } from "react";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  getNativePhoneEngineRuntimeModule,
  readNativePhoneEngineRuntime,
} from "@/native/PhoneEngineRuntimeNative";
import { expoSecureSettingsStorage } from "@/state/expoSecureSettingsStorage";
import { applyNativeDiscordIngestionSettings } from "@/state/nativeDiscordIngestionBridge";
import {
  hydratePersistentMobileState,
  installPersistentMobileState,
} from "@/state/persistentMobileState";
import { installPairingDeepLinkHandler } from "@/state/pairingDeepLinkState";
import { phoneEngineRuntimeStore } from "@/state/phoneEngineRuntimeState";
import { installRemoteConnectionSync } from "@/state/remoteConnectionSync";
import { remoteEngineStore } from "@/state/remoteEngineState";
import { useSettingsState } from "@/state/settingsState";
import { setupAutomationStore } from "@/state/setupAutomationState";

export default function RootLayout() {
  useEffect(() => {
    let active = true;
    let phoneRuntimeInterval: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    let unsubscribePairingDeepLink: (() => void) | undefined;
    let unsubscribeNativeDiscordSettings: (() => void) | undefined;
    let unsubscribeRemoteConnectionSync: (() => void) | undefined;

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
        unsubscribeRemoteConnectionSync = installRemoteConnectionSync();
        unsubscribePairingDeepLink = installPairingDeepLinkHandler(
          {
            getInitialURL: Linking.getInitialURL,
            addEventListener: (_eventName, handler) => Linking.addEventListener("url", handler),
          },
          {
            importPairingPackage: setupAutomationStore.getState().importPairingPackage,
            updateConnectionDraft: remoteEngineStore.getState().updateConnectionDraft,
          },
        );
        const syncNativeDiscordSettings = () =>
          applyNativeDiscordIngestionSettings(
            phoneEngineRuntimeStore,
            useSettingsState.getState().snapshot.discordIngestionSettings,
            getNativePhoneEngineRuntimeModule(),
          ).catch(() => undefined);

        void syncNativeDiscordSettings();
        unsubscribeNativeDiscordSettings = useSettingsState.subscribe((state, previousState) => {
          if (state.snapshot.discordIngestionSettings !== previousState.snapshot.discordIngestionSettings) {
            void syncNativeDiscordSettings();
          }
        });
      });

    return () => {
      active = false;
      if (phoneRuntimeInterval) {
        clearInterval(phoneRuntimeInterval);
      }
      unsubscribe?.();
      unsubscribePairingDeepLink?.();
      unsubscribeNativeDiscordSettings?.();
      unsubscribeRemoteConnectionSync?.();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
