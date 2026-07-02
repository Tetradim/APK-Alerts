# Sentinel Nexus

Sentinel Nexus is the Android-first mobile control app and phone-engine host for Sentinel Echo.

The foundation slice includes:

- npm workspace monorepo;
- shared TypeScript event and lease contracts;
- local append-only event log with duplicate idempotency-key protection;
- Expo mobile shell;
- operator cockpit as the first screen;
- failover settings for engine priority, engine enablement, transport preference, and phone alerts;
- Engines tab remote Sentinel Echo API health checks through `/api/health` and `/api/status`;
- Alerts tab evidence checks through `/api/bus/events`, `/api/operator/events`, and `/api/discord/chrome-bridge/health`;
- Positions tab reconciliation checks through `/api/operator/reconciliation`;
- More tab live-readiness checks through `/api/operator/live-readiness`;
- Alerts, Positions, Engines, Settings, and More tabs;
- no mobile Lab tab;
- no fake trading data.

## Development

Install dependencies:

```powershell
npm install
```

Run all tests:

```powershell
npm test
```

Run type checks:

```powershell
npm run typecheck
```

Start the mobile app:

```powershell
npm run mobile:dev
```

Run Android:

```powershell
npm run mobile:android
```

## Product Boundaries

The app starts from a real not-paired state. It does not invent sample trades or show demo broker data.

Backtests, replays, and parser lab workflows remain on Remote/Desktop Sentinel Echo surfaces. Mobile focuses on operator status, alerts, positions, engine health, settings, logs, diagnostics, and exports.

The mobile Alerts tab consumes real Sentinel Echo Chrome bridge evidence. It displays observed Discord messages, parser confidence, source/channel/author policy proof, bridge health, and operator audit decisions from the remote event stream. It does not simulate alerts, does not bypass source policy, and does not claim live-money readiness.

The mobile More tab consumes the remote live-readiness endpoint and remains display-only. The app can only label live money as ready when the endpoint passes and the normalized broker, source, credential, ingestion, reconciliation, replay, OCO, runtime shutdown, and live-arming checks all pass.

The mobile Positions tab consumes remote reconciliation rows to show alert, trade, order, and position links. It surfaces unresolved real-money attention reasons and keeps simulated unresolved rows separate from live-blocking reconciliation.

Native Phone Engine execution, embedded Python packaging, Tailscale pairing, credential provisioning, cloud relay fallback, and broker execution are separate implementation slices that build on this foundation.
