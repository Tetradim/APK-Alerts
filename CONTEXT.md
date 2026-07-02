# Sentinel Nexus / Sentinel Echo Context

Sentinel Nexus is the Android operator app for Sentinel Echo. The target behavior is deterministic, auditable trading automation where every alert can be traced through see, parse, decide, place or queue, and reconcile evidence before any live-money claim.

## Domain Terms

- Phone Engine: Native Android foreground service plus embedded Discord and broker runtime. It can only execute when runtime health, broker readiness, ingestion evidence, and lease evidence are all clear.
- Remote Engine: Windows Sentinel Echo process exposed through a private Tailscale/local/cloud API. It remains reachable while dormant and resumes when the phone no longer owns a valid lease.
- Lease: The execution authority record. A healthy engine is only eligible; an audited active lease is what permits active ownership.
- Lease Evidence: Normalized proof of holder, lease id, holder engine id, expiry, observation time, source, stale state, and conflict state.
- Peer Alert Challenge: Remote asks the phone for its latest alert fingerprint to verify whether both engines saw the same source alert.
- Live Readiness: Endpoint-gated claim. The app must never claim live-money readiness unless broker, source, credential, reconciliation, OCO, runtime, and arming checks pass.
- Foreground Keepalive: Android process-retention mechanism. It is not an ingestion source and does not prove Discord alert visibility.
- Discord Ingestion Routes: Bot Engine, WebView, and Foreground Keepalive. Bot/WebView can prove ingestion; Foreground Keepalive only supports process survival.

## Current Constraints

- The app supports private HTTP remote APIs, so Android cleartext traffic remains enabled for internal Tailscale/local workflows.
- Discord token storage in the app is a deliberate project decision for this private install model.
- The mobile app does not include the desktop Lab/backtest tab.
- Debug-signed APKs are internal test artifacts unless release keystore environment or Gradle properties are supplied.
