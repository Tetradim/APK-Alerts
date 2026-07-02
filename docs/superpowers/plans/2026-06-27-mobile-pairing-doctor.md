# Mobile Pairing Doctor and Evidence Readiness Plan

## Goal

Make Sentinel Nexus prove, from inside the Android app, whether it is paired to the remote Sentinel Echo engine and whether the required remote endpoints are reachable with the configured API key. This becomes the base evidence for later install readiness, support bundle export, and alert timeline views.

## Batch 1 - Remote Pairing Contract

1. Add a Sentinel Echo backend pairing route under `/api/pairing/status`.
2. Keep `/api/pairing/status` non-secret: it may report whether an API key is configured, whether remote binding is enabled, and which checks are expected, but it must not return the API key.
3. Add `/api/pairing/config` for keyed/local pairing payloads. This route may include the API key only when the backend is running authless local desktop mode or the request already supplied the valid API key.
4. Include endpoint checks for health, status, setup diagnostics, live readiness, alert evidence, reconciliation, bot bus, and Chrome bridge.
5. Add backend tests for redacted status, keyed config payload, and unauthenticated secret rejection.

## Batch 2 - Mobile Pairing Doctor

1. Add a contract normalizer for remote pairing status/config payloads.
2. Add a sync-client pairing client that fetches `/pairing/status` and can probe required endpoints using the same API key header.
3. Add mobile pairing doctor state that records each check as pass, fail, or skipped with timestamp and error.
4. Add an Engines screen section with a single "Run Pairing Doctor" action, a non-secret checklist, and import-ready labels for the current base URL and transport.
5. Add tests for payload normalization, client headers, failed endpoint handling, and mobile summary labels.

## Batch 3 - Evidence Features

1. Add persistent WebView health timestamps to the existing Discord WebView state.
2. Add install readiness summary rows that include pairing, foreground service, WebView health, phone engine, and live readiness gates.
3. Add support bundle builders that collect non-secret pairing, readiness, WebView, phone engine, and alert evidence snapshots.
4. Add an evidence timeline view over existing alert evidence records so a customer can inspect see, parse, decide, place/queue, and reconcile stages.

## Verification

Run backend tests for the pairing route, then Sentinel Nexus typecheck, lint, and tests. Build the release APK only after both repositories pass their targeted checks.
