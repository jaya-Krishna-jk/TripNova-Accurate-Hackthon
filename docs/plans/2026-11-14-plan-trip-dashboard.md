---
id: PLAN-001
type: plan
feature_id: FEAT-001
architecture_id: ARCH-001
version: 1
status: complete
title: Plan-a-Trip dashboard (first screen) with /travel/chat integration
owner: planner
created: 2026-11-14
---

# PLAN-001 — Plan-a-Trip dashboard + API service layer

## Scope

Port the main screen of the Stitch project **"Remix of AI Travel Planner Dashboard"**
(screen: *AuraVoyage - Home & AI Travel Planner*) into the Angular app and wire the
**Generate My Trip** button to `POST /travel/chat` on the FastAPI backend.

Explicitly out of scope (per user instruction on 2026-11-14): rendering or validating the
API response, and any of the other Stitch screens (itineraries, journeys, confirmation).

> Note: no FEAT-001 / ARCH-001 documents exist yet in this repo. The IDs above are
> placeholders so the plan validates against the planner schema; the user instruction
> is the approved requirement for this work.

## Tasks

| ID | Title | Owner | Deps | Est | Status |
|----|-------|-------|------|-----|--------|
| TASK-001 | Install deps, confirm Angular 22 toolchain (Node ≥ 22.22) | frontend-engineer | — | S | complete |
| TASK-002 | Port Stitch design tokens to Tailwind v4 `@theme` in `src/styles.css`; load Inter, Newsreader, Material Symbols in `index.html` | frontend-engineer | TASK-001 | S | complete |
| TASK-003 | Add `src/environments/` with `apiBaseUrl`; production `fileReplacements` in `angular.json` | frontend-engineer | TASK-001 | S | complete |
| TASK-004 | Add `ChatRequest` model + `TravelApiService.chat()` posting to `${apiBaseUrl}/travel/chat`; register `provideHttpClient(withFetch())` | frontend-engineer | TASK-003 | S | complete |
| TASK-005 | Move existing login component to `features/auth/login-page` and route it at `/login` (behaviour preserved) | frontend-engineer | TASK-001 | S | complete |
| TASK-006 | Build `layout/dashboard-shell` (sidebar + top bar + router outlet) from the Stitch screen | frontend-engineer | TASK-002 | M | complete |
| TASK-007 | Build `features/plan-trip/plan-trip-page` (hero, prompt box, context anchors, quick prompts, Generate button with loading/error/sent states) | frontend-engineer | TASK-004, TASK-006 | M | complete |
| TASK-008 | Routing: `/` → shell + plan-trip page, `/login`, `**` redirect | frontend-engineer | TASK-005, TASK-006, TASK-007 | S | complete |
| TASK-009 | Unit tests: service posts to `/travel/chat`; page click triggers POST; shell/app create | test-engineer | TASK-007 | S | complete |
| TASK-010 | Verify `ng build` (prod, prerender) and `ng test` pass | test-engineer | TASK-008, TASK-009 | S | complete |

## Dependency summary

TASK-001 → {002, 003, 005} → 004 → 007 → 008 → 010; 006 depends only on 002; 009 depends on 007.

## Parallel work

- TASK-002, TASK-003, TASK-005 can run in parallel after TASK-001.
- TASK-004 and TASK-006 can run in parallel.

## Acceptance criteria

- Visiting `/` shows the sidebar, top bar, hero headline "Where would you like to go next?", prompt box,
  context anchors and quick prompts, matching the Stitch screen's layout and palette.
- Clicking **Generate My Trip** sends `POST {apiBaseUrl}/travel/chat` with body `{ "message": "<prompt>" }`.
- The button is disabled while a request is in flight and when the prompt is empty.
- A failed request shows an inline error; a completed request shows a "sent" confirmation. The response body is not rendered.
- The previous Firebase login flow still works at `/login`.
- `ng build` and `ng test` pass.

## Risks / blockers

- **Node version**: Angular CLI 22 requires Node ≥ 22.22.3; the dev machine had Node 20.18.3. Verified with a
  portable Node 22; the developer must upgrade Node to run `npm start` locally.
- `package-lock.json` was regenerated on macOS arm64 so the native `oxc-parser` binding resolves; it previously
  only contained bindings for another platform.
- The sidebar's other nav items, attach/voice/filter buttons are visual placeholders (disabled, "Coming soon").
