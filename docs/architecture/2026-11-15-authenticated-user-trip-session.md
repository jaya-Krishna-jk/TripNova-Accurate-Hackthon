---
id: ARCH-003
type: architecture
feature_id: FEAT-003
version: 1
status: approved
proposed_solution: >-
  Add a browser-backed session service and route guards, derive stable user IDs
  from normalized usernames, stamp trip creation with the current user ID, and
  subscribe to the Realtime Database query filtered by that ID.
components:
  - id: COMP-01
    name: User session service and guards
    responsibility: Restore and persist the accepted profile in browser storage, protect application routes, and provide logout.
  - id: COMP-02
    name: RealtimeDatabaseService
    responsibility: Attach userId to newly created trips and subscribe only to records matching the session userId.
  - id: COMP-03
    name: PlanTripPage and DashboardShell
    responsibility: Project the current user's active trip and display their session profile.
---

# Authenticated User Trip Session Architecture

## Context
FEAT-003 explicitly replaces FEAT-002's fixed `jk` and `TN-3UP9HH` landing-page selection. The existing database login is a development/demo account system; this design does not represent it as Firebase Authentication.

## Design
- `UserSessionService` owns a validated `{ userId, username, name }` browser session, restores localStorage first and sessionStorage second, writes the active session to localStorage, and removes it from both stores on logout.
- Functional route guards allow application routes only when a valid session exists, redirect unauthenticated users to `/login`, and redirect signed-in users away from `/login`.
- The existing normalized username database key is the stable user ID, maintaining compatibility with existing sample ownership values such as `jk`.
- `createTrip` requires a current session and writes its `userId` after spreading the trip payload so caller data cannot override ownership.
- The home listener uses Realtime Database `orderByChild('userId')` and `equalTo(userId)` on `/userTrips`; the page rechecks ownership, ignores completed trips, and selects the newest eligible record. It never listens to all userTrips records without an owner filter.
- The dashboard profile and logout action read from the same session service.

## Security and Failure Boundaries
The client-side query and userId field are not authorization. Production remains blocked on Firebase Authentication and owner-scoped Realtime Database rules, including query-compatible rules/indexing. Storage parsing rejects malformed sessions and routes to login. Firebase query errors continue to use the page's explicit error state.

## Compatibility
The itinerary display and trip tracking service remain unchanged. Existing trips with userId values matching the normalized username can appear; trips without userId do not. New booked trips always include userId.
