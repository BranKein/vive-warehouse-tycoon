/**
 * Fake read model for developing the renderer and the UI before (or without)
 * the simulation. It is driven only by time, so vehicles move and numbers
 * change, but nothing here follows the real game rules.
 */
import type {
  BuildingStatus,
  BuildingView,
  ContentCatalog,
  FacilityView,
  GameSnapshot,
  StockView,
  UpgradeTrackId,
  UpgradeView,
  Vec3,
  VehicleView,
} from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';
import { TICKS_PER_SECOND } from '@/core/time';

const stock = (item: string, amount: number, capacity: number | null = 40): StockView => ({
  item,
  amount: bn(amount),
  capacity: capacity === null ? null : bn(capacity),
});

function upgradeView(catalog: ContentCatalog, trackId: UpgradeTrackId, level: number, money: BigNum): UpgradeView {
  const track = catalog.upgradeTracks[trackId]!;
  const valueAt = (lv: number): BigNum =>
    track.effect.kind === 'multiply' ? bn(track.effect.perLevel).pow(lv) : bn(1 + track.effect.perLevel * lv);
  const maxed = track.maxLevel !== null && level >= track.maxLevel;
  const cost = maxed ? null : bn(track.baseCost).mul(bn(track.costGrowth).pow(level));
  return {
    trackId,
    stat: track.stat,
    unit: track.unit,
    level,
    maxLevel: track.maxLevel,
    cost,
    affordable: cost !== null && money.gte(cost),
    current: valueAt(level),
    next: maxed ? null : valueAt(level + 1),
  };
}

/** Position on a polyline at parameter t in [0, 1], with the heading of the current segment. */
function along(points: Vec3[], t: number): { x: number; y: number; z: number; heading: number } {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    lengths.push(length);
    total += length;
  }
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i]!;
    const a = points[i]!;
    const b = points[i + 1]!;
    if (remaining <= length || i === lengths.length - 1) {
      const k = length === 0 ? 0 : Math.min(1, remaining / length);
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        z: a.z + (b.z - a.z) * k,
        heading: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    remaining -= length;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y, z: last.z, heading: 0 };
}

