import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DemoUser, RealtimeDatabaseService } from '../../realtime-database.service';

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
  protected readonly currentUser = signal<DemoUser | null>(null);

  constructor(private readonly databaseService: RealtimeDatabaseService) {}

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      if (this.isSignUp()) {
        const user = await this.databaseService.registerUser(this.name, this.username, this.password);
        this.currentUser.set(user);
      } else {
        const user = await this.databaseService.loginUser(this.username, this.password);
        this.currentUser.set(user);
      }
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

  protected logout(): void {
    this.currentUser.set(null);
    this.password = '';
    this.successMessage.set('');
  }
}
