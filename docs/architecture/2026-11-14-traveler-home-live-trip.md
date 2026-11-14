---
id: ARCH-002
type: architecture
feature_id: FEAT-002
version: 4
status: ready
proposed_solution: >-
  Evolve the existing PlanTripPage live-trip card, reusing its read-only
  Realtime Database listener for exactly /userTrips/TN-3UP9HH. Verify
  userId === jk before rendering, project the authoritative day/activity
  position into a static progress rail and day-grouped itinerary, and present
  stored current/next activity and delay information without inferred values.
  Auto-open an accessible, dismiss-only delay modal exactly on eligible
  false/unknown-to-true transitions, with stored drift hours or truthful
  unavailable text. Keep the booked/no-tracking record Planned / Not started
  with a clearly labeled Day 1 / Activity 1 preview. Do not query or enumerate
  /userTrips, write trip data, alter Firebase rules, or change /mock-trip.
components:
  - id: COMP-01
    name: Traveler home (PlanTripPage)
    responsibility: Verify and project exact-record snapshots, and display loading/empty/error states plus the responsive trip dashboard card and existing prompt flow.
  - id: COMP-02
    name: RealtimeDatabaseService
    responsibility: Reuse the configured Firebase client and provide a read-only onValue listener to /userTrips/TN-3UP9HH with snapshot/error forwarding and unsubscribe.
  - id: COMP-03
    name: Firebase Realtime Database
    responsibility: Remain the authoritative source for the exact trip child and deliver snapshots subject to existing deployed rules.
---

# Traveler Home: Live Trip Architecture

## Context

This architecture revision implements approved `FEAT-002` version 6 and
supersedes the earlier continuous-marker design in `ARCH-002` version 2.
`PLAN-002` describes the existing exact-child listener and page integration;
its earlier delay-gated animation wording predates requirement version 5 and
is superseded here by the static-by-default progress behavior. Version 6 adds
an accessible delay-alert modal driven only by qualifying authoritative
`tracking.delayTriggered` transitions.
The scope remains the development prototype for exactly
`/userTrips/TN-3UP9HH`, rendered only after confirming the stored
`userId === 'jk'`.

The observed record has top-level `status: booked` and no `tracking` object.
Present it as **Planned / Not started**, with its first stored activity as a
Day 1 / Activity 1 preview. That is a display state only: it neither starts
the trip nor creates tracking data. For an in-progress trip, the stored
`tracking.currentCheckpointIndex` identifies the current activity in the
ordered concatenation of `days[].activities[]`.

This remains a read-only home-screen experience. The existing prompt-generation
flow and `/mock-trip` interface and FEAT-001 behavior are outside the change.
No travel dates, coordinates, geographic placement, inferred activity values,
or tracking outcomes may be fabricated.

## Current State

- `app.routes.ts` maps `/` to `DashboardShell` with `PlanTripPage`; `/mock-trip`
  is a separate `TravelMockComponent` route.
- `PlanTripPage` uses Angular signals for prompt state and already subscribes
  to the traveler-home record. The current working tree already projects
  exact-owner snapshots into the responsive day-grouped itinerary, explicit
  day/activity coordinates, and current/next summaries.
- The current working tree's itinerary rail is static and accessible, with a
  planned-preview state; retain this behavior and do not add idle motion or
  animation. The delay state and drift are displayed independently, but there
  is no transition-triggered modal or prior-transition memory yet.
- The page already uses `isPlatformBrowser` to prevent Firebase observation
  during server rendering and has browser-side signals for the live trip. The
  app enables client hydration. Delay transition memory and modal DOM/focus
  operations therefore belong to the browser-only page lifecycle; SSR must
  render no open modal.
- The page projection currently displays delay and drift independently but
  has no transition-triggered modal. The existing itinerary booking dialog
  demonstrates dialog markup, but its wrapper alone does not establish the
  required focus management; use native modal-dialog behavior or an
  equivalent implementation with explicit focus restoration.
- `RealtimeDatabaseService.subscribeToTravelerHomeTrip` already attaches
  `onValue` to exactly `userTrips/TN-3UP9HH`, forwards snapshots/errors, and
  returns an unsubscribe handle. Existing FEAT-001 tracking methods are
  separate and must remain unchanged.
