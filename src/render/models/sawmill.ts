/**
 * Sawmill, drawn by hand as the style sample for buildings (PLAN.md stage 5):
 * a gabled timber shed with its saw blade on the gable, and an open lean-to
 * beside it where a log runs through the saw. Same plot frame and anchors as
 * the other buildings (see buildings.ts), so the yard in front stays free for
 * the stock piles.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import { buildingPalette, itemColor } from '../theme';
import { BUILDING_ANCHORS } from './buildings';
import type { Kit, Paint } from './kit';
import { HALF_PI, barnDoor, bush, framedWindow, gableRoof, log as partLog } from './parts';

/** Saw blade with teeth, standing upright; its axis points along x (`axis: 'x'`) or along z. */
function sawBlade(kit: Kit, radius: number, axis: 'x' | 'z', hub: Paint, x: number, y: number, z: number): Object3D {
  const p = kit.theme.props;
  const blade = new Group();
  // Built facing +z, then turned as a whole.
  blade.add(kit.cyl(radius, radius, 0.08, p.metal, { y: -0.04, rx: HALF_PI }, 24));
  blade.add(kit.cyl(radius * 0.32, radius * 0.32, 0.14, hub, { y: -0.07, rx: HALF_PI }, 16));
  const teeth = 12;
  for (let i = 0; i < teeth; i += 1) {
    const angle = (i / teeth) * Math.PI * 2;
    const tooth = kit.box(radius * 0.3, radius * 0.3, 0.07, p.metal, { r: 0.02, rz: angle + Math.PI / 4 });
    tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    blade.add(tooth);
  }
  blade.position.set(x, y, z);
  if (axis === 'x') blade.rotation.y = HALF_PI;
  return blade;
}

