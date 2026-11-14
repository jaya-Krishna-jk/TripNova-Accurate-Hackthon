/**
 * Development environment (default for `ng serve` / `ng build --configuration development`).
 * The FastAPI backend in `smart-travel-backend/` runs on port 8000 by default.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
};
