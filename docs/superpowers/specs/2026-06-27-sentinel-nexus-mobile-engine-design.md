# Sentinel Nexus Mobile Engine Design

Date: 2026-06-27

## Objective

Build Sentinel Nexus as an Android-first mobile app for Sentinel Echo. The app must be a complete operator surface and a real trading engine host, not a demo shell. It should run as a React Native/Expo application with native Android support where required, and it should support a full Phone Engine that can take over from the existing Windows Remote Engine when the phone engine is online and healthy.

The target source repo is `Tetradim/Sentinel-Nexus`. The existing Sentinel Echo repo remains the source of current backend behavior, trading rules, Discord parsing, broker integration, readiness checks, and safety gates.

## Approved Direction

Use a hybrid monorepo:

- React Native/Expo for the Android app UI.
- Native Android module/service for foreground execution, Android health, notifications, and background survival.
- Embedded Python evaluation first for Phone Engine parity with Sentinel Echo.
- Shared event contracts and tests so Phone Engine and Remote Engine make the same trading decisions.
- Tailscale/private-network sync first, with cloud relay support added later as an optional fallback.

The implementation should avoid noisy code paths that will need to be removed later. No fake data fallbacks, sample-only trading flows, or demo modes should be introduced. Existing Sentinel Echo simulation and paper-shadow behavior may be reused because those are production safety modes, not throwaway demo behavior.

## Non-Goals

- Do not depend on keeping the Discord Android app alive in the background.
- Do not automate a Discord user account or build self-bot behavior.
- Do not put backtesting, replay, or parser lab tools in the mobile app.
- Do not add mock broker or mock Discord data as a visible app mode.
- Do not allow Remote Engine and Phone Engine to submit orders for the same alert.

Backtests, replays, and parser lab surfaces stay on the Remote/Desktop side. The mobile app may show live evidence, diagnostics, logs, and exportable audit records from the event log.

## Monorepo Shape

The Sentinel Nexus repo should be organized so app, engine, contracts, and tests can evolve together.

Proposed top-level layout:

```text
apps/
  mobile/
    app/                  # Expo Router screens
    android/              # native Android project after prebuild
    native-modules/       # foreground service and engine bridge
packages/
  contracts/              # event, lease, settings, and API schemas
  mobile-ui/              # reusable app components and design tokens
  engine-bridge/          # JS/Native bridge to Phone Engine
  sync-client/            # event-log replication and transport clients
engine/
  python/                 # embedded Sentinel Echo-compatible engine subset
  android/                # Android service integration and packaging glue
docs/
  superpowers/specs/
  architecture/
  runbooks/
tests/
  contracts/
  mobile-e2e/
  engine-compat/
```

Exact tooling can be finalized in the implementation plan, but the design expects a workspace-aware monorepo with clear package boundaries and no cross-package imports that bypass contracts.

## Engine Roles

### Phone Engine

The Phone Engine is the preferred active engine when its service is enabled, online, synced, and passing health checks. It runs under an Android foreground service with a persistent notification and explicit readiness state. When active, it can:

- connect to Discord through approved bot/API paths;
- parse Discord alerts using Sentinel Echo-compatible logic;
- evaluate source policy, risk settings, live gates, and duplicate protection;
- create order intents;
- submit broker orders when live prerequisites are satisfied;
- monitor broker fills;
- reconcile alerts, trades, and positions;
- write all decisions to the replicated event log.

Phone Engine must not become active merely because the device is booted or the app is installed. It becomes eligible only when the Phone Engine service is enabled and healthy.

### Remote Engine

Remote Engine is the existing Windows Sentinel Echo runtime by default. It remains the easiest setup path for basic users, using the current Windows PC launcher and local dashboard.

When Phone Engine owns the active trading lease, Remote Engine becomes dormant:

- it stays reachable;
- it syncs the replicated event log;
- it can serve API/dashboard state;
- it can report health and diagnostics;
- it does not parse executable Discord alerts;
- it does not submit broker orders.

When Phone Engine stops, disconnects, misses health checks, loses readiness, or relinquishes the lease, Remote Engine waits for the lease expiry/takeover rule, records takeover in the event log, and resumes from the last replicated event.

