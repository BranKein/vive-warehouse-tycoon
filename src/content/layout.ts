import type { FacilityDef, IslandLayoutDef, PlotDef, RoadNodeDef, RoadNodeId } from '@/contracts';

/**
 * First island: 59 plots on a roughly square board. +x is east, +z is south.
 * Four east-west roads serve eight plot rows, three columns on each side of a
 * north-south road down the middle. Another north-south road runs along each
 * end; the far side of the east one holds seven more plots, and the far side
 * of the west one four, around the yards. Trucks enter from the west gate,
 * the river (dock) runs along the south edge and the runway along the north.
 *
 *            runway ──────────────────── apron
 *     ▯ ║ ▢ ▢ ▢ ║ ▢ ▢ ▢ ║ ▯
 *     ▯ ╠═══════ road A ═══════╣ ▯
 *       ║ ▢ ▢ ▢ ║ ▢ ▢ ▢ ║ ▯
 *       ╠═══════ road B ═══════╣ ▯
 * gate ═ yards ╣ ▢ ▢ ▢ ║ ▢ ▢ ▢ ║ ▯
 *       ╠═══════ road C ═══════╣ ▯
 *     ▯ ║ ▢ ▢ ▢ ║ ▢ ▢ ▢ ║ ▯
 *     ▯ ╠═══════ road D ═══════╣ ▯
 *            river ───────────────────── dock
 */
const COLUMNS_X = [-49, -31, -13, 13, 31, 49];
const MID_X = 0;
const WEST_X = -64;
const EAST_X = 64;
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
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
/** How far a plot sits from the road it opens onto. */
const ROW_OFFSET = 10;
/** Plot rows: centre z, which way the dock faces, and the road it opens onto. */
const ROWS = ROADS.flatMap((road) => [
  { z: road.z - ROW_OFFSET, facing: SOUTH, road: road.id },
  { z: road.z + ROW_OFFSET, facing: NORTH, road: road.id },
]);
/** Plots east of the east road, facing it. They lie sideways, so they are spaced by the plot width. */
const EAST_SIDE_Z = [-54, -36, -18, 0, 18, 36, 54];
/** Plots west of the west road; the middle is taken by the gate road and the yards. */
const WEST_SIDE_Z = [-54, -36, 36, 54];

const ROAD_XS = [WEST_X, ...COLUMNS_X.slice(0, 3), MID_X, ...COLUMNS_X.slice(3), EAST_X];
const roadNodeId = (road: string, index: number): RoadNodeId => `${road}${index}`;
const sideNodeId = (side: 'e' | 'w', index: number): RoadNodeId => `${side}Stop${index}`;

function buildRoads(): { nodes: RoadNodeDef[]; edges: Array<[RoadNodeId, RoadNodeId]> } {
  const nodes: RoadNodeDef[] = [];
  const edges: Array<[RoadNodeId, RoadNodeId]> = [];
  for (const road of ROADS) {
    ROAD_XS.forEach((x, index) => {
      nodes.push({ id: roadNodeId(road.id, index), x, z: road.z });
      if (index > 0) edges.push([roadNodeId(road.id, index - 1), roadNodeId(road.id, index)]);
    });
  }
  // West spur: island gate and the two road yards.
  nodes.push({ id: 'gate', x: GATE_X, z: SPUR_Z }, { id: 'yardRoad', x: YARD_X, z: SPUR_Z });
  nodes.push({ id: 'westMid', x: WEST_X, z: SPUR_Z });
  edges.push(['gate', 'yardRoad'], ['yardRoad', 'westMid']);
  // East spurs to the dock (south) and the airport apron (north).
  nodes.push({ id: 'dockRoad', x: EAST_X, z: SOUTH_ROAD_Z + 13 }, { id: 'airRoad', x: EAST_X, z: NORTH_ROAD_Z - 13 });
  // A stop on the end road in front of every plot across it.
  EAST_SIDE_Z.forEach((z, index) => nodes.push({ id: sideNodeId('e', index), x: EAST_X, z }));
  WEST_SIDE_Z.forEach((z, index) => nodes.push({ id: sideNodeId('w', index), x: WEST_X, z }));

  // Each north-south road links every node on its line, north to south.
  for (const x of [WEST_X, MID_X, EAST_X]) {
    const line = nodes.filter((node) => node.x === x).sort((a, b) => a.z - b.z);
    for (let index = 1; index < line.length; index += 1) edges.push([line[index - 1]!.id, line[index]!.id]);
  }
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
        roadNode: roadNodeId(row.road, ROAD_XS.indexOf(x)),
      });
    });
  });
  EAST_SIDE_Z.forEach((z, index) => {
    plots.push({ id: `e${index}`, x: EAST_X + ROW_OFFSET, z, facing: WEST, roadNode: sideNodeId('e', index) });
  });
  WEST_SIDE_Z.forEach((z, index) => {
    plots.push({ id: `w${index}`, x: WEST_X - ROW_OFFSET, z, facing: EAST, roadNode: sideNodeId('w', index) });
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
  // Ships and planes come in from the west, so they are seen travelling the length of the board.
  shipLane: [
    { x: GATE_X - 30, y: 0, z: SOUTH_ROAD_Z + 33 },
    { x: EAST_X - 22, y: 0, z: SOUTH_ROAD_Z + 33 },
    { x: EAST_X + 2, y: 0, z: SOUTH_ROAD_Z + 29 },
  ],
  flightLane: [
    { x: EAST_X - 200, y: 46, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X - 100, y: 9, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X - 58, y: 0, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X + 8, y: 0, z: NORTH_ROAD_Z - 35 },
    { x: EAST_X, y: 0, z: NORTH_ROAD_Z - 28 },
  ],
  river: { minX: GATE_X, maxX: EAST_X + 35, minZ: SOUTH_ROAD_Z + 25, maxZ: SOUTH_ROAD_Z + 41 },
  runway: { minX: EAST_X - 70, maxX: EAST_X + 28, minZ: NORTH_ROAD_Z - 39, maxZ: NORTH_ROAD_Z - 31 },
};
