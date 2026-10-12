import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { SaveData, SaveStore } from '@/contracts';
import {
  CURRENT_SAVE_VERSION,
  IndexedDbSaveStore,
  MemorySaveStore,
  SaveFormatError,
  createSaveStore,
  isSaveData,
  migrate,
  type MigrationStep,
} from '@/save';

const save = (overrides: Partial<SaveData> = {}): SaveData => ({
  version: CURRENT_SAVE_VERSION,
  savedAt: 1_700_000_000_000,
  summary: { money: '1.5e12', buildings: 4, playSeconds: 3600 },
  state: { money: '1.5e12', buildings: [{ id: 'b1', type: 'sawmill' }] },
  ...overrides,
});

const stores: Array<[string, () => SaveStore]> = [
  ['MemorySaveStore', () => new MemorySaveStore()],
  ['IndexedDbSaveStore', () => new IndexedDbSaveStore({ factory: new IDBFactory() })],
];

describe.each(stores)('%s', (_name, create) => {
  it('starts empty', async () => {
    const store = create();
    expect(await store.getAuto()).toBeNull();
    expect(await store.listManual()).toEqual([]);
    expect(await store.getManual('nope')).toBeNull();
  });

  it('keeps a single auto save slot', async () => {
    const store = create();
    await store.putAuto(save({ savedAt: 1 }));
    await store.putAuto(save({ savedAt: 2 }));
    expect(await store.getAuto()).toEqual(save({ savedAt: 2 }));
    expect(await store.listManual()).toEqual([]);
  });

  it('adds, lists (newest first), loads and deletes manual saves', async () => {
    const store = create();
    const first = await store.addManual(save({ savedAt: 100 }));
    const second = await store.addManual(save({ savedAt: 300, summary: { money: '9e3', buildings: 9, playSeconds: 1 } }));
    const third = await store.addManual(save({ savedAt: 200 }));
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    expect(second).toEqual({ id: second.id, savedAt: 300, summary: { money: '9e3', buildings: 9, playSeconds: 1 } });

    expect((await store.listManual()).map((entry) => entry.id)).toEqual([second.id, third.id, first.id]);
    expect(await store.getManual(third.id)).toEqual(save({ savedAt: 200 }));

    await store.deleteManual(third.id);
    await store.deleteManual('nope');
    expect((await store.listManual()).map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(await store.getManual(third.id)).toBeNull();
  });

  it('has no limit on manual saves, even with the same timestamp', async () => {
    const store = create();
    for (let i = 0; i < 60; i += 1) await store.addManual(save());
    expect(await store.listManual()).toHaveLength(60);
  });

  it('does not share objects with the caller', async () => {
    const store = create();
    const data = save();
    const entry = await store.addManual(data);
    (data.state as { money: string }).money = 'changed';
    data.summary.buildings = 99;
    expect(await store.getManual(entry.id)).toEqual(save());
    expect((await store.listManual())[0]!.summary.buildings).toBe(4);
  });

  it('clear removes the auto save and every manual save', async () => {
    const store = create();
    await store.putAuto(save());
    await store.addManual(save());
    await store.addManual(save());
    await store.clear();
    expect(await store.getAuto()).toBeNull();
    expect(await store.listManual()).toEqual([]);
  });

  it('refuses to load a save written by a newer build', async () => {
    const store = create();
    const entry = await store.addManual(save({ version: CURRENT_SAVE_VERSION + 1 }));
    await expect(store.getManual(entry.id)).rejects.toBeInstanceOf(SaveFormatError);
    // It is still listed, so the player can delete it.
    expect(await store.listManual()).toHaveLength(1);
  });
});

describe('IndexedDbSaveStore persistence', () => {
  it('keeps saves across instances on the same database, separately per database name', async () => {
    const factory = new IDBFactory();
    const first = new IndexedDbSaveStore({ factory, dbName: 'a' });
    await first.putAuto(save());
    const entry = await first.addManual(save({ savedAt: 5 }));
    await first.close();

    const again = new IndexedDbSaveStore({ factory, dbName: 'a' });
    expect(await again.getAuto()).toEqual(save());
    expect(await again.getManual(entry.id)).toEqual(save({ savedAt: 5 }));
    expect(await new IndexedDbSaveStore({ factory, dbName: 'b' }).getAuto()).toBeNull();
  });

  it('createSaveStore picks IndexedDB when a factory is available and memory otherwise', () => {
    expect(createSaveStore({ factory: new IDBFactory() })).toBeInstanceOf(IndexedDbSaveStore);
    expect(createSaveStore()).toBeInstanceOf(MemorySaveStore);
  });
});

describe('migrate', () => {
  const v1 = save({ version: 1, state: { coins: 5 } });
  const steps: Record<number, MigrationStep> = {
    1: (data) => ({ ...data, version: 2, state: { money: String((data.state as { coins: number }).coins) } }),
    2: (data) => ({ ...data, version: 3, state: { ...(data.state as object), speed: 1 } }),
  };

  it('returns a current save unchanged', () => {
    const data = save();
    expect(migrate(data)).toBe(data);
  });

  it('runs every step in order up to the target version', () => {
    expect(migrate(v1, steps, 3)).toEqual({ ...v1, version: 3, state: { money: '5', speed: 1 } });
    expect(migrate(v1, steps, 2)).toEqual({ ...v1, version: 2, state: { money: '5' } });
    expect(migrate({ ...v1, version: 2, state: { money: '7' } }, steps, 3).state).toEqual({ money: '7', speed: 1 });
  });

  it('does not mutate the input', () => {
    const copy = structuredClone(v1);
    migrate(v1, steps, 3);
    expect(v1).toEqual(copy);
  });

  it('rejects saves from the future, missing steps and steps that skip versions', () => {
    const code = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return error instanceof SaveFormatError ? error.code : 'other';
      }
      return 'none';
    };
    expect(code(() => migrate(save({ version: 4 }), steps, 3))).toBe('tooNew');
    expect(code(() => migrate(v1, { 1: steps[1]! }, 3))).toBe('missingStep');
    expect(code(() => migrate(v1, { 1: (data) => ({ ...data, version: 3 }) }, 3))).toBe('badStep');
    expect(code(() => migrate(v1, { 1: (data) => data }, 2))).toBe('badStep');
  });

  it('rejects things that are not saves', () => {
    for (const bad of [null, 'x', 3, [], {}, { version: 1 }, save({ version: 0 }), save({ version: 1.5 }), { ...save(), summary: null }]) {
      expect(isSaveData(bad)).toBe(false);
      expect(() => migrate(bad)).toThrow(SaveFormatError);
    }
    expect(isSaveData(save())).toBe(true);
    expect(isSaveData(save({ state: null }))).toBe(true);
  });
});