- `/mock-trip` provides visual cues for journey progress, day/checkpoint
  coordinates, current action, next action, and delay information. Reuse
  compatible hierarchy and status cues without changing that route.
- Existing Firebase security findings remain unresolved. The exact owner
  string is a display check, not authentication or an authorization boundary.
- `templates/architecture.md` and `schemas/architecture.schema.yaml` are not
  present in this workspace. Formal template/schema validation is unavailable;
  the metadata and required sections in this artifact have been manually
  checked.

## Proposed Solution

Keep the change within `PlanTripPage` and its existing template/styles. Reuse
the current database listener and signal-based state; do not add a service
layer, global state library, backend endpoint, or new infrastructure.

Add a page-local modal state and transition memory. For each snapshot, first
run the same complete projection and eligibility checks used by the card:
the fixed child exists, the root is valid, `userId === 'jk'`, any stored
`tripId` matches, the lifecycle and itinerary are valid, and
`tracking.status` is not `completed`. A booked/no-tracking preview has no
delay boolean and cannot trigger. No modal may open for missing, mismatched,
completed, malformed, or otherwise unavailable trip data.

For an eligible snapshot, classify `tracking.delayTriggered` as `true`,
`false`, or `unknown` (absent); reject malformed non-boolean values through
the existing unavailable-data handling. Keep only the preceding transition
state in component memory, never Firebase. On `false` or `unknown`, update
that baseline and do not open the modal. On `true`, open only if the previous
baseline was `false` or `unknown`; while the baseline remains `true`, repeated
snapshots cannot reopen a dismissed modal. A subsequent false/unknown
snapshot resets the baseline so a later true snapshot can open once again.
Reset transition memory and close any open modal when the record becomes
ineligible, unavailable, errors, or the page is destroyed, so state cannot
carry across owners/records or stale data.

Build the modal message from the exact approved copy, replacing only
`#drifters` with the stored finite `driftHrs` value followed by “hours”. If
`driftHrs` is absent, use “an unknown number of hours”; do not infer or
substitute a numeric duration. Preserve exact wording and punctuation:

> Your trip was delayed by #drifters. Here is the recommended plan. Plan your
> things appropriately. Don't panic. Use the AI suggestions for a safe and
> better plan.

Provide the button label **View the recommendations**. It is a dismiss-only
placeholder: no navigation, generated/claimed recommendation content, or
other action is defined. The modal includes an accessible name, receives
focus on opening, contains keyboard focus, closes with Escape and an explicit
close control, and restores focus to the previously focused connected
element (or a stable page heading fallback). Native `<dialog>.showModal()`
may supply the modality/focus containment where supported; otherwise use an
equivalent accessible pattern. Invoke DOM/focus APIs only in the browser after
render, never during SSR. The modal and CTA are read-only and perform no
Firebase writes.

The page's existing `isPlatformBrowser` guard remains the boundary for
starting the listener and processing live modal transitions. Initial SSR
rendering keeps the modal closed; there is no server-side trip access,
transition evaluation, dialog opening, or focus operation. Client-side
authoritative snapshots drive the interaction after hydration.

For each authoritative snapshot:

1. Require an object record and exact `userId === 'jk'` before projecting any
   trip fields. Reject a contradictory stored `tripId`, malformed/ineligible
   lifecycle, malformed itinerary, and invalid cursor. Do not fall back to a
   different record.
2. Keep the existing lifecycle presentation: a booked record with absent
   tracking is **Planned / Not started**; completed is not an active trip;
   in-progress records derive their cursor from the stored
   `currentCheckpointIndex`. Do not create or normalize tracking.
3. Preserve stored day order and activity order. For an in-progress trip,
   derive:
   - **Day X of N** from the containing day’s one-based position and total
     stored days;
   - **Activity Y of M** from the activity’s one-based position and activity
     count within that day; and
   - **Overall X of total** from its one-based flattened position and total
     flattened activities.
   The day-grouped itinerary displays each stored day and its activities in
   order, with the current day/activity distinctly identifiable in both visual
   and accessible text.
4. Render an exact stored day `theme` or other explicit day label/summary when
   present (the existing `TripDay` contract includes `theme` and
   `daySummary`). Use the derived `Day X` heading as the coordinate label;
   do not synthesize a theme, summary, date, or location.
