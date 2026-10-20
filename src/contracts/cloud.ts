import type { SaveData, SaveSummary } from './save';

/**
 * Cloud saves keep the latest game of any device in the player's own cloud account, with no server of ours.
 * Each service is one `CloudProvider`; adding one (Apple's iCloud next) does not touch the sync logic or the UI.
 */
export type CloudProviderId = 'google' | 'apple';

/** What the cloud holds: the latest save and the device that wrote it. */
export interface CloudSave {
  data: SaveData;
  /** Rough device name such as "iPhone · Safari", shown when another device offers its save. */
  device: string;
}

/** How a provider finds its earlier session when the page opens. */
export type CloudRestoreResult = 'connected' | 'expired' | 'off';

/** One cloud service. Implemented in `src/save/cloud/<service>/`. */
export interface CloudProvider {
  readonly id: CloudProviderId;
  /** Loads what `connect` needs, so the sign-in window can open straight from the click. */
  prepare?(): void;
  /** Picks up the session kept from an earlier visit without showing anything. */
  restore(): Promise<CloudRestoreResult>;
  /**
   * Signs in. Must be called straight from a click: the sign-in window is a popup.
   * Rejects with `CloudCancelledError` when the player closes it or declines.
   */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** `null` when nothing was saved yet. Rejects with `CloudAuthError` when the sign-in ran out. */
  read(): Promise<CloudSave | null>;
  write(save: CloudSave): Promise<void>;
}

export type CloudState = 'off' | 'connecting' | 'connected' | 'syncing' | 'expired' | 'error';

/** A cloud save another device wrote, waiting for the player to load it or keep this device's game. */
export interface CloudOffer {
  savedAt: number;
  /** Saved later than this device's own game. */
  newer: boolean;
  device: string;
  summary: SaveSummary;
  /** This device's game as it is now, to compare with. */
  local: SaveSummary;
}

export interface CloudStatus {
  provider: CloudProviderId | null;
  state: CloudState;
  /** Epoch milliseconds of the last upload or download. */
  lastSyncedAt: number | null;
  offer: CloudOffer | null;
}

/** Cloud actions exposed to the UI; wired by the app. Left out when the build has no provider keys. */
export interface CloudController {
  /** Providers this build can use, in the order the buttons show. */
  providers(): readonly CloudProviderId[];
  status(): CloudStatus;
  onChange(listener: () => void): () => void;
  /** Lets the chosen provider load its sign-in script ahead of the click. */
  prepare(): void;
  /** Resolves `false` when the player closed the sign-in window. Call straight from a click. */
  connect(id: CloudProviderId): Promise<boolean>;
  disconnect(): Promise<void>;
  /** Uploads the current game now (or retries after an error). */
  syncNow(): Promise<void>;
  /** Replaces the current game with the cloud save. `false` when there is none or it cannot be read. */
  loadFromCloud(): Promise<boolean>;
  /** Loads the offered save. */
  acceptOffer(): Promise<boolean>;
  /** Keeps this device's game; the next upload replaces the cloud save. */
  dismissOffer(): Promise<void>;
}
