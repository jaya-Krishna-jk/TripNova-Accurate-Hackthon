---
id: PLAN-002
type: plan
feature_id: FEAT-002
architecture_id: ARCH-002
version: 3
status: ready
title: Traveler Home live trip UX refinement
owner: planner
created: 2026-11-14
---

# PLAN-002 — Traveler Home live trip UX refinement

## Approved basis and implementation stage

This plan implements approved `FEAT-002` version 6 and `ARCH-002` version 4.
It supersedes PLAN-002 version 1 where that plan describes continuous or
delay-gated movement. The frontend source tasks TASK-001 and TASK-002 are
implemented. TASK-003 validation and independent TASK-004/TASK-005 reviews
remain pending; `ready` is the status of this plan only and does not mean
review or release is complete.

The scoped refinement is to the existing `PlanTripPage` traveler-home card:

- Keep the existing read-only listener for exactly
  `/userTrips/TN-3UP9HH`; display the record only after the stored
  `userId === 'jk'` check. Do not query or enumerate `/userTrips`, select a
  substitute record, write trip data, or change Firebase configuration/rules.
- Render progress as a static, snapshot-driven indicator. It must not move,
  pulse, oscillate, or otherwise animate while idle. Its position and
  accessible text change only when the authoritative cursor or itinerary
  ordering/count changes.
- For an in-progress trip, display **Day X of N**, **Activity Y of M** for
  that day, and **Overall X of total**, deriving positions from stored
  `days[].activities[]` order. Display a scannable day-grouped itinerary in
  stored day/activity order, with the selected current day and activity
  visually and textually distinguished.
- Keep current and next activity information, map only `Transport` to travel,
  `Meal` to eating, and `Accommodation` to hotel, and show absent optional
  values plainly. Display stored `delayTriggered` and `driftHrs` separately;
  an absent/unknown delay trigger is not confirmed on-time.
- A top-level `status: booked` record with no tracking remains **Planned / Not
  started** and presents the first activity as a clearly labeled **Day 1 /
  Activity 1 preview**, not as actual tracking progress. Do not create
  tracking state.
- Preserve the existing prompt-generation behavior, request states and
  navigation, `/mock-trip`, FEAT-001 behavior, exact-record boundary, and
  security posture. At 375px and 1280px, the card must remain legible and
  usable without clipping, overlap, or horizontal page overflow.

The exact-child listener already exists in `RealtimeDatabaseService`; no
service task is planned unless implementation inspection reveals a necessary
compatibility correction. Do not change service behavior speculatively.

Plan templates and `schemas/plan.schema.yaml` are not present in this
workspace. The artifact follows the existing plan format and has been manually
checked for required plan metadata and task fields; formal schema validation
was unavailable. This limitation does not change the approved scope.

## Production and environment gates

This remains a development-only prototype. Use only a confirmed
non-sensitive development Firebase environment and existing rules. If the
exact-child read is denied or the environment boundary cannot be confirmed,
stop rather than widening access or changing rules.

**Production use remains blocked** until Firebase Authentication,
owner-scoped read/write rules, and authorized traveler/admin permission
boundaries are implemented or confirmed and verified. The `userId === 'jk'`
check is a display filter, not authorization. No task in this plan removes
this gate.

## Task summary

| ID | Title | Owner | Dependencies | Status |
|---|---|---|---|---|
| TASK-001 | Derive snapshot-based day and activity progress | frontend-engineer | — | complete |
| TASK-002 | Render the static rail and day-grouped responsive itinerary | frontend-engineer | TASK-001 | complete |
| TASK-003 | Optional manual visual and build validation | frontend-engineer | TASK-001, TASK-002 | pending |
| TASK-004 | Review implementation scope and UX behavior | code-reviewer | TASK-001, TASK-002 | pending |
| TASK-005 | Review exact-record boundary and production gate | security-reviewer | TASK-001, TASK-002 | pending |
| TASK-006 | Show accessible delay-trigger popup | frontend-engineer | TASK-001, TASK-002 | complete |

### TASK-001 — Derive snapshot-based day and activity progress

- **Goal:** Update the existing `PlanTripPage` projection so each authoritative
  snapshot derives day-local and overall activity positions, current/next
  activities, and the booked first-activity preview without changing the
  underlying trip record.
