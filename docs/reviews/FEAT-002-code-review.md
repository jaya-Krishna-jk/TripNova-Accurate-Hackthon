---
id: REVIEW-002
type: code-review
feature_id: FEAT-002
reviewer: code-reviewer
status: changes_requested
findings:
  - id: FINDING-001
    severity: medium
    title: Required frontend regression suite is still failing
    description: >-
      The TASK-003 report records 38/40 tests passing, including an unresolved
      `/mock-trip` assertion that expects `Delayed` but receives `In Progress`
      with stored drift `0.75`, and a login-heading assertion failure. The
      `/mock-trip` failure leaves the required regression boundary unverified.
      The available evidence does not establish whether either failure was
      introduced by this implementation or predates it. Triage the `/mock-trip`
      expectation against the intended behavior and current implementation,
      resolve or explicitly disposition both failures, then rerun the final
      focused specs and full suite before approval.
---

# FEAT-002 Code Review

**Verdict:** Changes requested. This is not a production security or release
approval.

## Scope and evidence

Reviewed the approved FEAT-002 requirement, ARCH-002, PLAN-002 (including
TASK-004 and TASK-003's blocked status), the TASK-003 test report, and the
current traveler-home service, component, template, and tests. The repository
does not contain `templates/review.md` or `schemas/review.schema.yaml`; this
document follows the required review fields and the existing review-document
convention, but schema validation could not be run.

A git diff could not be obtained with the available file-inspection tools.
Accordingly, implementation observations below are against the current files;
whether unrelated files or `/mock-trip` were changed cannot be confirmed from a
diff in this review.

## Review checks

- The traveler-home subscription constructs exactly
  `userTrips/TN-3UP9HH` and attaches `onValue` to that reference
  (`realtime-database.service.ts:359-380`). The home-page path does not query
  or enumerate `/userTrips`, and this subscription method does not write.
- The page checks exact `userId === 'jk'` before inspecting/projecting other
  trip fields, rejects a contradictory stored `tripId`, and rejects malformed
  lifecycle, cursor, itinerary, delay-trigger, and drift values
  (`plan-trip-page.ts:172-271`). It does not show the mismatched owner's trip
  fields.
- Initial and subsequent snapshots are projected into a single signal state.
  Listener errors clear the live card into an error state; service errors stop
  the listener, and component teardown invokes the unsubscribe handle
  (`realtime-database.service.ts:359-389`,
  `plan-trip-page.ts:139-170`). Tests cover exact-path subscription,
  unchanged snapshot forwarding, error/unsubscribe behavior, and late callback
  suppression (`realtime-database.service.spec.ts:242-331`,
  `plan-trip-page.spec.ts:238-256`).
- The booked/no-tracking preview, cursor-derived current/next itinerary,
  category mappings, missing optional values, and independently displayed
  delay/drift are represented in the component and targeted tests
  (`plan-trip-page.ts:188-271`,
  `plan-trip-page.spec.ts:102-189`).
- Motion is gated on an explicit `delayTriggered === false`; delay and unknown
  states do not render the moving marker. The component includes a
  `prefers-reduced-motion` rule
  (`plan-trip-page.ts:69-76`, `plan-trip-page.html:122-142`). The targeted test
  checks the CSS media-rule text and visual labels but does not exercise a
  browser's computed animation under reduced motion
  (`plan-trip-page.spec.ts:216-236`).
- The prompt validation/chat test remains in the page spec and checks the
  existing navigation path (`plan-trip-page.spec.ts:259-290`). The report says
  the `/mock-trip` test was not edited, but the behavioral assertion currently
  fails; absent a git diff or baseline run, preservation of `/mock-trip` cannot
  be conclusively established.

## Test and build status

Per `docs/reviews/FEAT-002-testing.md:53-73`, the focused test rerun passed
22/22 before the final two assertion-only refinements; those exact final specs
were not rerun. The full suite reported 38/40 passing. Besides the
`/mock-trip` mismatch noted in FINDING-001, the login-page test expects
`Sign in` while the current heading is `Welcome back`. These are current
reported failures; this review does not label them pre-existing or attribute
them to FEAT-002.

Per `docs/reviews/FEAT-002-testing.md:74-82`, `npm run build` exited 0 and
emitted browser/server bundles, but prerender logged
`TypeError: Cannot read properties of undefined (reading 'source')` for the
`itinerary-suggestions` route and then reported six routes prerendered. Treat
that as an unresolved prerender/runtime issue, not as evidence of a clean
prerender or as a proven FEAT-002 regression. The report also records an
initial-bundle warning above the configured warning budget.

## Required follow-up

1. Triage the failing `/mock-trip` behavior and login assertion without
   weakening tests merely to obtain a pass; confirm the intended behavior and
   document any approved disposition.
2. Rerun the focused specs on the final revision, then the complete frontend
   suite. Revisit this verdict if the regression suite remains red.
3. Triage the `itinerary-suggestions` prerender exception separately.
4. Obtain and inspect the implementation diff before final scope approval.

Production use remains blocked under the approved FEAT-002 gate until
authentication, owner-scoped rules, and traveler/admin access boundaries are
confirmed and tested.
