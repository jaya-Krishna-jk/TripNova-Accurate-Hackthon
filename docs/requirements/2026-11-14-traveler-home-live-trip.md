---
id: FEAT-002
type: requirement
version: 6
status: approved
goal: Show the owner-verified Firebase trip `/userTrips/TN-3UP9HH` as a polished, legible traveler-home dashboard card with accurate day/activity progress synchronized to authoritative updates.
acceptance_criteria:
  - id: AC-01
    description: "Given the traveler home screen loads the prototype trip, when it reads `/userTrips/TN-3UP9HH`, then it displays that record only if the stored `userId` exactly equals `jk`; it does not query or enumerate other children under `/userTrips`."
    verification: "Verify the client reads/subscribes only to `/userTrips/TN-3UP9HH`, displays the record when `userId` is `jk`, and displays no trip when the record is missing or its stored `userId` differs."
  - id: AC-02
    description: "Given a trip belonging to `jk` has no `tracking` object and top-level `status: booked`, when it is displayed, then it is presented as Planned / Not started and its first itinerary activity is shown as a preview; this display classification does not create or persist FEAT-001 tracking state."
    verification: "Load the booked/no-tracking record and verify the Planned / Not started label, first activity preview, and unchanged Firebase record."
  - id: AC-03
    description: "Given the exact prototype record is missing, fails the exact-owner check, or has `tracking.status: completed`, when the traveler home screen resolves it, then the existing trip-planning prompt is shown and no active-trip card is displayed; no other trip is searched for or substituted."
    verification: "Test a missing exact record, owner mismatch, and completed exact record; verify the existing plan-a-trip prompt appears, no active card is shown, and no collection query or alternate trip lookup occurs."
  - id: AC-04
    description: "Given a selected trip has `tracking.currentCheckpointIndex`, when the home screen renders or receives a trip update, then it derives the current and next activity/action/location from that zero-based index across `days[].activities[]` in day order and activity order; for a booked trip without tracking it shows the first activity as a Day 1 preview."
    verification: "Use a multi-day itinerary with different activity counts per day and move the cursor across day boundaries; verify current and next activity/action/location follow the flattened ordering and that booked/no-tracking previews the first activity on Day 1 without writing tracking data."
  - id: AC-05
    description: "Given an itinerary activity has a stored `type`, when it is shown, then `Transport` is displayed as travel, `Meal` as eating, and `Accommodation` as hotel; absent values are shown plainly as not provided and other types are not falsely mapped to one of these categories."
    verification: "Test each of the three mappings, an absent type, and at least one other observed type; verify the mapped labels and plainly represented absent/unmapped values."
  - id: AC-06
    description: "Given a trip is selected, when its authoritative Firebase record changes through the supported administrator simulator/backend path, then the traveler home screen reflects the updated values without a manual page reload."
    verification: "Keep the traveler screen open, update the same record through the supported administrator path, and verify displayed values change without reloading."
  - id: AC-07
    description: "Given a selected trip contains `tracking.delayTriggered` and/or `tracking.driftHrs`, when either value changes, then the home screen displays the latest stored trigger and cumulative drift separately; if either field is absent, its absence is shown plainly and no value is invented."
    verification: "Change each stored tracking field independently and together, and test either field absent; confirm separate display of stored values and a plain absent-value indication."
  - id: AC-08
    description: "Given lookup or live updates are denied, unavailable, or contain missing fields, when the traveler home screen handles the result, then it does not display another user's trip or fabricate trip/activity values and presents a distinct error, unavailable, or not-provided state."
    verification: "Exercise denied access, offline updates, malformed data, ownership mismatch, and partial activity/tracking fields; verify no unauthorized or fabricated values are shown."
  - id: AC-09
    description: "Given FEAT-002 is used as a development prototype with existing Firebase access, when production readiness is evaluated, then production use remains blocked until Firebase Authentication, owner-scoped read/write rules, and the authorized traveler/admin permission boundaries are confirmed and tested; this feature does not broaden or modify Firebase access rules."
    verification: "Inspect the release gate and confirm production deployment/use is blocked until each listed access control is evidenced; confirm the feature requirements do not grant, loosen, or change Firebase rules."
  - id: AC-10
    description: "Given a selected trip has a valid itinerary position, when the traveler home card renders or receives an authoritative Firebase snapshot, then its default progress indicator is a static rail whose position and accessible text correspond to the current activity for an in-progress trip or the first-activity preview for a booked trip; the preview is not represented as actual tracking progress. The rail never oscillates, pulses, or moves continuously while idle and changes position only when a snapshot changes the cursor or itinerary ordering/count. Any optional animation is restrained, plays once only for such a meaningful progress change, can be replayed only by another meaningful change, and is disabled by `prefers-reduced-motion`. No map coordinates or location positions are invented."
    verification: "Hold the same snapshot with the card idle and verify the rail position is visually unchanged for at least 10 seconds with no repeating/pulsing animation. Send snapshots that change unrelated fields and verify the rail does not move; then change the cursor and verify its static position and accessible progress text update to the new activity. For booked/no-tracking, verify the first-activity rail state is labeled as a preview, not tracked progress. If transition animation is present, verify it plays once per meaningful progress change and not on unrelated snapshots, and verify `prefers-reduced-motion` disables it. Inspect the UI to confirm no fabricated coordinates or geographic placement."
  - id: AC-11
    description: "Given an in-progress trip has a valid `tracking.currentCheckpointIndex`, when its card is displayed, then it explicitly identifies the current day as `Day X of N` and the current activity as `Activity Y of M` within that day, with one-based display numbering derived by accumulating the activity counts in preceding `days[]` entries; it also exposes the overall one-based activity position and total. For a booked trip without tracking, it identifies `Day 1` and `Activity 1` as a preview, clearly labeled Planned / Not started rather than underway."
    verification: "Test a multi-day itinerary with unequal day activity counts and cursor values at the first activity, last activity of an early day, and first activity of a later day; verify day, day-local activity, and overall position/total labels. Test booked/no-tracking and verify Day 1 / Activity 1 is explicitly marked preview and Planned / Not started, with no claim that tracking has begun. Test invalid/out-of-range cursors and verify no day or activity is invented."
  - id: AC-12
    description: "Given the selected trip has itinerary activities grouped in `days[].activities[]`, when its dashboard card is displayed, then it presents a scannable itinerary/timeline grouped under every stored day in day order, preserves activity order and numbers activities within each day, and makes the current day and activity visually distinguishable without requiring the traveler to infer them from location text."
    verification: "Render a multi-day record with multiple activities per day and verify every stored day has an explicit day heading, activity sequence/order and numbering are preserved, and current day/activity have a distinct visible and text-accessible state. Verify the booked preview is identified in the Day 1 group."
  - id: AC-13
    description: "Given the live-trip card is rendered on the traveler home screen, when reviewed at 375px mobile width and 1280px desktop width, then it is demonstration-quality and visually coherent with the existing `/mock-trip` interface: clear heading/status/current-progress hierarchy, consistent typography, spacing, surface treatment, and status styling; key information is readable without clipping, overlapping, or horizontal page scrolling; and status/progress meaning is not conveyed by color alone."
    verification: "Capture the traveler home card at 375px and 1280px and review alongside `/mock-trip`; verify the stated hierarchy and visual treatment are coherent, all required trip/day/activity/progress labels remain legible, no card content is clipped or overlaps, no horizontal page overflow is introduced, and status/progress remains understandable in grayscale or with color removed."
  - id: AC-14
    description: "Given the traveler home screen already supports trip-planning prompt generation, when the live-trip card is added or updates, then existing prompt-generation behavior remains available and unchanged; the `/mock-trip` route, interface, and FEAT-001 behavior are unchanged."
    verification: "Exercise the existing prompt-generation flow before and after the traveler-home change and verify its inputs, output, and navigation remain unchanged. Compare `/mock-trip` route/interface and its FEAT-001 behavior before and after; verify no change is introduced."
  - id: AC-15
    description: "Given the exact, owner-verified trip is not completed, when `tracking.delayTriggered` changes from false or unknown to true, then the traveler home automatically opens one delay-alert modal for that transition. Repeated snapshots with the flag still true do not reopen it; after the flag resets to false, a later change to true opens it again. No modal opens while the flag is false or unknown, or when `tracking.status` is `completed`."
    verification: "On the exact permitted development record, test initial unknown-to-true and false-to-true changes, repeated true snapshots, a true-to-false reset followed by false-to-true, false/unknown values, and completed status. Verify one automatic opening per eligible transition and no opening in excluded states."
  - id: AC-16
    description: "Given an eligible delay-alert modal opens, when its message is rendered, then it displays exactly: “Your trip was delayed by #drifters. Here is the recommended plan. Plan your things appropriately. Don't panic. Use the AI suggestions for a safe and better plan.” The `#drifters` placeholder is replaced with the stored `tracking.driftHrs` value expressed in hours; if that value is absent, it is replaced by truthful unavailable text, not a number or an invented duration. The modal includes a button labeled exactly “View the recommendations.”"
    verification: "Test with present integer and fractional `driftHrs` values and with `driftHrs` absent; verify the exact message wording and punctuation, correct stored value with hours, and truthful nonnumeric unavailable text. Verify the exact button label."
  - id: AC-17
    description: "Given the delay-alert modal is open, when keyboard or assistive-technology users interact with it, then it is exposed as a modal dialog with an accessible name, receives focus on opening, keeps keyboard focus within the modal, supports Escape dismissal, and returns focus to the prior control when dismissed. Activating “View the recommendations” dismisses the modal only: it does not navigate, claim recommendations are available, or create recommendation content. The modal and CTA do not write to Firebase."
    verification: "Test dialog semantics/name and focus placement, keyboard focus containment, Escape dismissal, focus restoration, CTA dismissal without URL/route/content changes, and unchanged Firebase data. Verify a native dialog or equivalent accessible modal behavior."