/** 0 -> 1 -> 0 over `period` seconds. */
const pingPong = (timeSec: number, period: number, offset = 0): number => {
  const phase = ((timeSec + offset) % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
};

const FIXTURE_BUILDINGS: Array<{ plot: string; type: string; status: BuildingStatus; level: number; waste: number }> = [
  { plot: 'p2-0', type: 'sawmill', status: 'working', level: 4, waste: 0 },
  { plot: 'p2-1', type: 'steelMill', status: 'working', level: 2, waste: 1.3 },
  { plot: 'p3-0', type: 'textileMill', status: 'working', level: 1, waste: 0 },
  { plot: 'p3-1', type: 'furnitureFactory', status: 'starved', level: 0, waste: 0 },
  { plot: 'p2-2', type: 'wasteDisposal', status: 'idle', level: 0, waste: 0 },
  { plot: 'p1-3', type: 'applianceFactory', status: 'outputFull', level: 0, waste: 0.4 },
  { plot: 'p4-5', type: 'handmadeWorkshop', status: 'working', level: 0, waste: 0 },
];

export function createFixtureSnapshot(catalog: ContentCatalog, timeSec: number): GameSnapshot {
  const island = catalog.islands[catalog.startIsland]!;
  const layout = island.layout;
  const money = bn(1234.5).mul(bn(1.02).pow(timeSec)).add(bn('4.2e7'));
  const node = (id: string): Vec3 => {
    const found = layout.roadNodes.find((n) => n.id === id)!;
    return { x: found.x, y: 0, z: found.z };
  };

  const buildings: BuildingView[] = FIXTURE_BUILDINGS.map((entry, index) => {
    const def = catalog.buildings[entry.type]!;
    const recipe = catalog.recipes[def.recipe]!;
    const invested = bn(def.buildCost).mul(1 + entry.level);
    return {
      id: `b${index + 1}`,
      typeId: entry.type,
      plotId: entry.plot,
      status: entry.status,
      missingInputs: entry.status === 'starved' ? recipe.inputs.slice(0, 1).map((io) => io.item) : [],
      progress: entry.status === 'working' ? (timeSec / recipe.durationSec) % 1 : 0,
      inputs: recipe.inputs.map((io) => stock(io.item, entry.status === 'starved' ? 0 : 12)),
      outputs: recipe.outputs
        .filter((io) => catalog.items[io.item]!.kind !== 'waste')
        .map((io) => stock(io.item, entry.status === 'outputFull' ? 40 : 6 + 10 * pingPong(timeSec, 20, index * 3))),
      waste: recipe.outputs
        .filter((io) => catalog.items[io.item]!.kind === 'waste')
        .map((io) => stock(io.item, entry.waste * 20, 20)),
      wasteRatio: entry.waste,
      modifiers: entry.waste >= 1 ? [{ source: 'wasteClogged', stat: 'cycleSpeed', multiplier: 0.5 }] : [],
      upgrades: def.upgradeTracks.map((track, i) => upgradeView(catalog, track, i === 0 ? entry.level : 0, money)),
      handlingCount: index % 2,
      uptime: 0.55 + (index % 5) * 0.1,
      invested,
      refund: invested.div(2),
    };
  });

  const facilities: FacilityView[] = layout.facilities.map((facility) => {
    const inbound = catalog.inboundChannels[island.inbound]!;
    const sale = Object.values(catalog.saleChannels).find((channel) => channel.facility === facility.id);
    const isInbound = facility.id === inbound.facility;
    const tracks = isInbound ? inbound.upgradeTracks : (sale?.upgradeTracks ?? []);
    return {
      id: facility.id,
      kind: facility.kind,
      channelId: isInbound ? inbound.id : (sale?.id ?? ''),
      unlocked: facility.kind !== 'airport',
      stock: isInbound
        ? [stock('wood', 18, null), stock('ironOre', 9, null), stock('cotton', 14, null)]
        : [stock('lumber', 22, null), stock('chair', 5, null)],
      upgrades: tracks.map((track) => upgradeView(catalog, track, 1, money)),
      nextArrivalSec: facility.kind === 'airport' ? null : 10 - (timeSec % 10),
      handlingCount: 1,
    };
  });

  const roadB = [node('B0'), node('B8')];
  const gateRun = [node('gate'), node('yardRoad')];
  const eastRun = [node('B8'), node('C8'), node('dockRoad')];
  const mover = (
    id: string,
    kind: VehicleView['kind'],
    model: string,
    path: Vec3[],
    period: number,
    offset: number,
    item: string,
  ): VehicleView => {
    const t = pingPong(timeSec, period, offset);
    const outbound = ((timeSec + offset) % period) / period < 0.5;
    const pos = along(path, t);
    return {
      id,
      kind,
      model,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      heading: outbound ? pos.heading : pos.heading + Math.PI,
      state: t < 0.02 ? 'loading' : t > 0.98 ? 'unloading' : 'moving',
      cargo: outbound ? [{ item, amount: bn(8) }] : [],
      loadRatio: outbound ? 0.8 : 0,
      capacity: bn(10),
    };
  };

  const vehicles: VehicleView[] = [
    mover('v1', 'carrier', 'vehicle.carrier', roadB, 40, 0, 'lumber'),
    mover('v2', 'carrier', 'vehicle.carrier', roadB, 40, 13, 'steel'),
    mover('v3', 'carrier', 'vehicle.carrier', eastRun, 30, 5, 'chair'),
    mover('v4', 'inboundTruck', 'vehicle.boxTruck', gateRun, 16, 0, 'wood'),
    mover('v5', 'saleTruck', 'vehicle.boxTruck', gateRun, 16, 8, 'lumber'),
    mover('v6', 'ship', 'vehicle.cargoShip', layout.shipLane, 60, 0, 'appliance'),
    mover('v7', 'plane', 'vehicle.cargoPlane', layout.flightLane, 50, 0, 'electronicPart'),
  ];

  const builtCount = (typeId: string): number => buildings.filter((b) => b.typeId === typeId).length;
  const unlockedTypes = new Set(FIXTURE_BUILDINGS.map((b) => b.type));

  return {
    tick: Math.floor(timeSec * TICKS_PER_SECOND),
    playSeconds: timeSec,
    money,
    incomePerSec: money.div(400),
    totalEarned: money.mul(3),
    speed: 1,
    autoPilot: {
      enabled: false,
      target: null,
      targetCost: null,
    },
    unlocks: Object.values(catalog.unlocks).map((unlock) => {
      const unlocked = unlock.grants.type === 'building' ? unlockedTypes.has(unlock.grants.buildingType) : unlock.id === 'unlock.channel.ship';
      return {
        id: unlock.id,
        unlocked,
        available: unlock.requires.length === 0 || unlock.id === 'unlock.channel.plane',
        cost: bn(unlock.cost),
        affordable: money.gte(unlock.cost),
      };
    }),
    globalUpgrades: catalog.globalUpgradeTracks.map((track) => upgradeView(catalog, track, 2, money)),
    islands: [{ id: island.id, active: true, estimatedIncomePerSec: BigNum.ZERO }],
    island: {
      id: island.id,
      maxBuildings: island.maxBuildings,
      plots: layout.plots.map((plot) => ({
        id: plot.id,
        buildingId: buildings.find((b) => b.plotId === plot.id)?.id ?? null,
      })),
      buildings,
      facilities,
      vehicles,
      buildOptions: island.buildingTypes.map((typeId) => {
        const def = catalog.buildings[typeId]!;
        const cost = bn(def.buildCost).mul(bn(def.buildCostGrowth).pow(builtCount(typeId)));
        return {
          typeId,
          unlocked: def.unlock === null || unlockedTypes.has(typeId),
          unlockId: def.unlock,
          cost,
          affordable: money.gte(cost),
          maxCount: def.maxCount,
          builtCount: builtCount(typeId),
        };
      }),
      stats: {
        windowSec: 300,
        uptime: Object.fromEntries(buildings.map((building) => [building.id, building.uptime ?? 0])),
        averageUptime: 0.75,
        shortages: [
          { item: 'steel', seconds: 140 },
          { item: 'lumber', seconds: 60 },
        ],
        salesByItem: [
          { item: 'chair', amount: bn(5200) },
          { item: 'lumber', amount: bn(900) },
        ],
        salesByChannel: [
          { channelId: 'sale.truck', amount: bn(4100) },
          { channelId: 'sale.ship', amount: bn(2000) },
        ],
      },
      specialCargo:
        timeSec % 30 < 15 ? { id: 'special-1', x: -27, z: 3, expiresInSec: 15 - (timeSec % 30), reward: money.div(20) } : null,
    },
  };
}
