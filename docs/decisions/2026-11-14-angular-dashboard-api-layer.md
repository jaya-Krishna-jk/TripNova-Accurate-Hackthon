# 2026-11-14 — Angular dashboard structure and API service layer

## Context

The Angular app in `Frontend/TripNova-angular-app` only had a Firebase demo login as its root component.
The user asked for the Stitch "Remix of AI Travel Planner Dashboard" main screen to become the first screen,
with **Generate My Trip** calling the FastAPI endpoint `POST /travel/chat`.

## Decisions

1. **Backend is FastAPI, not Django.** `CLAUDE.md` mentions Django/DRF and an `/api/` prefix, but the actual
   backend (`smart-travel-backend/app/main.py`) is FastAPI with un-prefixed routes. The frontend targets the real
   routes (`/travel/chat`). CLAUDE.md should be corrected separately.
2. **API base URL lives in `src/environments/`** (`apiBaseUrl`, default `http://localhost:8000`); production
   swaps in `environment.prod.ts` via `fileReplacements`. Components never hardcode URLs (per `.claude/rules/40-frontend.mdc`).
3. **Service layer**: `core/services/travel-api.service.ts` wraps `HttpClient` (fetch-based) and owns error-to-message
   mapping. The `/travel/chat` response is intentionally left `unknown` until response handling is in scope.
4. **Routing**: root `/` renders `layout/dashboard-shell` with `features/plan-trip/plan-trip-page` as the child;
   the existing login component moved unchanged to `features/auth/login-page` at `/login` to preserve behaviour.
5. **Styling**: Tailwind v4 `@theme` tokens mirror the Stitch Material palette and type scale, so Stitch utility
   class names (`bg-surface-container`, `text-headline-xl`, …) port almost one-to-one. Fonts load from Google Fonts.
6. **Toolchain**: Angular 22 requires Node ≥ 22.22.3. The lockfile was regenerated on macOS arm64 so native
   optional dependencies resolve.
