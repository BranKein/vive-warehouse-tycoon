import type { BigNum } from '@/core/BigNum';
import type {
  AchievementId,
  BuildingTypeId,
  ChannelId,
  IslandId,
  PlotId,
  UnlockId,
  UpgradeScope,
  UpgradeTrackId,
} from './defs';
import type { BuildingId, GameSpeed } from './snapshot';

export type CommandFailure =
  | 'notEnoughMoney'
  | 'locked'
  | 'plotOccupied'
  | 'islandFull'
  | 'typeFull'
  | 'maxLevel'
  | 'notFound'
  | 'requirementsNotMet'
  | 'alreadyUnlocked';

export type CommandResult = { ok: true } | { ok: false; reason: CommandFailure };

/** Everything the player (or auto mode) can do. All calls are synchronous and take effect immediately. */
export interface GameCommands {
  build(plotId: PlotId, typeId: BuildingTypeId): CommandResult;
  demolish(buildingId: BuildingId): CommandResult;
  /** Moves a building to another plot. A building already standing there takes the plot that was left. */
  moveBuilding(buildingId: BuildingId, plotId: PlotId): CommandResult;
  upgradeBuilding(buildingId: BuildingId, trackId: UpgradeTrackId): CommandResult;
  /** Upgrades an inbound or sale channel. */
  upgradeChannel(channelId: ChannelId, trackId: UpgradeTrackId): CommandResult;
  upgradeGlobal(trackId: UpgradeTrackId): CommandResult;
  unlock(unlockId: UnlockId): CommandResult;
  collectSpecialCargo(id: string): CommandResult;
  setSpeed(speed: GameSpeed): void;
  setAutoPilot(enabled: boolean): void;
  switchIsland(islandId: IslandId): CommandResult;
}

export type GameEvent =
  | { type: 'buildingBuilt'; buildingId: BuildingId; typeId: BuildingTypeId; plotId: PlotId }
  | { type: 'buildingDemolished'; buildingId: BuildingId; plotId: PlotId; refund: BigNum }
  | { type: 'buildingMoved'; buildingId: BuildingId; plotId: PlotId; swappedWith: BuildingId | null }
  | { type: 'upgraded'; scope: UpgradeScope; targetId: string | null; trackId: UpgradeTrackId; level: number }
  | { type: 'unlocked'; unlockId: UnlockId }
  | { type: 'sale'; channelId: ChannelId; amount: BigNum; x: number; z: number }
  | { type: 'specialCargoSpawned'; id: string }
  | { type: 'specialCargoCollected'; id: string; reward: BigNum }
  | { type: 'islandSwitched'; islandId: IslandId }
  | { type: 'achievementUnlocked'; achievementId: AchievementId; /** Sale bonus from all achievements now, e.g. 0.05. */ saleBonus: number };
