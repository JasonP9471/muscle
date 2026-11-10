# TrainOS authentication and two-device sync evidence

Audit date: 2026-10-27  
Production data touched: **No**  
Production schema or Auth configuration changed: **No**

## Scope and safety boundary

All write-path testing in this change set uses deterministic in-memory test doubles or transaction-wrapped local Supabase fixtures. The local Supabase configuration points at `127.0.0.1`, enables email confirmation, and sends mail to the local Mailpit service. `scripts/assert-safe-test-environment.mjs` rejects every hosted target and explicitly rejects the TrainOS production project reference.

The deterministic suite does not require credentials. The database isolation suite is designed for `supabase start` and rolls back its test users and snapshots. CI starts a disposable local stack before running it.

## Evidence matrix

| Requirement | Automated evidence | Result | Boundary / notes |
|---|---|---|---|
| Signup confirmation | `provider.test.ts` verifies a signup with no initial session, canonical TrainOS `emailRedirectTo`, and token-hash confirmation through `verifyOtp` | Pass | Provider-level integration with a deterministic Auth client; local Mailpit delivery was not executed on this workstation because the Supabase CLI/local stack is unavailable |
| Login | `provider.test.ts` signs in and requires a returned session | Pass | Covers error-safe provider mapping and account identity |
| Refresh persistence | `provider.test.ts` recreates the provider after login and observes a rotated access/refresh session | Pass | Exercises the app/provider contract; the Supabase SDK owns storage and refresh-token rotation |
| Logout | `provider.test.ts` signs out and verifies the next session lookup is empty | Pass | Local account data remains route-protected, then is reset before a different account is restored |
| Password recovery | `provider.test.ts` verifies the TrainOS recovery redirect, PKCE code exchange, and password update; `AuthPage.tsx` keeps recovery callbacks on the reset form | Pass | Browser click-through is pending a runnable browser/local Mailpit environment |
| Fresh-device restore | `engine.test.ts` starts with an empty device and restores only the authenticated account snapshot | Pass | Deterministic two-store integration |
| Concurrent profile edits | `engine.test.ts` changes name on phone and body weight on desktop | Pass | Three-way merge keeps both independent fields |
| Concurrent workout and meal edits | `engine.test.ts` adds a workout on phone and meal on desktop, then completes a round trip to both devices | Pass | Both records survive and converge |
| Offline queue | `engine.test.ts` edits an active workout offline, verifies the queue and local data survive, then reconnects and uploads | Pass | Queue is cleared only after the compare-and-set save succeeds |
| Active-workout edits | `engine.test.ts` merges concurrent set weight/reps/completion edits | Pass | Same-field collision uses the newer autosave and reports the overlap |
| Conflict reporting | `engine.test.ts` verifies persisted conflict details; existing Profile UI renders those records | Pass | Delete-vs-edit and field-level behavior remain covered by `merge.test.ts` |
| Optimistic concurrency | `engine.test.ts` forces three compare-and-set failures | Pass | Sync reports contention and retains the local queue for retry |
| Cross-user application isolation | `engine.test.ts` verifies user B restores no user A rows and account switching resets device storage | Pass | Remote test store is keyed by authenticated user ID |
| Cross-user database isolation | `supabase/tests/rls.sql` verifies own read/update, blocked cross-user update/delete, and blocked anonymous read | Added; CI/local execution required | Transaction rolls back all fixture users/data; no hosted database target is permitted |
| Production-target refusal | Safety guard was invoked with the production Supabase URL | Pass | Exited non-zero before any client or database operation |

## Hardening changes

1. Sync orchestration now uses an adapter-based engine with optimistic compare-and-set retries, persistent queue semantics, deterministic three-way merges, conflict records, and a monotonically increasing remote timestamp.
2. Device ownership is checked before account restore. Changing authenticated users resets the prior account's IndexedDB cache before downloading the next account.
3. Auth operations are dependency-injected, making the real provider contract testable without a production account or secret key.
4. Password-recovery callbacks no longer redirect directly to Today; they remain on the password-update form after the recovery session is established.
5. Local Supabase now uses local-only redirect allow-lists and email confirmation, matching the hosted confirmation flow without sending mail externally.
6. The browser test server explicitly disables cloud sync, even if a developer has production variables in their shell.
7. CI includes deterministic Auth/sync tests and transaction-wrapped RLS tests against a disposable local Supabase stack.

## Commands and observed results

```text
npm run typecheck       PASS
npm run lint            PASS
npm run test            PASS — 21 files, 91 tests
npm run test:auth-sync  PASS — 4 files, 26 tests
npm run build           PASS
```

The production-refusal check also passed by failing closed:

```text
TRAINOS_TEST_SUPABASE_URL=https://hthpdsxnbykkqgiyciwj.supabase.co \
  node scripts/assert-safe-test-environment.mjs
# Refuses the target and exits non-zero.
```

The five existing Playwright tests could not launch Chromium in this managed macOS environment. Chromium terminated before opening a page because Mach port registration was denied (`Permission denied (1100)`). This is an environment limitation, not an application assertion failure. The same suite remains suitable for CI or an unrestricted local shell.

The local RLS command was not executed on this workstation because the Supabase CLI/local Docker stack is unavailable. It is wired into `.github/workflows/auth-sync-tests.yml` and can be reproduced locally with:

```text
supabase start
TRAINOS_TEST_SUPABASE_URL=http://127.0.0.1:54321 npm run test:supabase:local
supabase stop --no-backup
```

## Residual risks before release

- Run the local Supabase CI job and inspect the first result before merging; SQL coverage exists, but this workstation could not execute pgTAP.
- Run Playwright on CI or an unrestricted machine to verify real browser navigation, IndexedDB persistence after a hard close, and the recovery form visually.
- Perform one manual two-physical-device smoke test using newly created test-only accounts after the local/CI suites pass. Do not use the owner account or existing production records.
- Hosted email delivery, SMTP reputation, rate limits, and dashboard redirect settings remain operational configuration and were intentionally not changed.

## References

- [Supabase: Test auth flows](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [Supabase: Testing overview](https://supabase.com/docs/guides/local-development/testing/overview)
