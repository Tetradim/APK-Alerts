# ADR 0001: Private Discord Token Storage

## Status

Accepted

## Decision

APK-Alerts stores the Discord bot token in app-managed secure settings for this private install workflow.

## Context

The app is not being built as a public Play Store distribution model. The operator explicitly prefers local/private operation with reduced security friction.

## Consequences

- Settings and persistence code must treat the token as private app configuration.
- Logs, tests, and UI summaries must avoid printing token values.
- A future public distribution model would need a different credential strategy.
