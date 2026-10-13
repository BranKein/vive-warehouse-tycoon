/**
 * Tool factory: a tall gabled forge hall with a crossed hammer and wrench on
 * its gable, a round brick stack behind, and a low open workshop beside it
 * with a drop press out front and tools hanging on the back wall.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { bush, flatRoof, framedWindow, gableRoof, rollerDoor } from '../parts';
import { FLOOR, crate, rodX, rodZ, slab, walls, type Parts } from './shared';

/** Hammer standing upright in the z plane, centred on its handle; `size` is its length. */
function hammer(kit: Kit, size: number, head: Paint, x: number, y: number, z: number, rz: number): Object3D {
  const g = new Group();
  g.add(kit.box(size * 0.11, size, 0.1, kit.theme.props.wood, { y: -size / 2, r: 0.03 }));
  g.add(kit.box(size * 0.5, size * 0.24, 0.16, head, { y: size * 0.3, r: 0.04 }));
  g.position.set(x, y, z);
  g.rotation.z = rz;
  return g;
}

/** Wrench standing upright in the z plane; the open jaw shows the `gap` colour. */
function wrench(kit: Kit, size: number, paint: Paint, gap: Paint, x: number, y: number, z: number, rz: number): Object3D {
  const g = new Group();
  g.add(kit.box(size * 0.13, size * 0.8, 0.1, paint, { y: -size * 0.4, r: 0.03 }));
  g.add(rodZ(kit, size * 0.2, 0.1, paint, 0, size * 0.42, 0, 16));
  g.add(kit.box(size * 0.13, size * 0.24, 0.18, gap, { y: size * 0.44, r: 0.02 }));
  g.add(rodZ(kit, size * 0.15, 0.1, paint, 0, -size * 0.42, 0, 16));
  g.add(rodZ(kit, size * 0.07, 0.18, gap, 0, -size * 0.42, 0, 12));
  g.position.set(x, y, z);
  g.rotation.z = rz;
  return g;
}

function toolFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'toolFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const steel = itemColor(theme, 'steel');
  const plank = itemColor(theme, 'lumber');
  const tools = itemColor(theme, 'tools');
  const parts: Parts = [];

  // Forge hall: tall and narrow, gable end towards the yard.
  const CX = -3.3;
  const CZ = -2.9;
  const W = 5.6;
  const D = 6;
  const WALL = 4;
  const RISE = 1.9;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.1, 5.8, -6.75, 2));
  parts.push(kit.box(3.6, 0.22, 1.2, p.concrete, { x: CX, z: front + 0.65, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  for (const x of [left + 0.1, right - 0.1]) {
    for (const z of [front - 0.1, CZ - D / 2 + 0.1]) {
      parts.push(kit.box(0.42, WALL + 0.1, 0.42, palette.accent, { x, y: FLOOR, z, r: 0.1 }));
    }
  }
  parts.push(kit.box(W + 0.1, 0.34, 0.3, palette.accent, { x: CX, y: eave - 0.3, z: front + 0.02, r: 0.08 }));
  parts.push(gableRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, eave, rise: RISE, wall: palette.wall, roof: palette.roof, cap: palette.accent, overhang: 0.7 }));
  parts.push(rollerDoor(kit, { cx: CX, wall: front, y: FLOOR, width: 2.6, height: 2.5 }));
  // Backplate that holds the door lamp to the wall.
  parts.push(kit.box(0.54, 0.36, 0.14, p.sign, { x: CX, y: FLOOR + 2.73, z: front + 0.03, r: 0.05 }));
  for (const z of [CZ - 1.5, CZ + 1.5]) {
    parts.push(framedWindow(kit, { face: 'left', along: z, wall: left, y: FLOOR + 1.7, sill: palette.accent }));
  }

  // Crossed hammer and wrench on the gable.
  const signY = eave + 0.4;
  parts.push(rodZ(kit, 1.12, 0.1, p.sign, CX, signY, front + 0.03, 28));
  parts.push(wrench(kit, 1.6, palette.accent, p.sign, CX, signY, front + 0.13, 0.75));
  parts.push(hammer(kit, 1.6, palette.roof, CX, signY, front + 0.22, -0.75));

  // Round brick stack on a stone base, joined to the hall by a flue.
  const stackX = 1.3;
  const stackZ = -5.6;
  parts.push(kit.box(1.9, 0.9, 1.9, p.rock, { x: stackX, y: FLOOR, z: stackZ, r: 0.14 }));
  parts.push(kit.cyl(0.52, 0.8, 7, palette.roof, { x: stackX, y: FLOOR + 0.85, z: stackZ }, 18));
  parts.push(kit.cyl(0.66, 0.69, 0.36, p.sign, { x: stackX, y: FLOOR + 5.6, z: stackZ }, 18));
  parts.push(kit.cyl(0.66, 0.66, 0.3, p.sign, { x: stackX, y: FLOOR + 7.65, z: stackZ }, 18));
  parts.push(kit.box(1.5, 0.55, 0.55, p.darkMetal, { x: 0.15, y: FLOOR + 1.5, z: stackZ, r: 0.1 }));

  // Open workshop: back wall, one side wall, flat roof on posts.
  const AX = 2.45;
  const backWall = -4.3;
  const shopTop = FLOOR + 2.6;
  parts.push(kit.box(5.9, 2.6, 0.3, palette.wall, { x: AX, y: FLOOR, z: backWall, r: 0.1 }));
  parts.push(kit.box(6, 0.5, 0.42, p.rock, { x: AX, y: FLOOR, z: backWall, r: 0.1 }));
  parts.push(kit.box(0.3, 2.6, 2.8, palette.wall, { x: 5.25, y: FLOOR, z: backWall + 1.3, r: 0.1 }));
  parts.push(framedWindow(kit, { face: 'right', along: backWall + 1.4, wall: 5.4, y: FLOOR + 1, width: 1.4, height: 1.1, sill: palette.accent }));
  for (const x of [2.3, 5.2]) parts.push(kit.box(0.32, 2.6, 0.32, palette.accent, { x, y: FLOOR, z: -1.5, r: 0.09 }));
  parts.push(flatRoof(kit, { cx: 2.5, cz: -2.9, width: 5.6, depth: 2.8, top: shopTop, roof: palette.roof, cap: p.sign }));

  // Tool board on the back wall.
  const boardZ = backWall + 0.2;
  parts.push(kit.box(3, 1.5, 0.12, p.sign, { x: 1.4, y: FLOOR + 0.85, z: boardZ, r: 0.06 }));
  for (const [i, x] of [0.35, 1.05, 1.75, 2.45].entries()) {
    parts.push(
      i % 2 === 0
        ? hammer(kit, 1, tools, x, FLOOR + 1.6, boardZ + 0.14, 0)
        : wrench(kit, 1, palette.accent, p.sign, x, FLOOR + 1.6, boardZ + 0.12, 0),
    );
  }
  // Steel bars on trestles under the roof.
  for (const x of [3.3, 4.6]) parts.push(kit.box(0.2, 0.5, 1, p.darkMetal, { x, y: FLOOR, z: -3.3, r: 0.05 }));
  for (const [dz, dy] of [[-0.26, 0], [0, 0], [0.26, 0], [-0.13, 0.22], [0.13, 0.22]] as const) {
    parts.push(rodX(kit, 0.12, 2.2, steel, 3.95, FLOOR + 0.62 + dy, -3.3 + dz, 10));
  }

  // Drop press out front: frame, ram, anvil, a glowing blank.
  const PX = 1.3;
  const PZ = -0.3;
  parts.push(kit.box(1.7, 0.5, 1.4, p.darkMetal, { x: PX, y: FLOOR, z: PZ, r: 0.12 }));
  parts.push(kit.box(0.9, 0.34, 0.8, p.metal, { x: PX, y: FLOOR + 0.5, z: PZ, r: 0.08 }));
  parts.push(kit.box(0.6, 0.1, 0.24, kit.materials.lamp, { x: PX, y: FLOOR + 0.84, z: PZ, r: 0.04 }));
  for (const dx of [-0.66, 0.66]) parts.push(kit.box(0.3, 2.5, 0.4, palette.accent, { x: PX + dx, y: FLOOR + 0.5, z: PZ, r: 0.08 }));
  parts.push(kit.box(1.9, 0.6, 0.9, palette.accent, { x: PX, y: FLOOR + 2.9, z: PZ, r: 0.14 }));
  parts.push(kit.box(1.9, 0.16, 0.94, p.hazard, { x: PX, y: FLOOR + 2.86, z: PZ, r: 0.05 }));
  parts.push(kit.box(0.7, 0.8, 0.6, p.metal, { x: PX, y: FLOOR + 1.5, z: PZ, r: 0.1 }));
  parts.push(kit.cyl(0.14, 0.14, 0.7, p.darkMetal, { x: PX, y: FLOOR + 2.25, z: PZ }, 10));

  // Quench barrel and handle blanks beside the press.
  parts.push(kit.cyl(0.36, 0.32, 0.8, p.wood, { x: PX + 1.45, y: FLOOR, z: PZ - 0.3 }, 14));
  parts.push(kit.cyl(0.31, 0.31, 0.06, p.glass, { x: PX + 1.45, y: FLOOR + 0.76, z: PZ - 0.3 }, 14));
  for (let layer = 0; layer < 2; layer += 1) {
    for (const dz of [-0.26, 0, 0.26]) {
      parts.push(kit.box(1.4, 0.13, 0.22, plank, { x: PX + (layer ? 0.05 : -0.05), y: FLOOR + layer * 0.14, z: 1.45 + dz, r: 0.03 }));
    }
  }

  // Bench with finished tools, and a crate of them ready to go.
  const TX = 4.2;
  const TZ = 0.2;
  const benchTop = FLOOR + 0.84;
  parts.push(kit.box(2.1, 0.16, 1.1, p.wood, { x: TX, y: benchTop - 0.16, z: TZ, r: 0.05 }));
  for (const dx of [-0.9, 0.9]) parts.push(kit.box(0.2, 0.7, 0.95, palette.accent, { x: TX + dx, y: FLOOR, z: TZ, r: 0.06 }));
  for (const [dx, dz] of [[-0.6, 0.2], [0.05, -0.15]] as const) {
    parts.push(kit.box(0.8, 0.08, 0.1, p.wood, { x: TX + dx, y: benchTop, z: TZ + dz, r: 0.03 }));
    parts.push(kit.box(0.22, 0.2, 0.42, tools, { x: TX + dx + 0.3, y: benchTop, z: TZ + dz, r: 0.04 }));
  }
  parts.push(kit.box(0.8, 0.08, 0.12, tools, { x: TX + 0.55, y: benchTop, z: TZ + 0.3, ry: 0.5, r: 0.03 }));
  parts.push(crate(kit, 4.9, FLOOR, 1.45, 0.8, tools));
  parts.push(crate(kit, 3.95, FLOOR, 1.5, 0.65, p.wood));

  parts.push(bush(kit, left - 0.55, FLOOR - 0.05, front + 0.7));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[stackX, FLOOR + 8.2, stackZ]] });
}

export function registerToolFactoryModel(registry: ModelRegistry): void {
  registry.register('building.toolFactory', toolFactory);
}
