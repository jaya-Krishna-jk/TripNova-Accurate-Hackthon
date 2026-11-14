---
id: SEC-002
type: security-review
feature_id: FEAT-002
reviewer: security-reviewer
status: blocked
findings:
  - id: SEC-F-003
    severity: high
    title: Client-side owner check does not authorize access to the trip
    description: >-
      The home route subscribes directly to the fixed Firebase trip without
      Firebase Authentication. Comparing the returned userId with the
      hardcoded string jk is only a client-side display filter; it is not an
      access-control boundary. SEC-001 verified an unauthenticated read of
      /userTrips/111, and the exact target trip has been reported readable but
      its effective anonymous permissions were not verified. Thus the target
      trip's confidentiality remains unresolved, and if the deployed rules
      grant access at an ancestor or at this child, any visitor can retrieve
      its itinerary regardless of this UI check.
  - id: SEC-F-004
    severity: high
    title: Development-only restriction is documentation, not a runtime or deployment guard
    description: >-
      The requirement blocks production use until authentication and
      owner-scoped permissions are tested, but the root route unconditionally
      loads PlanTripPage and its browser initialization unconditionally starts
      the database listener. No environment check, feature flag, route guard,
      or enforced deployment gate was found. A production build/deployment
      therefore runs the same hardcoded trip subscription unless an external
      process prevents it.
  - id: SEC-F-005
    severity: medium
    title: Connection loss can leave the last snapshot displayed without a freshness indication
    description: >-
      Explicit Firebase listener errors stop the listener and switch the page
      to an error state, correctly removing the previous card. However, the
      implementation does not observe RTDB connection state or record
      snapshot freshness. A transient offline/disconnected client may continue
      displaying its last in-memory snapshot without invoking the listener
      error callback, so the view cannot distinguish current data from stale
      data. The focused tests exercise an explicit error only, not a silent
      disconnect/reconnect.
---

# FEAT-002 Security Review

**Verdict: BLOCK — production use is not approved.**  
**Review status: blocked**  
**Feature:** Traveler Home live trip  
**Review date:** 2026-11-14  
**Production-blocking:** **Yes.** Findings SEC-F-003 and SEC-F-004 are
high-severity blockers. The target record's effective deployed read rules and
non-sensitive development environment were not verified.

## Scope and evidence

Reviewed the FEAT-002 requirement, ARCH-002 architecture, PLAN-002
implementation plan, FEAT-001 security review SEC-001, FEAT-002 testing report,
and current Angular source for the home page, Firebase database service,
Firebase authentication service, Firebase config, and application routes.
The current source subscribes only to the exact child
`userTrips/TN-3UP9HH`; it does not enumerate `/userTrips` or write Firebase
data from the home-page feature.

SEC-001 reports a successful unauthenticated REST read of
`/userTrips/111.json`, including ownership and itinerary data, and a successful
unauthenticated tracking write for that record. It explicitly says deployed
rules were not inspected. This review does **not** claim anonymous access to
`TN-3UP9HH` was independently demonstrated: the exact child's effective
permissions remain unknown. FEAT-002 requirement assumptions report a direct
read of `TN-3UP9HH` worked but do not establish whether that read was
authenticated.

The security-review template and `schemas/security-review.schema.yaml` are
absent from the workspace. The artifact follows the existing SEC-001 review
structure and includes the required metadata and finding fields, but formal
schema validation could not be performed. The implementation diff was not
available through the review tools; code evidence below is from the current
workspace source. No Firebase rules were changed or tested, and no Firebase
data was accessed for this review.

## Threat model

- **Assets:** traveler identity/ownership, trip ID, itinerary and planned
  locations/times, tracking state, and confidence that the displayed trip is
  current.
- **Actors:** the intended traveler, any unauthenticated visitor to the public
  home route, and a client able to inspect or modify browser code or call the
  Firebase endpoint directly.
- **Trust boundary:** the browser client communicates directly with Firebase
  Realtime Database. The Firebase web configuration, fixed trip ID, fixed
  username, and JavaScript checks are visible and modifiable by clients.
  Authentication and deployed Realtime Database rules must enforce access.
- **Attack surfaces:** the unauthenticated `/` route, exact-child Firebase
  listener, stored `userId` display check, and Firebase listener lifecycle.
- **Primary threats:** unauthorized disclosure of itinerary/location data;
  treating a fixed demo username as proof of owner identity; accidental
  production exposure of a development prototype; and stale trip information
  appearing current after a silent connection loss.

## Findings

### High — SEC-F-003: Client-side owner check does not authorize access to the trip

**Confidence:** High that the client has no authentication/authorization
enforcement; medium that the target child is anonymously readable because its
effective deployed rules were not inspected.

**Evidence:**

- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts:52-53`
  hardcodes `TRIP_ID = 'TN-3UP9HH'` and `OWNER_ID = 'jk'`.
- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts:150-155`
  starts the listener and sends every snapshot to the page projection;
  `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts:181-182`
  checks the returned record's `userId` against the constant `jk`.
- `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts:359-385`
  attaches a direct `onValue` listener to the fixed child. The service does
  not require or check Firebase Auth.
- `Frontend/TripNova-angular-app/src/app/app.routes.ts:6-12` maps the root
  route to the traveler page without an authentication guard.
- `FirebaseAuthService` has sign-in methods, but the reviewed page, route, and
  database subscription do not use them.
