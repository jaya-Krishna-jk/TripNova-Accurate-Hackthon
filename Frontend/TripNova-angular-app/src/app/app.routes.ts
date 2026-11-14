import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/dashboard-shell').then((m) => m.DashboardShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'TripNova | Plan a Trip',
        loadComponent: () => import('./features/plan-trip/plan-trip-page').then((m) => m.PlanTripPage),
      },
      {
        path: 'trip-details',
        title: 'TripNova | Complete Trip Details',
        loadComponent: () => import('./features/trip-details/trip-details-page').then((m) => m.TripDetailsPage),
      },
      {
        path: 'itinerary-suggestions',
        title: 'TripNova | Itinerary Suggestions',
        loadComponent: () => import('./features/itinerary-suggestions/itinerary-suggestions-page').then((m) => m.ItinerarySuggestionsPage),
      },
    ],
  },
  {
    path: 'login',
    title: 'TripNova | Sign in',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  { path: '**', redirectTo: '' },
];
