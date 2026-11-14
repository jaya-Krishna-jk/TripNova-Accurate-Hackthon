---
id: SEC-001
type: security-review
feature_id: FEAT-001
reviewer: security-reviewer
status: changes_requested
findings:
  - id: SEC-F-001
    severity: high
    title: Trip records are readable without authentication
    description: The reported unauthenticated GET of /userTrips/111.json returned tripId, userId, and itinerary. This confirms public read access for that record and exposes potentially sensitive travel plans and identifiers. The Angular trip flow does not sign in or otherwise attach a user identity, and trip IDs are user-supplied and likely discoverable/enumerable. Require authenticated, owner-scoped reads and remove any public ancestor read grant.
  - id: SEC-F-002
    severity: high
    title: Trip tracking writes are accepted without authentication
    description: The unguarded /mock-trip route successfully started trip 111 and a fresh Firebase read showed persisted tracking, without any Firebase Authentication call in the route or database service. This confirms anonymous write access to tracking for this record. The root transaction writes the full record, so deployed rules must also protect itinerary and unrelated fields.
---

# FEAT-001 Security Review

**Verdict: BLOCK**  
**Review status: changes_requested**  
**Feature:** Firebase trip tracking in the Angular Firebase web client  
**Date:** 2026-11-14

## Scope And Evidence

Reviewed the approved `FEAT-001` requirements, approved `ARCH-001` architecture, implementation plan, `.claude/skills/security/SKILL.md`, Angular trip service/component source and their unit tests, Firebase configuration, auth service, and routes. The plan remains `draft` and itself identifies deployed rules/authentication as an unverified release dependency.

An unauthenticated REST read of `/userTrips/111.json` returned `tripId`, `userId`, and itinerary data. The mock route then completed an unauthenticated Start transaction. Further actions were recorded from the open browser session; the latest read shows `tracking.status: in_progress`, `currentCheckpointIndex: 4`, `driftHrs: 3.3`, and current checkpoint `TTD Gardens`. The `0.3`-hour latest delay is attributed to its event checkpoint, and `3.0` earlier hours are recorded as unattributed. The itinerary remains present. Deployed RTDB rules were not inspected, so broader root-field write constraints remain unverified.

The current implementation diff was not available through the tools exposed for this review. Findings about implementation behavior are based on the workspace source and tests, not a verified diff. The required `templates/security-review.md` and `schemas/security-review.schema.yaml` are absent from the workspace; schema/template validation is therefore **blocked**. A dependency vulnerability audit was also not run, so dependency CVE status is unverified.

## Threat Model

- **Assets:** trip ownership identifiers, itinerary and travel schedule, persisted tracking state, and integrity of the trip record.
- **Actors:** the trip owner, unauthenticated internet clients, and an attacker able to guess or obtain a trip ID.
- **Trust boundary:** the Angular browser talks directly to Firebase Realtime Database. Firebase web configuration and client code are public; RTDB Security Rules and authenticated identity must enforce access.
- **Attack surfaces:** public REST/SDK reads at `/userTrips/{tripId}`, root-level RTDB transactions, user-controlled trip IDs, and client-supplied tracking commands.

## Findings

### High: Trip records are readable without authentication (verified)

The provided REST result confirms that at least `/userTrips/111` can be read anonymously. Its `userId` and activity schedule are exposed; travel itinerary and timing can reveal sensitive location and movement information. A supplied trip ID is not an authorization credential, and sequential or otherwise guessable IDs increase the chance of enumeration.

The client trims the ID and rejects Firebase-forbidden key characters, which prevents malformed child paths, but does not authenticate the caller or limit which valid trip IDs can be read. `FirebaseAuthService` exists, but the trip route/component and `RealtimeDatabaseService` do not use it. The Firebase API key and project identifiers in `firebase.config.ts` are public web-app configuration, not secrets, and do not provide authorization.

**Required remediation:** enable and require Firebase Authentication for the trip flow, then deploy RTDB rules that deny unauthenticated reads and allow a read only when the authenticated UID is authorized for that record. Ensure the stored ownership field is a trusted Firebase UID or is mapped server-side to one; the observed `userId` value must not be assumed to equal `auth.uid`. Remove broad `.read: true` grants at `/` or `/userTrips`, since RTDB grants cascade and narrower child rules cannot revoke an ancestor grant. If anonymous/share access is a product requirement, use an explicit, high-entropy, revocable capability with narrowly scoped rules instead of a guessable ID; that access model is not approved by the current requirements.

