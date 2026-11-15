import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RealtimeDatabaseService } from '../../realtime-database.service';
import { UserSessionService } from '../../user-session.service';

@Component({
  imports: [FormsModule],
  selector: 'app-login-page',
  styleUrl: './login-page.css',
  templateUrl: './login-page.html',
})
export class LoginPage {
  protected name = '';
  protected username = '';
  protected password = '';
  protected readonly errorMessage = signal('');
  protected readonly isLoading = signal(false);
  protected readonly isSignUp = signal(false);
  protected readonly successMessage = signal('');
  protected readonly showPassword = signal(false);
  protected readonly pillars = ['AI-Crafted Itineraries', 'Live Trip Tracking & Smart Re-Planning', 'Transparent Budgets'];

  constructor(
    private readonly databaseService: RealtimeDatabaseService,
    private readonly userSession: UserSessionService,
    private readonly router: Router,
  ) {}

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      if (this.isSignUp()) {
        const user = await this.databaseService.registerUser(this.name, this.username, this.password);
        this.userSession.signIn(user);
      } else {
        const user = await this.databaseService.loginUser(this.username, this.password);
        this.userSession.signIn(user);
      }
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected toggleMode(): void {
    this.name = '';
    this.username = '';
    this.password = '';
    this.isSignUp.update((value) => !value);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

}
