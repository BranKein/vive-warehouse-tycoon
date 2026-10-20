import { describe, expect, it } from 'vitest';
import type { SaveData } from '@/contracts';
import {
  CLOUD_PREFS_KEY,
  CURRENT_SAVE_VERSION,
  CloudSync,
  MemoryCloudProvider,
  createCloudProviders,
  deviceName,
  memoryStorage,
  parseCloudFile,
  toCloudFile,
  type KeyValueStorage,
} from '@/save';

const save = (savedAt: number, money = '100'): SaveData => ({
  version: CURRENT_SAVE_VERSION,
  savedAt,
  summary: { money, buildings: 2, playSeconds: 60 },
  state: { money },
});

/** One device: its own game, auto save time and prefs, sharing `cloudStorage` with other devices. */
function device(options: { name: string; cloudStorage: KeyValueStorage; local: number | null; prefs?: KeyValueStorage }) {
  let clock = 1_000_000;
  let game = save(options.local ?? 0, options.name);
  let localSavedAt = options.local;
  const loaded: SaveData[] = [];
  const provider = new MemoryCloudProvider({ storage: options.cloudStorage });
  const sync = new CloudSync({
    providers: [provider],
    // Like the app: the game handed to the cloud is also written as the auto save.
    current: () => {
      localSavedAt = clock;
      return { ...game, savedAt: clock };
    },
    localSavedAt: async () => localSavedAt,
    load: (data) => {
      loaded.push(data);
      game = data;
      localSavedAt = clock;
      return true;
    },
    device: options.name,
    storage: options.prefs ?? memoryStorage(),
    now: () => clock,
    uploadIntervalMs: 1000,
  });
  return {
    sync,
    provider,
    loaded,
    tick: (ms: number) => (clock += ms),
    setClock: (ms: number) => (clock = ms),
  };
}

const cloudSavedAt = (storage: KeyValueStorage): number | null => {
  const raw = storage.getItem('warehouse-tycoon.cloud.fake');
  return raw ? parseCloudFile(JSON.parse(raw))!.data.savedAt : null;
};

