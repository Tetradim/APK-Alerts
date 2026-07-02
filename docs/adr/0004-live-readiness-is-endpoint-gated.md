# ADR 0004: Live Readiness Is Endpoint Gated

## Status

Accepted

## Decision

Sentinel Nexus must not claim live-money readiness unless the live-readiness endpoint passes all required broker, source, credential, reconciliation, OCO exit, runtime, and arming checks.

## Context

Mobile UI health, Discord connectivity, and local settings can only support readiness. They are not enough to authorize live-money execution.

## Consequences

- UI labels distinguish endpoint-ready, ready-to-arm, and live-money-ready.
- Missing endpoint evidence fails closed.
- Any future local broker/Discord engine must still feed the same readiness contract before live-money claims are allowed.