- **Rationale:** The existing page projection does not yet expose the complete
  day/activity coordinates needed by FEAT-002 v5 and ARCH-002 v3.
- **Dependencies:** None.
- **Affected files/components:**
  - `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts`
  - Existing `PlanTripPage` local view model and snapshot projection.
- **Implementation notes:**
  - Continue using the existing exact-record subscription. Preserve the
    exact `userId === 'jk'` check before projecting trip fields, exact stored
    trip ID handling, lifecycle/data validation, atomic snapshot updates,
    error handling, teardown, and no-fallback behavior.
  - Derive the flattened cursor from stored day order and activity order.
    For in-progress trips, calculate one-based **Day X of N**,
    **Activity Y of M** within the day, and **Overall X of total**.
  - Keep current and next activity data grounded in stored values. Preserve
    the approved type mappings and explicit absent-value handling. Project
    `delayTriggered` and `driftHrs` independently; do not infer one from the
    other or interpret an absent trigger as on-time.
  - Keep booked/no-tracking as **Planned / Not started** with an explicitly
    preview-only Day 1 / Activity 1 position. Do not label the preview as
    underway, write tracking, or fabricate an invalid position.
  - Keep the progress position stable when snapshots only change unrelated
    values; recompute it only when the cursor or itinerary ordering/count
    changes.
- **Acceptance criteria:**
  1. In-progress projections expose correct one-based day, day-local activity,
     and overall activity coordinates from the stored ordered arrays.
  2. Current and next activity, type labels, and missing-value presentation
     use only the exact authorized record's stored values and approved
     derivations.
  3. Delay trigger and drift remain separate; missing/unknown trigger is not
     represented as confirmed on-time.
  4. Booked/no-tracking is **Planned / Not started** and its first activity is
     explicitly a Day 1 / Activity 1 preview, with no tracking write or claim
     that progress has begun.
  5. Existing exact-child, owner-check, no-query/no-write, prompt, and
     `/mock-trip` boundaries are unchanged.
- **Testing requirements:** No test cases are to be authored or run in this
  pass. Do not modify existing test files. If source changes appear to require
  test-file changes, pause and request separate authorization.
- **Risk:** Incorrect flattening or partial snapshot projection could show a
  misleading day/activity or stale progress. Derive coordinates from the
  latest validated snapshot and retain explicit unavailable states.
- **Completion status:** complete; source projection is implemented. No test
  cases were authored or run, and no test/spec files were changed in this pass.

### TASK-002 — Render the static rail and day-grouped responsive itinerary

- **Goal:** Update the traveler-home template and component styles to present
  a static, accessible progress rail, the day-grouped ordered itinerary, and a
  clear current-day/current-activity hierarchy at the required viewport
  widths.
- **Rationale:** The current template lacks the approved grouped itinerary and
  explicit day/activity hierarchy, and component styles still contain an
  infinitely alternating journey-marker animation.
- **Dependencies:** TASK-001.
- **Affected files/components:**
  - `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.html`
  - `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts`
    (component styles only as needed)
- **Implementation notes:**
  - Render every stored day in stored order and its activities in stored
    order, with within-day numbering. Visually and textually identify the
    selected day and activity; expose the day, local activity, overall
    position, and totals in accessible text.
  - For booked/no-tracking, place the first activity in the Day 1 group and
    label its Day 1 / Activity 1 position as a preview alongside
    **Planned / Not started**.
  - Replace the existing infinite animation and any idle movement/oscillation
    with a static indicator tied to snapshot-derived progress. Do not add a
    repeating, pulsing, or transition animation in this pass.
  - Keep delay/drift as distinct labeled values and preserve current/next
    activity details. Communicate status in text as well as visual styling.
  - Use stored day themes/labels only when present; do not invent dates,
    coordinates, geographic placement, themes, or activity details.
  - Match the existing dashboard design language and preserve the prompt
    section, request states, navigation, `/mock-trip`, and FEAT-001 UI.
    Ensure the layout works at 375px and 1280px.