## Active Lease

Only one engine can execute at a time. Both engines may be online, but only the active lease holder can turn alerts into broker-affecting actions.

The lease rules are:

- Phone Engine has priority when it is explicitly enabled, online, synced, and healthy.
- Remote Engine is dormant while Phone Engine owns the lease.
- Remote Engine can retake the lease only after Phone Engine loses health or the lease expires according to the shared lease protocol.
- Every handoff creates an audit event.
- Every executable alert/order uses idempotency keys so duplicate order submission can be detected and blocked.
- If lease status is unclear, trading fails closed.

The active lease must be visible in the mobile cockpit and in Remote diagnostics.

## Replicated Event Log

Phone and Remote share a neutral replicated event log. This is the source of truth for failover, auditability, and duplicate prevention. The event log avoids fragile database copying between devices.

Event categories include:

- engine health;
- transport health;
- lease acquisition, renewal, relinquish, expiry, and takeover;
- Discord alert observed;
- alert parse decision;
- source-policy decision;
- risk/readiness decision;
- order intent;
- broker acknowledgment;
- broker rejection/cancellation/expiry;
- fill update;
- trade/position reconciliation;
- emergency stop;
- settings/provisioning changes;
- operator notification events.

Each event should include:

- stable event id;
- event type and schema version;
- source engine id;
- observed timestamp;
- monotonic sequence or causal cursor;
- idempotency key where applicable;
- payload;
- signature or integrity proof where practical;
- previous event/cursor reference for recovery.

On restart, an engine rebuilds current state from persisted events and reconciles against broker truth before it executes any new order.

## Networking And Pairing

Tailscale/private networking is the default off-LAN path. Same-Wi-Fi pairing can be the easiest first-run path when both phone and PC are local. Cloud relay is a later fallback transport and should be designed behind an abstraction now, but not required for v1.

Settings should support:

- prefer Tailscale/private network;
- prefer cloud relay, when relay exists;
- allow cloud fallback;
- notify when transport changes;
- notify when an engine is offline or likely offline;
- notify when failover happens.

Tailscale setup should be guided for basic users:

- Windows installer checks whether Tailscale is installed and running.
- Remote Engine exposes a pairing code or QR code.
- Android app checks whether Tailscale is available and guides the user to install/sign in if needed.
- The app verifies connectivity to Remote Engine over the Tailscale hostname or IP.
- The app does not hide platform-level VPN/sign-in consent requirements.

Cloud relay support should not change trading authority. Transport failover affects sync and health connectivity only; the active lease still decides which engine can execute.

## Credential Provisioning

During pairing, Remote Engine provisions scoped and revocable Phone Engine credentials. These credentials should be stored on Android using Keystore-backed secure storage.

The provisioning model should include:

- short-lived pairing token;
- device identity;
- scoped engine credentials;
- revocation from either engine;
- manual credential entry/import for recovery;
- masked display of secrets;
- readiness checks before using credentials for live behavior.

Phone Engine cannot become active for live trading unless its local readiness proves Discord, broker, source policy, risk gates, and event-log sync are healthy.

## Phone Engine Packaging Strategy

Evaluate embedded Python first because it offers the strongest parity with existing Sentinel Echo behavior.

The compatibility gate must prove:

- required Python modules can be packaged for Android;
- the real parser/source-policy/risk/order/reconciliation subset can run on-device;
- dependency risk areas such as `cryptography`, `pandas`, `numpy`, `aiohttp`, `discord.py`, and broker clients are either packaged successfully or isolated away from the on-device subset;
- the engine can run under the Android foreground service lifecycle;
- health checks, restart, and shutdown behave predictably.

If full backend packaging is not viable, extract the smallest production engine subset instead of introducing demo behavior. The fallback implementation must still use real contracts, real settings, and real broker/Discord integrations.

## Mobile UI

The first screen is the Operator Cockpit. It answers whether the system is active, safe, synced, and able to trade.

Primary mobile surfaces:

