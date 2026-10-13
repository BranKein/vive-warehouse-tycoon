import type { FacilityDef, IslandLayoutDef, PlotDef, RoadNodeDef, RoadNodeId } from '@/contracts';

/**
 * First island: 56 plots in 7 columns x 8 rows on a roughly square board.
 * +x is east, +z is south. Four east-west roads serve the plot rows and are
 * joined by a north-south road at each end. Trucks enter from the west gate,
 * the river (dock) runs along the south edge and the runway along the north.
 *
 *        runway ──────────────────────────── apron
 *   row 0  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   ════════ road A ════════
 *   row 1  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   row 2  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   ════════ road B ════════
 *   row 3  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 * gate ═ yards ╣
 *   row 4  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   ════════ road C ════════
 *   row 5  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   row 6  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *   ════════ road D ════════
 *   row 7  ▢ ▢ ▢ ▢ ▢ ▢ ▢
 *        river ────────────────────────────── dock
 */
const COLUMNS_X = [-54, -36, -18, 0, 18, 36, 54];
const WEST_X = -69;
const EAST_X = 69;
/** The gate and the two road yards sit on a spur west of the plots. */
const YARD_X = WEST_X - 16;
const GATE_X = YARD_X - 19;
/** The spur meets the west road halfway down, between roads B and C. */
const SPUR_Z = 0;
const ROADS = [
  { id: 'A', z: -51 },
  { id: 'B', z: -17 },
  { id: 'C', z: 17 },
  { id: 'D', z: 51 },
] as const;
const NORTH_ROAD_Z = ROADS[0].z;
const SOUTH_ROAD_Z = ROADS[3].z;
const SOUTH = 0;
const NORTH = Math.PI;
/** How far a plot row sits from the road it opens onto. */
const ROW_OFFSET = 10;
/** Plot rows: centre z, which way the dock faces, and the road it opens onto. */
const ROWS = ROADS.flatMap((road) => [
  { z: road.z - ROW_OFFSET, facing: SOUTH, road: road.id },
  { z: road.z + ROW_OFFSET, facing: NORTH, road: road.id },
]);

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
  edges.push(['A0', 'B0'], ['B0', 'westMid'], ['westMid', 'C0'], ['C0', 'D0']);
  edges.push([`A${last}`, `B${last}`], [`B${last}`, `C${last}`], [`C${last}`, `D${last}`]);

  // West spur: island gate and the two road yards.
  nodes.push({ id: 'gate', x: GATE_X, z: SPUR_Z }, { id: 'yardRoad', x: YARD_X, z: SPUR_Z });
  nodes.push({ id: 'westMid', x: WEST_X, z: SPUR_Z });
  edges.push(['gate', 'yardRoad'], ['yardRoad', 'westMid']);
  // East spurs to the dock (south) and the airport apron (north).
  nodes.push({ id: 'dockRoad', x: EAST_X, z: SOUTH_ROAD_Z + 13 }, { id: 'airRoad', x: EAST_X, z: NORTH_ROAD_Z - 13 });
  edges.push([`D${last}`, 'dockRoad'], [`A${last}`, 'airRoad']);
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
  { id: 'inboundYard', kind: 'inboundYard', x: YARD_X, z: SPUR_Z - 12, facing: SOUTH, roadNode: 'yardRoad' },
  { id: 'truckYard', kind: 'truckYard', x: YARD_X, z: SPUR_Z + 12, facing: NORTH, roadNode: 'yardRoad' },
  { id: 'dock', kind: 'dock', x: EAST_X, z: SOUTH_ROAD_Z + 21, facing: SOUTH, roadNode: 'dockRoad' },
  { id: 'airport', kind: 'airport', x: EAST_X, z: NORTH_ROAD_Z - 21, facing: NORTH, roadNode: 'airRoad' },
];

const roads = buildRoads();

export const ISLAND_ONE_LAYOUT: IslandLayoutDef = {
  bounds: { minX: GATE_X, maxX: EAST_X + 35, minZ: NORTH_ROAD_Z - 44, maxZ: SOUTH_ROAD_Z + 41 },
  plotSize: { width: 16, depth: 14 },
  roadWidth: 6,
  plots: buildPlots(),
  roadNodes: roads.nodes,
  roadEdges: roads.edges,
  facilities: FACILITIES,
  roadGate: 'gate',
  shipLane: [
    { x: EAST_X + 70, y: 0, z: SOUTH_ROAD_Z + 33 },
    { x: EAST_X + 20, y: 0, z: SOUTH_ROAD_Z + 33 },
    { x: EAST_X + 2, y: 0, z: SOUTH_ROAD_Z + 29 },
  ],
  flightLane: [
    { x: EAST_X + 120, y: 46, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X + 32, y: 8, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X - 20, y: 0, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X, y: 0, z: NORTH_ROAD_Z - 28 },
  ],
  river: { minX: GATE_X, maxX: EAST_X + 35, minZ: SOUTH_ROAD_Z + 25, maxZ: SOUTH_ROAD_Z + 41 },
  runway: { minX: EAST_X - 70, maxX: EAST_X + 28, minZ: NORTH_ROAD_Z - 39, maxZ: NORTH_ROAD_Z - 31 },
};
