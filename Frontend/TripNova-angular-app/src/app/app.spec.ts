import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('should create the app class', () => {
    expect(new App()).toBeTruthy();
  });

  it('should expose the root app shell', () => {
    expect(typeof App).toBe('function');
  });
});
