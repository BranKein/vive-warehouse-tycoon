import type { CloudProvider, CloudProviderId, CloudRestoreResult, CloudSave } from '@/contracts';
import { CloudAuthError, CloudCancelledError } from './errors';
import { parseCloudFile, toCloudFile } from './format';
import { memoryStorage, readJson, writeJson, type KeyValueStorage } from './storage';

export const FAKE_CLOUD_KEY = 'warehouse-tycoon.cloud.fake';
const SESSION_KEY = 'warehouse-tycoon.cloud.fake.session';

export interface MemoryCloudOptions {
  /** Which provider it stands in for; the buttons and messages follow it. */
  id?: CloudProviderId;
  /** Where the "cloud" lives. Given `localStorage`, every tab of the dev server shares it like two devices would. */
  storage?: KeyValueStorage;
}

/**
 * A cloud without a network, for tests and for the dev server (`?cloud=fake`).
 * `failNext`, `expire` and `cancelNext` let tests walk through the unhappy paths.
 */
export class MemoryCloudProvider implements CloudProvider {
  readonly id: CloudProviderId;
  private readonly storage: KeyValueStorage;
  private connected = false;
  failNext: Error | null = null;
  cancelNext = false;
  reads = 0;
  writes = 0;

  constructor(options: MemoryCloudOptions = {}) {
    this.id = options.id ?? 'google';
    this.storage = options.storage ?? memoryStorage();
  }

  async restore(): Promise<CloudRestoreResult> {
    const session = readJson<{ connected: boolean }>(this.storage, SESSION_KEY);
    this.connected = session?.connected === true;
    return session === null ? 'off' : this.connected ? 'connected' : 'expired';
  }

  connect(): Promise<void> {
    if (this.cancelNext) {
      this.cancelNext = false;
      return Promise.reject(new CloudCancelledError());
    }
    this.connected = true;
    writeJson(this.storage, SESSION_KEY, { connected: true });
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.storage.removeItem(SESSION_KEY);
  }

  /** As if the sign-in ran out. */
  expire(): void {
    this.connected = false;
    writeJson(this.storage, SESSION_KEY, { connected: false });
  }

  async read(): Promise<CloudSave | null> {
    this.guard();
    this.reads += 1;
    return parseCloudFile(readJson(this.storage, FAKE_CLOUD_KEY));
  }

  async write(save: CloudSave): Promise<void> {
    this.guard();
    this.writes += 1;
    writeJson(this.storage, FAKE_CLOUD_KEY, toCloudFile(save));
  }

  private guard(): void {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    if (!this.connected) throw new CloudAuthError();
  }
}