---

# Traveler Home: Live Trip

## Version 6 Update
Approved product refinement dated 2026-11-14: add an accessible delay-alert modal for eligible false/unknown-to-true `tracking.delayTriggered` transitions, using the stored `tracking.driftHrs` value or truthful unavailable text and a dismiss-only recommendations placeholder CTA. Preserve exact-record safety, read-only behavior, and the development-only production gate.

## Version 5 Update
Approved product refinement dated 2026-11-14: replace continuous journey-marker motion with a static-by-default progress rail; make current day and day-local/overall activity numbering explicit; define the booked/no-tracking Day 1 preview; require a day-grouped itinerary and a responsive, demonstration-quality card; preserve exact-record safety, existing prompt generation, and `/mock-trip`.

## User Story
As traveler `jk`, I want the traveler home screen to present my verified trip and its day-by-day progress clearly, so that I can understand what day and activity are current and see authoritative updates without stale or fabricated details.

## Scope
Add a read-only development-prototype traveler-home experience for exactly `/userTrips/TN-3UP9HH`. Read and subscribe only to that record, and display it only after confirming its stored `userId` equals `jk`. Do not query or enumerate other children under `/userTrips`, and do not write to Firebase. The observed record has top-level `status: booked` and no tracking state; display it as Planned / Not started with its first itinerary activity as a Day 1 / Activity 1 preview. This is a traveler-facing display classification, not a change to FEAT-001 tracking lifecycle or a write to Firebase.