function sawmill(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'sawmill');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const plank = itemColor(theme, 'lumber');
  const sawdust = itemColor(theme, 'sawdust');
  const log = (radius: number, length: number, x: number, y: number, z: number): Object3D[] =>
    partLog(kit, radius, length, x, y, z, plank);
  const parts: Array<Object3D | Object3D[]> = [];

  const FLOOR = 0.3;
  // Main shed: gable end towards the yard.
  const CX = 2;
  const CZ = -3;
  const W = 7;
  const D = 7.2;
  const WALL = 3;
  const RISE = 2.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const right = CX + W / 2;
  const left = CX - W / 2;

  // Ground slab and the loading step in front of the door.
  parts.push(kit.box(12.3, FLOOR, 8.4, p.concrete, { x: -0.1, z: -2.9, r: 0.1 }));
  parts.push(kit.box(5.2, 0.22, 1.5, p.concrete, { x: CX, z: front + 0.6, r: 0.1 }));

  // Walls on a stone footing, gable, timber frame.
  parts.push(kit.box(W, WALL, D, palette.wall, { x: CX, y: FLOOR, z: CZ, r: 0.2 }));
  parts.push(kit.box(W + 0.16, 0.55, D + 0.16, p.rock, { x: CX, y: FLOOR, z: CZ, r: 0.14 }));
  for (const x of [left + 0.1, right - 0.1]) {
    for (const z of [front - 0.1, CZ - D / 2 + 0.1]) {
      parts.push(kit.box(0.42, WALL + 0.1, 0.42, palette.accent, { x, y: FLOOR, z, r: 0.1 }));
    }
  }
  parts.push(kit.box(W + 0.1, 0.34, 0.3, palette.accent, { x: CX, y: eave - 0.3, z: front + 0.02, r: 0.08 }));
  parts.push(kit.box(0.3, 0.34, D + 0.1, palette.accent, { x: right + 0.02, y: eave - 0.3, z: CZ, r: 0.08 }));

  parts.push(gableRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, eave, rise: RISE, wall: palette.wall, roof: palette.roof, cap: palette.accent, overhang: 0.42 }));
  parts.push(barnDoor(kit, { cx: CX, wall: front, y: FLOOR, paint: trim }));

  // The saw blade on the gable says what the building does.
  parts.push(kit.cyl(1.02, 1.02, 0.1, p.sign, { x: CX, y: eave + 0.85, z: front + 0.02, rx: HALF_PI }, 28));
  parts.push(sawBlade(kit, 0.72, 'z', palette.roof, CX, eave + 0.9, front + 0.14));

  // Windows with frames and sills on the open side wall.
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1.05, sill: palette.accent }));
  }
  // Flower box under the front window.
  parts.push(kit.box(0.4, 0.3, 1.5, trim, { x: right + 0.22, y: FLOOR + 0.72, z: CZ + 1.7, r: 0.1 }));
  for (const dz of [-0.45, 0, 0.45]) {
    parts.push(kit.blob(0.22, 0.2, 0.26, theme.props.foliage[0] ?? trim, { x: right + 0.24, y: FLOOR + 0.95, z: CZ + 1.7 + dz }));
  }
  parts.push(kit.blob(0.1, 0.1, 0.1, p.blossom, { x: right + 0.3, y: FLOOR + 1.22, z: CZ + 1.5 }));
  parts.push(kit.blob(0.1, 0.1, 0.1, p.blossom, { x: right + 0.3, y: FLOOR + 1.2, z: CZ + 2.05 }));

  // Brick chimney through the roof.
  const chimneyX = CX + 1.9;
  const chimneyZ = CZ - 2.2;
  parts.push(kit.box(0.9, 2.3, 0.9, palette.accent, { x: chimneyX, y: eave + 0.6, z: chimneyZ, r: 0.14 }));
  parts.push(kit.box(1.12, 0.26, 1.12, p.sign, { x: chimneyX, y: eave + 2.8, z: chimneyZ, r: 0.09 }));

  // Lean-to on the left: posts, a low back wall and a single-pitch roof.
  const LX = -3.5;
  const LEFT_EDGE = -5.6;
  const LD = 6.2;
  for (const z of [CZ - LD / 2 + 0.2, CZ, CZ + LD / 2 - 0.2]) {
    parts.push(kit.box(0.36, 2.35, 0.36, palette.accent, { x: LEFT_EDGE, y: FLOOR, z, r: 0.1 }));
    // Angled strut from the post to the beam.
    parts.push(kit.box(0.2, 0.9, 0.2, palette.accent, { x: LEFT_EDGE + 0.3, y: FLOOR + 1.6, z, rz: -0.7, r: 0.06 }));
  }
  parts.push(kit.box(0.4, 0.32, LD + 0.3, palette.accent, { x: LEFT_EDGE, y: FLOOR + 2.3, z: CZ, r: 0.1 }));
  parts.push(kit.box(4.1, 1.5, 0.24, palette.wall, { x: LX - 0.05, y: FLOOR, z: CZ - LD / 2 + 0.15, r: 0.08 }));
  parts.push(kit.box(4.1, 0.2, 0.3, palette.accent, { x: LX - 0.05, y: FLOOR + 1.45, z: CZ - LD / 2 + 0.15, r: 0.06 }));
  const leanPitch = Math.atan2(0.75, 4.6);
  parts.push(kit.box(4.9, 0.3, LD + 0.9, palette.roof, { x: LX - 0.25, y: FLOOR + 2.72, z: CZ, rz: leanPitch, r: 0.12 }));
  parts.push(kit.box(4.9, 0.2, 0.22, p.sign, { x: LX - 0.25, y: FLOOR + 2.7, z: CZ + LD / 2 + 0.42, rz: leanPitch, r: 0.06 }));

  // Saw bench: rollers, a log going in, the blade, boards coming out behind it.
  const benchZ = CZ + 0.1;
  parts.push(kit.box(1.5, 0.2, 5.2, p.darkMetal, { x: LX, y: FLOOR + 0.62, z: benchZ, r: 0.08 }));
  for (const z of [benchZ - 2.2, benchZ - 0.6, benchZ + 0.6, benchZ + 2.2]) {
    for (const x of [LX - 0.58, LX + 0.58]) parts.push(kit.box(0.2, 0.66, 0.2, p.darkMetal, { x, y: FLOOR, z, r: 0.06 }));
  }
  for (let i = 0; i < 9; i += 1) {
    const z = benchZ - 2.3 + i * 0.575;
    parts.push(kit.cyl(0.11, 0.11, 1.3, p.metal, { x: LX, y: FLOOR + 0.86 - 0.65, z, rz: HALF_PI }, 10));
  }
  parts.push(log(0.42, 2.2, LX, FLOOR + 0.95, benchZ + 1.55));
  parts.push(sawBlade(kit, 1.0, 'x', palette.roof, LX, FLOOR + 1.2, benchZ - 0.45));
  parts.push(kit.box(0.5, 0.75, 0.9, trim, { x: LX + 1.15, y: FLOOR, z: benchZ - 0.5, r: 0.14 }));
  parts.push(kit.box(0.3, 0.12, 0.3, p.hazard, { x: LX + 1.15, y: FLOOR + 0.75, z: benchZ - 0.5, r: 0.05 }));
  for (const [dx, y] of [[-0.3, 0], [0.3, 0], [0, 0.13]] as const) {
    parts.push(kit.box(0.5, 0.12, 1.9, plank, { x: LX + dx, y: FLOOR + 0.98 + y, z: benchZ - 1.75, r: 0.03 }));
  }
  // Sawdust under the blade.
  parts.push(kit.dome(0.7, 0.4, 0.55, sawdust, { x: LX - 1.25, y: FLOOR - 0.02, z: benchZ - 0.6 }));

  // Log pile waiting beside the lean-to, held by stakes.
  const pileX = -6.75;
  const pileZ = CZ + 0.6;
  parts.push(log(0.4, 3.6, pileX - 0.42, 0, pileZ));
  parts.push(log(0.4, 3.6, pileX + 0.42, 0, pileZ + 0.15));
  parts.push(log(0.38, 3.4, pileX, 0.68, pileZ - 0.1));
  for (const z of [pileZ - 1.2, pileZ + 1.2]) {
    parts.push(kit.box(0.16, 0.95, 0.16, palette.accent, { x: pileX - 0.93, z, r: 0.05 }));
  }

  // Finished boards stacked by the door, on spacers.
  const stackX = CX + 2.55;
  const stackZ = front + 0.75;
  for (const dx of [-0.42, 0.42]) parts.push(kit.box(0.14, 0.12, 1.0, p.trunk, { x: stackX + dx, y: 0, z: stackZ, r: 0.03 }));
  for (let layer = 0; layer < 4; layer += 1) {
    for (const dz of [-0.3, 0, 0.3]) {
      parts.push(kit.box(1.5, 0.13, 0.27, plank, { x: stackX + (layer % 2 ? 0.05 : -0.05), y: 0.12 + layer * 0.15, z: stackZ + dz, r: 0.03 }));
    }
  }

  // Greenery at the corner and a barrel by the door.
  parts.push(bush(kit, left + 0.25, FLOOR - 0.05, front + 0.55));
  parts.push(kit.cyl(0.32, 0.28, 0.75, p.wood, { x: CX - 2.2, y: 0.22, z: front + 0.75 }, 14));
  parts.push(kit.cyl(0.33, 0.33, 0.08, p.darkMetal, { x: CX - 2.2, y: 0.72, z: front + 0.75 }, 14));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[chimneyX, eave + 3.1, chimneyZ]] });
}

export function registerSawmillModel(registry: ModelRegistry): void {
  registry.register('building.sawmill', sawmill);
}
