# APK-Alerts

APK-Alerts is the Android-first mobile control app and phone-engine host for Consolidation.

The approved design starts with:

- React Native / Expo for the mobile app;
- typed event and lease contracts shared by mobile and engine code;
- a phone-preferred active trading lease;
- no fake trading data or sample broker modes;
- no mobile Lab tab for backtests or replays.

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

The first implementation slice builds contracts, a local event log, and the operator cockpit shell. Native Phone Engine execution, Tailscale pairing, credential provisioning, and broker execution are separate implementation slices.
