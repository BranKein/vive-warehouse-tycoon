import type { CloudProvider } from '@/contracts';
import { GoogleDriveProvider } from './google/GoogleDriveProvider';
import { MemoryCloudProvider } from './MemoryCloudProvider';
import type { KeyValueStorage } from './storage';

export { CloudSync, CLOUD_PREFS_KEY, CLOUD_UPLOAD_INTERVAL_MS, type CloudSyncOptions } from './CloudSync';
export { CloudAuthError, CloudCancelledError } from './errors';
export { CLOUD_FILE_FORMAT, parseCloudFile, toCloudFile, type CloudFile } from './format';
export { currentDeviceName, deviceName } from './deviceName';
export { GoogleDriveProvider, DRIVE_APPDATA_SCOPE, DRIVE_FILE_NAME, GOOGLE_SESSION_KEY, type GoogleDriveOptions } from './google/GoogleDriveProvider';
export { MemoryCloudProvider, FAKE_CLOUD_KEY, type MemoryCloudOptions } from './MemoryCloudProvider';
export { browserStorage, memoryStorage, type KeyValueStorage } from './storage';

/** Keys the build was given. Empty values leave that provider out. */
export interface CloudKeys {
  googleClientId?: string;
  /** Dev server only: a pretend cloud in `localStorage`, shared by every tab like separate devices. */
  fake?: boolean;
}

/**
 * The providers this build can offer, in button order.
 * Adding Apple later: an `ICloudProvider` in `./apple/` (CloudKit JS, private database, storing `toCloudFile`
 * JSON in one record), its keys here, and its labels in the translations. Nothing else changes.
 */
export function createCloudProviders(keys: CloudKeys, storage?: KeyValueStorage): CloudProvider[] {
  if (keys.fake) return [new MemoryCloudProvider({ id: 'google', ...(storage ? { storage } : {}) })];
  const providers: CloudProvider[] = [];
  const googleClientId = keys.googleClientId?.trim();
  if (googleClientId) providers.push(new GoogleDriveProvider({ clientId: googleClientId, ...(storage ? { storage } : {}) }));
  return providers;
}