- `docs/reviews/FEAT-001-security-review.md:29-48` records the successful
  anonymous read of `/userTrips/111.json` and requires authentication and
  owner-scoped rules. That evidence is for record `111`, not proof of the
  target record's current deployed permissions.

**Risk:** `userId === 'jk'` only suppresses rendering when a fetched record
does not match. It cannot stop a caller from reading the child directly or
changing the client check. Trip IDs and usernames are not credentials; the
fixed values are delivered in the frontend bundle. If the deployed rules
permit anonymous reads for this record (or an ancestor grant covers it), any
visitor or direct REST/SDK caller can obtain itinerary, schedule, and location
data. Those details can reveal a traveler's movements and plans. If rules
deny anonymous reads, the listener will fail, but that protection has not
been established for the exact target.

**Required remediation:** before any sensitive or production use, establish
Firebase Authentication for the traveler and enforce record-owner access in
deployed Realtime Database rules using a trusted authenticated UID (or a
server-side mapping), not the demo string `jk`. Inspect effective ancestor
rules and remove broad grants; verify anonymous and non-owner reads fail and
owner reads succeed against the intended rules/emulator and deployed
development environment. Do not treat the page's ownership comparison,
hardcoded ID, or public Firebase client configuration as authorization. Until
the exact child's rule behavior is verified, use only a confirmed
non-sensitive development project and data.

### High — SEC-F-004: Development-only restriction is documentation, not a runtime or deployment guard

**Confidence:** High.

**Evidence:**

- `docs/requirements/2026-11-14-traveler-home-live-trip.md:52,84` calls this a
  development prototype and blocks production use pending authentication and
  owner-scoped permissions.
- `Frontend/TripNova-angular-app/src/app/app.routes.ts:6-12` always registers
  the home page at `/`.
- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts:134-137`
  starts the listener on browser initialization, and `:144-155` invokes the
  Firebase subscription without an environment or readiness check.
- `Frontend/TripNova-angular-app/src/environments/environment.prod.ts:6`
  sets `production: true`, but the reviewed page does not read the environment
  value to disable or guard the trip feature.
- `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts:373-375`
  constructs the exact Firebase reference and starts `onValue`.

**Risk:** the documented release gate does not prevent a production bundle
from querying Firebase. If a deployment pipeline or Firebase rules permit
access, the prototype and its hardcoded traveler data can be exposed in a
production context. No such external release control was evidenced in the
reviewed workspace, so it cannot be relied on here.

**Required remediation:** enforce the development-only boundary in the
deployment pipeline and application configuration. Keep the feature disabled
by default outside an explicitly approved non-sensitive development
environment, and fail closed if the environment is not explicitly enabled.
Before enabling it in production, close SEC-F-003 and verify authentication,
owner-scoped rules, and traveler/admin permissions as required by FEAT-002.
Documentation alone is not a production gate.

### Medium — SEC-F-005: Connection loss can leave the last snapshot displayed without a freshness indication

**Confidence:** Medium. Explicit error handling was confirmed; silent
disconnect behavior was not exercised in the available tests.

**Evidence:**

- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts:150-162`
  sets the page to an error state on an explicit listener error, replacing the
  prior live state.
- `Frontend/TripNova-angular-app/src/app/realtime-database.service.ts:373-385`
  handles listener callbacks and
  errors, but does not subscribe to RTDB connection state or expose a
  last-snapshot/connection indicator.
- `docs/reviews/FEAT-002-testing.md` says tests cover an error after a valid
  snapshot and clear the card; it does not demonstrate a network disconnect
  that does not invoke the error callback.
- `docs/architecture/2026-11-14-traveler-home-live-trip.md` says the screen
  should make clear when it has received a current snapshot and must not imply
  data is live after an error.

**Risk:** a previously received itinerary/status may remain visible during a
temporary disconnect without the user being told that updates are unavailable.
This is a freshness/integrity-of-presentation issue, not evidence that the
service ignores explicit permission errors; those errors stop the listener and
clear the card.

**Required remediation:** expose Firebase connection/freshness state or another
reliable mechanism that makes a disconnected/stale snapshot visibly
unavailable, and restore the live indication only after a fresh server
snapshot. Add integration coverage for disconnect/reconnect and confirm the
view does not claim freshness while disconnected.

## Controls that worked as reviewed

- The service path is fixed to `userTrips/TN-3UP9HH`; no collection query or
  fallback lookup was found.
- The home-page subscription is read-only and has a teardown handle. The
  service stops forwarding callbacks after unsubscribe and stops the listener
  on an explicit Firebase error.
- The page clears the displayed card on an explicit listener error. The tested
  owner comparison happens before projecting trip fields, and Angular
  interpolation is used for displayed values.
- The FEAT-002 testing report states that focused service/page tests passed
  before final assertion-only refinements, but the final focused specs were not
  rerun and the full frontend suite failed 2 of 40 tests. Those test results
  do not prove deployed Firebase authorization.

## Verdict and release gate

**Status: blocked. Production use is explicitly blocked.** Do not connect this
feature to production or sensitive traveler records until SEC-F-003 and
SEC-F-004 are remediated and the exact target's effective Firebase permissions
are verified. SEC-F-005 should also be addressed to meet the freshness
expectation. Do not broaden Firebase access to make the listener work.
