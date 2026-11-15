import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export interface UserSession {
  userId: string;
  username: string;
  name: string;
}

export const USER_SESSION_KEY = 'tripnova-user-session';

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly currentUser = signal<UserSession | null>(this.restoreSession());

  signIn(user: UserSession): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    sessionStorage.removeItem(USER_SESSION_KEY);
    this.currentUser.set(user);
  }

  signOut(): void {
    if (this.isBrowser) {
      localStorage.removeItem(USER_SESSION_KEY);
      sessionStorage.removeItem(USER_SESSION_KEY);
    }
    this.currentUser.set(null);
  }

  private restoreSession(): UserSession | null {
    if (!this.isBrowser) {
      return null;
    }

    for (const storage of [localStorage, sessionStorage]) {
      const stored = storage.getItem(USER_SESSION_KEY);
      if (!stored) {
        continue;
      }

      let value: unknown;
      try {
        value = JSON.parse(stored);
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
        storage.removeItem(USER_SESSION_KEY);
        continue;
      }

      if (this.isUserSession(value)) {
        return value;
      }
      storage.removeItem(USER_SESSION_KEY);
    }
    return null;
  }

  private isUserSession(value: unknown): value is UserSession {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const session = value as Record<string, unknown>;
    return typeof session['userId'] === 'string' && session['userId'].length > 0
      && typeof session['username'] === 'string' && session['username'].length > 0
      && typeof session['name'] === 'string' && session['name'].length > 0;
  }
}