5. For the booked/no-tracking record, identify the first stored activity as
   **Day 1 / Activity 1 preview** and show **Planned / Not started**. It may
   show one-based local/overall preview numbering, but all such numbering must
   remain explicitly a preview, not tracked progress. Do not display it as an
   underway current checkpoint.
6. Show concise current and next activity details for in-progress trips,
   including stored type/action, place, time, and description where available.
   Use **Not provided** for absent optional values. Map only `Transport` to
   travel, `Meal` to eating, and `Accommodation` to hotel; other stored types
   remain plainly represented. A missing next activity is not available.
7. Display stored `delayTriggered` and `driftHrs` independently. An absent
   trigger is unknown, not on-time. Delay state must be conveyed by text and
   status styling, not color alone.
8. Preserve a static rail/progress indicator whose
   position and accessible progress text represent the authoritative activity
   position. Keep the same position while the cursor and itinerary ordering/
   count remain unchanged, including across snapshots that only update
   unrelated fields. Update the position only when a snapshot meaningfully
   changes the cursor or the itinerary ordering/count. Do not add a repeating,
   pulsing, or idle animation. No transition animation is needed; if one is
   separately chosen, it must be restrained, one-shot for a meaningful
   position change, and disabled by `prefers-reduced-motion`.
9. For planned state, label the rail position as a preview, not actual tracking
   progress. For delayed or unknown delay state, do not depict movement that
   implies confirmed on-time travel. The rail is an ordered itinerary
   indicator, not a map; use no coordinates or geographic placement.
10. Apply each valid snapshot atomically. On fatal listener error clear/mark
    the previous record unavailable and stop implying it is live. Unsubscribe
    on page destruction; late callbacks must not update a destroyed page.

Compose a crisp card consistent with the app’s Tailwind surface, typography,
spacing, and status tokens, drawing on `/mock-trip`’s journey-progress,
day/checkpoint, current/next, and delay hierarchy. At 375px mobile and 1280px
desktop widths, content must remain readable without clipping, overlap, or
horizontal page scrolling. Preserve the existing prompt, quick prompts,
request states, and navigation.

## Affected Components

| Component / file | Architectural impact |
|---|---|
| `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts` | Keep exact-owner validation and snapshot projection; derive day-local and overall activity coordinates, day labels, current/next view data, preview state, and static rail progress from each authoritative snapshot. Also maintain transient tri-state delay transition/modal state; gate transition evaluation and focus/DOM effects to the browser; permit opening only for an eligible verified non-completed trip and reset on false/unknown or ineligibility. Preserve listener teardown and ignore late callbacks. |
| `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.html` | Render status hierarchy, Day X of N, Activity Y of M, overall X of total, exact stored day theme/label where present, current/next activity, and all stored days as a scannable grouped itinerary. Clearly distinguish the planned preview. Add accessible modal markup, exact message interpolation, close affordance, and the dismiss-only **View the recommendations** button. |
| `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts` styles and `plan-trip-page.html` Tailwind classes | Preserve the static, accessible, responsive rail/card treatment and add a responsive modal. Do not introduce continuous or idle animation; dialog motion is unnecessary and, if present, must respect reduced-motion. |
| `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts` | Reuse the existing exact-child read-only subscription unchanged unless integration requires a compatibility correction; no collection read/query, writes, or tracking changes. |
| `Frontend/TripNova-angular-app/src/app/travel-mock/travel-mock.component.*`, `app.routes.ts`, Firebase config/rules, and backend | No changes. Preserve `/mock-trip`, route structure, Firebase configuration/rules, and backend behavior. |

No test/spec files are in scope. Verification for this architecture revision is
manual only; do not author or run test cases.

## Data Model

No persisted data-model change, migration, backfill, or write is introduced.
The feature consumes the existing record:

