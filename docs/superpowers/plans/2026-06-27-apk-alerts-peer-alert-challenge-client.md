# APK Alerts Peer Alert Challenge Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the peer alert failsafe contract into Remote challenge emission and Phone response handling without fake transports or demo fallbacks.

**Architecture:** Harden the shared peer alert evaluator first so missing required identity/timing fields cannot match. Add a Phone-side response builder that turns a challenge plus the phone's last alert copy into `alert.peer.response.v1`. Add a sync-client Remote emitter that POSTs the challenge to `/api/peer-alert/challenges`, expects a typed phone response, and evaluates it with the shared contract.

**Tech Stack:** TypeScript, Node test runner, npm workspaces, shared `@apk-alerts/contracts`, `@apk-alerts/sync-client`.

---

### Task 1: Strict Phone Response Handling

**Files:**
- Modify: `packages/contracts/src/peerAlertFailsafe.test.ts`
- Modify: `packages/contracts/src/peerAlertFailsafe.ts`

- [x] **Step 1: Add failing contract tests**

Add tests that prove:
- `buildPhoneAlertPeerResponseEvent` creates a deterministic `alert.peer.response.v1` response for a challenge.
- Invalid `respondedAt` blocks with `responded_at_invalid`.
- Blank required identity proof blocks even when challenge and phone copy both carry the same blank value.

Run:

```powershell
npm --workspace @apk-alerts/contracts exec -- tsx --test src/peerAlertFailsafe.test.ts
```

Expected: FAIL because the builder and strict checks do not exist.

- [x] **Step 2: Implement strict response builder/evaluator**

Add `buildPhoneAlertPeerResponseEvent(input)` to `packages/contracts/src/peerAlertFailsafe.ts`.

Add blocking codes for missing required challenge/phone alert fields and `responded_at_invalid`. Parse `response.payload.respondedAt` and enforce:

```text
phoneObservedAt <= phoneReceivedAt <= respondedAt <= response.observedAt
```

- [x] **Step 3: Run green contract verification**

Run:

```powershell
npm --workspace @apk-alerts/contracts exec -- tsx --test src/peerAlertFailsafe.test.ts
```

Expected: PASS.

### Task 2: Remote Challenge Emission Client

**Files:**
- Create: `packages/sync-client/src/peerAlertFailsafeClient.test.ts`
- Create: `packages/sync-client/src/peerAlertFailsafeClient.ts`
- Modify: `packages/sync-client/src/index.ts`

- [x] **Step 1: Add failing sync-client tests**

Add tests that prove:
- root and `/api` URLs normalize to `/api`;
- the client POSTs the challenge to `/api/peer-alert/challenges`;
- API key and JSON headers are sent when configured;
- blank API keys are omitted;
- a valid phone response returns `ok: true` with `matched` evaluation;
- HTTP, network, and invalid response payloads fail closed.

Run:

```powershell
npm --workspace @apk-alerts/sync-client exec -- tsx --test src/peerAlertFailsafeClient.test.ts
```

Expected: FAIL because the client does not exist.

- [x] **Step 2: Implement sync-client**

Create `requestPhoneAlertPeerResponse(config, challenge)`.

Behavior:
- normalize `baseApiUrl` to `/api`;
- POST JSON challenge to `/peer-alert/challenges`;
- accept response body `{ response: AlertPeerResponseEvent }` or a raw `AlertPeerResponseEvent`;
- reject malformed responses as invalid;
- evaluate via `evaluateAlertPeerResponse`;
- fail closed for invalid URL, missing fetch, HTTP errors, network errors, and invalid response payloads.

- [x] **Step 3: Export sync-client**

Export the new client and types from `packages/sync-client/src/index.ts`.

- [x] **Step 4: Run green sync-client verification**

Run:

```powershell
npm --workspace @apk-alerts/sync-client exec -- tsx --test src/peerAlertFailsafeClient.test.ts
```

Expected: PASS.

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

Expected: all commands exit 0.

- [x] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-apk-alerts-peer-alert-challenge-client.md packages/contracts/src/peerAlertFailsafe.ts packages/contracts/src/peerAlertFailsafe.test.ts packages/sync-client/src/peerAlertFailsafeClient.ts packages/sync-client/src/peerAlertFailsafeClient.test.ts packages/sync-client/src/index.ts
git diff --cached --check
git commit -m "feat: add peer alert challenge client"
git push
```

Expected: commit and push succeed after verification.
