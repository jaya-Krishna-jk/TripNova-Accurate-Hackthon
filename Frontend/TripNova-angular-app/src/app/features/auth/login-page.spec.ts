import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { LoginPage } from './login-page';
import { RealtimeDatabaseService } from '../../realtime-database.service';
import { UserSessionService } from '../../user-session.service';

describe('LoginPage', () => {
  const user = { userId: 'jk', name: 'Jamie', username: 'JK' };
  const loginUser = vi.fn();
  const signIn = vi.fn();
  const navigateByUrl = vi.fn();

  beforeEach(async () => {
    loginUser.mockReset();
    signIn.mockReset();
    navigateByUrl.mockReset().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: RealtimeDatabaseService, useValue: { loginUser } },
        { provide: UserSessionService, useValue: { signIn } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    })
      .compileComponents();
  });

  it('should create the login page', () => {
    const fixture = TestBed.createComponent(LoginPage);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the login form', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Welcome back');
    expect(compiled.querySelector('input[name="username"]')).toBeTruthy();
  });

  it('stores the signed-in user and navigates to the protected landing page', async () => {
    loginUser.mockResolvedValue(user);
    const fixture = TestBed.createComponent(LoginPage);

    const username = fixture.nativeElement.querySelector('input[name="username"]') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('input[name="password"]') as HTMLInputElement;
    username.value = user.username;
    username.dispatchEvent(new Event('input'));
    password.value = 'secret';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(loginUser).toHaveBeenCalledWith(user.username, 'secret');
    expect(signIn).toHaveBeenCalledExactlyOnceWith(user);
    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/');
  });
});
