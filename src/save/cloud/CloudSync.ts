import type { CloudController, CloudProvider, CloudProviderId, CloudSave, CloudState, CloudStatus, SaveData } from '@/contracts';
import { CloudAuthError, CloudCancelledError } from './errors';
import { browserStorage, readJson, writeJson, type KeyValueStorage } from './storage';

export const CLOUD_PREFS_KEY = 'warehouse-tycoon.cloud';
/** Regular uploads are at most this often; leaving the tab and saving by hand upload at once. */
export const CLOUD_UPLOAD_INTERVAL_MS = 5 * 60 * 1000;

interface CloudPrefs {
  provider: CloudProviderId;
  lastSyncedAt: number | null;
  /** `savedAt` of the save this device last uploaded or loaded, so it is never offered back to it. */
  lastSavedAt?: number | null;
}

export interface CloudSyncOptions {
  /** Providers this build has keys for. */
  providers: CloudProvider[];
  /** The game as it is now. */
  current(): SaveData;
  /** When this device last saved its game (the auto save), `null` when it never did. */
  localSavedAt(): Promise<number | null>;
  /** Replaces the running game; `false` when the save cannot be read. */
  load(data: SaveData): boolean | Promise<boolean>;
  device: string;
  storage?: KeyValueStorage;
  now?: () => number;
  uploadIntervalMs?: number;
}

/**
 * Keeps the latest game in the player's cloud, whichever provider they chose.
 *
 * On connecting (or opening the game while connected) the cloud save is read first. When another device wrote it,
 * the player is asked whether to load it or keep this device's game, and nothing is uploaded until they choose;
 * save times are not trusted to decide, since a game left open keeps its auto save fresh without being played.
 * The same goes when this device's game is older than the cloud save or gone (site data cleared, say), even if the
 * cloud save is this device's own: a fresh game must never replace it unasked. Otherwise the current game is uploaded.
 * After that, `backup` uploads at most every few minutes, or at once when forced.
 * Every upload first checks that the cloud still holds this device's last save: a game left open on one device
 * must not overwrite what another device saved meanwhile, so that save is offered instead.
 */
export class CloudSync implements CloudController {
  private readonly byId: Map<CloudProviderId, CloudProvider>;
  private readonly storage: KeyValueStorage;
  private readonly now: () => number;
  private readonly uploadIntervalMs: number;
  private readonly listeners = new Set<() => void>();
  private provider: CloudProvider | null = null;
  private state: CloudState = 'off';
  private lastSyncedAt: number | null = null;
  private lastSavedAt: number | null = null;
  private lastUploadAt = 0;
  private offer: CloudSave | null = null;
  private offerNewer = false;
  private offerLocal: SaveData['summary'] | null = null;
  /** Uploads wait until the cloud save was compared with this device's game. */
  private checked = false;
  /** Cloud calls run one at a time. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: CloudSyncOptions) {
    this.byId = new Map(options.providers.map((provider) => [provider.id, provider]));
    this.storage = options.storage ?? browserStorage();
    this.now = options.now ?? Date.now;
    this.uploadIntervalMs = options.uploadIntervalMs ?? CLOUD_UPLOAD_INTERVAL_MS;
  }

  providers(): readonly CloudProviderId[] {
    return [...this.byId.keys()];
  }

  status(): CloudStatus {
    const offer = this.offer;
    return {
      provider: this.provider?.id ?? null,
      state: this.state,
      lastSyncedAt: this.lastSyncedAt,
      offer: offer
        ? {
            savedAt: offer.data.savedAt,
            newer: this.offerNewer,
            device: offer.device,
            summary: { ...offer.data.summary },
            local: { ...(this.offerLocal ?? this.options.current().summary) },
          }
        : null,
    };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  prepare(): void {
    const id = this.provider?.id ?? this.providers()[0];
    if (id) this.byId.get(id)?.prepare?.();
  }

  /** Reconnects to the provider chosen on an earlier visit, without any window. */
  async start(): Promise<void> {
    const prefs = readJson<CloudPrefs>(this.storage, CLOUD_PREFS_KEY);
    const provider = prefs ? this.byId.get(prefs.provider) : undefined;
    if (!prefs || !provider) return;
    this.provider = provider;
    this.lastSyncedAt = prefs.lastSyncedAt ?? null;
    this.lastSavedAt = prefs.lastSavedAt ?? null;
    this.setState('connecting');
    let result: Awaited<ReturnType<CloudProvider['restore']>>;
    try {
      result = await provider.restore();
    } catch (error) {
      console.error(error);
      result = 'expired';
    }
    if (result === 'off') {
      this.forget();
      return;
    }
    if (result === 'expired') {
      this.setState('expired');
      return;
    }
    this.setState('connected');
    await this.enqueue(() => this.check());
  }

  async connect(id: CloudProviderId): Promise<boolean> {
    const provider = this.byId.get(id);
    if (!provider) return false;
    const before = this.state;
    const wasProvider = this.provider;
    // The sign-in popup has to open inside the click, so nothing is awaited before this call.
    const signIn = provider.connect();
    this.setState('connecting');
    try {
      await signIn;
    } catch (error) {
      this.provider = wasProvider;
      this.setState(before === 'connecting' ? 'off' : before);
      if (error instanceof CloudCancelledError) return false;
      throw error;
    }
    if (wasProvider && wasProvider !== provider) await wasProvider.disconnect().catch(() => undefined);
    if (wasProvider !== provider) {
      this.lastSyncedAt = null;
      this.lastSavedAt = null;
    }
    this.provider = provider;
    this.checked = false;
    this.savePrefs();
    this.setState('connected');
    await this.enqueue(() => this.check());
    return true;
  }

