/**
 * Where the scenery stands that is not part of the game: small trees in the
 * gaps between plots, and the countryside around the board (hills, villages,
 * trees, clouds). Pure and seeded, so the same layout always looks the same
 * and the placement is unit tested in Node.
 */
import { rotateLocal, seededRandom } from './math';
import type { PropSpot, Site } from './layout';

export interface Area {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ScaledSpot extends PropSpot {
  /** Which of the model variants to use; taken modulo the number there are. */
  kind: number;
  scale: number;
}

interface PlotLayout {
  plotSize: { width: number; depth: number };
  plots: ReadonlyArray<Site>;
}

export interface GapTreeRule {
  seed: number;
  /** Share of the possible places that get a tree, 0..1. */
  share: number;
  /** Places along a gap, as distances from the plots' centre line towards the dock (+) or the back (-). */
  offsets: ReadonlyArray<number>;
  /** Neighbouring plots count as a gap when they are at most this far apart, edge to edge. */
  maxGap: number;
  scale: number;
}

/**
 * Small trees in the narrow strips between neighbouring plots of a row. The
 * places come from the plots themselves, so they follow the layout; a seeded
 * draw keeps only some of them, so the trees are a sprinkle and not a hedge.
 */
export function gapTreeSpots(layout: PlotLayout, rule: GapTreeRule): ScaledSpot[] {
  const random = seededRandom(rule.seed);
  const width = layout.plotSize.width;
  const spots: ScaledSpot[] = [];
  const taken = new Set<string>();
  for (const plot of layout.plots) {
    for (const other of layout.plots) {
      if (other === plot || Math.abs(other.facing - plot.facing) > 1e-6) continue;
      // The neighbour on the plot's right-hand side (+x in its own frame), level with it.
      const local = rotateLocal(other.x - plot.x, other.z - plot.z, -plot.facing);
      const gap = local.x - width;
      if (Math.abs(local.z) > 1e-6 || gap <= 0 || gap > rule.maxGap) continue;
      for (const offset of rule.offsets) {
        const at = rotateLocal(local.x / 2, offset, plot.facing);
        const x = plot.x + at.x;
        const z = plot.z + at.z;
        // Rows that stand back to back share the places on their common edge.
        const key = `${Math.round(x * 2)}|${Math.round(z * 2)}`;
        const keep = random() < rule.share;
        const heading = random() * Math.PI * 2;
        const kind = Math.floor(random() * 4);
        if (!keep || taken.has(key)) continue;
        taken.add(key);
        spots.push({ x, z, heading, kind, scale: rule.scale * (0.9 + random() * 0.2) });
      }
    }
  }
  return spots;
}

export interface Hill {
  x: number;
  z: number;
  radius: number;
  height: number;
  kind: number;
}

export interface Cloud {
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
}

export interface Outskirts {
  hills: Hill[];
  houses: ScaledSpot[];
  trees: ScaledSpot[];
  clouds: Cloud[];
}

export interface OutskirtsRule {
  seed: number;
  hills: number;
  villages: number;
  housesPerVillage: number;
  trees: number;
  clouds: number;
  /** Nothing stands closer to the board than this. */
  margin: number;
  /** Trees and villages reach this far out from the board's edge. */
  reach: number;
}

/**
 * The countryside around the board. `corridors` are kept clear: the sea,
 * the tunnel at the gate and the way planes come in.
 */
export function outskirts(bounds: Area, corridors: ReadonlyArray<Area>, rule: OutskirtsRule): Outskirts {
  const random = seededRandom(rule.seed);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2;
  /** Distance from the edge of the board; negative on it. */
  const beyond = (x: number, z: number): number => {
    const dx = Math.abs(x - cx) - halfX;
    const dz = Math.abs(z - cz) - halfZ;
    return dx > 0 && dz > 0 ? Math.hypot(dx, dz) : Math.max(dx, dz);
  };
  const blocked = (x: number, z: number, room: number): boolean =>
    corridors.some((area) => x > area.minX - room && x < area.maxX + room && z > area.minZ - room && z < area.maxZ + room);

  // Hills: wide, low domes far out, so the horizon is not a flat line.
  const hills: Hill[] = [];
  for (let attempt = 0; attempt < rule.hills * 40 && hills.length < rule.hills; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 55 + random() * 75;
    const distance = Math.max(halfX, halfZ) + rule.reach * 0.75 + radius + random() * 330;
    const x = cx + Math.sin(angle) * distance;
    const z = cz + Math.cos(angle) * distance;
    const height = radius * (0.22 + random() * 0.2);
    const kind = Math.floor(random() * 3);
    if (blocked(x, z, radius + 6)) continue;
    hills.push({ x, z, radius, height, kind });
  }

  // Villages: a handful of houses each, loosely facing the board.
  const houses: ScaledSpot[] = [];
  const centres: Array<{ x: number; z: number }> = [];
  for (let attempt = 0; attempt < rule.villages * 60 && centres.length < rule.villages; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const x = cx + Math.sin(angle) * (halfX + 45 + random() * (rule.reach - 90));
    const z = cz + Math.cos(angle) * (halfZ + 45 + random() * (rule.reach - 90));
    if (beyond(x, z) < 42 || blocked(x, z, 40)) continue;
    if (centres.some((centre) => Math.hypot(centre.x - x, centre.z - z) < 130)) continue;
    centres.push({ x, z });
    const toBoard = Math.atan2(cx - x, cz - z);
    let placed = 0;
    for (let tries = 0; tries < rule.housesPerVillage * 30 && placed < rule.housesPerVillage; tries += 1) {
      const spread = 8 + random() * 26;
      const around = random() * Math.PI * 2;
      const hx = x + Math.sin(around) * spread;
      const hz = z + Math.cos(around) * spread;
      const heading = toBoard + (random() - 0.5) * 1.2;
      const kind = Math.floor(random() * 5);
      if (houses.some((house) => Math.hypot(house.x - hx, house.z - hz) < 9.5)) continue;
      houses.push({ x: hx, z: hz, heading, kind, scale: 1 });
      placed += 1;
    }
  }

  // Trees: thick near the board and the villages, thinning out with distance.
  const trees: ScaledSpot[] = [];
  const span = rule.reach + rule.margin;
  for (let attempt = 0; attempt < rule.trees * 30 && trees.length < rule.trees; attempt += 1) {
    const x = bounds.minX - span + random() * (bounds.maxX - bounds.minX + span * 2);
    const z = bounds.minZ - span + random() * (bounds.maxZ - bounds.minZ + span * 2);
    const heading = random() * Math.PI * 2;
    const kind = Math.floor(random() * 4);
    const scale = 0.9 + random() * 0.7;
    const chance = random();
    const distance = beyond(x, z);
    if (distance < rule.margin || distance > rule.reach) continue;
    const nearVillage = centres.some((centre) => Math.hypot(centre.x - x, centre.z - z) < 55);
    if (chance > (nearVillage ? 0.95 : Math.exp(-distance / (rule.reach * 0.45)))) continue;
    if (blocked(x, z, 3)) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 5.5)) continue;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 3.6)) continue;
    trees.push({ x, z, heading, kind, scale });
  }

  // Clouds: far out and high up, so they never drift between the camera and the board.
  const clouds: Cloud[] = [];
  for (let index = 0; index < rule.clouds; index += 1) {
    const angle = ((index + random() * 0.7) / rule.clouds) * Math.PI * 2;
    const distance = Math.max(halfX, halfZ) + 430 + random() * 380;
    clouds.push({
      x: cx + Math.sin(angle) * distance,
      y: 150 + random() * 90,
      z: cz + Math.cos(angle) * distance,
      heading: random() * Math.PI * 2,
      scale: 22 + random() * 20,
    });
  }
  return { hills, houses, trees, clouds };
}

