import { remoteEngineStore } from "./remoteEngineState";
import type { SecureSettingsStorage } from "./secureSettingsPersistence";
import { useSettingsState } from "./settingsState";

export async function hydratePersistentMobileState(
  storage: SecureSettingsStorage,
): Promise<void> {
  await Promise.all([
    remoteEngineStore.getState().hydrateConnection(storage),
    useSettingsState.getState().hydrateFailoverSettings(storage),
  ]);
}

export async function persistPersistentMobileState(
  storage: SecureSettingsStorage,
): Promise<void> {
  await Promise.all([
    remoteEngineStore.getState().persistConnection(storage),
    useSettingsState.getState().persistFailoverSettings(storage),
  ]);
}

export function installPersistentMobileState(
  storage: SecureSettingsStorage,
): () => void {
  const unsubscribeRemote = remoteEngineStore.subscribe((state, previousState) => {
    const current = state.snapshot.connection;
    const previous = previousState.snapshot.connection;
    if (current.baseApiUrl !== previous.baseApiUrl || current.apiKey !== previous.apiKey) {
      void state.persistConnection(storage).catch(() => undefined);
    }
  });

  const unsubscribeSettings = useSettingsState.subscribe((state, previousState) => {
    if (state.snapshot.failoverSettings !== previousState.snapshot.failoverSettings) {
      void state.persistFailoverSettings(storage).catch(() => undefined);
    }
  });

  return () => {
    unsubscribeRemote();
    unsubscribeSettings();
  };
}
