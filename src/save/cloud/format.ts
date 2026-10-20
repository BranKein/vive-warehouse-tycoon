import type { CloudSave } from '@/contracts';
import { isSaveData } from '../migrations';

/**
 * The JSON every provider stores: one file (Google Drive) or one record field (iCloud).
 * `data` is the usual save; it goes through `migrate` when it is loaded, like a local one.
 */
export const CLOUD_FILE_FORMAT = 'warehouse-tycoon-cloud';
export const CLOUD_FILE_VERSION = 1;

export interface CloudFile {
  format: typeof CLOUD_FILE_FORMAT;
  version: number;
  device: string;
  data: CloudSave['data'];
}

export const toCloudFile = (save: CloudSave): CloudFile => ({
  format: CLOUD_FILE_FORMAT,
  version: CLOUD_FILE_VERSION,
  device: save.device,
  data: save.data,
});

/** `null` when the content is not a cloud save this build understands. */
export function parseCloudFile(value: unknown): CloudSave | null {
  if (typeof value !== 'object' || value === null) return null;
  const file = value as Partial<CloudFile>;
  if (file.format !== CLOUD_FILE_FORMAT || !isSaveData(file.data)) return null;
  return { data: file.data, device: typeof file.device === 'string' ? file.device : '' };
}
