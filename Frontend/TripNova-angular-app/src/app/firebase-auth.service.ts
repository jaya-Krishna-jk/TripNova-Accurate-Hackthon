import { Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { firebaseConfig } from './firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private auth?: Auth;

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.getAuth(), email, password);
  }

  async createAccount(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.getAuth(), email, password);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.getAuth(), email);
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.getAuth(), new GoogleAuthProvider());
  }

  getErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      switch (error.code) {
        case 'auth/invalid-credential':
          return 'The email or password is incorrect.';
        case 'auth/email-already-in-use':
          return 'An account already exists for this email.';
        case 'auth/weak-password':
          return 'Use a password with at least six characters.';
        case 'auth/invalid-email':
          return 'Enter a valid email address.';
        case 'auth/popup-closed-by-user':
          return 'The Google sign-in window was closed.';
      }
    }

    if (!this.hasFirebaseConfig()) {
      return 'Add your Firebase web app configuration in src/app/firebase.config.ts to enable sign-in.';
    }

    return 'Something went wrong. Please try again.';
  }

  private getAuth(): Auth {
    if (!this.hasFirebaseConfig()) {
      throw new Error('Firebase configuration is missing.');
    }

    if (!this.auth) {
      this.auth = getAuth(this.getFirebaseApp());
    }

    return this.auth;
  }

  private getFirebaseApp(): FirebaseApp {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }

  private hasFirebaseConfig(): boolean {
    return Boolean(
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
    );
  }
}
