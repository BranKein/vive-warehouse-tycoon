import type { BigNum } from '@/core/BigNum';
import type { GameCommands, GameEvent } from './commands';
import type { ContentCatalog, FacilityId, PlotId } from './defs';
import type { SaveController, SaveData } from './save';
import type { BuildingId, GameSnapshot, VehicleId } from './snapshot';

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
  | { type: 'facility'; facilityId: FacilityId }
  | { type: 'vehicle'; vehicleId: VehicleId };

export type PickTarget = Selection | { type: 'specialCargo'; id: string };

/** The 3D view. Implemented in `src/render`. */
/** The looks (colour grades) the picture can be drawn in, and the one in use. Remembered by the renderer. */
export interface LookControl {
  readonly names: readonly string[];
  current(): string;
  set(name: string): void;
}

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
  /** Called as the pointer moves over the scene; `null` when it leaves the scene or picks a building up. */
  onHover(listener: (target: PickTarget | null, clientX: number, clientY: number) => void): void;
  /** Called when a building that was picked up (double-click and hold) is dropped on a plot or another building. */
  onDrop(listener: (buildingId: BuildingId, target: PickTarget) => void): void;
  /**
   * Called every frame while a vehicle is selected with the point on the page just above it,
   * and once with `null` when there is no such point any more.
   */
  onVehicleAnchor(listener: (anchor: ScreenPoint | null) => void): void;
  handleEvents(events: GameEvent[]): void;
  readonly looks: LookControl;
  dispose(): void;
}

/** A point on the page, in client pixels. */
export interface ScreenPoint {
  clientX: number;
  clientY: number;
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
  /** Lets the settings offer the looks; left out where there is no 3D view. */
  looks?: LookControl;
}

/** The HTML overlay. Implemented in `src/ui`. */
export interface GameUI {
  update(snapshot: GameSnapshot): void;
  setSelection(selection: Selection): void;
  /** What the pointer is over in the 3D view, and where on the page; `null` hides the hover card. */
  setHover(target: PickTarget | null, clientX: number, clientY: number): void;
  /** Where the selected vehicle is on the page; its card stays beside that point. */
  setVehicleAnchor(anchor: ScreenPoint | null): void;
  handleEvents(events: GameEvent[]): void;
  /** Shown when the tab was hidden for a long time. */
  showAwayNotice(earned: BigNum, awaySeconds: number): void;
  dispose(): void;
}
