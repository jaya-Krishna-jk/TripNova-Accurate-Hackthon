---
id: PLAN-001
type: plan
feature_id: FEAT-001
architecture_id: ARCH-001
version: 1
status: blocked
summary: Implement Firebase-backed trip loading and atomic one-time tracking in the Angular app.
target: Frontend/TripNova-angular-app
estimated_effort: L
tasks:
  - id: TASK-001
    title: Add Firebase trip read contract
    owner: frontend-engineer
    status: complete
  - id: TASK-002
    title: Implement atomic tracking transactions
    owner: frontend-engineer
    status: complete
  - id: TASK-003
    title: Integrate Firebase trip loading and view states
    owner: frontend-engineer
    status: complete
  - id: TASK-004
    title: Integrate persisted tracking actions
    owner: frontend-engineer
    status: complete
  - id: TASK-005
    title: Add service unit tests
    owner: test-engineer
    status: complete
  - id: TASK-006
    title: Add component behavior tests
    owner: test-engineer
    status: complete
  - id: TASK-007
    title: Verify Firebase transaction and rules behavior
    owner: test-engineer
    status: blocked
  - id: TASK-008
    title: Run Angular test and production build gates
    owner: frontend-engineer
    status: complete
---

# Firebase Trip Tracking Implementation Plan

## Scope and Constraints

Implement approved `FEAT-001` using approved `ARCH-001` in `Frontend/TripNova-angular-app`. Reuse the configured Firebase app and existing `RealtimeDatabaseService`; keep changes within the trip service and existing `TravelMockComponent` boundary. Do not introduce a backend, alternate persistence, default trip ID, mock fallback, record migration, reset/restart behavior, or changes to itinerary and unrelated record fields.

The approved acceptance criteria are `AC-01` through `AC-10`. All writes must transact at `/userTrips/{tripId}` and merge only `tracking` into the latest root snapshot. Tracking timestamps, command IDs, expected status/index checks, checkpoint history, current day/global coordinates, and transaction abort semantics follow the architecture. The three lifecycle statuses are `not_started` (derived if no tracking), `in_progress`, and `completed`; a separate `delayTriggered` flag is set at `driftHrs >= 5`. A load error must not be represented as not-found, and a transaction failure must not be shown as a committed local update.

## Validation Limitations and Blockers

- The public Firebase REST read for `/userTrips/111.json` returned the requested record with `tripId`, `userId`, and `days[].activities[]`; it initially had no `tracking` object. The trip is now `in_progress` at global checkpoint index `4` (`TTD Gardens`), with `3.3` total drift hours. The known latest `0.3`-hour delay is attributed to its checkpoint and the other `3.0` hours are recorded as unattributed legacy drift. The earlier lookup of `/userTrips/1.json` returned `null` and was the wrong ID. Do not substitute local sample JSON. Confirm intended deployed rules before rollout.
- `templates/plan.md`, `templates/task.md`, and `schemas/plan.schema.yaml` were not found in the repository workspace. Schema validation is blocked; the plan remains blocked until the schema is available and validation passes.
- The trip record at `/userTrips/111` is confirmed and has been migrated with 23 checkpoint states. It is active at overall checkpoint index 4, with 3.3 hours total drift: the known 0.3-hour delay is attributed to checkpoint index 3 and 3.0 legacy hours remain explicitly unattributed. Emulator/deployed-rule validation remains blocked; unauthenticated reads and tracking writes succeeded, so production rollout requires owner-scoped authentication and rules.

## Tasks

### TASK-001: Add Firebase trip read contract

