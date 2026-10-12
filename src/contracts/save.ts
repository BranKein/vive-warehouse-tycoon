export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Shown in the save list without having to parse the whole save. */
export interface SaveSummary {
  /** BigNum in its string form. */
  money: string;
  buildings: number;
  playSeconds: number;
}

export interface SaveData {
  /** Format version; older versions are upgraded step by step on load. */
  version: number;
  /** Epoch milliseconds. */
  savedAt: number;
  summary: SaveSummary;
  /** Opaque to everything except the simulation. */
  state: JsonValue;
}

export interface ManualSaveEntry {
  id: string;
  savedAt: number;
  summary: SaveSummary;
}

/** Persistence backend. Implemented with IndexedDB in the browser and in memory for tests. */
export interface SaveStore {
  putAuto(data: SaveData): Promise<void>;
  getAuto(): Promise<SaveData | null>;
  /** Adds a new manual save; there is no limit on how many exist. */
  addManual(data: SaveData): Promise<ManualSaveEntry>;
  listManual(): Promise<ManualSaveEntry[]>;
  getManual(id: string): Promise<SaveData | null>;
  deleteManual(id: string): Promise<void>;
  /** Removes the auto save and every manual save. */
  clear(): Promise<void>;
}

/** Save actions exposed to the UI; wired by the app to the engine and the store. */
export interface SaveController {
  saveManual(): Promise<ManualSaveEntry>;
  listManual(): Promise<ManualSaveEntry[]>;
  loadManual(id: string): Promise<boolean>;
  deleteManual(id: string): Promise<void>;
  hasAuto(): Promise<boolean>;
  loadAuto(): Promise<boolean>;
  /** Wipes all saves and starts a new game. */
  reset(): Promise<void>;
}
