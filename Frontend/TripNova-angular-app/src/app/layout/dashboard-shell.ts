import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserSessionService } from '../user-session.service';

interface NavItem {
  label: string;
  icon: string;
  route: string | null;
  badge?: string;
}

/**
 * Dashboard chrome ported from the Stitch screen "AuraVoyage - Home & AI Travel Planner":
 * fixed left sidebar, sticky top bar and a routed content area.
 */
@Component({
  selector: 'app-dashboard-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-shell.html',
})
export class DashboardShell {
  constructor(
    protected readonly userSession: UserSessionService,
    private readonly router: Router,
  ) {}

  protected readonly navItems: NavItem[] = [
    { label: 'Plan a Trip', icon: 'explore', route: '/' },
    { label: 'My Itineraries', icon: 'calendar_month', route: null },
    { label: 'My Journeys', icon: 'flight_takeoff', route: null },
    { label: 'Notifications', icon: 'notifications', route: null, badge: '2' },
  ];

  protected async logout(): Promise<void> {
    this.userSession.signOut();
    await this.router.navigateByUrl('/login');
  }
}