- **Acceptance criteria:**
  1. Each stored day and activity is shown in its original order, with
     explicit day headings and activity numbering.
  2. Current day and activity have a distinct visual treatment and accessible
     text; the current/next, day-local, and overall progress hierarchy is
     understandable without relying on location text or color alone.
  3. The rail is static while idle and on unrelated snapshot updates, and its
     accessible position corresponds to the current snapshot. The booked
     position is visibly and textually marked preview-only.
  4. The existing infinite animation is removed from component styles; there
     is no idle oscillation, pulse, or continuous motion.
  5. At 375px and 1280px, content remains readable without clipping,
     overlapping, or horizontal page scrolling.
  6. Existing prompt behavior and the `/mock-trip` route/interface remain
     unchanged.
- **Testing requirements:** No test cases are to be authored or run in this
  pass. Do not modify existing test files; request separate authorization if
  a source change appears to require test-file edits.
- **Risk:** A visually highlighted position without accessible textual
  context, or a narrow layout that hides day/activity details, would fail the
  UX requirement. Review visual and accessible states together.
- **Completion status:** complete; source template/styles are implemented. No
  test cases were authored or run, and no test/spec files were changed in this
  pass.

### TASK-003 — Optional manual visual and build validation

- **Goal:** If authorized and practical after source work, manually inspect the
  updated page at 375px and 1280px and optionally run the normal application
  build, recording outcomes and any issues without authoring or executing test
  cases.
- **Rationale:** The approved requirement calls for demonstration-quality
  responsive presentation; the architecture permits manual visual review and
  a normal build as non-test verification.
- **Dependencies:** TASK-001 and TASK-002.
- **Affected files/components:** `PlanTripPage` in the running frontend and
  the frontend build output; no source changes are assigned to this task.
- **Implementation notes:**
  - This task is optional and is not an automated-test task. Do not run unit,
    integration, or end-to-end tests, and do not write test cases.
  - Inspect the grouped itinerary, labels, selected-day/activity distinction,
    static idle progress, preview state, and readable status meaning at both
    viewport widths. Check for clipping, overlap, and horizontal page
    overflow.
  - If a build is run, record its actual result. A successful build command
    alone does not establish a clean prerender, correct behavior, security,
    or production readiness.
- **Acceptance criteria:**
  1. The manual review record states whether the 375px and 1280px layouts
     satisfy the visual and responsive requirements and records any
     outstanding issue.
  2. If the build is run, its command and observed result are recorded without
     representing it as test execution or production approval.
  3. No test case is authored or run as part of this task.
- **Testing requirements:** No tests. Manual visual inspection and optional
  build only.
- **Risk:** Build success can be misinterpreted as behavioral or security
  evidence; keep the review limited to what was actually observed.
- **Completion status:** pending; manual visual review and build validation
  have not been performed in this pass.

### TASK-004 — Review implementation scope and UX behavior

- **Goal:** Independently review the source changes against FEAT-002 v5,
  ARCH-002 v3, and this plan, including the responsive/static progress
  requirements and protected existing behavior.
- **Rationale:** An independent review helps catch scope drift and incomplete
  UX requirements before this development-only change is accepted.
- **Dependencies:** TASK-001 and TASK-002. May proceed in parallel with
  TASK-003.
- **Affected files/components:** Review the changed `PlanTripPage` TypeScript,
  template, styles, and relevant plan/review artifacts; no new source file is
  required.
- **Implementation notes:**
  - Inspect the component styles for continuous keyframes or an oscillating
    marker, and confirm progress remains static when idle or when unrelated
    snapshot fields change.
  - Confirm day-grouped stored ordering, explicit day/local/overall labels,
    preview semantics, current/next and separate delay/drift, and responsive
    accessible hierarchy.
  - Confirm exact-child/owner-check/no-write boundaries and unchanged prompt
    and `/mock-trip` scope. Review source only; do not author or run tests.
- **Acceptance criteria:** Record a review verdict and findings; no
  unresolved scope violation or blocking UX issue is represented as approved.
  This review does not certify production security or release readiness.
- **Testing requirements:** No test cases are to be authored or run. Review
  source and any optional manual/build evidence only.
- **Risk:** A code review must not treat a prior test report, build result, or
  client-side owner check as production authorization evidence.
- **Completion status:** pending; review not performed.

### TASK-005 — Review exact-record boundary and production gate

