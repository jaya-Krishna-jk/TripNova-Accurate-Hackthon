---
id: FEAT-001
type: requirement
version: 2
status: approved
goal: Load trips from Firebase Realtime Database and persist one-time trip tracking progress and outcomes on each trip record.
acceptance_criteria:
  - id: AC-01
    description: "Given a non-empty trip ID, when the traveler loads it, then the app looks up `/userTrips/{tripId}` and renders the trip data from that record."
    verification: "With an existing Firebase record, verify the displayed trip fields and itinerary match the record."
  - id: AC-02
    description: "Given a missing or unknown trip ID, when the traveler loads it, then no trip is displayed and an appropriate not-found state is shown; the app does not substitute a default ID or mock trip."
    verification: "Load an empty ID and a nonexistent ID; verify no trip data or tracking controls are shown and a not-found state is visible."
  - id: AC-03
    description: "Given a loaded trip that has not started, when the traveler starts it, then its started lifecycle/status and initial tracking state are persisted to that same trip record."
    verification: "Start a trip and inspect `/userTrips/{tripId}` for persisted lifecycle/status, current checkpoint/progress, last event, and `driftHrs`."
  - id: AC-04
    description: "Given a trip that has started or completed, when it is loaded again, then its stored state is resumed and the traveler cannot start it again or reset it."
    verification: "Reload started and completed records and verify the saved state is shown and start/reset actions are unavailable."
  - id: AC-05
    description: "Given an active trip, when the traveler records an on-time, delayed, missed, or dropped outcome, then the outcome and its applicable checkpoint/progress, lifecycle/status, last-event, and cumulative delay effects are persisted on the same record."
    verification: "Exercise each outcome and verify the corresponding record state survives a reload. For delay, enter hours and verify cumulative delay is stored in `driftHrs` in hours."
  - id: AC-06
    description: "Given a missed or dropped outcome, when the traveler invokes the available recovery or skip action, then its resulting progress, status, last event, and applicable cumulative delay effect are persisted on that same record."
    verification: "Exercise missed recovery and dropped-connection skip; reload and verify the resulting state and `driftHrs`."
  - id: AC-07
    description: "Given the final checkpoint, when the traveler records its completion, then the trip is marked complete and that state is persisted; a completed trip cannot be restarted or reset."
    verification: "Complete the final checkpoint, reload the trip, and verify completed status and no start/reset action."
  - id: AC-08
    description: "Given any tracking update, when it is saved, then the trip's itinerary and unrelated record fields retain their existing values."
    verification: "Compare the record before and after each update; confirm itinerary and unrelated fields are unchanged."
  - id: AC-09
    description: "Given a started trip, when it loads or a checkpoint action is saved, then Firebase contains a tracking row for every activity with day number, day-local index, overall index, checkpoint name, ongoing date, delay hours, visited status, on-time state, on-track state, and outcome; the current checkpoint summary contains its day-local and overall coordinates and exact name."
    verification: "Load the trip and inspect every checkpoint tracking row and current checkpoint metadata in Firebase and the simulator."
  - id: AC-10
    description: "Given cumulative drift reaches or exceeds 5 hours, when the update is saved, then Firebase sets `delayTriggered` to true and the UI clearly displays the delay trigger; lifecycle status remains one of not_started, in_progress, or completed."
    verification: "Inspect the saved threshold flag and lifecycle status at and above 5 hours of cumulative drift."
---

# Firebase Trip Tracking

## User Story
As a traveler, I want to load and track the trip identified by my trip ID using its Firebase record, so that my itinerary and trip progress remain accurate when I return.

## Scope
Replace the Angular standalone app's hardcoded mock-trip data and in-memory tracking state with data and state from Firebase Realtime Database at `/userTrips/{tripId}`. Reuse the existing Firebase configuration/service. Render the loaded trip's Firebase data, and show no trip plus a not-found state for a missing ID or absent record.

Persist tracking updates to the same trip record, including lifecycle status, current checkpoint, per-checkpoint history, last event, and cumulative delay in the explicitly named `driftHrs` field. Each checkpoint stores day number, day-local index, overall index, name, ongoing date, checkpoint delay, visited/not_visited, onTime, onTrack, and outcome. The current checkpoint summary stores its day-local and overall indices plus exact checkpoint name and ongoing date. The delay-entry UI requests hours. At cumulative drift greater than or equal to 5 hours, set `delayTriggered: true` as the external trigger while lifecycle status remains one of `not_started`, `in_progress`, or `completed`. Support on-time, delayed, missed, and dropped outcomes, and persist the effects of missed recovery and dropped-connection skip. Preserve the itinerary and all unrelated fields in the record. A trip is one-time: reopen resumes stored state, and a started or completed trip cannot be started again or reset. Reaching the final checkpoint marks the trip complete.

## Acceptance Criteria
See the required, individually verifiable Given/When/Then criteria in the YAML front matter above.

## Out Of Scope
- Changing the itinerary or editing unrelated trip-record fields.
- Replacing the Firebase project/configuration or introducing a different persistence store.
- Defining authentication, authorization, or database security rules beyond the access dependency below.

## Assumptions
- Firebase trip ID `111` is confirmed at `/userTrips/111`; the local sample `data.json` is not a source of truth.
- The confirmed record includes `tripId`, `userId`, and `days[].activities[]`; other summary fields may be absent and must not be fabricated as required data.
- Delay input is a non-negative number of hours, and `tracking.driftHrs` stores cumulative delay in hours.
- Tracking fields are grouped under a `tracking` object on the trip record; itinerary and unrelated record fields remain unchanged.
- On-time and delayed actions advance progress; missed and dropped pause progress until recovery or skip; missed-departure recovery adds 2 hours; skipping a dropped connection adds no delay.
- The first checkpoint is the initial progress position; reaching the last checkpoint transitions the trip to complete.
- Checkpoint `onTrack` is true only while cumulative drift is below 5 hours; missed, dropped, and skipped checkpoints are not on track. The separate `delayTriggered` field becomes true at 5 hours and remains true because cumulative drift does not decrease.
- Existing trip `111` has 3.3 hours of drift but no historical per-checkpoint breakdown. The known latest 0.3-hour delay is attributed to its recorded checkpoint; the remaining 3.0 hours are stored as `unattributedDriftHrs` rather than assigned to an invented checkpoint.

## Open Questions And Dependencies
- Firebase Realtime Database rules must permit the app to read `/userTrips/{tripId}` and write tracking fields on the same record. Confirm the rules and intended authorization scope before implementation; current permissions have not been verified.
- The trip record's `tracking` object is introduced by this feature; existing records without tracking are treated as not started.
- Delay values may be fractional hours; the UI and persisted value retain numeric precision.
- An empty ID shows an input prompt; a non-empty ID with no matching record shows a not-found state.
- `templates/requirement.md` and `schemas/requirement.schema.yaml` were not found in the repository workspace, so schema validation could not be performed. Apply the repository schema when it becomes available.