- **Goal:** Add a typed trip-record read operation to `RealtimeDatabaseService` that reads exactly `/userTrips/{tripId}` and distinguishes an absent root from Firebase/configuration errors.
- **Rationale:** Component behavior must use the requested Firebase record as its source of truth, without a sample/default fallback; later transaction commands need a stable service boundary.
- **Dependencies:** None.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts`; Firebase Realtime Database `/userTrips/{tripId}`.
- **Implementation notes:** Reuse the existing database/app/configuration helpers and preserve demo-user methods. Normalize/validate the non-empty ID at the owning boundary. Return an explicit not-found result for an absent snapshot; do not turn exceptions into not-found. Model the trip as an open record so unknown fields are retained. Do not write tracking during load.
- **Acceptance criteria:** A non-empty ID reads only its matching userTrips path; an absent root yields an explicit not-found result; database/configuration failures remain errors; empty IDs cause no lookup; existing service methods remain available.
- **Testing requirements:** Add or prepare focused service coverage for the exact path, empty-ID behavior, present/absent snapshots, and propagated Firebase errors (completed in TASK-005).
- **Risk:** The representative record shape is confirmed; Firebase read permissions and other records' shape still need validation.
- **Effort:** S.
- **Status:** complete.

### TASK-002: Implement atomic tracking transactions

- **Goal:** Add a service operation that applies start and tracking commands atomically to the trip root.
- **Rationale:** A root-level transaction is required to verify the trip still exists, serialize competing actions, enforce one-time start and legal transitions, and preserve concurrent/unrelated root fields.
- **Dependencies:** TASK-001 for service record and result contracts.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts`; Firebase Realtime Database `/userTrips/{tripId}`.
- **Implementation notes:** Use `runTransaction` at the trip root. In its pure callback, verify root existence and the expected current status/checkpoint, reject duplicates/illegal actions, and replace only `tracking` on a shallow copy of the latest root. Generate each event ID once outside the callback. Store server-resolved timestamps, cumulative `driftHrs`, per-checkpoint state, current day/global checkpoint coordinates, and `delayTriggered` at the 5-hour threshold. Preserve current tracking history when migrating older records and keep previous unattributed drift explicit. Do not reconstruct the root from a client snapshot or expose reset/restart.
- **Acceptance criteria:** Valid commands commit only against current state; repeated starts and stale/illegal commands abort without mutation; missing roots are not created; delayed hours are finite, non-negative, and cumulative; each action updates the relevant checkpoint's visited/onTime/onTrack/outcome/date/delay fields and the current checkpoint's day/global coordinates; drift at least five hours raises `delayTriggered`; recovery adds two hours; skip adds none; final resolution completes at the last valid index; unknown root fields and itinerary survive.
- **Testing requirements:** Cover transition matrix, duplicate IDs, transaction callback retry against changed snapshots, timestamps/completion, and root-field preservation in TASK-005; verify serialization/rules in TASK-007.
- **Risk:** Realtime Database rules must permit reads and writes at the trip root; SDK server-timestamp support in transaction callbacks needs verification.
- **Effort:** L.
- **Status:** complete.

### TASK-003: Integrate Firebase trip loading and view states

