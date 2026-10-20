import type { SaveStore } from '@/contracts';
import { IndexedDbSaveStore, type IndexedDbSaveStoreOptions } from './IndexedDbSaveStore';
import { MemorySaveStore } from './MemorySaveStore';

export { IndexedDbSaveStore, DEFAULT_DB_NAME, type IndexedDbSaveStoreOptions } from './IndexedDbSaveStore';
export { MemorySaveStore } from './MemorySaveStore';
export {
  CURRENT_SAVE_VERSION,
  MIGRATIONS,
  SaveFormatError,
  isSaveData,
  migrate,
  type MigrationStep,
  type SaveErrorCode,
} from './migrations';

/** IndexedDB where it exists, otherwise memory (saves then last only until the page closes). */
export function createSaveStore(options: IndexedDbSaveStoreOptions = {}): SaveStore {
  if (options.factory || typeof indexedDB !== 'undefined') return new IndexedDbSaveStore(options);
  return new MemorySaveStore();
}
export * from './cloud';
