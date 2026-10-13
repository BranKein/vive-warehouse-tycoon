/**
 * Dev page: runs the renderer alone on the fixture snapshot, stepped at the
 * simulation's tick rate so interpolation between ticks is exercised. Picks
 * are logged to the console and shown as the selection.
 * Open /src/render/dev.html on the Vite dev server. Not part of the game build.
 */
import { catalog } from '@/content';
import type { GameSnapshot } from '@/contracts';
import { SECONDS_PER_TICK } from '@/core/time';
import { createFixtureSnapshot } from '@/dev/fixtures';
import { createRenderer } from './index';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const label = document.querySelector<HTMLElement>('#dev-log')!;
const renderer = createRenderer(canvas, { catalog });

const fit = (): void => renderer.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', fit);
fit();

renderer.onPick((target) => {
  console.log('[pick]', JSON.stringify(target));
  label.textContent = `pick: ${JSON.stringify(target)}`;
  renderer.setSelection(target.type === 'specialCargo' ? { type: 'none' } : target);
});

let tick = 0;
let prev: GameSnapshot = createFixtureSnapshot(catalog, 0);
let curr: GameSnapshot = prev;
let accumulator = 0;
let lastMs: number | null = null;

const frame = (nowMs: number): void => {
  const elapsed = lastMs === null ? 0 : Math.min(0.25, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  accumulator += elapsed / SECONDS_PER_TICK;
  while (accumulator >= 1) {
    accumulator -= 1;
    tick += 1;
    prev = curr;
    curr = createFixtureSnapshot(catalog, tick * SECONDS_PER_TICK);
  }
  renderer.render(prev, curr, accumulator, nowMs / 1000);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
