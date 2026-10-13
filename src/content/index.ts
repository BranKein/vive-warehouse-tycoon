import type { ContentCatalog, IslandDef } from '@/contracts';
import { BUILDINGS, BUILDING_UNLOCKS } from './buildings';
import { CHANNEL_UNLOCKS, INBOUND_CHANNELS, SALE_CHANNELS } from './channels';
import { ITEMS } from './items';
import { ISLAND_ONE_LAYOUT } from './layout';
import { RECIPES } from './recipes';
import { GLOBAL_TRACKS, UPGRADE_TRACKS } from './upgrades';

const byId = <T extends { id: string }>(list: readonly T[]): Record<string, T> =>
  Object.fromEntries(list.map((entry) => [entry.id, entry]));

/** The first island sells a bit of everything. Themed islands are added as further definitions. */
const ISLAND_ONE: IslandDef = {
  id: 'island.one',
  layout: ISLAND_ONE_LAYOUT,
  maxBuildings: 48,
  buildingTypes: BUILDINGS.map((building) => building.id),
  inbound: 'inbound.truck',
  saleChannels: SALE_CHANNELS.map((channel) => channel.id),
  start: {
    money: 0,
    buildings: [{ plot: 'p2-0', type: 'sawmill' }],
  },
};

export const catalog: ContentCatalog = {
  items: byId(ITEMS),
  recipes: byId(RECIPES),
  buildings: byId(BUILDINGS),
  upgradeTracks: byId(UPGRADE_TRACKS),
  unlocks: byId([...BUILDING_UNLOCKS, ...CHANNEL_UNLOCKS]),
  inboundChannels: byId(INBOUND_CHANNELS),
  saleChannels: byId(SALE_CHANNELS),
  islands: byId([ISLAND_ONE]),
  globalUpgradeTracks: GLOBAL_TRACKS,
  startIsland: ISLAND_ONE.id,
};