- **Goal:** Replace sample/default loading in `TravelMockComponent` with requested-ID Firebase loading and explicit prompt, loading, loaded, not-found, and retryable error states.
- **Rationale:** The existing screen currently loads a hardcoded sample and substitutes ID `1`, which conflicts with AC-01/AC-02.
- **Dependencies:** TASK-001.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.ts`; `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.html`; existing component spec.
- **Implementation notes:** Inject the service and consume its read result. Empty/whitespace IDs remain a prompt and issue no lookup. Clear or make prior data unavailable while loading a different ID. Derive checkpoints by flattening stored days and activities in order; render trip fields from Firebase. Treat absent tracking as unstarted and render persisted tracking on reload. A malformed record or itinerary without activities is a data error, not a mock fallback.
- **Acceptance criteria:** Loaded display reflects the selected Firebase record; empty ID has no trip/controls; missing root displays not-found with no stale trip/controls; database and malformed-data failures are distinguishable from not-found and can be retried.
- **Testing requirements:** Component tests cover empty ID, loading, not-found, loaded trip/itinerary projection, stale-content clearing, persisted state projection, and retryable errors (TASK-006).
- **Risk:** Existing markup and synchronous component assumptions will need to accommodate asynchronous service state.
- **Effort:** M.
- **Status:** complete.

### TASK-004: Integrate persisted tracking actions

- **Goal:** Replace in-memory-only actions with service commands and render only actions permitted by persisted tracking state.
- **Rationale:** AC-03 through AC-08 require one-time persisted state, resume behavior, outcome persistence, and preservation of the existing trip record.
- **Dependencies:** TASK-002 and TASK-003.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.ts`; `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.html`.
- **Implementation notes:** Send expected status and checkpoint index with each action. Update the view from the committed transaction result, not optimistic local mutation. On abort refresh state and explain the action is no longer available; on network/rules failure keep the last loaded state and report save failure. Disable duplicate submissions while pending. Convert the delay input from minutes to non-negative fractional hours and display persisted `driftHrs` in hours. Gate active, missed, dropped, and completed actions as specified; remove restart/reset UI and behavior.
- **Acceptance criteria:** Start and every supported event persist to the same record; reload resumes stored progress; outcome-specific delay and checkpoint behavior matches the approved state machine; completed/started trips cannot restart or reset; save abort/failure is not presented as success.
- **Testing requirements:** Exercise action visibility/gating, hours validation and display, pending state, committed-result projection, abort refresh, save failure, and reload expectations in TASK-006; persistence transitions are covered in TASK-005/TASK-007.
- **Risk:** Concurrent commands and ambiguous network responses can make displayed state stale; transaction result and reload behavior must remain authoritative.
- **Effort:** M.
- **Status:** complete.

### TASK-005: Add service unit tests

