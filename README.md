# APK-Alerts

APK-Alerts is the Android-first mobile control app and phone-engine host for Consolidation.

The foundation slice includes:

- npm workspace monorepo;
- shared TypeScript event and lease contracts;
- local append-only event log with duplicate idempotency-key protection;
- Expo mobile shell;
- operator cockpit as the first screen;
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

Backtests, replays, and parser lab workflows remain on Remote/Desktop Consolidation surfaces. Mobile focuses on operator status, alerts, positions, engine health, settings, logs, diagnostics, and exports.

Native Phone Engine execution, embedded Python packaging, Tailscale pairing, credential provisioning, cloud relay fallback, and broker execution are separate implementation slices that build on this foundation.
