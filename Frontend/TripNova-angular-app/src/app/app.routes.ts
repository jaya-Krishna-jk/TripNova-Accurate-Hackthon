import { Routes } from '@angular/router';
import { TravelMockComponent } from './travel-mock/travel-mock.component';
import { authGuard, guestGuard } from './auth.guards';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
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
      {
        path: 'itinerary-details',
        title: 'TripNova | Detailed Itinerary',
        loadComponent: () => import('./features/itinerary-details/itinerary-details-page').then((m) => m.ItineraryDetailsPage),
      },
      // Re-itinerary (delay) flow: separate pages and state from the new-plan flow above.
      {
        path: 'replan-suggestions',
        title: 'TripNova | Re-plan Recommendations',
        loadComponent: () => import('./features/replan-suggestions/replan-suggestions-page').then((m) => m.ReplanSuggestionsPage),
      },
      {
        path: 'replan-details',
        title: 'TripNova | Re-planned Itinerary',
        loadComponent: () => import('./features/replan-details/replan-details-page').then((m) => m.ReplanDetailsPage),
      },
    ],
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'TripNova | Sign in',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  { path: 'mock-trip', component: TravelMockComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