### High: Trip tracking writes are accepted without authentication (verified)

`updateTripTracking` performs a read and then a `runTransaction` at the trip root. The unguarded `/mock-trip` route successfully wrote tracking, and the trip route does not call Firebase Authentication. This confirms anonymous tracking writes are currently accepted. `applyTripTrackingAction` is client code and can be bypassed by a modified client or direct REST request. Because the transaction writes the root, deployed rules must prevent changes to `days`, ownership, and every unrelated field.

**Required remediation:** inspect and test the deployed rules, including effective ancestor grants. Require authenticated ownership on both `.read` and `.write`; for the root transaction, validate that the new record exists, ownership and itinerary/unrelated fields are unchanged, and only the permitted `tracking` shape/state transition is changed. Validate tracking types, allowed status/event values, checkpoint bounds, non-negative finite delay, and completion invariants in rules as far as practicable. If those invariants cannot be robustly enforced in RTDB rules, move mutations to a trusted backend/Cloud Function and deny direct client root writes. Verify both allowed owner operations and denied unauthenticated/non-owner/field-tampering operations using the Firebase Emulator and intended deployed rules. Do not loosen rules to make the transaction pass.

Public tracking write access is **verified** by the successful Start action. Arbitrary writes to other trip fields were not attempted; their protection remains unverified. This is a release-blocking security finding.

## Security Controls And Gaps

- **Trip ID validation:** IDs are trimmed, empty IDs rejected, and `.`, `#`, `$`, `[`, `]`, `/`, and ASCII control characters are rejected before lookup. This is appropriate RTDB key validation, not access control; no owner authorization or enumeration defense follows from it.
- **Replay and stale commands:** the service creates an event ID once outside the transaction callback, checks equality with the current `lastEvent.id`, and compares expected status/checkpoint index against the transaction snapshot. These are useful duplicate/retry and concurrency controls. The duplicate check retains only the latest event ID and is not durable replay protection; more importantly, an attacker can bypass these checks with direct writes unless rules enforce the corresponding invariants. The event ID is not an authentication token.
- **Stored user data:** the exposed record includes `userId` and `days[].activities[]`; these values were returned by the reported anonymous read. Access should be denied by default and scoped to the record owner. Avoid logging full trip payloads.
- **Firebase configuration:** the embedded web API key, app ID, project ID, and database URL are expected to be visible to browser users and are not server credentials. Restrict the API key to the required Firebase APIs and expected application origins where supported, but do not treat that as a substitute for RTDB rules or Firebase Auth.
- **Existing demo login:** a separate demo-user path in `RealtimeDatabaseService` stores a client-computed unsalted SHA-256 password hash and checks it client-side. It is not Firebase Authentication and is not wired into the trip route; it must not be treated as authorization for trips. Its deployed data access was not assessed because the relevant rules were unavailable.
- **Injection/XSS:** the reviewed component renders trip values through Angular interpolation; no direct HTML insertion or SQL surface was identified in this flow.
- **Tests:** unit tests cover forbidden ID characters, stale expected checkpoint, duplicate current event ID, field preservation, and a root transaction call. They do not prove deployed authorization, rule enforcement, anonymous denial, non-owner denial, or transaction behavior against representative RTDB rules. The architecture calls for Emulator/rules integration coverage, which remains outstanding.

## Required Gate Before Approval

1. Deny anonymous reads and writes in the deployed RTDB rules; bind access to authenticated, trusted ownership.
2. Constrain the root transaction so that a caller cannot change itinerary, ownership, or unrelated fields; use a trusted backend if rules cannot safely enforce the transition policy.
3. Run Emulator tests for owner success, anonymous and non-owner denial, illegal tracking transitions, and attempted changes to non-tracking fields; then verify the intended deployed rules and representative record.
4. Provide the implementation diff for independent review and run the project's dependency audit.
5. Obtain the missing review template/schema and validate this report. Validation is blocked until those files are available.

Until these gates pass, the feature is not security-approved for rollout.
