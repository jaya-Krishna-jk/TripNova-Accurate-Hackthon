---
id: FEAT-003
type: requirement
version: 1
status: draft
goal: Allow an authorized API consumer to retrieve CriminalRecords entries from the Firebase Realtime Database that match a supplied drivingLicenseNo.
---

# FEAT-003 — Lookup criminal records by driving license number

## Status and context

**Status: draft.** Product and security decisions listed below are unresolved, and there is no evidence of the required approvals. The repository does not contain `templates/requirement.md` or `schemas/requirement.schema.yaml`, so this document could not be validated against that schema.

The request describes connecting the backend to a Firebase Realtime Database project and looking up records under the root `CriminalRecords` node by `drivingLicenseNo`. The supplied Firebase web-app configuration is public client configuration, not a server credential. The database screenshot identifies `CriminalRecords` as a root node. Two example record shapes were supplied as data references; this requirement does not infer extra fields or impose a unified record schema from them.

Repository inspection found that the running backend in `smart-travel-backend/` is **FastAPI**, with current unprefixed routes such as `/travel/validate` and `/travel/chat`. Although `CLAUDE.md` describes Django/DRF and `/api/` routes, that description does not match the backend files. This discrepancy must be resolved before implementation.

## User and need

**Provisional user:** an authorized client of the TripNova backend (the specific consumer and authorization model have not been identified).

**User story:** As an authorized API consumer, I want to submit a driving license number and retrieve the matching CriminalRecords entry or entries, so that the calling workflow can determine whether a corresponding record exists.

## Scope and desired behaviour

- Accept a lookup value named `drivingLicenseNo`.
- Read from the Firebase Realtime Database root node `CriminalRecords`.
- Return only records whose `drivingLicenseNo` matches the supplied value, subject to the matching rules and response contract that remain to be decided.
- Perform a read-only lookup; this feature does not create, update, or delete database records.
- Access must be appropriately authorized for sensitive criminal-record data. The endpoint must not be made publicly accessible by default without an explicit, approved access policy.
- Server-side access must use an approved, server-appropriate credential/access mechanism. Do not treat the public Firebase web-app config as a server secret or embed private credentials in source code, client bundles, documentation, or logs.

## Acceptance criteria

| ID | Description | Verification |
|---|---|---|
| AC-001 | An API lookup accepts a `drivingLicenseNo` value and reads records only from the Firebase Realtime Database root node `CriminalRecords`. | Automated API/integration test with a Firebase test fixture containing records in `CriminalRecords` and an unrelated root node; verify the unrelated node is not queried or returned. |
| AC-002 | The lookup result contains only record(s) whose `drivingLicenseNo` matches the submitted value under the approved matching rule; records with non-matching values are excluded. | Automated test with matching and non-matching fixtures, including the approved case/whitespace rules. This criterion is not fully verifiable until those rules are approved. |
| AC-003 | The lookup does not mutate Firebase data. | Integration test captures the relevant fixture before and after a lookup and verifies it is unchanged. |
| AC-004 | Requests and responses follow the approved API path, input-validation, cardinality, and response/error contract, including defined behaviour for no match, invalid input, and Firebase unavailability. | Contract/API tests against the approved contract. **Blocked:** these contract decisions are unresolved. |
| AC-005 | Only callers permitted by the approved access policy can retrieve criminal-record data; unauthorized requests do not receive record contents. | Security/API tests for each approved authorization outcome, including unauthenticated and unauthorized callers. **Blocked:** caller identity and access policy are unresolved. |
| AC-006 | Firebase server access uses the approved server-side access mechanism; no private credential is exposed in repository files, client-delivered assets, API responses, or application logs. | Configuration/security review and automated secret scanning; verify an unauthorized or unconfigured Firebase connection fails without exposing credential material. **Blocked:** credential mechanism and deployment owner are unresolved. |

## Edge cases to define and test

- No matching record exists.
- More than one record has the same matching license number.
- The submitted value is missing, empty, malformed, or differs only by letter case or surrounding whitespace.
- A database record has no `drivingLicenseNo`, has a null value, or uses a type inconsistent with the submitted value.
- Firebase is unavailable, denies access, or returns malformed/unexpected data.
- The API caller is unauthenticated or lacks permission to access criminal-record data.
- Database records may differ in shape as shown by the supplied examples; do not assume fields beyond those needed for the lookup until the record contract is confirmed.

## Dependencies and constraints

- The Firebase project, database URL, and `CriminalRecords` data must be available to the backend under an approved access policy.
- Firebase web-app configuration alone does not provide authorized server-side access. An approved server credential/access arrangement and deployment process are required.
- Backend framework direction must be confirmed: current code is FastAPI, while project guidance and the request refer to Django/DRF.
- Route prefix conventions conflict: repository guidance says `/api/`, while existing FastAPI routes are unprefixed. No new route path is prescribed here.
- The supplied sample records and screenshot are references for the source data; do not copy credentials or real record contents into this requirement.

## Non-goals

- Creating or editing CriminalRecords entries.
- Changing the Firebase login/profile behaviour in the frontend.
- Defining a new criminal-record data model or transforming fields not needed for this lookup.
- Migrating the backend framework or changing unrelated API routes.
- Returning, exposing, or logging Firebase credentials.

## Unresolved questions / decisions required

1. **Backend framework:** Should this feature be added to the existing FastAPI service, or is a Django/DRF backend intended but absent from the repository?
2. **Endpoint contract:** What exact path, HTTP method, request location/shape, and response shape should clients use? Should the path follow `/api/` despite current routes being unprefixed?
3. **Result cardinality:** Can a license number match multiple records? Should the API return a collection, one record, or a conflict/error when duplicates exist?
4. **No-match and errors:** What status/body should represent no matches, invalid input, Firebase access denial, and temporary Firebase failures?
5. **Matching and validation:** Is matching exact and case-sensitive? Should leading/trailing whitespace be preserved or normalized? What format and maximum length are valid?
6. **Authorization and data handling:** Which callers may access these sensitive records, how are they authenticated/authorized, and are there response minimization, audit, retention, or rate-limit requirements?
7. **Server credential model:** Which approved mechanism should the deployment use (for example, a restricted service identity or another Firebase-supported server-side mechanism), who provisions/rotates it, and how is it delivered to each environment? The public web-app config is not an answer to this decision.
8. **Operational expectations:** Are there response-time, availability, pagination, or result-size requirements?
9. **Approvals:** Who owns the product/API contract and who approves security and Firebase access for this data?

## Assumptions

- `CriminalRecords` is the exact root-level Realtime Database node name, as shown in the supplied screenshot.
- `drivingLicenseNo` is the source field to use for matching, as identified in the request and supplied example shapes.
- The example shapes do not constitute approval of a single normalized schema or of a match cardinality.
- No production credential, authorization policy, endpoint contract, or approval is evidenced in the repository materials inspected; status therefore remains `draft`.
