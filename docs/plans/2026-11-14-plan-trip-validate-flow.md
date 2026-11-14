---
id: PLAN-002
type: plan
feature_id: FEAT-002
architecture_id: ARCH-001
version: 1
status: ready
title: Prompt validation flow with trip-details form page
owner: planner
created: 2026-11-14
---

# PLAN-002 — Prompt validation flow with trip-details form page

## Scope

Wire the existing "Generate My Trip" button on the plan-trip page to first call
`POST /travel/validate`, then either navigate to a new **trip-details** page
(when the prompt is incomplete) or call `POST /travel/chat` directly (when
complete). The trip-details page shows an AI extraction diagnostic, a pre-filled
form for missing parameters, and a "Validate & Generate Itinerary" CTA that
calls `/travel/chat` with a fully-structured `TravelRequest`.

The trip-details page design follows the Stitch screen "AuraVoyage - Travel
Preferences & AI Calibration" from the project "Remix of Remix of AI Travel
Planner Dashboard".

### Important backend observation

`POST /travel/chat` expects a `TravelRequest` body (source, destination,
startDate, endDate, travellerCount, travellerType, budget, mealPreference,
childrenCount, seniorCitizenCount, preferences, hotelPreference) — **not** the
`{ message }` payload the frontend currently sends. This plan corrects that
mismatch as part of the refactor.

### Out of scope

- Backend changes (all endpoints exist and are working)
- Rendering or parsing the `/travel/chat` response (itinerary display)
- Authentication / guards on the new route

> Note: FEAT-002 / ARCH-001 IDs are forward-references so the plan validates
> against the planner schema; the user instruction from 2026-11-14 is the
> approved requirement.

---

## Tasks

| ID       | Title                                                         | Owner             | Deps              | Est | Status |
|----------|---------------------------------------------------------------|-------------------|-------------------|-----|--------|
| TASK-011 | Add model interfaces to `travel.models.ts`                    | frontend-engineer | --                | S   | open   |
| TASK-012 | Add `validate()` method to `TravelApiService`                 | frontend-engineer | TASK-011          | S   | open   |
| TASK-013 | Refactor `TravelApiService.chat()` to accept `TravelRequest`  | frontend-engineer | TASK-011          | S   | open   |
| TASK-014 | Create shared validation-state signal service                 | frontend-engineer | TASK-011          | S   | open   |
| TASK-015 | Modify `PlanTripPage.generateTrip()` for validate-first flow | frontend-engineer | TASK-012, TASK-014 | M  | open   |
| TASK-016 | Create `TripDetailsPage` component (TypeScript logic)         | frontend-engineer | TASK-013, TASK-014 | M  | open   |
| TASK-017 | Create `trip-details-page.html` template (Stitch design port) | frontend-engineer | TASK-016          | L   | open   |
| TASK-018 | Register `/trip-details` route in `app.routes.ts`             | frontend-engineer | TASK-016          | S   | open   |
| TASK-019 | Unit tests for new and modified code                          | test-engineer     | TASK-015, TASK-017, TASK-018 | M | open |
| TASK-020 | Verify `ng build` and `ng test` pass                          | test-engineer     | TASK-018, TASK-019 | S  | open   |

---

## Task details

### TASK-011 — Add model interfaces to `travel.models.ts`

**Goal**: Define TypeScript interfaces that mirror the backend Pydantic models
so all API calls are properly typed.

**Rationale**: The file currently only has `ChatRequest`. The validate flow
requires `ValidationResponse`, `ExtractedData`, and `TravelRequest` interfaces
to type-check the full round-trip.

