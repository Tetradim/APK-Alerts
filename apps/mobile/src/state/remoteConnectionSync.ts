import {
  alertEvidenceStore,
  type AlertEvidenceState,
} from "./alertEvidenceState";
import {
  liveReadinessStore,
  type LiveReadinessState,
} from "./liveReadinessState";
import {
  reconciliationStore,
  type ReconciliationState,
} from "./reconciliationState";
import {
  remoteEngineStore,
  type RemoteEngineState,
} from "./remoteEngineState";

interface StoreLike<TState> {
  getState: () => TState;
  subscribe: (listener: (state: TState, previousState: TState) => void) => () => void;
}

export interface RemoteConnectionSyncStores {
  remote: StoreLike<RemoteEngineState>;
  alerts: StoreLike<AlertEvidenceState>;
  readiness: StoreLike<LiveReadinessState>;
  reconciliation: StoreLike<ReconciliationState>;
}

const defaultStores: RemoteConnectionSyncStores = {
  remote: remoteEngineStore,
  alerts: alertEvidenceStore,
  readiness: liveReadinessStore,
  reconciliation: reconciliationStore,
};

export function installRemoteConnectionSync(
  stores: RemoteConnectionSyncStores = defaultStores,
): () => void {
  applyRemoteConnectionToEvidenceStores(stores);

  return stores.remote.subscribe((state, previousState) => {
    const current = state.snapshot.connection;
    const previous = previousState.snapshot.connection;
    if (current.baseApiUrl === previous.baseApiUrl && current.apiKey === previous.apiKey) {
      return;
    }
    applyRemoteConnectionToEvidenceStores(stores);
  });
}

export function applyRemoteConnectionToEvidenceStores(
  stores: RemoteConnectionSyncStores = defaultStores,
): void {
  const connection = stores.remote.getState().snapshot.connection;
  syncStoreConnection(stores.alerts.getState(), connection);
  syncStoreConnection(stores.readiness.getState(), connection);
  syncStoreConnection(stores.reconciliation.getState(), connection);
}

function syncStoreConnection(
  state: Pick<AlertEvidenceState | LiveReadinessState | ReconciliationState, "snapshot" | "updateConnectionDraft">,
  connection: { baseApiUrl: string; apiKey: string },
): void {
  if (
    state.snapshot.connection.baseApiUrl === connection.baseApiUrl &&
    state.snapshot.connection.apiKey === connection.apiKey
  ) {
    return;
  }

  state.updateConnectionDraft({
    baseApiUrl: connection.baseApiUrl,
    apiKey: connection.apiKey,
  });
}