```text
/userTrips/TN-3UP9HH
  tripId?: string                   # if present, must match the exact child ID
  userId: string                    # must equal "jk" before any trip data renders
  status?: string                   # booked for observed no-tracking record
  days[]
    day?: number                    # stored value; display ordinal derives from order
    theme?: string                  # exact label, only when present
    daySummary?: string             # exact summary, only when present
    activities[]
      time?: string
      place?: string
      description?: string
      type?: string
  tracking?                         # absent remains absent for planned preview
    status?: "not_started" | "in_progress" | "completed"
    currentCheckpointIndex?: number # zero-based flattened activity index
    delayTriggered?: boolean
    driftHrs?: number
```

Treat Firebase values as untrusted runtime data. Validate the root, ownership,
itinerary/day/activity structure, optional displayed field types, lifecycle,
and in-progress cursor. Calculate presentation coordinates only from stored
array ordering/counts. Missing optional fields remain absent and display as
**Not provided**; malformed data yields unavailable state rather than
fabricated content. The local view model is a page projection, not a persisted
or shared domain entity.

The modal adds no persisted fields. Its transition baseline is component-local
ephemeral state (`unknown | false | true`) associated only with the current
eligible exact-child listener session; modal-open state and the prior-focus
reference are likewise transient UI state. They are cleared on ineligibility,
listener error/restart, and destruction. No schema migration, tracking update,
or recommendation entity/API is introduced.

## API / Contracts

There is no HTTP or backend API change. The Firebase integration contract
remains:

- Exact database child: `/userTrips/TN-3UP9HH`; never read/query/enumerate the
  `/userTrips` collection and never substitute another ID.
- Listener: existing Firebase Realtime Database `onValue`, delivering initial
  and subsequent authoritative snapshots.
- Identity: fixed candidate ID plus independent exact payload check
  `userId === 'jk'` before rendering.
- Errors: forward as a distinct unavailable/error state; do not convert access
  denial to an empty record or bypass it with another lookup.
- Lifetime: `PlanTripPage` owns and calls the returned unsubscribe function
  when destroyed and after fatal listener failure.
- Writes: none from the traveler-home card. FEAT-001 service operations remain
  separate and unchanged.
- Delay transition: evaluate only the validated exact-child snapshot after
  owner/lifecycle checks; absent boolean is `unknown`. A `false` or `unknown`
  snapshot resets the baseline without opening. A transition from either
  baseline to `true` opens once; subsequent `true` snapshots do not reopen
  after dismissal. A false/unknown reset permits a later true transition.
- Eligibility: modal requires a valid, owner-verified, non-completed trip
  projection and `delayTriggered === true` after a false/unknown baseline.
  Missing, owner-mismatched, completed, malformed, or unavailable records
  never open it.
- Message: substitute stored `driftHrs` as hours in the exact FEAT-002 v6
  message; if absent, substitute “an unknown number of hours”. The
  recommendations CTA dismisses only, with no route/content/result contract.
- SSR: the existing browser guard prevents listener subscription and delay
  transition processing on the server. Modal remains closed during SSR, and
  focus/DOM operations run only after browser rendering.
- Modal accessibility: accessible dialog name, initial focus, focus
  containment, Escape and explicit-close dismissal, and focus restoration to
  the prior connected element or a stable heading fallback.

The known filtered query’s missing `.indexOn userId` is immaterial to this
fixed exact-child contract. Do not attempt that query, download the collection,
or change indexes/rules under this feature.

## Frontend / Backend Responsibilities

**Frontend:** `PlanTripPage` owns page-lifetime observation, owner/lifecycle
validation, atomic projection, and all card states. It derives day and activity
coordinates from the latest stored itinerary ordering, keeps the rail stable
across irrelevant snapshot changes, and renders only stored values or explicit
absence states. It also owns transition memory and modal lifecycle; only
browser-side, validated snapshots can trigger the accessible dialog. The CTA
dismisses without navigation or recommendation claims. Existing Angular
signals and Tailwind conventions remain the implementation patterns.

**Service:** `RealtimeDatabaseService` constructs/uses the exact child
reference and owns the listener handle. It forwards snapshots/errors and does
not claim authorization or mutate records.

**Backend/simulator:** No changes. The existing authorized development
simulator/backend remains the source of changes to the record; the traveler
home only observes them.

**Firebase:** Remains authoritative for the record and access decisions. No
configuration, permission, index, or rule change is included.

## Failure Modes