For started trips, derive the current and next activity/action/location using `tracking.currentCheckpointIndex` and the itinerary. Map `Transport` to travel, `Meal` to eating, and `Accommodation` to hotel; display absent values plainly and do not invent mappings for other types. Reflect authoritative changes to the exact record from the supported administrator simulator/backend without a manual reload. Display `delayTriggered` and `driftHrs` independently when present.

Present the selected trip as a polished, demonstration-quality dashboard card consistent with the existing `/mock-trip` interface. Explicitly show day progress/current day and activity numbering, and make the itinerary scannable in day-grouped or timeline form while preserving stored order. For an in-progress trip, interpret `tracking.currentCheckpointIndex` as a zero-based index across `days[].activities[]` flattened in day order and activity order; show the derived current day, day-local activity number, and overall activity position. For a booked trip with no tracking, show the first activity as a Day 1 / Activity 1 preview, explicitly labeled Planned / Not started and not as actual tracking progress.

Use a static progress rail by default. It must remain fixed while the authoritative snapshot and relevant itinerary position are unchanged, with no continuous idle movement or oscillation; update its position and accessible text when a meaningful snapshot changes the cursor or itinerary. If an optional transition animation is used, it must be restrained, one-shot per meaningful progress change, never loop or replay on unrelated updates, and honor `prefers-reduced-motion`. Show delay state from stored tracking fields without depicting misleading movement. Use stored itinerary values only; do not invent travel dates, map coordinates, or geographic placement. An absent/unknown delay trigger must not be presented as confirmed on-time status.

When the exact trip is not completed, automatically show an accessible modal once per transition of `tracking.delayTriggered` from false or unknown to true. Do not reopen it for repeated snapshots that retain true; a reset to false followed by a later true transition may show it again. Do not show it for false/unknown values or completed trips. Use the requested exact message, replacing `#drifters` with the stored `tracking.driftHrs` value expressed in hours, or truthful unavailable text if absent. Include the “View the recommendations” button as a placeholder CTA only: activating it dismisses the modal and does not navigate or claim recommendations are available. This alert remains read-only and uses only the exact, owner-verified development record.

This is a development prototype using existing Firebase access only. Do not broaden or modify access rules as part of this feature. Production use is explicitly blocked until Firebase Authentication, owner-scoped rules, and traveler/admin access permissions are confirmed and tested. Use only non-sensitive development records while the existing access boundary is unresolved.

## Acceptance Criteria
See the required, individually verifiable Given/When/Then criteria in the YAML front matter above.

## Out Of Scope
- Changing trip itineraries, tracking outcomes, or the persistence rules covered by FEAT-001.
- Creating or assuming data beyond the verified candidate record and observed schema.
- Defining administrator tools or changing how the simulator/backend writes trip data.
- Changing Firebase Authentication, authorization, or database security rules.
- Discovering trips by username, querying `/userTrips` by `userId`, enumerating trip records, or selecting among multiple trips. Defer this until an owner-approved index, authentication, and rules are ready.

