import type { ManualSaveEntry, SaveData, SaveStore } from '@/contracts';
import { migrate } from './migrations';
import { createSaveId, toEntry } from './shared';

export const DEFAULT_DB_NAME = 'warehouse-tycoon';
/** Version of the database layout (object stores), unrelated to the save format version. */
const DB_SCHEMA_VERSION = 1;
const AUTO_STORE = 'auto';
const MANUAL_STORE = 'manual';
const AUTO_KEY = 'auto';

interface ManualRecord {
  id: string;
  data: SaveData;
}

export interface IndexedDbSaveStoreOptions {
  dbName?: string;
  /** Defaults to the global `indexedDB`; tests pass a fake. */
  factory?: IDBFactory;
}

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

/** One auto save slot and an unbounded list of manual saves, kept in IndexedDB. */
export class IndexedDbSaveStore implements SaveStore {
  private readonly dbName: string;
  private readonly factory: IDBFactory;
  private db: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDbSaveStoreOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    const factory = options.factory ?? (typeof indexedDB === 'undefined' ? undefined : indexedDB);
    if (!factory) throw new Error('IndexedDB is not available');
    this.factory = factory;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        const req = this.factory.open(this.dbName, DB_SCHEMA_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(AUTO_STORE)) db.createObjectStore(AUTO_STORE);
          if (!db.objectStoreNames.contains(MANUAL_STORE)) db.createObjectStore(MANUAL_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          const db = req.result;
          // Let another tab upgrade the database; we reopen on the next call.
          db.onversionchange = () => {
            db.close();
            this.db = null;
          };
          resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
        req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
      });
      this.db = opening;
      // A failed open must not be cached, or the store would stay broken forever.
      opening.catch(() => {
        if (this.db === opening) this.db = null;
      });
    }
    return this.db;
  }

  private async run<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(stores, mode);
    const finished = done(tx);
    const [result] = await Promise.all([work(tx), finished]);
    return result;
  }

  async putAuto(data: SaveData): Promise<void> {
    await this.run([AUTO_STORE], 'readwrite', (tx) => {
      tx.objectStore(AUTO_STORE).put(data, AUTO_KEY);
    });
  }

  async getAuto(): Promise<SaveData | null> {
    const raw = await this.run([AUTO_STORE], 'readonly', (tx) =>
      request<unknown>(tx.objectStore(AUTO_STORE).get(AUTO_KEY)),
    );
    return raw === undefined || raw === null ? null : migrate(raw);
  }

  async addManual(data: SaveData): Promise<ManualSaveEntry> {
    const record: ManualRecord = { id: createSaveId(data.savedAt), data };
    await this.run([MANUAL_STORE], 'readwrite', (tx) => {
      tx.objectStore(MANUAL_STORE).add(record);
    });
    return toEntry(record.id, data);
  }

  async listManual(): Promise<ManualSaveEntry[]> {
    const records = await this.run([MANUAL_STORE], 'readonly', (tx) =>
      request<ManualRecord[]>(tx.objectStore(MANUAL_STORE).getAll()),
    );
    return records
      .map((record) => toEntry(record.id, record.data))
      .sort((a, b) => b.savedAt - a.savedAt || (a.id < b.id ? 1 : -1));
  }

  async getManual(id: string): Promise<SaveData | null> {
    const record = await this.run([MANUAL_STORE], 'readonly', (tx) =>
      request<ManualRecord | undefined>(tx.objectStore(MANUAL_STORE).get(id)),
    );
    return record ? migrate(record.data) : null;
  }

  async deleteManual(id: string): Promise<void> {
    await this.run([MANUAL_STORE], 'readwrite', (tx) => {
      tx.objectStore(MANUAL_STORE).delete(id);
    });
  }

  async clear(): Promise<void> {
    await this.run([AUTO_STORE, MANUAL_STORE], 'readwrite', (tx) => {
      tx.objectStore(AUTO_STORE).clear();
      tx.objectStore(MANUAL_STORE).clear();
    });
  }

  /** Closes the connection (tests, hot reload). The store reopens on the next call. */
  async close(): Promise<void> {
    const opening = this.db;
    this.db = null;
    if (opening) (await opening.catch(() => null))?.close();
  }
}