| Condition | Required behavior |
|---|---|
| Initial exact-child listener pending | Show loading; no stale trip details or implied progress. |
| Exact child absent | Show the existing plan-a-trip prompt/state; no active-trip card or alternate lookup. |
| Owner mismatch or contradictory stored ID | Render none of the trip fields; show unavailable/empty state. |
| Booked with no tracking | Show Planned / Not started and first activity as Day 1 / Activity 1 preview, not as underway progress. |
| Completed/ineligible or malformed lifecycle | No active-trip card; use empty or unavailable state as appropriate. |
| Invalid itinerary, cursor, or displayed value type | Show unavailable/data state; do not infer a day/activity or substitute a value. |
| Missing day theme/summary or activity field | Omit optional day label or show **Not provided** for the relevant activity value; do not fabricate. |
| Missing next activity | Show next activity as unavailable; do not wrap or invent one. |
| Delay trigger true, absent, or unknown | Show stored delay state distinctly; absent/unknown never means confirmed on-time and never causes movement animation. |
| Eligible snapshot transitions false/unknown → true | Open one modal automatically for that transition, using stored drift hours or “an unknown number of hours”; set baseline true so repeated true snapshots do not reopen. |
| `delayTriggered` remains true after modal dismissal | Keep baseline true; do not reopen for repeated snapshots. |
| Delay trigger resets to false or unknown | Update/reset transition baseline and do not open; a later true transition may open once. |
| Missing record, owner mismatch, completed trip, invalid data, or listener error | Do not open; close any existing modal and clear transition memory so no stale trip can trigger it. |
| CTA, close control, or Escape | Dismiss only and restore focus appropriately; no navigation, recommendation content, or Firebase write. |
| Server-side render | Keep modal closed; do not subscribe to Firebase, evaluate transitions, manipulate dialog DOM, or move focus on the server. |
| Modal on mobile/desktop or zoomed viewport | Keep dialog content readable and operable without clipping; preserve page/card responsive requirements. |
| Unrelated authoritative snapshot update | Refresh changed displayed values atomically, but leave the progress position fixed if cursor and itinerary ordering/count are unchanged. |
| Cursor/order/count changes in authoritative snapshot | Recompute day/local/overall labels and static rail position from the new snapshot. |
| Listener denied/unavailable after prior snapshot | Clear or mark prior data unavailable; stop claiming it is current/live; expose retryable error without widening the read. |
| Component destroyed / route changed | Unsubscribe and ignore late callbacks. |
| 375px or 1280px layout | Preserve readable hierarchy and labels without clipping, overlap, or horizontal page overflow. |

## Security Considerations

This is a dev-only prototype with a hardcoded owner string. `userId === 'jk'`
is a presentation filter, not authentication, proof of ownership, or a security
control. Firebase client configuration is not authorization. The FEAT-001
security review reported successful unauthenticated reads and writes; deployed
rules have not been independently confirmed.

Production use remains **BLOCKED** until Firebase Authentication, owner-scoped
read/write rules, and authorized traveler/admin permission boundaries are
implemented and verified. Do not presume `userId: jk` equals `auth.uid`. Do
not broaden access or change rules to enable the exact-child read. Use only a
confirmed non-sensitive development environment; if that boundary cannot be
confirmed, do not connect the prototype. Never log full trip snapshots,
itinerary content, credentials, or tokens.

## Observability

Expose distinct loading, no-eligible-trip, unavailable/data, Firebase error,
and verified-trip states. Keep progress accessible through text semantics as
well as visual placement, including day, local activity, overall activity,
and preview labels. Communicate delay and unknown state through text/status,
not color alone. The dialog exposes an accessible name and its exact message;
opening/dismissal is observable through browser-visible UI behavior, not
payload logs or analytics. A fatal listener error must remove any implication
that stale data is live and close/reset the dialog. Add no analytics, payload
logging, or observability infrastructure.

## Migration / Rollout

No migration, backfill, or database write is required. Integrate the updated
card and delay dialog on the existing `/` route while preserving prompt
generation. Leave
`/mock-trip`, FEAT-001 tracking actions, backend behavior, and Firebase
configuration/rules unchanged.

Use only a confirmed non-sensitive development Firebase environment and
existing rules. If the exact-child read is denied, keep the card unavailable;
do not broaden the lookup or alter permissions. Production rollout remains
blocked by the authentication and owner-scoped access gate above.