  async disconnect(): Promise<void> {
    const provider = this.provider;
    await this.queue.catch(() => undefined);
    if (provider) await provider.disconnect().catch((error: unknown) => console.error(error));
    this.forget();
  }

  /**
   * Uploads the game; skipped while there is nothing to upload to or an offer is waiting. Pass the `data` just
   * written as the auto save, so the two carry the same time and the next visit does not see the cloud as newer.
   */
  backup(options: { force?: boolean; data?: SaveData } = {}): Promise<void> {
    // A first read that failed (offline, say) is tried again on the same schedule as uploads.
    const retryCheck = this.provider !== null && !this.checked && this.state === 'error';
    if (!retryCheck && !this.canUpload()) return Promise.resolve();
    if (!options.force && this.now() - this.lastUploadAt < this.uploadIntervalMs) return Promise.resolve();
    // Counted from the start, so the timer does not queue a second upload behind a slow one.
    this.lastUploadAt = this.now();
    return this.enqueue(() => (retryCheck ? this.check() : this.upload({ ...(options.data ? { data: options.data } : {}) })));
  }

  async syncNow(): Promise<void> {
    if (!this.provider || this.state === 'expired') return;
    if (!this.checked) {
      await this.enqueue(() => this.check());
      return;
    }
    if (this.offer) return;
    this.lastUploadAt = this.now();
    await this.enqueue(() => this.upload({ rethrow: true }));
  }

  async loadFromCloud(): Promise<boolean> {
    if (!this.provider) return false;
    return this.enqueue(async () => {
      const save = await this.call(() => this.provider!.read());
      return save ? this.adopt(save) : false;
    });
  }

  async acceptOffer(): Promise<boolean> {
    const offer = this.offer;
    if (!offer) return false;
    return this.adopt(offer);
  }

  async dismissOffer(): Promise<void> {
    if (!this.offer) return;
    this.offer = null;
    this.emit();
    // The player chose this device's game, so it replaces whatever the cloud holds.
    if (!this.canUpload()) return;
    this.lastUploadAt = this.now();
    await this.enqueue(() => this.upload({ overwrite: true }));
  }

  private canUpload(): boolean {
    return this.provider !== null && this.checked && this.offer === null && (this.state === 'connected' || this.state === 'error');
  }

  /** Reads the cloud save and either offers it or uploads this device's game over it. */
  private async check(): Promise<void> {
    if (!this.provider) return;
    let cloud: CloudSave | null;
    try {
      cloud = await this.call(() => this.provider!.read());
    } catch {
      return;
    }
    this.checked = true;
    const local = await this.options.localSavedAt().catch(() => null);
    if (cloud && (this.fromElsewhere(cloud) || local === null || local < cloud.data.savedAt)) {
      await this.offerSave(cloud);
      return;
    }
    this.offer = null;
    this.lastUploadAt = this.now();
    // Just read, so there is no need to read again before writing.
    await this.upload({ overwrite: true });
  }

  private async upload(options: { rethrow?: boolean; overwrite?: boolean; data?: SaveData } = {}): Promise<void> {
    if (!this.provider) return;
    const data = options.data ?? this.options.current();
    try {
      if (!options.overwrite) {
        const cloud = await this.call(() => this.provider!.read());
        if (cloud && this.fromElsewhere(cloud)) {
          await this.offerSave(cloud);
          return;
        }
      }
      await this.call(() => this.provider!.write({ data, device: this.options.device }));
    } catch (error) {
      if (options.rethrow) throw error;
      return;
    }
    this.lastSavedAt = data.savedAt;
    this.lastSyncedAt = this.now();
    this.savePrefs();
    this.emit();
  }

  /** A save another device wrote after this device's last upload or load (or any save, before the first). */
  private fromElsewhere(cloud: CloudSave): boolean {
    return this.lastSavedAt === null || cloud.data.savedAt > this.lastSavedAt;
  }

  private async offerSave(cloud: CloudSave): Promise<void> {
    const local = await this.options.localSavedAt().catch(() => null);
    this.offer = cloud;
    this.offerNewer = local === null || cloud.data.savedAt > local;
    this.offerLocal = this.options.current().summary;
    this.emit();
  }

  /** Loads a cloud save into the game; the next upload then carries on from it. */
  private async adopt(save: CloudSave): Promise<boolean> {
    const ok = await this.options.load(save.data);
    if (ok) {
      this.offer = null;
      this.checked = true;
      this.lastSavedAt = save.data.savedAt;
      this.lastSyncedAt = this.now();
      this.lastUploadAt = this.now();
      this.savePrefs();
    }
    this.emit();
    return ok;
  }

  /** Runs one cloud call, keeping the state in step: syncing while it runs, expired or error when it fails. */
  private async call<T>(work: () => Promise<T>): Promise<T> {
    this.setState('syncing');
    try {
      const result = await work();
      this.setState('connected');
      return result;
    } catch (error) {
      if (error instanceof CloudAuthError) {
        this.setState('expired');
      } else {
        console.error(error);
        this.setState('error');
      }
      throw error;
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private savePrefs(): void {
    if (this.provider) writeJson(this.storage, CLOUD_PREFS_KEY, { provider: this.provider.id, lastSyncedAt: this.lastSyncedAt, lastSavedAt: this.lastSavedAt } satisfies CloudPrefs);
  }

  private forget(): void {
    this.provider = null;
    this.offer = null;
    this.checked = false;
    this.lastSyncedAt = null;
    this.lastSavedAt = null;
    try {
      this.storage.removeItem(CLOUD_PREFS_KEY);
    } catch {
      // Nothing to forget.
    }
    this.setState('off');
  }

  private setState(state: CloudState): void {
    if (this.state === state) return;
    this.state = state;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
