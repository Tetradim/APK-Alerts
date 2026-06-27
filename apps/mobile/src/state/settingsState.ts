import {
  DEFAULT_FAILOVER_SETTINGS,
  type FailoverSettings,
  buildEnginePriorityLabel,
  buildTransportLabel,
  normalizeFailoverSettings,
} from "@apk-alerts/contracts";
import { create } from "zustand";
import {
  loadFailoverSettings,
  saveFailoverSettings,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence";

export interface MobileSettingsSnapshot {
  failoverSettings: FailoverSettings;
}

export interface SettingsSummary {
  engineLabel: string;
  transportLabel: string;
  notificationsLabel: string;
}

export function getDefaultMobileSettingsSnapshot(): MobileSettingsSnapshot {
  return {
    failoverSettings: DEFAULT_FAILOVER_SETTINGS,
  };
}

export function createNextSettings(
  current: FailoverSettings,
  patch: Partial<FailoverSettings>,
): FailoverSettings {
  return normalizeFailoverSettings({
    ...current,
    ...patch,
  });
}

export function buildSettingsSummary(settings: FailoverSettings): SettingsSummary {
  const notificationsLabel =
    settings.notifyOnFailover && settings.notifyWhenOffline
      ? "Failover and offline alerts on"
      : settings.notifyOnFailover
        ? "Failover alerts on"
        : settings.notifyWhenOffline
          ? "Offline alerts on"
          : "Phone alerts off";

  return {
    engineLabel: buildEnginePriorityLabel(settings),
    transportLabel: buildTransportLabel(settings),
    notificationsLabel,
  };
}

interface SettingsState {
  snapshot: MobileSettingsSnapshot;
  updateFailoverSettings: (patch: Partial<FailoverSettings>) => void;
  hydrateFailoverSettings: (storage: SecureSettingsStorage) => Promise<void>;
  persistFailoverSettings: (storage: SecureSettingsStorage) => Promise<void>;
}

export const useSettingsState = create<SettingsState>((set, get) => ({
  snapshot: getDefaultMobileSettingsSnapshot(),
  updateFailoverSettings: (patch) =>
    set((state) => ({
      snapshot: {
        failoverSettings: createNextSettings(state.snapshot.failoverSettings, patch),
      },
    })),
  hydrateFailoverSettings: async (storage) => {
    const settings = await loadFailoverSettings(storage);
    if (!settings) {
      return;
    }
    set({
      snapshot: {
        failoverSettings: settings,
      },
    });
  },
  persistFailoverSettings: async (storage) => {
    await saveFailoverSettings(storage, get().snapshot.failoverSettings);
  },
}));