- **Goal:** Add focused tests for trip reads and transaction behavior using mocked Firebase SDK calls.
- **Rationale:** Transaction callbacks and open-record merging are the primary correctness boundary and need deterministic coverage independent of the UI.
- **Dependencies:** TASK-001 and TASK-002.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/realtime-database.service.spec.ts` (new); `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts`.
- **Implementation notes:** Follow the app's Vitest conventions. Test callback retries using a changed current snapshot, not merely a single happy-path callback. Assert the exact root path and verify unknown fields are retained.
- **Acceptance criteria:** Tests cover exact lookup path, missing/error distinction, missing-root non-creation, one-time start, legal and illegal transitions, expected status/index, duplicate event IDs, fractional delay accumulation, fixed recovery delay, no-delay skip, completion timestamp/state, and preservation of itinerary/unrelated fields.
- **Testing requirements:** Run the focused service spec and include it in the Angular test suite.
- **Risk:** SDK transaction and timestamp behavior may differ from simplified mocks; emulator coverage is separately required.
- **Effort:** M.
- **Status:** complete.

### TASK-006: Add component behavior tests

- **Goal:** Update the existing component spec for injected asynchronous service behavior and cover the required user-visible states and actions.
- **Rationale:** Existing tests directly instantiate synchronous mock logic and do not verify service integration or persistence projections.
- **Dependencies:** TASK-003 and TASK-004.
- **Affected files/components:** `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.spec.ts`; component TypeScript/template.
- **Implementation notes:** Use a service stub and the existing Vitest/Angular testing conventions. Avoid duplicating the service transaction matrix; assert component-to-service command arguments and display of returned committed state.
- **Acceptance criteria:** Coverage maps to AC-01 through AC-08: prompt/no lookup, loading, found/not-found, source-of-truth itinerary, resumed started/completed state, start/action gating, each outcome/recovery/skip and hours input, final completion, no reset/restart, retryable read/save failures, and no false success on transaction abort.
- **Testing requirements:** Run the focused component spec and confirm the full component suite passes.
- **Risk:** Existing direct construction may hide Angular injection/lifecycle issues; tests should exercise the component's actual integration boundary.
- **Effort:** M.
- **Status:** complete.

### TASK-007: Verify Firebase transaction and rules behavior

- **Goal:** Validate actual Realtime Database transaction serialization, record preservation, missing-record behavior, and access-rule compatibility.
- **Rationale:** Mocked unit tests cannot demonstrate transaction concurrency or deployed rules compatibility; architecture marks this as a pre-rollout dependency.
- **Dependencies:** TASK-002; representative emulator/rules configuration and trip data must be available.
- **Affected files/components:** Firebase Emulator test setup/rules and focused integration tests, if present or approved for addition; Firebase Realtime Database `/userTrips/{tripId}`.
- **Implementation notes:** Use the existing emulator setup if available; otherwise identify the minimum required setup without changing production rules or expanding feature scope. Exercise simultaneous starts/competing updates, preservation of itinerary and unrelated fields, missing-root non-creation, and denied access. Separately confirm deployed rules permit only intended reads/writes; this feature does not define or broaden authorization.
- **Acceptance criteria:** Emulator checks demonstrate atomic state transitions and non-destructive root merge; denied access surfaces as an error; intended deployed rules and a representative existing record are verified before rollout. Record any unavailable external verification as blocked, not passed.
- **Testing requirements:** Run emulator integration tests against representative rules; document environment/configuration and deployed verification evidence.
- **Risk:** Authorization scope, rules, and emulator availability are unverified. The public read confirms record 111 but cannot establish write permission or deployed authorization safety.
- **Effort:** M.
- **Status:** blocked.

### TASK-008: Run Angular test and production build gates

- **Goal:** Run the application test suite and production build after implementation and focused tests are complete.
- **Rationale:** The feature must integrate cleanly with the Angular app and existing build configuration.
- **Dependencies:** TASK-005 and TASK-006; TASK-007 must pass before production readiness, though its external verification may be tracked separately if unavailable.
- **Affected files/components:** `Frontend/TripNova-angular-app/package.json`; Angular app under `Frontend/TripNova-angular-app/`.
- **Implementation notes:** From the app directory, run `npm test` and `npm run build`; run focused specs during their owning tasks as well. Do not alter unrelated source or workspace changes while addressing this feature.
- **Acceptance criteria:** Focused specs and the full Angular test command pass; the production build succeeds; failures are triaged without unrelated fixes. Mark the feature production-ready only after required Firebase record/rules verification also passes.
- **Testing requirements:** `npm test`; `npm run build`; report command results and any environment-dependent gate that remains blocked.
- **Risk:** Existing unrelated workspace changes or environment configuration can affect full-suite/build results; preserve them and report relevant interference.
- **Effort:** S.
- **Status:** complete.

## Dependency Order and Parallel Work

Primary sequence: `TASK-001 -> TASK-002 -> TASK-003 -> TASK-004`. Once the service contracts are stable, service tests (`TASK-005`) can proceed alongside component loading integration (`TASK-003`), with component behavior tests (`TASK-006`) following the completed UI/action work. Emulator verification (`TASK-007`) depends on the transaction implementation and can run in parallel with component work when emulator data/rules are available. Final application gates (`TASK-008`) follow unit-test completion; production readiness additionally requires TASK-007's external Firebase checks.

Parallel opportunities: TASK-003 and TASK-005 can overlap after TASK-001/TASK-002 contracts are agreed; TASK-007 can overlap with TASK-003/TASK-004 once the service transaction implementation is testable. TASK-006 should stay aligned with the final component/service contract to avoid testing a moving interface.

## Completion Gate

The plan can move from `draft` to `ready` after validation against the repository's plan schema once it is available. The feature implementation is ready for production only when AC-01 through AC-08 are verified, focused and full Angular tests pass, the production build passes, and intended rules/authorization are validated. A public read of record 111 confirms data exists but does not verify writes or authorization.
