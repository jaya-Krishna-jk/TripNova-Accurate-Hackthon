import { TestBed } from '@angular/core/testing';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
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
    expect(compiled.querySelector('h2')?.textContent).toContain('Sign in');
    expect(compiled.querySelector('input[name="username"]')).toBeTruthy();
  });
});
