export type DirectorState = 'IDLE' | 'PLAN_LOADED' | 'PREVIEWED' | 'RUNNING' | 'AWAITING_DECISION' | 'FINISHED';

export class DemoDirectorService {
  state: DirectorState = 'IDLE';

  loadPlan(): void {
    this.state = 'PLAN_LOADED';
  }

  previewed(): void {
    this.state = 'PREVIEWED';
  }

  start(): void {
    this.state = 'RUNNING';
  }

  pause(): void {
    if (this.state === 'RUNNING') {
      this.state = 'PREVIEWED';
    }
  }

  awaitDecision(): void {
    this.state = 'AWAITING_DECISION';
  }

  finish(): void {
    this.state = 'FINISHED';
  }

  rewind(): void {
    if (this.state === 'AWAITING_DECISION' || this.state === 'FINISHED') {
      this.state = 'RUNNING';
    }
  }
}
