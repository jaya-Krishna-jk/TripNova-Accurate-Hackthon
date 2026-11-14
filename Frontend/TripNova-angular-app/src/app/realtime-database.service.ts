import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, ref, set } from 'firebase/database';
import { firebaseConfig } from './firebase.config';

export interface DemoUser {
  name: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeDatabaseService {
  async registerUser(name: string, username: string, password: string): Promise<DemoUser> {
    const database = this.getDatabase();
    const userRef = ref(database, `demo-users/${this.getUserKey(username)}`);

    if ((await get(userRef)).exists()) {
      throw new Error('That username is already registered.');
    }

    const user = { name: name.trim(), username: username.trim() };
    await set(userRef, {
      ...user,
      passwordHash: await this.hashPassword(password),
    });
    return user;
  }

  async loginUser(username: string, password: string): Promise<DemoUser> {
    const snapshot = await get(ref(this.getDatabase(), `demo-users/${this.getUserKey(username)}`));

    if (!snapshot.exists() || snapshot.val().passwordHash !== await this.hashPassword(password)) {
      throw new Error('Username or password is incorrect.');
    }

    const user = snapshot.val() as DemoUser;
    return { name: user.name, username: user.username };
  }

  private getDatabase() {
    if (!firebaseConfig.databaseURL) {
      throw new Error('Firebase Realtime Database URL is missing.');
    }

    return getDatabase(this.getFirebaseApp());
  }

  private async hashPassword(password: string): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error('Secure password hashing is not available in this browser.');
    }

    const bytes = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private getUserKey(username: string): string {
    return encodeURIComponent(username.trim().toLowerCase());
  }

  private getFirebaseApp(): FirebaseApp {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
}
