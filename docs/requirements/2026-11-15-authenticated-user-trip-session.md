---
id: FEAT-003
type: requirement
version: 1
status: approved
goal: Gate application pages on the logged-in user session, save trip ownership, and show only that user's active trip.
acceptance_criteria:
  - id: AC-01
    description: "Given a browser opens any application page, when no valid session exists in localStorage or sessionStorage, then it is redirected to /login."
    verification: "Clear both storage areas, load / and /mock-trip, and verify redirect to /login."
  - id: AC-02
    description: "Given a user signs in or registers successfully, when credentials are accepted, then the app persists the user ID and profile name and navigates to the protected landing page."
    verification: "Sign in and register, then verify the persisted session fields and landing-page navigation."
  - id: AC-03
    description: "Given a logged-in user books a trip, when the trip record is saved, then its root-level userId matches the session user's ID."
    verification: "Book a trip and inspect `/userTrips/{tripId}/userId`."
  - id: AC-04
    description: "Given the landing page loads, when Firebase returns trips matching the current session user ID, then only that user's active or planned trip is displayed; completed and other users' trips are not displayed."
    verification: "Use records for multiple users and lifecycle states; verify only a matching user's non-completed trip is selected."
  - id: AC-05
    description: "Given a user is logged in, when a profile name is displayed, then it is taken from the persisted session profile."
    verification: "Sign in as users with different names and verify the profile name changes."
  - id: AC-06
    description: "Given a logged-in user chooses Log Out, when logout completes, then localStorage and sessionStorage session data are removed and the browser navigates to /login."
    verification: "Log out and verify both storage entries are absent and /login is displayed."
---

# Authenticated User Trip Session

## User Story
As a TripNova user, I want my session and trips associated with my account, so that the application opens only for me and shows my own active trip.

## Scope
Use the existing demo registration/login flow as the source of a stable user ID (the normalized username key). Persist the accepted user ID, username, and display name in browser storage, protect application routes, attach the current user ID when creating trips, and query Firebase for trips matching that ID. Display the most recently created non-completed trip as the user's current trip. Logout removes session values from both local and session storage.

This requirement supersedes the fixed `jk` owner and fixed `TN-3UP9HH` selection described by FEAT-002 for the landing page. Existing trip tracking behavior and itinerary projection remain unchanged.

## Security Limitation
Browser storage and a client-side `userId` query are application behavior, not an authorization boundary. The existing demo login stores password hashes in Realtime Database and does not establish a Firebase Authentication identity. Production use remains blocked until Firebase Authentication and owner-scoped Realtime Database rules enforce reads and writes independently of client code. Do not claim that local storage authenticates Firebase requests.
