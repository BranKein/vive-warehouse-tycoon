import type { FacilityDef, IslandLayoutDef, PlotDef, RoadNodeDef, RoadNodeId } from '@/contracts';

/**
 * First island: 30 plots in 6 columns x 5 rows on a rectangular board.
 * +x is east, +z is south. Three east-west roads serve the plot rows and are
 * joined by a north-south road at each end. Trucks enter from the west gate,
 * the river (dock) runs along the south edge and the runway along the north.
 *
 *        runway ─────────────────────────────── apron
 *   row 0  ▢ ▢ ▢ ▢ ▢ ▢
 *   ═══════ road A ═══════
 *   row 1  ▢ ▢ ▢ ▢ ▢ ▢
 *   row 2  ▢ ▢ ▢ ▢ ▢ ▢
 * gate ═ yards ═ road B ═══
 *   row 3  ▢ ▢ ▢ ▢ ▢ ▢
 *   row 4  ▢ ▢ ▢ ▢ ▢ ▢
 *   ═══════ road C ═══════
 *        river ───────────────────────────────── dock
 */
const COLUMNS_X = [-45, -27, -9, 9, 27, 45];
const WEST_X = -60;
const EAST_X = 60;
const ROADS = [
  { id: 'A', z: -31 },
  { id: 'B', z: 3 },
  { id: 'C', z: 37 },
] as const;
const SOUTH = 0;
const NORTH = Math.PI;
/** Plot rows: centre z, which way the dock faces, and the road it opens onto. */
const ROWS = [
  { z: -41, facing: SOUTH, road: 'A' },
  { z: -21, facing: NORTH, road: 'A' },
  { z: -7, facing: SOUTH, road: 'B' },
  { z: 13, facing: NORTH, road: 'B' },
  { z: 27, facing: SOUTH, road: 'C' },
] as const;

const ROAD_XS = [WEST_X, ...COLUMNS_X, EAST_X];
const roadNodeId = (road: string, index: number): RoadNodeId => `${road}${index}`;

function buildRoads(): { nodes: RoadNodeDef[]; edges: Array<[RoadNodeId, RoadNodeId]> } {
  const nodes: RoadNodeDef[] = [];
  const edges: Array<[RoadNodeId, RoadNodeId]> = [];
  for (const road of ROADS) {
    ROAD_XS.forEach((x, index) => {
      nodes.push({ id: roadNodeId(road.id, index), x, z: road.z });
      if (index > 0) edges.push([roadNodeId(road.id, index - 1), roadNodeId(road.id, index)]);
    });
  }
  const last = ROAD_XS.length - 1;
  edges.push(['A0', 'B0'], ['B0', 'C0'], [`A${last}`, `B${last}`], [`B${last}`, `C${last}`]);

  // West spur: island gate and the two road yards.
  nodes.push({ id: 'gate', x: -95, z: 3 }, { id: 'yardRoad', x: -76, z: 3 });
  edges.push(['gate', 'yardRoad'], ['yardRoad', 'B0']);
  // East spurs to the dock (south) and the airport apron (north).
  nodes.push({ id: 'dockRoad', x: EAST_X, z: 48 }, { id: 'airRoad', x: EAST_X, z: -44 });
  edges.push([`C${last}`, 'dockRoad'], [`A${last}`, 'airRoad']);
  return { nodes, edges };
}

function buildPlots(): PlotDef[] {
  const plots: PlotDef[] = [];
  ROWS.forEach((row, rowIndex) => {
    COLUMNS_X.forEach((x, columnIndex) => {
      plots.push({
        id: `p${rowIndex}-${columnIndex}`,
        x,
        z: row.z,
        facing: row.facing,
        roadNode: roadNodeId(row.road, columnIndex + 1),
      });
    });
  });
  return plots;
}

const FACILITIES: FacilityDef[] = [
  { id: 'inboundYard', kind: 'inboundYard', x: -76, z: -9, facing: SOUTH, roadNode: 'yardRoad' },
  { id: 'truckYard', kind: 'truckYard', x: -76, z: 15, facing: NORTH, roadNode: 'yardRoad' },
  { id: 'dock', kind: 'dock', x: EAST_X, z: 56, facing: SOUTH, roadNode: 'dockRoad' },
  { id: 'airport', kind: 'airport', x: EAST_X, z: -52, facing: NORTH, roadNode: 'airRoad' },
];

const roads = buildRoads();

export const ISLAND_ONE_LAYOUT: IslandLayoutDef = {
  bounds: { minX: -95, maxX: 95, minZ: -75, maxZ: 75 },
  plotSize: { width: 16, depth: 14 },
  roadWidth: 6,
  plots: buildPlots(),
  roadNodes: roads.nodes,
  roadEdges: roads.edges,
  facilities: FACILITIES,
  roadGate: 'gate',
  shipLane: [
    { x: 130, y: 0, z: 67 },
    { x: 80, y: 0, z: 67 },
    { x: 62, y: 0, z: 63 },
  ],
  flightLane: [
    { x: 180, y: 46, z: -66 },
    { x: 92, y: 8, z: -66 },
    { x: 40, y: 0, z: -66 },
    { x: 60, y: 0, z: -59 },
  ],
  river: { minX: -95, maxX: 95, minZ: 58, maxZ: 75 },
  runway: { minX: -10, maxX: 88, minZ: -70, maxZ: -62 },
};
