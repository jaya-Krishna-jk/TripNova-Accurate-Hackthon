# FEAT-002 / PLAN-002 TASK-003 — Testing report

**Status: BLOCKED — focused tests passed on the preceding spec revision; the
complete frontend suite did not pass.** PLAN-002 TASK-003 remains blocked.

## Scope and safety

Verification was limited to the approved exact-child `/userTrips/TN-3UP9HH`
subscription and `PlanTripPage`. Tests use Firebase and service doubles; no
production or sensitive Firebase data was accessed. No Firebase rules/config,
production gate, or application implementation was changed for this task.

## Tests added

### `realtime-database.service.spec.ts`

- Exact `userTrips/TN-3UP9HH` reference and `onValue` subscription path.
- Initial, subsequent, and missing-child snapshots forwarded as the same
  snapshot objects.
- Listener error forwarded, listener stopped on error, explicit unsubscribe is
  idempotent, and callbacks after stopping are ignored.
- No `get`, transaction, or `set` call for this live subscription.
- Existing FEAT-001 service coverage retained. Two stale expected lifecycle
  statuses were aligned with the implementation's actual `in_progress`
  lifecycle, and a rejected transaction expectation now includes its existing
  `refreshRequired` result field.

### `features/plan-trip/plan-trip-page.spec.ts`

- Booked/no-tracking status and first-activity preview, with source record
  unchanged.
- Flattened cursor projection and a later snapshot updating current/next
  activity without recreating the page.
- `Transport`, `Meal`, and `Accommodation` mappings, an unmapped type, and
  absent optional values.
- Missing record, owner mismatch, completed record, malformed itinerary,
  contradictory trip ID, unsupported lifecycle, and negative/fractional/
  out-of-range cursor cases; no fallback card is rendered.
- Independent delay/drift values, on-time-only marker, delay messaging,
  unknown-delay behavior, labeled current/next locations, and absence of
  fabricated coordinate values.
- Reduced-motion CSS rule retains rail labels and disables marker animation.
  The test validates the component's media-rule contract; it does not exercise
  an actual browser's computed animation under an OS reduced-motion setting.
- Error after a valid snapshot clears the card; teardown invokes unsubscribe.
- Existing prompt validation/chat regression test retained and verifies
  navigation.

## Commands executed and results

Commands were run from `Frontend/TripNova-angular-app`.

1. `npx ng test --watch=false --include src/app/realtime-database.service.spec.ts --include src/app/features/plan-trip/plan-trip-page.spec.ts`
   - First run found test compile issues (including stale FEAT-001 test
     expectations); test-only corrections were made.
   - Rerun: **2 files passed, 22/22 tests passed**.
   - This passing run preceded two final assertion-only refinements (snapshot
     identity and coordinate-value exclusions). A rerun after those refinements
     was not completed because permission to execute that follow-up command was
     denied. Therefore the exact final spec files have not been independently
     rerun.
2. `npx ng test --watch=false`
   - **5 files passed, 2 files failed; 38/40 tests passed.**
   - `src/app/travel-mock/travel-mock.component.spec.ts`, test
     “submits delay in hours and uses the committed tracking value”: expected
     checkpoint title `Delayed`, received `In Progress` with stored drift
     `0.75`. The existing test was not edited. The existing component derives
     its delay state from the stored trigger or a 5-hour fallback; this
     discrepancy needs owner triage and prevents the required `/mock-trip`
     regression suite from passing.
   - `src/app/features/auth/login-page.spec.ts`, test “should render the login
     form”: expects the `<h2>` to contain `Sign in`, while the current template
     heading is `Welcome back`. This unrelated existing test was not edited.
3. `npm run build`
   - **Command exit code 0** and production browser/server bundles were emitted.
   - During prerender, the command logged
     `TypeError: Cannot read properties of undefined (reading 'source')` in
     the `itinerary-suggestions` route template. It nevertheless reported six
     routes prerendered and build generation complete. Treat this as a
     prerender/runtime issue requiring triage, not as a clean build.
   - Build also warned that the 620.94 kB initial bundle exceeded the 500 kB
     warning budget; the configured error budget is 1 MB.

## Coverage gaps and limitations

- These unit tests cannot establish Firebase deployed-rule permissions,
  administrator update delivery, or production authorization; production
  remains blocked under the approved gate.
- Reduced-motion behavior is verified through the CSS media-rule contract in
  the unit-test DOM, not a real browser's computed style/animation.
- The final two test assertion refinements did not receive a post-edit rerun.
- The full suite remains red due to the two failures above; neither unrelated
  test was weakened or changed.

## Failures and implementation findings

- No FEAT-002-specific implementation defect was demonstrated by the focused
  tests that passed.
- TASK-003 cannot be marked complete: the full suite failed and the current
  final spec revision still needs its focused rerun.
- The `/mock-trip` mismatch and prerender exception are recorded for
  frontend/product-engineer triage. No production implementation fix was made
  because those issues are outside this task's authorized test-only scope.

## Required follow-up

1. Resolve or explicitly disposition the existing `/mock-trip` assertion
   mismatch without changing FEAT-002 scope.
2. Triage the login-page test mismatch and the prerender `source` exception.
3. Rerun focused specs on the final revision, then the full frontend suite and
   production build; update PLAN-002 TASK-003 only after all specified checks
   pass.
