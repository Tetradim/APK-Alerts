import { remoteEngineStore } from "./remoteEngineState";
import {
  loadSetupAutomationEvidence,
  saveSetupAutomationEvidence,
  type SecureSettingsStorage,
} from "./secureSettingsPersistence";
import { useSettingsState } from "./settingsState";
import { setupAutomationStore } from "./setupAutomationState";

export async function hydratePersistentMobileState(
  storage: SecureSettingsStorage,
): Promise<void> {
  await Promise.all([
    remoteEngineStore.getState().hydrateConnection(storage),
    useSettingsState.getState().hydrateFailoverSettings(storage),
    useSettingsState.getState().hydrateDiscordIngestionSettings(storage),
  ]);
  const setupEvidence = await loadSetupAutomationEvidence(storage);
  if (setupEvidence) {
    setupAutomationStore.getState().replaceWindowsEvidence(setupEvidence);
  }
}

export async function persistPersistentMobileState(
  storage: SecureSettingsStorage,
): Promise<void> {
  await Promise.all([
    remoteEngineStore.getState().persistConnection(storage),
    useSettingsState.getState().persistFailoverSettings(storage),
    useSettingsState.getState().persistDiscordIngestionSettings(storage),
    saveSetupAutomationEvidence(storage, setupAutomationStore.getState().snapshot.windows),
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
    if (state.snapshot.discordIngestionSettings !== previousState.snapshot.discordIngestionSettings) {
      void state.persistDiscordIngestionSettings(storage).catch(() => undefined);
    }
  });
  const unsubscribeSetup = setupAutomationStore.subscribe((state, previousState) => {
    if (state.snapshot.windows !== previousState.snapshot.windows) {
      void saveSetupAutomationEvidence(storage, state.snapshot.windows).catch(() => undefined);
    }
  });

  return () => {
    unsubscribeRemote();
    unsubscribeSettings();
    unsubscribeSetup();
  };
}
