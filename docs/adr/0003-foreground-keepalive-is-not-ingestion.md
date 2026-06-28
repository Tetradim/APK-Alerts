# ADR 0003: Foreground Keepalive Is Not Ingestion Evidence

## Status

Accepted

## Decision

Android foreground service state does not count as Discord ingestion readiness.

## Context

A foreground service keeps the process alive with a persistent notification. It does not prove that Discord is connected, that an allowed source/channel/author was observed, or that the parser saw a usable alert.

## Consequences

- Foreground keepalive may be enabled without making the Phone Engine lease-eligible.
- Discord gateway connection is separate from alert-ingestion evidence.
- Phone Engine readiness requires allowed alert evidence, not just process liveness.
