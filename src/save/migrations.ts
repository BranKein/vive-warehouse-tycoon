/**
 * Save format versioning. A save written by an older build is upgraded one
 * version at a time until it reaches `CURRENT_SAVE_VERSION`. The contents of
 * `state` belong to the simulation; steps registered here may reshape it, but
 * nothing else in this module interprets it.
 */
import { SAVE_VERSION, type SaveData } from '@/contracts';

/** Version written by this build. Bump `SAVE_VERSION` and add a step to `MIGRATIONS` whenever the format changes. */
export const CURRENT_SAVE_VERSION = SAVE_VERSION;

/** Upgrades a save from version N to version N + 1. Must not mutate its argument. */
export type MigrationStep = (data: SaveData) => SaveData;

/**
 * Steps keyed by the version they upgrade FROM. Example for a future format 2:
 *
 *   1: (data) => ({ ...data, version: 2, state: reshape(data.state) }),
 */
export const MIGRATIONS: Readonly<Record<number, MigrationStep>> = {};

export type SaveErrorCode = 'invalid' | 'tooNew' | 'missingStep' | 'badStep';

export class SaveFormatError extends Error {
  constructor(
    readonly code: SaveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Structural check of the envelope only; `state` is opaque. */
export function isSaveData(value: unknown): value is SaveData {
  if (!isRecord(value)) return false;
  const { version, savedAt, summary } = value;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return false;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return false;
  if (!isRecord(summary)) return false;
  if (typeof summary.money !== 'string') return false;
  if (typeof summary.buildings !== 'number' || typeof summary.playSeconds !== 'number') return false;
  return 'state' in value;
}

/**
 * Brings a save up to `targetVersion` by running the registered steps in
 * order. Throws `SaveFormatError` when the data is not a save, comes from a
 * newer build, or a step is missing or does not advance the version by one.
 */
export function migrate(
  data: unknown,
  steps: Readonly<Record<number, MigrationStep>> = MIGRATIONS,
  targetVersion: number = CURRENT_SAVE_VERSION,
): SaveData {
  if (!isSaveData(data)) throw new SaveFormatError('invalid', 'Not a valid save');
  if (data.version > targetVersion) {
    throw new SaveFormatError('tooNew', `Save version ${data.version} is newer than supported version ${targetVersion}`);
  }
  let current: SaveData = data;
  while (current.version < targetVersion) {
    const from = current.version;
    const step = steps[from];
    if (!step) throw new SaveFormatError('missingStep', `No migration from save version ${from}`);
    const next = step(current);
    if (!isSaveData(next) || next.version !== from + 1) {
      throw new SaveFormatError('badStep', `Migration from save version ${from} did not produce version ${from + 1}`);
    }
    current = next;
  }
  return current;
}
