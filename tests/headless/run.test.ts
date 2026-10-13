import { describe, expect, it } from 'vitest';
import { formatReport, parseArgs, runHeadless } from '@/headless/run';

describe('headless runner', () => {
  it('parses its arguments', () => {
    expect(parseArgs([])).toEqual({ hours: 1, auto: false, seed: 1 });
    expect(parseArgs(['--hours', '10', '--auto', '--seed', '7'])).toEqual({ hours: 10, auto: true, seed: 7 });
    expect(() => parseArgs(['--hours'])).toThrow(/--hours/);
    expect(() => parseArgs(['--hours', '-1'])).toThrow();
    expect(() => parseArgs(['--fast'])).toThrow(/Unknown argument/);
  });

  it('plays with auto mode and reports progress per hour', () => {
    const report = runHeadless({ hours: 2, auto: true, seed: 1 });
    expect(report.hours.map((row) => row.hour)).toEqual([1, 2]);
    expect(report.game.tickCount).toBe(2 * 3600 * 20);
    expect(report.buildingsBuilt).toBeGreaterThan(0);
    expect(report.upgradesBought).toBeGreaterThan(0);
    expect(report.game.totalEarned.toNumber()).toBeGreaterThan(0);
    expect(report.hours[1]!.buildings).toBeGreaterThanOrEqual(report.hours[0]!.buildings);
    expect(report.unlocks.length).toBeGreaterThan(0);
    expect(report.unlocks[0]!.atSec).toBeGreaterThan(0);
    expect(report.longestGapSec).toBeGreaterThan(0);
    expect(report.longestGapSec).toBeLessThanOrEqual(2 * 3600);

    const text = formatReport(report);
    expect(text).toContain('First tier-2 building unlocked:');
    expect(text).toContain('plots filled:');
    expect(text).toContain('Longest gap between visible changes');
    for (const unlock of report.unlocks) expect(text).toContain(unlock.id);
  });

  it('is reproducible for a seed and covers a partial last hour', () => {
    const first = runHeadless({ hours: 0.5, auto: true, seed: 3 });
    const second = runHeadless({ hours: 0.5, auto: true, seed: 3 });
    expect(first.hours).toEqual(second.hours);
    expect(first.hours).toHaveLength(1);
    expect(first.hours[0]!.hour).toBe(0.5);
    expect(first.unlocks).toEqual(second.unlocks);
  });

  it('only watches when auto mode is off', () => {
    const report = runHeadless({ hours: 0.25, auto: false, seed: 1 });
    expect(report.buildingsBuilt).toBe(0);
    expect(report.upgradesBought).toBe(0);
    expect(report.game.island.buildings).toHaveLength(1);
    expect(report.game.money.toNumber()).toBeGreaterThan(0);
    expect(report.longestGapSec).toBe(900);
  });
});
