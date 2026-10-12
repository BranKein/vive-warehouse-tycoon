import type { GameEngine, GameSnapshot } from '@/contracts';
import type { BigNum } from '@/core/BigNum';
import { TICKS_PER_SECOND } from '@/core/time';
import { APP_CONFIG, type AppConfig } from './config';

export interface GameLoopHooks {
  /** Called once per visible frame with the two latest tick snapshots and the blend factor between them. */
  onFrame(prev: GameSnapshot, curr: GameSnapshot, alpha: number, realTimeSec: number): void;
  /** Called when the tab comes back after being hidden for a long time. */
  onAway(earned: BigNum, awaySeconds: number): void;
}

/**
 * Drives the simulation in fixed ticks from real time.
 *
 * Visible: ticks follow the chosen speed and frames are interpolated between
 * the last two ticks. Hidden: nothing is drawn and time is caught up in
 * batches at a reduced rate. The loop itself owns no timers; the caller
 * feeds it timestamps, which keeps it testable.
 */
export class GameLoop {
  private engine: GameEngine;
  private prev: GameSnapshot;
  private curr: GameSnapshot;
  private accumulator = 0;
  private lastTimeMs: number | null = null;
  private visible = true;
  private dirty = false;
  private hiddenSinceMs = 0;
  private earnedAtHide: BigNum;

  constructor(
    engine: GameEngine,
    private readonly hooks: GameLoopHooks,
    private readonly config: AppConfig = APP_CONFIG,
  ) {
    this.engine = engine;
    this.curr = engine.snapshot();
    this.prev = this.curr;
    this.earnedAtHide = this.curr.totalEarned;
  }

  get snapshot(): GameSnapshot {
    return this.curr;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Swaps in a different game (after loading a save or resetting). */
  setEngine(engine: GameEngine): void {
    this.engine = engine;
    this.curr = engine.snapshot();
    this.prev = this.curr;
    this.accumulator = 0;
    this.earnedAtHide = this.curr.totalEarned;
  }

  /** Marks the state as changed outside of a tick (a player command), so the next frame refreshes its snapshot. */
  invalidate(): void {
    this.dirty = true;
  }

  /** Advances and draws one visible frame. */
  frame(nowMs: number): void {
    if (!this.visible) return;
    const elapsed = this.takeElapsedSeconds(nowMs);
    const speed = this.curr.speed;
    this.accumulator += elapsed * speed * TICKS_PER_SECOND;

    let due = Math.floor(this.accumulator);
    if (due > this.config.maxTicksPerFrame) {
      due = this.config.maxTicksPerFrame;
      this.accumulator = due;
    }
    if (due > 0) {
      this.accumulator -= due;
      if (due > 1) {
        this.engine.tick(due - 1);
        this.prev = this.engine.snapshot();
      } else {
        this.prev = this.dirty ? this.engine.snapshot() : this.curr;
      }
      this.engine.tick(1);
      this.curr = this.engine.snapshot();
      this.dirty = false;
    } else if (this.dirty) {
      // A command ran between ticks (or while paused): show its effect right away.
      this.curr = this.engine.snapshot();
      this.prev = this.curr;
      this.dirty = false;
    }
    const alpha = speed === 0 ? 1 : Math.min(1, this.accumulator);
    this.hooks.onFrame(this.prev, this.curr, alpha, nowMs / 1000);
  }

  /** Catches up simulated time while the tab is hidden. Returns the number of ticks run. */
  hiddenStep(nowMs: number): number {
    if (this.visible) return 0;
    const elapsed = Math.min(this.takeElapsedSeconds(nowMs), this.config.maxCatchUpSeconds);
    this.accumulator += elapsed * this.curr.speed * this.config.hiddenSpeedFactor * TICKS_PER_SECOND;
    const due = Math.floor(this.accumulator);
    if (due <= 0) return 0;
    this.accumulator -= due;
    this.engine.tick(due);
    this.curr = this.engine.snapshot();
    this.prev = this.curr;
    this.dirty = false;
    return due;
  }

  setVisible(visible: boolean, nowMs: number): void {
    if (visible === this.visible) return;
    if (!visible) {
      this.visible = false;
      this.lastTimeMs = nowMs;
      this.hiddenSinceMs = nowMs;
      this.earnedAtHide = this.curr.totalEarned;
      return;
    }
    // Simulate the stretch since the last hidden step, then resume drawing.
    this.hiddenStep(nowMs);
    this.visible = true;
    this.lastTimeMs = nowMs;
    this.accumulator = 0;
    const awaySeconds = (nowMs - this.hiddenSinceMs) / 1000;
    if (awaySeconds >= this.config.awayNoticeSeconds) {
      this.hooks.onAway(this.curr.totalEarned.sub(this.earnedAtHide), awaySeconds);
    }
  }

  private takeElapsedSeconds(nowMs: number): number {
    const last = this.lastTimeMs ?? nowMs;
    this.lastTimeMs = nowMs;
    return Math.max(0, (nowMs - last) / 1000);
  }
}
