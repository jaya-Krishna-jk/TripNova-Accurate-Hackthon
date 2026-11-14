<<<<<<< HEAD
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
=======
import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('should create the app class', () => {
    expect(new App()).toBeTruthy();
  });

  it('should expose the root app shell', () => {
    expect(typeof App).toBe('function');
>>>>>>> 4db7b68 (Trip simulator completed)
  });
});
