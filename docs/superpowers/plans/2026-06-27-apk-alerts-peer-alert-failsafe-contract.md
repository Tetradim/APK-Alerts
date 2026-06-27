# APK Alerts Peer Alert Failsafe Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared deterministic Remote-to-Phone alert challenge/response contract so Remote can ask whether Phone saw the same alert and fail closed on missing, stale, mismatched, or low-proof responses.

**Architecture:** Extend shared trading events with `alert.peer.challenge.v1` and `alert.peer.response.v1`. Keep evaluation logic in a focused contracts module that compares challenge identity, phone alert fingerprint, source/channel/author/hash/message evidence, lease id, and timestamp skew. Transport endpoints can later call this contract without inventing separate matching rules.

**Tech Stack:** TypeScript, Node test runner, npm workspaces, shared `@apk-alerts/contracts`.

---

### Task 1: Peer Alert Challenge Contract

**Files:**
- Create: `packages/contracts/src/peerAlertFailsafe.test.ts`
- Create: `packages/contracts/src/peerAlertFailsafe.ts`
- Modify: `packages/contracts/src/events.ts`
- Modify: `packages/contracts/src/index.ts`

- [x] **Step 1: Write failing tests**

Create `packages/contracts/src/peerAlertFailsafe.test.ts` with tests that assert:

```ts
assert.equal(match.status, "matched");
assert.equal(match.blocking, false);
assert.deepEqual(match.blockingCodes, []);
assert.equal(match.skewMs, 2000);

assert.equal(missing.status, "missing_response");
assert.equal(missing.blocking, true);
assert.deepEqual(missing.blockingCodes, ["peer_response_missing"]);

assert.equal(mismatch.status, "mismatch");
assert.equal(mismatch.blocking, true);
assert.equal(mismatch.blockingCodes.includes("source_key_mismatch"), true);
assert.equal(mismatch.blockingCodes.includes("normalized_text_hash_mismatch"), true);

assert.equal(stale.status, "stale");
assert.equal(stale.blocking, true);
assert.deepEqual(stale.blockingCodes, ["alert_timestamp_skew_exceeded"]);
```

- [x] **Step 2: Run red verification**

Run:

```powershell
npm --workspace @apk-alerts/contracts exec -- tsx --test src/peerAlertFailsafe.test.ts
```

Expected: FAIL because the module and event types do not exist.

- [x] **Step 3: Add event payload types**

In `packages/contracts/src/events.ts`, add:

```ts
| "alert.peer.challenge.v1"
| "alert.peer.response.v1"
```

Add payload interfaces for a remote challenge and phone response. Both must carry `challengeId`, `leaseId`, alert identity/fingerprint fields, and phone response timing.

- [x] **Step 4: Implement evaluator**

Create `packages/contracts/src/peerAlertFailsafe.ts` exporting:

```ts
export type AlertPeerFailsafeStatus = "matched" | "missing_response" | "mismatch" | "stale";
export function evaluateAlertPeerResponse(
  challenge: AlertPeerChallengeEvent,
  response: AlertPeerResponseEvent | null | undefined,
  options?: { maxAlertSkewMs?: number },
): AlertPeerFailsafeEvaluation
```

The evaluator must fail closed for:
- missing response;
- challenge id mismatch;
- lease id mismatch;
- missing phone alert copy;
- discord message id mismatch;
- channel id mismatch;
- author id mismatch;
- source key mismatch;
- normalized text hash mismatch;
- message URL mismatch when challenge has a URL;
- invalid timestamps;
- timestamp skew greater than the configured limit.

- [x] **Step 5: Export the contract**

Export the module from `packages/contracts/src/index.ts`.

- [x] **Step 6: Run green verification**

Run:

```powershell
npm --workspace @apk-alerts/contracts exec -- tsx --test src/peerAlertFailsafe.test.ts
```

Expected: PASS.

### Task 2: Batch Verification And Commit

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
git add docs/superpowers/plans/2026-06-27-apk-alerts-peer-alert-failsafe-contract.md packages/contracts/src/events.ts packages/contracts/src/index.ts packages/contracts/src/peerAlertFailsafe.ts packages/contracts/src/peerAlertFailsafe.test.ts
git diff --cached --check
git commit -m "feat: add peer alert failsafe contract"
git push
```

Expected: commit and push succeed after verification.
