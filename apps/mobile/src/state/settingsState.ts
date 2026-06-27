import {
  DEFAULT_FAILOVER_SETTINGS,
  type FailoverSettings,
  buildEnginePriorityLabel,
  buildTransportLabel,
  normalizeFailoverSettings,
} from "@apk-alerts/contracts";
import { create } from "zustand";

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
}

export const useSettingsState = create<SettingsState>((set) => ({
  snapshot: getDefaultMobileSettingsSnapshot(),
  updateFailoverSettings: (patch) =>
    set((state) => ({
      snapshot: {
        failoverSettings: createNextSettings(state.snapshot.failoverSettings, patch),
      },
    })),
}));
