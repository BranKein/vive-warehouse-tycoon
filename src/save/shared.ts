import type { ManualSaveEntry, SaveData } from '@/contracts';

let counter = 0;

/** Unique, and sortable by creation time within one session. */
export function createSaveId(savedAt: number): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${Math.floor(savedAt).toString(36)}-${counter.toString(36)}-${random}`;
}

export const toEntry = (id: string, data: SaveData): ManualSaveEntry => ({
  id,
  savedAt: data.savedAt,
  summary: { ...data.summary },
});
