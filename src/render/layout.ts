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
 * World position of the n-th pile of a group on a site. Inputs line up along
 * the front from the left edge inwards, outputs from the right edge inwards,
 * and waste stands beside the box running towards the back.
 */
export function pilePosition(site: Site, group: PileGroup, index: number, rule: YardRule): GroundPoint {
  if (group === 'inputs') return siteToWorld(site, -rule.edgeX + index * rule.step, rule.frontZ);
  if (group === 'outputs') return siteToWorld(site, rule.edgeX - index * rule.step, rule.frontZ);
  return siteToWorld(site, rule.wasteX, rule.wasteZ - index * rule.wasteStep);
}
