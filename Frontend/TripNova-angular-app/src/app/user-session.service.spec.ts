import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { USER_SESSION_KEY, UserSessionService } from './user-session.service';

describe('UserSessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('restores a valid session from localStorage', () => {
    const user = { userId: 'jk', username: 'JK', name: 'Jamie' };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));

    const session = TestBed.inject(UserSessionService);

    expect(session.currentUser()).toEqual(user);
  });

  it('falls back to sessionStorage when localStorage has no session', () => {
    const user = { userId: 'alex', username: 'Alex', name: 'Alex Traveler' };
    sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));

    const session = TestBed.inject(UserSessionService);

    expect(session.currentUser()).toEqual(user);
  });

  it('rejects malformed stored state and clears it', () => {
    localStorage.setItem(USER_SESSION_KEY, '{bad json');

    const session = TestBed.inject(UserSessionService);

    expect(session.currentUser()).toBeNull();
    expect(localStorage.getItem(USER_SESSION_KEY)).toBeNull();
  });

  it('persists login state and clears both browser storage areas on logout', () => {
    sessionStorage.setItem(USER_SESSION_KEY, 'old');
    const session = TestBed.inject(UserSessionService);
    const user = { userId: 'jk', username: 'JK', name: 'Jamie' };

    session.signIn(user);
    expect(session.currentUser()).toEqual(user);
    expect(JSON.parse(localStorage.getItem(USER_SESSION_KEY)!)).toEqual(user);
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();

    sessionStorage.setItem(USER_SESSION_KEY, 'stale');
    session.signOut();
    expect(session.currentUser()).toBeNull();
    expect(localStorage.getItem(USER_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_SESSION_KEY)).toBeNull();
  });
});