**Dependencies**: None.

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/core/models/travel.models.ts`

**Implementation notes**:
- `ExtractedData` — optional fields matching the ten extractable parameters:
  `source`, `destination`, `startDate`, `endDate`, `travellerCount`,
  `travellerType`, `budget`, `mealPreference`, `childrenCount`,
  `seniorCitizenCount`. All typed as `string | number | null` to match the
  backend's nullable JSON response.
- `ValidationResponse` — `{ isValid: boolean; missingFields: string[];
  extractedData: ExtractedData }`.
- `TravelRequest` — required fields matching the backend `TravelRequest`
  Pydantic model: `source: string`, `destination: string`, `startDate: string`,
  `endDate: string`, `travellerCount: number`, `travellerType: string`,
  `budget: number`, `mealPreference: string`, `childrenCount: number`,
  `seniorCitizenCount: number`, `preferences: string[]`,
  `hotelPreference: string`.
- Keep the existing `ChatRequest` interface (still used by the validate
  endpoint).

**Acceptance criteria**:
- All three new interfaces are exported.
- `TravelRequest` fields exactly match the backend model field names and types.
- Existing `ChatRequest` export is preserved; no import breakage.

**Testing requirements**: Compile-time check (no runtime tests needed for
interfaces).

**Risk**: Low. Pure additive change with no runtime behavior.

---

### TASK-012 — Add `validate()` method to `TravelApiService`

**Goal**: Expose a typed method that calls `POST /travel/validate` with a
free-text message and returns `Observable<ValidationResponse>`.

**Rationale**: The plan-trip page needs to call the validation endpoint before
deciding whether to navigate or chat directly.

**Dependencies**: TASK-011 (needs `ChatRequest`, `ValidationResponse`).

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/core/services/travel-api.service.ts`

**Implementation notes**:
```
validate(message: string): Observable<ValidationResponse> {
  const body: ChatRequest = { message: message.trim() };
  return this.http.post<ValidationResponse>(`${this.baseUrl}/travel/validate`, body);
}
```
- Import `ValidationResponse` and `ChatRequest` from `travel.models`.

**Acceptance criteria**:
- `validate()` sends a POST to `{apiBaseUrl}/travel/validate` with body
  `{ message: "<trimmed input>" }`.
- Return type is `Observable<ValidationResponse>`.
- The method trims whitespace from the input, matching the existing `chat()`
  convention.

**Testing requirements**: Covered in TASK-019.

**Risk**: Low. Simple HTTP wrapper.

---

### TASK-013 — Refactor `TravelApiService.chat()` to accept `TravelRequest`

**Goal**: Change `chat()` to accept a `TravelRequest` object instead of a plain
message string, matching the backend endpoint's actual contract.

**Rationale**: The backend `POST /travel/chat` expects a `TravelRequest` body
(structured fields), not `{ message }`. The current implementation silently
produces 422 responses from the backend. This refactor aligns the frontend with
the real API contract.