## Manual Verification (No Test Cases)

This architecture-only revision does not authorize implementation changes or
test-case authoring/execution. After implementation is separately authorized,
manually verify:

- The page only observes `/userTrips/TN-3UP9HH`; owner mismatch, missing record,
  completed status, malformed data, and listener errors never open the dialog
  or expose another trip. The trip-planning prompt, exact-owner check, static
  day-progress rail, existing prompt flow, and `/mock-trip` remain unchanged.
- With a confirmed non-sensitive development record, initial unknown-to-true
  and false-to-true transitions open once; repeated true snapshots do not
  reopen after dismissal; false and unknown snapshots do not open; after a
  false/unknown reset, a later true transition opens once again.
- The message uses the exact approved wording and punctuation, interpolates
  integer and fractional stored drift values with hours, and uses “an unknown
  number of hours” if drift is absent. The CTA label is exactly **View the
  recommendations** and only dismisses.
- Keyboard/assistive-technology review confirms modal semantics and accessible
  name, initial focus, contained focus, Escape and explicit close, focus
  restoration, and CTA dismissal without route/content changes. Confirm the
  Firebase record is unchanged by all modal interactions.
- SSR emits no open modal and does not subscribe or manipulate focus. After
  hydration, browser-side live snapshots can trigger the dialog.
- At 375px and 1280px, modal and card remain readable without clipping,
  overlap, or horizontal scrolling; status/progress does not rely on color
  alone, and the rail stays static during idle/unrelated updates.

Do not write or run automated test cases as part of this architecture task.

## Alternatives Considered

- **Continuously animated or oscillating marker:** rejected; it implies motion
  while the authoritative snapshot is idle and contradicts FEAT-002 v5.
- **Optional one-shot progress transition:** unnecessary for the default
  design. If introduced separately, it must occur only for a meaningful
  cursor/order/count change and honor reduced-motion preferences.
- **Use the mock-trip route or alter its UI to host the traveler card:** rejected;
  the existing `/` home route is the feature boundary and `/mock-trip` must
  remain unchanged.
- **Filtered query, collection download, or browser-side enumeration:** rejected;
  the prototype is limited to one approved exact child and must not expose
  other trip records.
- **One-time read or locally guessed progress:** rejected; snapshots from the
  exact Firebase child are authoritative and the page must reflect meaningful
  updates without reload.
- **Write missing tracking or derive dates/coordinates/themes:** rejected;
  the display must remain read-only and use only authoritative stored values
  plus explicitly derived ordinal positions.
- **New backend, repository abstraction, or global state library:** rejected as
  unnecessary; the existing service and Angular signals are sufficient.
- **Persisting delay-alert dismissal/transition state or writing tracking:**
  rejected; alert transition memory and modal dismissal are local UI concerns,
  and the approved display feature is read-only.
- **CTA navigation or fabricated AI recommendations:** rejected; product has
  defined only a dismiss-only placeholder and has not specified a destination
  or recommendation content.
- **Opening a dialog during SSR:** rejected; Firebase observation and DOM/focus
  operations are browser-only and server output must contain a closed dialog.

## Risks And Unresolved Technical Decisions

- **Production authorization:** remains unresolved and blocks production use.
  The local owner check does not mitigate Firebase access-rule weaknesses.
- **Development environment boundary:** confirm non-sensitive development data
  before using the existing Firebase client; otherwise do not connect.
- **Runtime record variability:** observations are point-in-time. Validate
  each snapshot and use explicit unavailable/not-provided states.
- **Formal schema validation:** unavailable because the architecture template
  and schema are missing from the workspace. Required metadata/sections were
  manually checked; this is not a claim of schema validation. Status remains
  `draft` until the required template/schema is available and validation passes.
- **No open UI/data contract choice:** day/local/overall positions derive from
  the ordered stored arrays; exact stored `theme`/`daySummary` are optional and
  never synthesized. The static rail is the chosen default; no continuous or
  idle animation is part of the design. Modal fallback text is fixed by the
  approved version 6 requirement refinement as “an unknown number of hours”;
  no recommendation destination/content is defined.
