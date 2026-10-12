import { describe, expect, it } from 'vitest';
import { GameLoop } from '@/app/GameLoop';
import { APP_CONFIG } from '@/app/config';
import type { GameEngine, GameSnapshot, GameSpeed } from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';

/** Minimal engine: counts ticks and earns one coin per tick. */
function fakeEngine(speed: GameSpeed = 1) {
  const state = { ticks: 0, speed };
  const engine = {
    tick: (count = 1) => {
      state.ticks += count;
    },
    snapshot: () =>
      ({ tick: state.ticks, speed: state.speed, money: bn(state.ticks), totalEarned: bn(state.ticks) }) as unknown as GameSnapshot,
  } as unknown as GameEngine;
  return { engine, state };
}

function makeLoop(speed: GameSpeed = 1) {
  const fake = fakeEngine(speed);
  const frames: Array<{ prev: number; curr: number; alpha: number }> = [];
  const away: Array<{ earned: BigNum; seconds: number }> = [];
  const loop = new GameLoop(fake.engine, {
    onFrame: (prev, curr, alpha) => frames.push({ prev: prev.tick, curr: curr.tick, alpha }),
    onAway: (earned, seconds) => away.push({ earned, seconds }),
  });
  return { ...fake, loop, frames, away };
}

describe('GameLoop', () => {
  it('runs 20 ticks per real second at 1x and interpolates between ticks', () => {
    const { loop, state, frames } = makeLoop(1);
    loop.frame(0);
    loop.frame(1000 / 60);
    expect(state.ticks).toBe(0);
    expect(frames.at(-1)!.alpha).toBeGreaterThan(0);
    for (let ms = 100; ms <= 1000; ms += 100) loop.frame(ms);
    expect(state.ticks).toBe(20);
    const last = frames.at(-1)!;
    expect(last.curr - last.prev).toBe(1);
  });

  it('scales ticks with the game speed and stops when paused', () => {
    const fast = makeLoop(4);
    fast.loop.frame(0);
    fast.loop.frame(250);
    expect(fast.state.ticks).toBe(20);

    const paused = makeLoop(0);
    paused.loop.frame(0);
    paused.loop.frame(5000);
    expect(paused.state.ticks).toBe(0);
  });

  it('caps the ticks of a single slow frame', () => {
    const { loop, state } = makeLoop(4);
    loop.frame(0);
    loop.frame(60_000);
    expect(state.ticks).toBe(APP_CONFIG.maxTicksPerFrame);
  });

  it('refreshes the snapshot after a command even while paused', () => {
    const { loop, state, frames } = makeLoop(0);
    loop.frame(0);
    state.ticks = 7; // stands in for a state change made by a command
    loop.frame(16);
    expect(frames.at(-1)!.curr).toBe(0);
    loop.invalidate();
    loop.frame(32);
    expect(frames.at(-1)!.curr).toBe(7);
  });

  it('runs at a quarter speed while hidden, without drawing', () => {
    const { loop, state, frames } = makeLoop(1);
    loop.frame(0);
    loop.setVisible(false, 0);
    const drawn = frames.length;
    expect(loop.hiddenStep(4000)).toBe(20); // 4s * 20 tps * 0.25
    loop.frame(4000);
    expect(frames.length).toBe(drawn);
    expect(state.ticks).toBe(20);
  });

  it('limits how much time one hidden step catches up', () => {
    const { loop, state } = makeLoop(1);
    loop.setVisible(false, 0);
    loop.hiddenStep(3_600_000);
    expect(state.ticks).toBe(APP_CONFIG.maxCatchUpSeconds * 20 * APP_CONFIG.hiddenSpeedFactor);
  });

  it('reports earnings only after a long absence', () => {
    const short = makeLoop(1);
    short.loop.setVisible(false, 0);
    short.loop.hiddenStep(10_000);
    short.loop.setVisible(true, 20_000);
    expect(short.away).toHaveLength(0);

    const long = makeLoop(1);
    long.loop.setVisible(false, 0);
    for (let ms = 1000; ms <= 400_000; ms += 1000) long.loop.hiddenStep(ms);
    long.loop.setVisible(true, 400_000);
    expect(long.away).toHaveLength(1);
    expect(long.away[0]!.seconds).toBe(400);
    expect(long.away[0]!.earned.toNumber()).toBe(400 * 20 * 0.25);
  });
});