- **Goal:** Independently review the implementation and plan for preservation
  of the approved exact-record safety boundary and the production block.
- **Rationale:** The hardcoded owner check is not authorization, and the
  prototype must not imply that its UI is safe for production use.
- **Dependencies:** TASK-001 and TASK-002. May proceed in parallel with
  TASK-003 and TASK-004.
- **Affected files/components:** Review the subscription usage, page
  projection/error handling, changed-file scope, and documented release gate;
  no Firebase rules/configuration changes are in scope.
- **Implementation notes:**
  - Confirm use of only `/userTrips/TN-3UP9HH`, exact `userId === 'jk'`
    checking before trip fields render, and no collection query/enumeration,
    fallback lookup, or trip write.
  - Confirm that no rules, authentication configuration, backend behavior, or
    FEAT-001 tracking behavior is changed by this UX refinement.
  - Keep development use limited to a confirmed non-sensitive environment
    under existing rules. Production remains blocked pending Authentication,
    owner-scoped rules, and authorized traveler/admin permission boundaries.
  - Review only; do not author or run test cases or attempt access-rule
    changes.
- **Acceptance criteria:** Record an independent security/scope verdict and
  unresolved environment or access concerns. The plan continues to state that
  production is blocked; this task cannot remove that block.
- **Testing requirements:** No test cases are to be authored or run. Review
  source and documented boundaries only; no production or sensitive-data
  access is authorized.
- **Risk:** The exact owner string is only a presentation filter. A
  client-side check or exact-child read does not prove authorization.
- **Completion status:** pending; review not performed.

### TASK-006 — Show accessible delay-trigger popup

- **Goal:** Automatically show the approved delay message once when an
  eligible trip's `delayTriggered` flag transitions from false/unknown to
  true; include stored `driftHrs` in hours and the dismiss-only CTA.
- **Dependencies:** Existing exact-record listener and traveler trip
  projection (TASK-001, TASK-002).
- **Affected files/components:** `PlanTripPage` and its home template only.
- **Implementation notes:** Keep transition memory in the page, do not reopen
  on repeated true snapshots, reset on false/unknown, and do not show for
  completed/ineligible records. Use a modal dialog with accessible keyboard
  dismissal and focus behavior. The CTA dismisses only; no recommendations or
  navigation are implemented. No Firebase writes.
- **Acceptance criteria:** Follow FEAT-002 AC-15 through AC-17. Preserve exact
  message copy, replace `#drifters` with stored drift hours (or “an unknown
  number of hours” if absent), and show the exact CTA label.
- **Testing requirements:** No test cases are to be authored or run, per user
  instruction.
- **Completion status:** complete; browser-only transition handling and the
  dismiss-only accessible dialog are implemented in `PlanTripPage` and its
  template. Tests and visual validation were not performed.

## Dependency summary and parallel work

`TASK-001 → TASK-002 → {TASK-003, TASK-004, TASK-005, TASK-006}`.

TASK-001 and TASK-002 are sequential because the grouped UI depends on the
snapshot-derived view model. Once source work is complete, optional manual
visual/build validation, code review, and security-boundary review can run in
parallel. No test-engineer task, test-case authoring, or test execution is
included in this plan revision.

## Blockers and non-scope prerequisites

- Production deployment/use remains blocked pending Firebase Authentication,
  owner-scoped read/write rules, and confirmed/verified traveler and admin
  permission boundaries.
- Do not use a Firebase environment unless its non-sensitive development-data
  boundary is confirmed. A denied exact-child read is an unavailable state,
  not permission to change rules or widen access.
- Do not change `/mock-trip`, the prompt-generation flow, routes, backend,
  Firebase configuration/rules, or FEAT-001 behavior.
- Existing test files from the prior implementation are outside this pass.
  Do not modify them or author/run test cases; seek separate authorization if
  implementation changes appear to necessitate test-file work.
- The prior report in `docs/reviews/FEAT-002-testing.md` records unresolved
  suite failures and a prerender exception during its build run. These remain
  historical findings; this plan does not authorize test reruns or claim those
  findings are resolved. If optional build validation is performed, record
  its result separately.
- Multi-trip discovery remains deferred. Do not work around the known
  collection-query index limitation by reading or enumerating `/userTrips`.
