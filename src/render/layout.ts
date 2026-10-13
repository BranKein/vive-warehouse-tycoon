/**
 * Where things stand on the board. Pure: no Three.js, so it is unit tested
 * in Node. A "site" is a plot or a facility: a point with a facing, whose
 * local frame has +z pointing out of the loading dock.
 */
import { headingOf, rotateLocal } from './math';

export interface Site {
  x: number;
  z: number;
  /** Radians, 0 = +z, counter-clockwise from above. */
  facing: number;
}

export interface GroundPoint {
  x: number;
  z: number;
}

/** A straight piece of road: a rectangle `length` long, centred on (x, z), running along `heading`. */
export interface RoadStrip extends GroundPoint {
  length: number;
  heading: number;
}

/** One strip per road edge. Edges that name a missing node are skipped. */
export function roadStrips(
  nodes: ReadonlyArray<{ id: string; x: number; z: number }>,
  edges: ReadonlyArray<readonly [string, string]>,
): RoadStrip[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const strips: RoadStrip[] = [];
  for (const [from, to] of edges) {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    strips.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, length: Math.hypot(dx, dz), heading: headingOf(dx, dz) });
  }
  return strips;
}

/** World position of a point given in a site's local frame. */
export function siteToWorld(site: Site, localX: number, localZ: number): GroundPoint {
  const offset = rotateLocal(localX, localZ, site.facing);
  return { x: site.x + offset.x, z: site.z + offset.z };
}

export interface YardRule {
  frontZ: number;
  edgeX: number;
  step: number;
  wasteX: number;
  wasteZ: number;
  wasteStep: number;
}

export type PileGroup = 'inputs' | 'outputs' | 'waste';

/**
 * Where the n-th pile of a group stands in its site's own frame. Inputs line
 * up along the front from the left edge inwards, outputs from the right edge
 * inwards, and waste stands beside the box running towards the back.
 */
export function pileLocal(group: PileGroup, index: number, rule: YardRule): GroundPoint {
  if (group === 'inputs') return { x: -rule.edgeX + index * rule.step, z: rule.frontZ };
  if (group === 'outputs') return { x: rule.edgeX - index * rule.step, z: rule.frontZ };
  return { x: rule.wasteX, z: rule.wasteZ - index * rule.wasteStep };
}

/** World position of the n-th pile of a group on a site. */
export function pilePosition(site: Site, group: PileGroup, index: number, rule: YardRule): GroundPoint {
  const local = pileLocal(group, index, rule);
  return siteToWorld(site, local.x, local.z);
}

export interface FacilityYardRule {
  perRow: number;
  rows: number;
  edgeX: number;
  step: number;
  frontZ: number;
  rowStep: number;
}

/**
 * Where the n-th pile of a transport facility stands in its own frame: rows
 * of `perRow` from the left edge, the first along the front of the pad and
 * each next one a step closer to the model.
 */
export function facilityPileLocal(slot: number, rule: FacilityYardRule): GroundPoint {
  return { x: -rule.edgeX + (slot % rule.perRow) * rule.step, z: rule.frontZ - Math.floor(slot / rule.perRow) * rule.rowStep };
}

export interface PropSpot {
  x: number;
  z: number;
  heading: number;
}

/**
 * Street lamps: one on each side of every road node that is a crossing or a
 * bend, set back from the road and reaching over it. Nodes where a road
 * simply runs on get one lamp on alternating sides, so long roads are lit too.
 */
export function lampSpots(
  nodes: ReadonlyArray<{ id: string; x: number; z: number }>,
  edges: ReadonlyArray<readonly [string, string]>,
  offset: number,
): PropSpot[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const spots: PropSpot[] = [];
  edges.forEach(([from, to], index) => {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 12) return;
    // Halfway along the stretch, on alternating sides; the arm points back at the road.
    const side = index % 2 === 0 ? 1 : -1;
    const nx = (-dz / length) * side;
    const nz = (dx / length) * side;
    spots.push({ x: (a.x + b.x) / 2 + nx * offset, z: (a.z + b.z) / 2 + nz * offset, heading: Math.atan2(-nx, -nz) });
  });
  return spots;
}

type Area = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * Places up to `count` trees on the free parts of the board: off the plots,
 * the facility pads, the roads, the river and the runway, and apart from each
 * other. The same seed always gives the same trees.
 */
export function treeSpots(
  layout: {
    bounds: Area;
    plotSize: { width: number; depth: number };
    plots: ReadonlyArray<Site>;
    facilities: ReadonlyArray<Site>;
    roadNodes: ReadonlyArray<{ id: string; x: number; z: number }>;
    roadEdges: ReadonlyArray<readonly [string, string]>;
    roadWidth: number;
    river: Area;
    runway: Area;
  },
  rule: { count: number; seed: number; clearance: number; spacing: number; facilityPad: readonly [number, number] },
): PropSpot[] {
  let state = rule.seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inArea = (x: number, z: number, area: Area, margin: number): boolean =>
    x > area.minX - margin && x < area.maxX + margin && z > area.minZ - margin && z < area.maxZ + margin;
  const onSite = (x: number, z: number, site: Site, width: number, depth: number): boolean => {
    const local = rotateLocal(x - site.x, z - site.z, -site.facing);
    return Math.abs(local.x) < width / 2 + rule.clearance && Math.abs(local.z) < depth / 2 + rule.clearance;
  };
  const byId = new Map(layout.roadNodes.map((node) => [node.id, node]));
  const roads = layout.roadEdges.flatMap(([from, to]) => {
    const a = byId.get(from);
    const b = byId.get(to);
    return a && b ? [{ a, b }] : [];
  });
  const nearRoad = (x: number, z: number): boolean =>
    roads.some(({ a, b }) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)) < layout.roadWidth / 2 + rule.clearance + 1;
    });
  const b = layout.bounds;
  const spots: PropSpot[] = [];
  for (let attempt = 0; attempt < rule.count * 60 && spots.length < rule.count; attempt += 1) {
    const x = b.minX + 2 + random() * (b.maxX - b.minX - 4);
    const z = b.minZ + 2 + random() * (b.maxZ - b.minZ - 4);
    const heading = random() * Math.PI * 2;
    // The strip west of the runway stays clear too: planes come in low over it.
    const flightStrip = { ...layout.runway, minX: layout.runway.minX - 50 };
    if (inArea(x, z, layout.river, rule.clearance) || inArea(x, z, flightStrip, rule.clearance + 3)) continue;
    if (layout.plots.some((plot) => onSite(x, z, plot, layout.plotSize.width, layout.plotSize.depth))) continue;
    if (layout.facilities.some((site) => onSite(x, z, site, rule.facilityPad[0] + 4, rule.facilityPad[1] + 10))) continue;
    if (nearRoad(x, z)) continue;
    if (spots.some((spot) => Math.hypot(spot.x - x, spot.z - z) < rule.spacing)) continue;
    spots.push({ x, z, heading });
  }
  return spots;
}