export interface RunwayLightRule {
  /** Distance from one edge light to the next. */
  step: number;
  /** How far in from the runway's edge the lights stand. */
  inset: number;
  /** Distance between the lights across each end. */
  endStep: number;
  /** Lights keep this far from the line planes roll along on the ground. */
  clearance: number;
}

/**
 * Lights along both long edges of the runway and a row across each end.
 * `lane` is the path planes follow; where it runs on the ground (y = 0) the
 * lights leave it free, so a plane taxiing off the runway does not roll over them.
 */
export function runwayLightSpots(
  runway: Area,
  lane: ReadonlyArray<{ x: number; y: number; z: number }>,
  rule: RunwayLightRule,
): { edge: PropSpot[]; ends: PropSpot[] } {
  const inWay = (x: number, z: number): boolean => {
    for (let index = 1; index < lane.length; index += 1) {
      const a = lane[index - 1]!;
      const b = lane[index]!;
      if (a.y !== 0 || b.y !== 0) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < rule.clearance) return true;
    }
    return false;
  };
  const edge: PropSpot[] = [];
  const length = runway.maxX - runway.minX - rule.inset * 2;
  const count = Math.max(1, Math.round(length / rule.step));
  for (let index = 0; index <= count; index += 1) {
    const x = runway.minX + rule.inset + (length * index) / count;
    for (const z of [runway.minZ + rule.inset, runway.maxZ - rule.inset]) {
      if (!inWay(x, z)) edge.push({ x, z, heading: 0 });
    }
  }
  const ends: PropSpot[] = [];
  const width = runway.maxZ - runway.minZ - rule.inset * 2;
  const across = Math.max(2, Math.round(width / rule.endStep));
  // The corners already have an edge light.
  for (let index = 1; index < across; index += 1) {
    const z = runway.minZ + rule.inset + (width * index) / across;
    for (const x of [runway.minX + rule.inset, runway.maxX - rule.inset]) {
      if (!inWay(x, z)) ends.push({ x, z, heading: 0 });
    }
  }
  return { edge, ends };
}
