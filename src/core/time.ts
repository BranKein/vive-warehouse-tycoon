/** Fixed simulation rate. Every duration in the game is derived from this. */
export const TICKS_PER_SECOND = 20;
export const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;

export function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds * TICKS_PER_SECOND));
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}