**Dependencies**: TASK-011 (needs `TravelRequest` interface).

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/core/services/travel-api.service.ts`

**Implementation notes**:
- Change signature: `chat(request: TravelRequest): Observable<unknown>`.
- Body becomes the request object directly:
  `return this.http.post<unknown>(\`${this.baseUrl}/travel/chat\`, request);`
- Remove the `ChatRequest` import if no longer needed in this file (it may
  still be used by `validate()`).

**Acceptance criteria**:
- `chat()` accepts a `TravelRequest` and posts it as the body.
- No references to `{ message }` remain in `chat()`.
- `validate()` still works with `ChatRequest`.

**Testing requirements**: Existing `chat()` spec must be updated (TASK-019).

**Risk**: Medium. This is a breaking change to the `chat()` call signature.
All existing callers (`PlanTripPage.generateTrip()`) must be updated in
TASK-015 at the same time or immediately after.

---

### TASK-014 — Create shared validation-state signal service

**Goal**: Create a lightweight injectable service that holds the latest
`ValidationResponse` and the original prompt text in Angular signals, so data
can be passed from the plan-trip page to the trip-details page without complex
router state serialization.

**Rationale**: Router state / navigation extras are lost on page refresh and
are cumbersome for complex objects. A singleton signal service is the idiomatic
Angular 22 approach for cross-route state.

**Dependencies**: TASK-011 (needs `ValidationResponse`).

**Affected files** (new):
- `Frontend/TripNova-angular-app/src/app/core/services/validation-state.service.ts`

**Implementation notes**:
- `@Injectable({ providedIn: 'root' })` standalone service.
- Signals: `validationResponse = signal<ValidationResponse | null>(null)`,
  `originalPrompt = signal<string>('')`.
- Methods: `set(response: ValidationResponse, prompt: string)` and `clear()`.
- The trip-details page reads these signals; the plan-trip page writes to them
  before navigating.

**Acceptance criteria**:
- Service is injectable app-wide (`providedIn: 'root'`).
- `set()` stores both the validation response and the original prompt.
- `clear()` resets both signals to their defaults.
- Signals are readable from any component via `inject()`.

**Testing requirements**: Covered in TASK-019.

**Risk**: Low. Stateless outside of a single user flow; no persistence needed.

---

### TASK-015 — Modify `PlanTripPage.generateTrip()` for validate-first flow

**Goal**: Change the "Generate My Trip" button handler to call
`POST /travel/validate` first, then branch:
- `isValid === false` -> store response in validation-state service, navigate
  to `/trip-details`.
- `isValid === true` -> build a `TravelRequest` from `extractedData`, call
  `POST /travel/chat` directly.

**Rationale**: This is the core flow change described in the requirements.

**Dependencies**: TASK-012 (validate method), TASK-014 (state service).
Also implicitly depends on TASK-013 since `chat()` signature changes, but
both callers (here and trip-details) will be coded against the new signature.

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.ts`

**Implementation notes**:
- Inject `Router` and `ValidationStateService` alongside `TravelApiService`.
- In `generateTrip()`:
  1. Call `firstValueFrom(this.travelApi.validate(message))`.
  2. If `response.isValid === false`:
     - `this.validationState.set(response, message)`.
     - `this.router.navigate(['/trip-details'])`.
     - Set status to `'idle'` (not success, since we navigated away).
  3. If `response.isValid === true`:
     - Build a `TravelRequest` from `response.extractedData` with sensible
       defaults for any null optional fields (`childrenCount: 0`,
       `seniorCitizenCount: 0`, `preferences: []`, `hotelPreference: 'any'`).
     - Call `firstValueFrom(this.travelApi.chat(travelRequest))`.
     - Set status to `'success'`.
- Error handling stays the same (catch -> error message -> error status).

**Acceptance criteria**:
- Clicking "Generate My Trip" first hits `/travel/validate`.
- When validation says `isValid: false`, the app navigates to `/trip-details`
  and the validation state service holds the response.
- When validation says `isValid: true`, the app calls `/travel/chat` with a
  proper `TravelRequest` body and shows the success state.
- Loading spinner shows during the entire async operation.
- Error state still shows on HTTP failures.

**Testing requirements**: Covered in TASK-019.

**Risk**: Medium. Must coordinate with TASK-013's chat() signature change. Both
tasks should be implemented in the same session to avoid a broken intermediate
state.

---

### TASK-016 — Create `TripDetailsPage` component (TypeScript logic)

**Goal**: Create the standalone component class for the trip-details page with
all form state, computed signals, and the submit handler that calls
`POST /travel/chat`.

**Rationale**: Separating the component logic from the template makes each
piece independently reviewable and testable.

**Dependencies**: TASK-013 (needs updated `chat()` accepting `TravelRequest`),
TASK-014 (needs validation-state service to read extracted data).

**Affected files** (new):
- `Frontend/TripNova-angular-app/src/app/features/trip-details/trip-details-page.ts`

**Implementation notes**:
- Standalone component: `@Component({ selector: 'app-trip-details-page', imports: [ReactiveFormsModule], templateUrl: './trip-details-page.html' })`.
- Inject `ValidationStateService`, `TravelApiService`, `Router`.
- On init, read `validationState.validationResponse()`. If null (direct
  navigation without prior validation), redirect back to `/`.
- Build a reactive form (`FormGroup`) with controls for all `TravelRequest`
  fields, pre-filled from `extractedData`. Mark controls that correspond to
  `missingFields` as required + visually highlighted.
- Computed signals:
  - `detectedParams` — list of field names that have values in `extractedData`.
  - `missingParams` — list of field names in `missingFields`.
  - `parameterCards` — array of 6 card objects for the diagnostic grid (each
    with label, icon, status: 'detected' | 'missing', value).
  - `progressStep` — set to step 2 ("Missing Parameters Required") when there
    are missing fields.
- `submitForm()` — validates the form, builds a `TravelRequest`, calls
  `this.travelApi.chat(request)`, handles loading/error/success states.
- `editPrompt()` — navigates back to `/` (the plan-trip page).
- Request status signals: `status`, `errorMessage`, `isLoading` (same pattern
  as `PlanTripPage`).

**Acceptance criteria**:
- Component creates without errors when validation state is populated.
- Redirects to `/` when accessed without validation state.
- Form is pre-filled with extracted data from the validation response.
- Missing fields are marked required in the form model.
- `submitForm()` posts a valid `TravelRequest` to `/travel/chat`.
- `editPrompt()` navigates back to `/`.

**Testing requirements**: Covered in TASK-019.

**Risk**: Medium. This is the largest logic component. Form field mapping must
exactly match the backend `TravelRequest` model.

---

### TASK-017 — Create `trip-details-page.html` template (Stitch design port)

**Goal**: Build the HTML template for the trip-details page following the Stitch
design "AuraVoyage - Travel Preferences & AI Calibration".

**Rationale**: This is the user-facing UI that shows the AI validation
diagnostic and the parameter form.

**Dependencies**: TASK-016 (template binds to component signals and form).

**Affected files** (new):
- `Frontend/TripNova-angular-app/src/app/features/trip-details/trip-details-page.html`

**Implementation notes**:

Layout (top to bottom):
1. **Breadcrumb bar**: `TRIP PLANNING / ROUTE / AI VALIDATION` — static text
   with link on "TRIP PLANNING" back to `/`.
2. **Progress indicator**: 3 steps — "Prompt Analyzed" (done), "Missing
   Parameters Required" (active), "Itinerary Synthesis" (pending). Use
   secondary-container for done steps, primary for active, outline for pending.
3. **AI Prompt Validation Diagnostic banner**: headline + 6 parameter cards in
   a responsive grid (2 cols on sm, 3 cols on lg). Each card shows:
   - Icon (Material Symbols)
   - Label (e.g. "Source City", "Budget")
   - Value from `extractedData` or "Needs Specifics"
   - Status indicator (green check / amber warning)
4. **Form section**: 2-column grid on large screens, single column on mobile.
   Numbered sections (1-6):
   1. Source & Destination — two text inputs
   2. Travel Dates — startDate and endDate inputs (type="date")
   3. Number of People — travellerCount, childrenCount, seniorCitizenCount
      (number inputs)
   4. Budget — number input with INR prefix
   5. Type of Travel — select/radio for travellerType (Family, Friends, Solo,
      Couple, Business)
   6. Meal Preference — select/radio (Vegetarian, Non-Vegetarian, Vegan, No
      Preference)
   - Fields that are in `missingFields` get an amber left border and a
     "Required" badge.
   - Fields with extracted values are pre-filled but editable.
5. **Bottom CTA bar**: sticky/fixed at bottom.
   - Left: "Edit Prompt" button (outline style) — calls `editPrompt()`.
   - Right: "Validate & Generate Itinerary" button (filled, secondary-container
     style) — calls `submitForm()`. Disabled when form is invalid or loading.
   - Loading spinner on the submit button (same pattern as plan-trip).
6. **Right sidebar** (visible on xl screens):
   - Destination visual card — placeholder image with destination name overlay.
   - Concierge advisory panel — static placeholder text about the AI analysis.
   - Both can use hardcoded/placeholder content for now.

Tailwind classes must use the existing design tokens from `styles.css`
(primary, secondary-container, surface-container-low, etc.).

**Acceptance criteria**:
- Page renders the breadcrumb, progress indicator, diagnostic banner with 6
  cards, form with 6 numbered sections, and bottom CTA bar.
- Missing-field cards show amber "Needs Specifics" styling; detected cards show
  green "Detected" styling.
- Form inputs are bound to the reactive form from TASK-016.
- Missing fields have visible required indicators.
- "Edit Prompt" navigates back to `/`.
- "Validate & Generate Itinerary" is disabled when the form is invalid.
- Right sidebar renders placeholder content on xl+ screens.
- Layout is responsive (single column on mobile, 2-col form on lg, sidebar on
  xl).
- Uses only existing design tokens — no new CSS variables or colors added.

**Testing requirements**: Visual verification. Structural checks in TASK-019.

**Risk**: High. Largest task by effort (L). Precise Tailwind class composition
requires iterative visual checking. The template may need post-implementation
polish, but the structural layout and data binding should be correct on first
pass.

---

### TASK-018 — Register `/trip-details` route in `app.routes.ts`

**Goal**: Add a lazy-loaded route for the trip-details page under the
DashboardShell layout, so navigating to `/trip-details` renders the new page
inside the sidebar + top bar chrome.

**Rationale**: The page must be routable and share the same layout shell as the
plan-trip page.

**Dependencies**: TASK-016 (component must exist to be referenced).

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/app.routes.ts`

**Implementation notes**:
- Add a new child route under the existing `DashboardShell` route:
  ```
  {
    path: 'trip-details',
    title: 'TripNova | Trip Details',
    loadComponent: () =>
      import('./features/trip-details/trip-details-page')
        .then(m => m.TripDetailsPage),
  }
  ```
- Place it as a sibling of the existing plan-trip child route.

**Acceptance criteria**:
- Navigating to `/trip-details` renders the `TripDetailsPage` inside the
  dashboard shell (sidebar + top bar visible).
- The existing `/` and `/login` routes continue to work.
- The wildcard redirect still catches unknown paths.

**Testing requirements**: Covered in TASK-019 (route creation test).

**Risk**: Low. Single route addition.

---

### TASK-019 — Unit tests for new and modified code

**Goal**: Add and update unit tests covering the validate flow, the refactored
chat method, the validation-state service, the plan-trip navigation logic, and
the trip-details component.

**Rationale**: Existing tests will break due to the `chat()` signature change;
new behavior needs coverage.

**Dependencies**: TASK-015, TASK-017, TASK-018 (all implementation complete).

**Affected files**:
- `Frontend/TripNova-angular-app/src/app/core/services/travel-api.service.spec.ts`
  (update existing + add new)
- `Frontend/TripNova-angular-app/src/app/features/plan-trip/plan-trip-page.spec.ts`
  (update)
- `Frontend/TripNova-angular-app/src/app/core/services/validation-state.service.spec.ts`
  (new)
- `Frontend/TripNova-angular-app/src/app/features/trip-details/trip-details-page.spec.ts`
  (new)

**Implementation notes**:

`travel-api.service.spec.ts` updates:
- Update existing `chat()` test to send a `TravelRequest` object instead of a
  string.
- Add test: `validate()` posts trimmed message to `/travel/validate`.
- Add test: `validate()` returns typed `ValidationResponse`.

`validation-state.service.spec.ts` (new):
- `set()` stores response and prompt in signals.
- `clear()` resets both to defaults.
- Signals are readable after `set()`.

`plan-trip-page.spec.ts` updates:
- Mock `TravelApiService.validate()` to return `isValid: false`.
- Verify that clicking "Generate My Trip" navigates to `/trip-details`.
- Mock `validate()` to return `isValid: true` with full `extractedData`.
- Verify that the page calls `chat()` with a `TravelRequest` (not a string).

`trip-details-page.spec.ts` (new):
- Component creates when validation state is populated.
- Redirects to `/` when validation state is null.
- Form is pre-filled with extracted data.
- `submitForm()` posts a `TravelRequest` to `/travel/chat`.
- `editPrompt()` navigates to `/`.

**Acceptance criteria**:
- All existing tests pass (updated for new signatures).
- New test files exist and pass.
- At least one test per public method / behavior.

**Testing requirements**: Self-referential — this IS the testing task.

**Risk**: Medium. Tests for `PlanTripPage` become more complex due to the
two-step async flow (validate then navigate/chat).

---

### TASK-020 — Verify `ng build` and `ng test` pass

**Goal**: Run the full production build and test suite to confirm nothing is
broken.

**Rationale**: Final gate before marking the plan complete.

**Dependencies**: TASK-018, TASK-019.

**Affected files**: None (verification only).

**Implementation notes**:
- Run `ng build` (production configuration).
- Run `ng test --watch=false` (single run).
- Fix any compilation errors, lint warnings, or test failures.

**Acceptance criteria**:
- `ng build` exits with code 0 and produces a valid output bundle.
- `ng test --watch=false` exits with code 0 and all specs pass.
- No TypeScript compilation errors.

**Testing requirements**: N/A (this task is the verification step).

**Risk**: Low, assuming prior tasks are correct.

---

## Dependency summary

```
TASK-011 (models)
  |-- TASK-012 (validate method)
  |-- TASK-013 (refactor chat)
  |-- TASK-014 (validation state service)
       |
       +-- TASK-015 (modify plan-trip page)   [also needs TASK-012]
       +-- TASK-016 (trip-details component)  [also needs TASK-013]
              |-- TASK-017 (trip-details template)
              |-- TASK-018 (route registration)
                     |
                     +-- TASK-019 (unit tests) [also needs TASK-015, TASK-017]
                            |-- TASK-020 (build verification)
```

Critical path: TASK-011 -> TASK-014 -> TASK-016 -> TASK-017 -> TASK-019 -> TASK-020

## Parallel work opportunities

- **After TASK-011**: TASK-012, TASK-013, and TASK-014 can all run in parallel
  (they only depend on the models).
- **After TASK-012 + TASK-014**: TASK-015 can start.
- **After TASK-013 + TASK-014**: TASK-016 can start.
- TASK-015 and TASK-016 can run in parallel (different files, independent
  logic).
- TASK-017 and TASK-018 can run in parallel once TASK-016 is done.

Maximum parallelism: 3 tasks simultaneously (TASK-012 + TASK-013 + TASK-014).

## Acceptance criteria (plan-level)

- Clicking "Generate My Trip" on the plan-trip page calls
  `POST /travel/validate` with the prompt text.
- When validation returns `isValid: false`, the app navigates to `/trip-details`
  showing the AI diagnostic banner with 6 parameter cards (detected vs missing),
  a pre-filled form with highlighted required fields, and CTA buttons.
- When validation returns `isValid: true`, the app calls `POST /travel/chat`
  with a structured `TravelRequest` and shows the existing success state.
- The trip-details form "Validate & Generate Itinerary" button sends a complete
  `TravelRequest` to `POST /travel/chat`.
- The "Edit Prompt" button navigates back to the plan-trip page.
- The trip-details page follows the Stitch "AI Calibration" screen layout with
  breadcrumb, progress indicator, diagnostic grid, numbered form sections,
  and right sidebar placeholder.
- All existing routes (`/`, `/login`) continue to work.
- `ng build` and `ng test` pass.

## Risks / blockers

- **Chat signature breaking change** (TASK-013): The refactored `chat()` method
  changes its parameter type. TASK-013 and TASK-015 must be implemented in the
  same session or in immediate sequence to avoid a broken intermediate state
  where `PlanTripPage` calls the old signature.
- **Backend extractedData shape**: The validate endpoint returns `extractedData`
  as `Dict[str, Any]`. If the backend returns unexpected field names or types,
  the frontend mapping in TASK-016 may need adjustment. Mitigated by matching
  the exact field names from the backend `TravelRequest` model.
- **Additional TravelRequest fields**: The backend `TravelRequest` includes
  `preferences: List[str]` and `hotelPreference: str` which are not part of the
  6 form sections described in the requirements. These will use sensible
  defaults (`preferences: []`, `hotelPreference: 'any'`) unless the validate
  endpoint extracts them.
- **Template size** (TASK-017): The trip-details template is the largest single
  deliverable. It may require iterative visual refinement after initial
  implementation.