- Cockpit: active engine, lease state, readiness, transport, emergency stop, recent alerts, sync status.
- Alerts: Discord intake evidence, parse status, source policy decisions, skip reasons, execution status.
- Positions: open positions, fills, exits, P/L, OCO/protection status, broker reconciliation.
- Engines: Phone/Remote health, active lease, handoff history, event-log sync status, transport status.
- Settings: engine enablement, engine preference, failover notifications, broker settings, Discord settings, risk settings, Tailscale/cloud transport.
- More: logs, diagnostics, account status, help, exports, app/about information.

There is no Lab tab in the mobile app. Replay, backtesting, and parser lab workflows stay on Remote/Desktop.

The UI should be dense, operational, and mobile-native. It should prioritize status clarity, controls with real consequences, and readable audit evidence over decorative marketing layout.

## Failure Handling

Trading must fail closed when any of the following are unclear:

- active lease ownership;
- event-log sync state;
- Discord readiness;
- broker credentials/configuration;
- broker order status support;
- source policy;
- risk gates;
- live trading arming;
- fill reconciliation state.

Required behaviors:

- Notify when failover happens.
- Notify when Phone or Remote is offline or likely offline.
- Notify when transport changes between Tailscale/private network and cloud relay.
- Notify when live readiness degrades.
- Record emergency stop in the event log.
- Require broker reconciliation before executing after restart or takeover.
- Make skipped decisions visible, with reasons.

## Data Flow

Normal Phone Engine active flow:

1. Phone Engine owns lease.
2. Discord bot alert is observed.
3. Alert text and embeds are normalized.
4. Parser and source policy produce a decision event.
5. Risk/readiness gates produce an execution decision.
6. Order intent is written with idempotency key.
7. Broker submission occurs only if live gates are satisfied.
8. Broker ack/fill/rejection is written to event log.
9. Position and alert state are reconciled.
10. Remote Engine receives replicated events but remains dormant.

Remote takeover flow:

1. Phone Engine misses health or relinquishes lease.
2. Remote Engine observes lease expiry/takeover eligibility.
3. Remote Engine writes takeover event.
4. Remote Engine rebuilds state from the event log.
5. Remote Engine reconciles broker state.
6. Remote Engine resumes intake/orders from the last confirmed event.

## Testing Strategy

Testing must focus on correctness, failover safety, and mobile runtime behavior.

Required test layers:

- Python/backend unit tests carried forward from Sentinel Echo for parser, policy, risk, orders, fills, and reconciliation.
- Contract tests for event schemas, lease state transitions, idempotency keys, and sync cursors.
- Cross-engine parity tests proving Phone and Remote produce the same parse, source-policy, risk, sizing, order-key, and reconciliation results for the same events.
- Embedded Python compatibility tests for Android packaging.
- React Native component tests for cockpit, alerts, positions, engines, and settings states.
- Mobile E2E tests for onboarding, pairing, Tailscale connectivity, credential provisioning, lease takeover, remote dormancy, notifications, and emergency stop.
- Manual Android device checks for foreground service persistence, battery-optimization warnings, notification behavior, network transition behavior, and app restart recovery.

## Acceptance Criteria

The design is implemented when:

- Sentinel Nexus is a monorepo with clear app, engine, contracts, sync, and test boundaries.
- The Android app shows an operator cockpit as the first screen.
- The mobile navigation excludes Lab/backtesting/replay functionality.
- Phone Engine can own the active lease only when its service is enabled and healthy.
- Remote Engine becomes dormant when Phone Engine owns the lease.
- Remote Engine resumes execution after Phone Engine loses health or lease.
- Both engines use the replicated event log as the source of truth.
- Idempotency prevents duplicate broker orders from the same alert.
- Tailscale/private networking is the default sync path.
- Cloud relay is abstracted for later fallback support.
- Credentials are provisioned during pairing and stored securely on Android.
- Trading fails closed when lease, readiness, broker, or sync state is unclear.
- Failover/offline/transport-change notifications are configurable.
- Existing Sentinel Echo live-trading gates still apply.
- No demo-only modes, fake data fallbacks, or throwaway mobile trading paths are added.