## Assumptions
### Verified Firebase observations
- Read-only observation reported by the requester on 2026-11-14: `/userTrips/TN-3UP9HH` exists; its `tripId` and `userId` match `TN-3UP9HH` and `jk`; its top-level `status` is `booked`; it has no `tracking` object; and it is currently the only observed record with `userId: jk`.
- The observed record has five itinerary days with activity fields `time`, `place`, `description`, `type`, and `bookingStatus`, plus plan details. Observed activity `type` values include `Transport`, `Meal`, `Accommodation`, and others.
- These are point-in-time observations, not a guarantee that the Firebase data remains unchanged or that every record follows this shape.
- Follow-up read-only verification reported on 2026-11-14: direct read of `/userTrips/TN-3UP9HH` works; attempting `orderByChild('userId').equalTo('jk')` at `/userTrips` is rejected with HTTP 400 because `.indexOn userId` is missing under `/userTrips`. The approved product choice is not to work around this by fetching all trips into the browser.

### Product decisions
- For this requested prototype, hardcode traveler username `jk`.
- Restrict the prototype lookup and live subscription to `/userTrips/TN-3UP9HH`; verify `userId === 'jk'` before displaying. The exact ID is a bounded prototype choice, not a general trip-discovery or authorization mechanism.
- A record with top-level `status: booked` and no `tracking` object is presented as Planned / Not started, with its first itinerary activity as a preview. This UI state does not create tracking data or establish a write-side lifecycle transition.
- For a booked trip without tracking, the preview is Day 1 / Activity 1, clearly labeled as a preview; it is not evidence that the trip has started or that progress was persisted.
- For in-progress trips, interpret `tracking.currentCheckpointIndex` as a zero-based index across the ordered concatenation of `days[].activities[]`. Derive `Day X of N`, the one-based activity number within that day, and the one-based overall activity position from that index. Do not infer travel dates or location coordinates.
- Map `Transport` → travel, `Meal` → eating, and `Accommodation` → hotel. Show absent fields plainly; do not fabricate values for other activity types.
- The default progress indicator is a static rail, not a continuously animated marker. Its position changes only when an authoritative snapshot changes the cursor or itinerary ordering/count. Any optional motion is one-shot on a meaningful progress change and disabled for reduced-motion preferences.
- The dashboard card must meet the responsive and visual consistency checks in AC-13 against `/mock-trip`; keep existing home prompt-generation behavior and do not change `/mock-trip` or its FEAT-001 behavior.
- Delay alerts are triggered only by eligible false/unknown-to-true transitions of `tracking.delayTriggered`; same-valued true snapshots do not retrigger. Completed trips do not show the modal. Missing `driftHrs` is presented as unavailable, not inferred.
- The requested recommendations button is a dismiss-only placeholder. Actual recommendations, recommendation content, and navigation destinations are not defined by this requirement.
- Username-based discovery and multiple-trip selection are deferred until an owner-approved `.indexOn userId`, authentication, and access rules are ready. No browser-side fetch-all workaround is permitted.
- Prototype use is limited to existing Firebase access and non-sensitive development records. No Firebase permissions or rules are to be changed under this requirement.

### FEAT-001 relationship
- FEAT-001 defines tracking at `/userTrips/{tripId}`, lifecycle values `not_started`, `in_progress`, and `completed`, and tracking fields including `delayTriggered` and `driftHrs`. The observed candidate currently has no tracking object; absent tracking values must not be fabricated or persisted by this display feature.

## Open Questions And Dependencies
- **BLOCKED — production authorization gate:** Firebase Authentication, owner-scoped read/write rules, and explicit traveler/admin permissions have not been confirmed. FEAT-001 security review `SEC-001` reports unauthenticated read and write access. Do not use this prototype with production or sensitive traveler records, do not broaden/modify the rules to make the feature work, and do not remove the production block until controls are implemented and verified.
- **Development environment dependency:** Confirm the existing Firebase project/access used for the prototype is limited to non-sensitive development records. If that cannot be confirmed, do not connect the prototype to it.
- **Deferred discovery dependency:** Username-based trip discovery and any multiple-trip precedence require owner approval of `.indexOn userId`, authentication, and suitable read rules. Until those are ready and approved, the prototype is limited to the exact trip ID and performs no collection query or browser-side enumeration.
- **Update source and route:** Confirm which development simulator/backend path writes the same Firebase record and identify the application route that hosts the traveler home experience. This does not change the product behavior above.
- **Validation:** `templates/requirement.md` and `schemas/requirement.schema.yaml` are not present in the workspace, so schema validation could not be performed. Product decisions supplied for this version are treated as approval of the feature behavior; this requirement's `approved` status does not mean implementation, security review, production readiness, or release approval.