describe('CloudSync', () => {
  it('uploads this device on connect when the cloud is empty', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    expect(await pc.sync.connect('google')).toBe(true);
    expect(pc.sync.status()).toMatchObject({ provider: 'google', state: 'connected', offer: null });
    expect(pc.sync.status().lastSyncedAt).not.toBeNull();
    expect(cloudSavedAt(cloud)).toBe(1_000_000);
  });

  it('offers a newer cloud save and does not upload over it until the player decides', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');

    const phone = device({ name: 'Phone', cloudStorage: cloud, local: 200 });
    phone.setClock(100);
    await phone.sync.connect('google');
    const offer = phone.sync.status().offer;
    expect(offer).toMatchObject({ device: 'PC', savedAt: 1_000_000, newer: true });

    phone.tick(10_000);
    await phone.sync.backup({ force: true });
    expect(cloudSavedAt(cloud)).toBe(1_000_000);

    expect(await phone.sync.acceptOffer()).toBe(true);
    expect(phone.loaded).toHaveLength(1);
    expect(phone.loaded[0]!.summary.money).toBe('PC');
    expect(phone.sync.status().offer).toBeNull();
  });

  it('keeping this device replaces the cloud save', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');
    const phone = device({ name: 'Phone', cloudStorage: cloud, local: null });
    phone.setClock(2_000_000);
    await phone.sync.connect('google');
    expect(phone.sync.status().offer).not.toBeNull();
    await phone.sync.dismissOffer();
    expect(phone.loaded).toHaveLength(0);
    expect(cloudSavedAt(cloud)).toBe(2_000_000);
  });

  it('asks even when this device saved later, without uploading over the other device', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    pc.setClock(100);
    await pc.sync.connect('google');
    // A game left open keeps its auto save fresh, so its time says nothing about which game the player wants.
    const phone = device({ name: 'Phone', cloudStorage: cloud, local: 5_000 });
    await phone.sync.connect('google');
    expect(phone.sync.status().offer).toMatchObject({ device: 'PC', newer: false });
    phone.tick(10_000);
    await phone.sync.backup({ force: true });
    expect(cloudSavedAt(cloud)).toBe(100);
  });

  it('a game left open does not overwrite what another device saved meanwhile', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');
    const phone = device({ name: 'Phone', cloudStorage: cloud, local: 2_000_000 });
    phone.setClock(3_000_000);
    await phone.sync.connect('google');
    await phone.sync.dismissOffer();
    expect(cloudSavedAt(cloud)).toBe(3_000_000);

    pc.tick(5000);
    await pc.sync.backup({ force: true });
    expect(cloudSavedAt(cloud)).toBe(3_000_000);
    expect(pc.sync.status().offer).toMatchObject({ device: 'Phone', savedAt: 3_000_000 });
  });

  it('a device that lost its own game is offered its last upload instead of overwriting it', async () => {
    const cloud = memoryStorage();
    const prefs = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500, prefs });
    await pc.sync.connect('google');
    // Site data cleared: no auto save, a fresh game, but the cloud prefs survive.
    const again = device({ name: 'PC', cloudStorage: cloud, local: null, prefs });
    again.setClock(2_000_000);
    await again.sync.start();
    expect(again.sync.status().offer).toMatchObject({ device: 'PC', savedAt: 1_000_000, newer: true });
    expect(cloudSavedAt(cloud)).toBe(1_000_000);
  });

  it('an auto save written with the upload is not taken for an older game', async () => {
    const cloud = memoryStorage();
    const prefs = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500, prefs });
    await pc.sync.connect('google');
    // The next visit opens the auto save written together with that upload.
    const again = device({ name: 'PC', cloudStorage: cloud, local: 1_000_000, prefs });
    await again.sync.start();
    expect(again.sync.status().offer).toBeNull();
  });

  it('regular uploads are spaced out; forced ones are not', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');
    const writes = pc.provider.writes;
    pc.tick(10);
    await pc.sync.backup();
    expect(pc.provider.writes).toBe(writes);
    await pc.sync.backup({ force: true });
    expect(pc.provider.writes).toBe(writes + 1);
    pc.tick(2000);
    await pc.sync.backup();
    expect(pc.provider.writes).toBe(writes + 2);
  });

  it('an expired sign-in stops uploads until the player connects again', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');
    pc.provider.expire();
    pc.tick(5000);
    await pc.sync.backup();
    expect(pc.sync.status().state).toBe('expired');
    const writes = pc.provider.writes;
    pc.tick(5000);
    await pc.sync.backup();
    expect(pc.provider.writes).toBe(writes);

    expect(await pc.sync.connect('google')).toBe(true);
    expect(pc.sync.status().state).toBe('connected');
    expect(pc.provider.writes).toBe(writes + 1);
  });

  it('a network failure shows an error and the next upload tries again', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    await pc.sync.connect('google');
    pc.provider.failNext = new Error('offline');
    pc.tick(5000);
    await pc.sync.backup();
    expect(pc.sync.status().state).toBe('error');
    pc.tick(5000);
    await pc.sync.backup();
    expect(pc.sync.status().state).toBe('connected');
  });

  it('a failed first read is retried by the next backup', async () => {
    const cloud = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: cloud, local: 500 });
    pc.provider.failNext = new Error('offline');
    await pc.sync.connect('google');
    expect(pc.sync.status().state).toBe('error');
    pc.tick(5000);
    await pc.sync.backup();
    expect(pc.sync.status().state).toBe('connected');
    expect(cloudSavedAt(cloud)).not.toBeNull();
  });

  it('closing the sign-in window leaves things as they were', async () => {
    const pc = device({ name: 'PC', cloudStorage: memoryStorage(), local: 500 });
    pc.provider.cancelNext = true;
    expect(await pc.sync.connect('google')).toBe(false);
    expect(pc.sync.status()).toMatchObject({ provider: null, state: 'off' });
  });

  it('reconnects on the next visit and remembers the last sync', async () => {
    const cloud = memoryStorage();
    const prefs = memoryStorage();
    const first = device({ name: 'PC', cloudStorage: cloud, local: 500, prefs });
    await first.sync.connect('google');
    expect(prefs.getItem(CLOUD_PREFS_KEY)).not.toBeNull();

    const again = device({ name: 'PC', cloudStorage: cloud, local: 2_000_000, prefs });
    await again.sync.start();
    expect(again.sync.status()).toMatchObject({ provider: 'google', state: 'connected', lastSyncedAt: 1_000_000 });
  });

  it('disconnecting forgets the provider', async () => {
    const prefs = memoryStorage();
    const pc = device({ name: 'PC', cloudStorage: memoryStorage(), local: 500, prefs });
    await pc.sync.connect('google');
    await pc.sync.disconnect();
    expect(pc.sync.status()).toMatchObject({ provider: null, state: 'off', lastSyncedAt: null });
    expect(prefs.getItem(CLOUD_PREFS_KEY)).toBeNull();
  });

  it('tells listeners about changes', async () => {
    const pc = device({ name: 'PC', cloudStorage: memoryStorage(), local: 500 });
    const states: string[] = [];
    pc.sync.onChange(() => states.push(pc.sync.status().state));
    await pc.sync.connect('google');
    expect(states).toContain('connecting');
    expect(states.at(-1)).toBe('connected');
  });
});

describe('cloud file', () => {
  it('round-trips a save', () => {
    const data = save(42);
    expect(parseCloudFile(JSON.parse(JSON.stringify(toCloudFile({ data, device: 'Mac · Safari' }))))).toEqual({ data, device: 'Mac · Safari' });
  });

  it('rejects anything else', () => {
    expect(parseCloudFile(null)).toBeNull();
    expect(parseCloudFile({ format: 'other', data: save(1) })).toBeNull();
    expect(parseCloudFile({ format: 'warehouse-tycoon-cloud', data: { nope: true } })).toBeNull();
  });
});

describe('createCloudProviders', () => {
  it('offers nothing without keys', () => {
    expect(createCloudProviders({})).toEqual([]);
    expect(createCloudProviders({ googleClientId: '  ' })).toEqual([]);
  });

  it('offers Google with a client ID', () => {
    expect(createCloudProviders({ googleClientId: 'abc.apps.googleusercontent.com' }, memoryStorage()).map((p) => p.id)).toEqual(['google']);
  });
});

describe('deviceName', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 0, 'iPhone · Safari'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 0, 'Mac · Chrome'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 5, 'iPad · Safari'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 0, 'Windows · Edge'],
    ['Mozilla/5.0 (Linux; Android 15; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 0, 'Android · Samsung Internet'],
    ['', 0, 'Browser'],
  ])('%s', (ua, touch, expected) => {
    expect(deviceName(ua, touch)).toBe(expected);
  });
});
