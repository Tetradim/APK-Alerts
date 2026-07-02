# Sentinel Nexus Peer Alert Endpoint Mobile Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the peer alert failsafe into a server-side challenge endpoint and expose the latest peer challenge outcome as mobile evidence.

**Architecture:** Add a small framework-neutral endpoint handler package for `POST /api/peer-alert/challenges`. The handler validates the challenge, builds the phone response from the phone's latest alert snapshot, evaluates it through the shared contract, and records the outcome through an injected recorder. Add mobile state and Alerts UI summaries that display the latest peer outcome and fail closed when no peer challenge evidence exists.

**Tech Stack:** TypeScript, Node test runner, npm workspaces, shared `@sentinel-nexus/contracts`, Expo React Native, Zustand.

---

### Task 1: Phone Peer Challenge Endpoint

**Files:**
- Create: `packages/peer-alert-server/package.json`
- Create: `packages/peer-alert-server/tsconfig.json`
- Create: `packages/peer-alert-server/src/peerAlertChallengeEndpoint.test.ts`
- Create: `packages/peer-alert-server/src/peerAlertChallengeEndpoint.ts`
- Create: `packages/peer-alert-server/src/index.ts`

- [x] **Step 1: Write failing endpoint tests**

Add tests for `POST /api/peer-alert/challenges` covering valid responses, wrong route or method rejection, invalid challenge rejection, and a valid challenge with no last phone alert.

- [x] **Step 2: Run red endpoint verification**

Run:

```powershell
npm --workspace @sentinel-nexus/peer-alert-server exec -- tsx --test src/peerAlertChallengeEndpoint.test.ts
```

Expected: FAIL because the endpoint module does not exist.

- [x] **Step 3: Implement endpoint handler**

Create `handlePeerAlertChallengeRequest(config, request)` that:
- accepts only `POST /api/peer-alert/challenges`;
- runtime-validates `alert.peer.challenge.v1`;
- reads the phone latest alert snapshot through `getLastAlert`;
- creates an `alert.peer.response.v1` event through `buildPhoneAlertPeerResponseEvent`;
- evaluates with `evaluateAlertPeerResponse`;
- calls `recordOutcome` with `{ ok, checkedAt, challenge, response, evaluation, error }`;
- returns `{ response, evaluation, ok, checkedAt, error }`.

Also create `handlePeerAlertChallengeFetchRequest(config, request)` so the same logic can mount directly behind a standard server `Request`/`Response` endpoint.

- [x] **Step 4: Run green endpoint verification**

Run:

```powershell
npm --workspace @sentinel-nexus/peer-alert-server exec -- tsx --test src/peerAlertChallengeEndpoint.test.ts
```

Expected: PASS.

### Task 2: Mobile Latest Peer Outcome Evidence

**Files:**
- Create: `apps/mobile/src/state/peerAlertFailsafeState.test.ts`
- Create: `apps/mobile/src/state/peerAlertFailsafeState.ts`
- Modify: `apps/mobile/src/screens/AlertsScreen.tsx`

- [x] **Step 1: Write failing mobile state tests**

Add tests proving:
- no peer outcome fails closed;
- matched peer outcome renders clear evidence labels;
- missing peer response renders blocking evidence labels;
- the Zustand store records and clears the latest outcome.

- [x] **Step 2: Run red mobile verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/peerAlertFailsafeState.test.ts
```

Expected: FAIL because the mobile state module does not exist.

- [x] **Step 3: Implement mobile state and summary**

Create `createPeerAlertFailsafeStore`, `usePeerAlertFailsafeState`, `getDefaultPeerAlertFailsafeSnapshot`, and `buildPeerAlertOutcomeSummary`.

- [x] **Step 4: Render the latest peer outcome on Alerts**

Add an Alerts panel titled `Peer challenge outcome` with status, blocker, source, timing, response, and detail evidence from `buildPeerAlertOutcomeSummary`.

- [x] **Step 5: Run green mobile verification**

Run:

```powershell
npm --workspace @sentinel-nexus/mobile exec -- tsx --test src/state/peerAlertFailsafeState.test.ts
npm --workspace @sentinel-nexus/mobile run typecheck
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

- [ ] **Step 2: Commit and push**

Run:

```powershell
git add docs/superpowers/plans/2026-06-27-sentinel-nexus-peer-alert-endpoint-mobile-evidence.md packages/peer-alert-server apps/mobile/src/state/peerAlertFailsafeState.ts apps/mobile/src/state/peerAlertFailsafeState.test.ts apps/mobile/src/screens/AlertsScreen.tsx
git diff --cached --check
git commit -m "feat: add peer alert endpoint evidence"
git push
```

Expected: commit and push succeed after verification.
