import type { BigNum } from '@/core/BigNum';
import type { GameCommands, GameEvent } from './commands';
import type { ContentCatalog, FacilityId, PlotId } from './defs';
import type { SaveController, SaveData } from './save';
import type { BuildingId, GameSnapshot } from './snapshot';

/** The simulation as seen by the app. Implemented in `src/sim`. */
export interface GameEngine {
  readonly catalog: ContentCatalog;
  readonly commands: GameCommands;
  /** Advances the simulation by `count` ticks (default 1). */
  tick(count?: number): void;
  /** Builds a fresh read model of the current state. */
  snapshot(): GameSnapshot;
  /** Returns and clears the events raised since the last call. */
  drainEvents(): GameEvent[];
  serialize(): SaveData;
}

export interface CreateGameOptions {
  catalog: ContentCatalog;
  seed?: number;
  /** When given, the game is restored from this save instead of starting fresh. */
  save?: SaveData;
}

export type Selection =
  | { type: 'none' }
  | { type: 'plot'; plotId: PlotId }
  | { type: 'building'; buildingId: BuildingId }
  | { type: 'facility'; facilityId: FacilityId };

export type PickTarget = Selection | { type: 'specialCargo'; id: string };

/** The 3D view. Implemented in `src/render`. */
export interface GameRenderer {
  /**
   * Draws one frame. `prev` and `curr` are the snapshots of the last two
   * ticks and `alpha` (0..1) is how far the frame sits between them.
   */
  render(prev: GameSnapshot, curr: GameSnapshot, alpha: number, realTimeSec: number): void;
  resize(width: number, height: number): void;
  setSelection(selection: Selection): void;
  /** Called when the player left-clicks something in the scene. */
  onPick(listener: (target: PickTarget) => void): void;
  handleEvents(events: GameEvent[]): void;
  dispose(): void;
}

export interface RendererOptions {
  catalog: ContentCatalog;
}

export interface UIDeps {
  catalog: ContentCatalog;
  commands: GameCommands;
  saves: SaveController;
  /** Called when the player changes the selection from the UI side. */
  onSelectionChange(selection: Selection): void;
}

/** The HTML overlay. Implemented in `src/ui`. */
export interface GameUI {
  update(snapshot: GameSnapshot): void;
  setSelection(selection: Selection): void;
  handleEvents(events: GameEvent[]): void;
  /** Shown when the tab was hidden for a long time. */
  showAwayNotice(earned: BigNum, awaySeconds: number): void;
  dispose(): void;
}
