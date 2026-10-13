/**
 * Runs the simulation without a screen and collects the figures used to
 * check pacing: money and building count per hour, when things were
 * unlocked, and how long the game went without a visible change.
 */
import type { ContentCatalog } from '@/contracts';
import { formatDuration, formatNumber } from '@/core/format';
import { TICKS_PER_SECOND } from '@/core/time';
import { catalog as defaultCatalog } from '@/content';
import type { Balance } from '@/content/balance';
import { createGame, type Game } from '@/sim';

export interface HeadlessOptions {
  hours: number;
  auto: boolean;
  seed: number;
  catalog?: ContentCatalog;
  balance?: Balance;
}

export interface HourRow {
  hour: number;
  money: string;
  incomePerSec: string;
  totalEarned: string;
  buildings: number;
  unlocks: number;
  upgrades: number;
}

export interface HeadlessReport {
  options: { hours: number; auto: boolean; seed: number };
  hours: HourRow[];
  /** Every unlock in the order it happened, in simulated seconds. */
  unlocks: Array<{ id: string; atSec: number }>;
  firstTier2UnlockSec: number | null;
  /** When every plot of the start island held a building. */
  allPlotsFilledSec: number | null;
  /** Longest stretch without a new building or unlock, and when it began. */
  longestGapSec: number;
  longestGapStartSec: number;
  buildingsBuilt: number;
  upgradesBought: number;
  wallMs: number;
  game: Game;
}

/** Events that change what the player sees on the board: something new appears or opens up. */
const VISIBLE_EVENTS = new Set(['buildingBuilt', 'unlocked']);

export function runHeadless(options: HeadlessOptions): HeadlessReport {
  const started = Date.now();
  const catalog = options.catalog ?? defaultCatalog;
  const game = createGame({ catalog, seed: options.seed, ...(options.balance ? { balance: options.balance } : {}) });
  game.setAutoPilot(options.auto);

  const totalSeconds = Math.max(0, Math.round(options.hours * 3600));
  const report: HeadlessReport = {
    options: { hours: options.hours, auto: options.auto, seed: options.seed },
    hours: [],
    unlocks: [],
    firstTier2UnlockSec: null,
    allPlotsFilledSec: null,
    longestGapSec: 0,
    longestGapStartSec: 0,
    buildingsBuilt: 0,
    upgradesBought: 0,
    wallMs: 0,
    game,
  };
  let lastVisibleSec = 0;
  const closeGap = (nowSec: number): void => {
    if (nowSec - lastVisibleSec > report.longestGapSec) {
      report.longestGapSec = nowSec - lastVisibleSec;
      report.longestGapStartSec = lastVisibleSec;
    }
    lastVisibleSec = nowSec;
  };
  const addRow = (second: number): void => {
    report.hours.push({
      hour: second / 3600,
      money: formatNumber(game.money),
      incomePerSec: formatNumber(game.incomePerSec),
      totalEarned: formatNumber(game.totalEarned),
      buildings: game.island.buildings.length,
      unlocks: report.unlocks.length,
      upgrades: report.upgradesBought,
    });
  };

  for (let second = 1; second <= totalSeconds; second += 1) {
    game.tick(TICKS_PER_SECOND);
    for (const event of game.drainEvents()) {
      if (VISIBLE_EVENTS.has(event.type)) closeGap(second);
      if (event.type === 'buildingBuilt') {
        report.buildingsBuilt += 1;
        if (report.allPlotsFilledSec === null && game.island.isFull) report.allPlotsFilledSec = second;
      } else if (event.type === 'upgraded') {
        report.upgradesBought += 1;
      } else if (event.type === 'unlocked') {
        report.unlocks.push({ id: event.unlockId, atSec: second });
        const grants = catalog.unlocks[event.unlockId]?.grants;
        if (
          report.firstTier2UnlockSec === null &&
          grants?.type === 'building' &&
          catalog.buildings[grants.buildingType]?.category === 'tier2'
        ) {
          report.firstTier2UnlockSec = second;
        }
      }
    }
    if (second % 3600 === 0) addRow(second);
  }
  if (totalSeconds % 3600 !== 0) addRow(totalSeconds);
  // The stretch still open at the end counts too.
  if (totalSeconds - lastVisibleSec > report.longestGapSec) {
    report.longestGapSec = totalSeconds - lastVisibleSec;
    report.longestGapStartSec = lastVisibleSec;
  }
  report.wallMs = Date.now() - started;
  return report;
}

const USAGE = 'Usage: npm run sim -- --hours <n> [--auto] [--seed <n>]';

export function parseArgs(argv: readonly string[]): Required<Pick<HeadlessOptions, 'hours' | 'auto' | 'seed'>> {
  const options = { hours: 1, auto: false, seed: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--auto') {
      options.auto = true;
    } else if (arg === '--hours' || arg === '--seed') {
      const value = Number(argv[(i += 1)]);
      if (!Number.isFinite(value) || value < 0) throw new Error(`${arg} needs a non-negative number\n${USAGE}`);
      if (arg === '--hours') options.hours = value;
      else options.seed = Math.floor(value);
    } else {
      throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
    }
  }
  return options;
}

const time = (seconds: number | null): string => (seconds === null ? 'not reached' : formatDuration(seconds));

export function formatReport(report: HeadlessReport): string {
  const { options } = report;
  const island = report.game.island;
  const lines: string[] = [];
  lines.push(`Headless run: ${options.hours} h, auto mode ${options.auto ? 'on' : 'off'}, seed ${options.seed}`);
  lines.push('');
  lines.push('  hour       money    income/s      earned  buildings  unlocks  upgrades');
  for (const row of report.hours) {
    lines.push(
      [
        row.hour.toFixed(2).padStart(6),
        row.money.padStart(11),
        row.incomePerSec.padStart(11),
        row.totalEarned.padStart(11),
        String(row.buildings).padStart(10),
        String(row.unlocks).padStart(8),
        String(row.upgrades).padStart(9),
      ].join(' '),
    );
  }
  lines.push('');
  lines.push('Unlocks:');
  if (report.unlocks.length === 0) lines.push('  (none)');
  for (const unlock of report.unlocks) lines.push(`  ${time(unlock.atSec).padStart(10)}  ${unlock.id}`);
  lines.push('');
  lines.push(`First tier-2 building unlocked: ${time(report.firstTier2UnlockSec)}`);
  lines.push(
    `All ${Math.min(island.def.maxBuildings, island.layout.plots.length)} plots filled: ${time(report.allPlotsFilledSec)}` +
      ` (now ${island.buildings.length})`,
  );
  lines.push(
    `Longest gap between visible changes (new building or unlock): ${time(report.longestGapSec)}` +
      ` (from ${time(report.longestGapStartSec)})`,
  );
  lines.push(`Buildings built: ${report.buildingsBuilt}, upgrades bought: ${report.upgradesBought}`);
  lines.push(`Simulated ${report.game.tickCount} ticks in ${(report.wallMs / 1000).toFixed(1)} s`);
  return lines.join('\n');
}
