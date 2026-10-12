import type { ManualSaveEntry, SaveData, SaveStore } from '@/contracts';
import { migrate } from './migrations';
import { createSaveId, toEntry } from './shared';

/** Keeps saves in memory. Used in tests and as a fallback where IndexedDB is unavailable. */
export class MemorySaveStore implements SaveStore {
  private auto: SaveData | null = null;
  private readonly manual = new Map<string, SaveData>();

  async putAuto(data: SaveData): Promise<void> {
    this.auto = structuredClone(data);
  }

  async getAuto(): Promise<SaveData | null> {
    return this.auto ? migrate(structuredClone(this.auto)) : null;
  }

  async addManual(data: SaveData): Promise<ManualSaveEntry> {
    const id = createSaveId(data.savedAt);
    this.manual.set(id, structuredClone(data));
    return toEntry(id, data);
  }

  async listManual(): Promise<ManualSaveEntry[]> {
    return [...this.manual.entries()]
      .map(([id, data]) => toEntry(id, data))
      .sort((a, b) => b.savedAt - a.savedAt || (a.id < b.id ? 1 : -1));
  }

  async getManual(id: string): Promise<SaveData | null> {
    const data = this.manual.get(id);
    return data ? migrate(structuredClone(data)) : null;
  }

  async deleteManual(id: string): Promise<void> {
    this.manual.delete(id);
  }

  async clear(): Promise<void> {
    this.auto = null;
    this.manual.clear();
  }
}
