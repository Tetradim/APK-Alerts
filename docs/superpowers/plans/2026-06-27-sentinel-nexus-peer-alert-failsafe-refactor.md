# Sentinel Nexus Peer Alert Failsafe Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the peer alert failsafe code review fixes by hardening phone response creation, expanding blocker-code coverage, and refactoring evaluator internals into clear validation stages.

**Architecture:** Keep the public peer alert event contract unchanged. Add a strict builder guard so a phone cannot create a response for another phone's challenge. Split evaluator internals into envelope, alert fingerprint, timing, and status helpers while preserving the existing `evaluateAlertPeerResponse` API. Keep endpoint and sync-client behavior fail-closed when a peer check is missing, mismatched, or stale.

**Tech Stack:** TypeScript, Node test runner, npm workspaces, shared `@sentinel-nexus/contracts`, `@sentinel-nexus/sync-client`, `@sentinel-nexus/peer-alert-server`.

---

### Task 1: Builder Target Guard

**Files:**
- Modify: `packages/contracts/src/peerAlertFailsafe.test.ts`
- Modify: `packages/contracts/src/peerAlertFailsafe.ts`
- Modify: `packages/peer-alert-server/src/peerAlertChallengeEndpoint.test.ts`
- Modify: `packages/peer-alert-server/src/peerAlertChallengeEndpoint.ts`

- [x] **Step 1: Add failing tests**

Add tests proving `buildPhoneAlertPeerResponseEvent` rejects `responderEngineId` values that do not match the challenge `targetEngineId`, and proving the phone endpoint rejects challenges addressed to another phone with `409`.

- [x] **Step 2: Implement target guard**

Throw from `buildPhoneAlertPeerResponseEvent` when the responder does not match the target. Return a fail-closed endpoint error before reading phone alert state when a challenge targets another phone.

- [x] **Step 3: Verify focused tests**

Run:

```powershell
npm --workspace @sentinel-nexus/contracts exec -- tsx --test src/peerAlertFailsafe.test.ts
npm --workspace @sentinel-nexus/peer-alert-server exec -- tsx --test src/peerAlertChallengeEndpoint.test.ts
```

### Task 2: Blocker Coverage And Evaluator Refactor

**Files:**
- Modify: `packages/contracts/src/peerAlertFailsafe.test.ts`
- Modify: `packages/contracts/src/peerAlertFailsafe.ts`
- Modify: `packages/sync-client/src/peerAlertFailsafeClient.test.ts`

- [x] **Step 1: Expand blocker-code coverage**

Add direct tests for challenge/lease/responder envelope mismatches, missing phone alert copy, Discord/channel/author/message URL fingerprint mismatches, invalid timestamps, and timing-order blockers.

- [x] **Step 2: Add sync-client blocked-response coverage**

Add a test proving a valid phone response that evaluates as mismatched returns `ok: false`, preserves the response event, and reports no transport error.

- [x] **Step 3: Refactor evaluator helpers**

Split `evaluateAlertPeerResponse` internals into `validatePeerEnvelope`, `validateAlertFingerprint`, `validatePeerTiming`, and `classifyPeerStatus`.

### Task 3: Batch Verification And Commit

**Files:**
- Verify all modified files.

- [x] **Step 1: Run full verification**

Run:

```powershell
npm test
npm run typecheck
git diff --check
```

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-peer-alert-failsafe-refactor.md packages/contracts/src/peerAlertFailsafe.ts packages/contracts/src/peerAlertFailsafe.test.ts packages/peer-alert-server/src/peerAlertChallengeEndpoint.ts packages/peer-alert-server/src/peerAlertChallengeEndpoint.test.ts packages/sync-client/src/peerAlertFailsafeClient.test.ts
git diff --cached --check
git commit -m "refactor: harden peer alert failsafe"
git push
```
