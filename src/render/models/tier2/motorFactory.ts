/**
 * Motor factory: a single-pitch hall with a gear and rotor on its tall side,
 * and a yellow gantry crane in the open beside it, lowering a finished motor
 * onto a pallet next to the winding bench and the reels of wire.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { HALF_PI, bush, framedWindow, rollerDoor } from '../parts';
import { FLOOR, pallet, planter, rodX, rodZ, slab, walls, type Parts } from './shared';

/** Gear facing +z with a wound rotor at its hub. */
function gear(kit: Kit, radius: number, paint: Paint, coil: Paint, x: number, y: number, z: number): Object3D {
  const p = kit.theme.props;
  const g = new Group();
  g.add(rodZ(kit, radius, 0.14, paint, 0, 0, 0, 24));
  const teeth = 10;
  for (let i = 0; i < teeth; i += 1) {
    const angle = (i / teeth) * Math.PI * 2;
    const tooth = kit.box(radius * 0.36, radius * 0.36, 0.14, paint, { r: 0.04, rz: angle });
    tooth.position.set(Math.cos(angle) * radius * 1.06, Math.sin(angle) * radius * 1.06, 0);
    g.add(tooth);
  }
  g.add(rodZ(kit, radius * 0.62, 0.18, p.sign, 0, 0, 0, 20));
  g.add(rodZ(kit, radius * 0.4, 0.26, coil, 0, 0, 0, 16));
  g.add(rodZ(kit, radius * 0.13, 0.36, p.metal, 0, 0, 0, 10));
  g.position.set(x, y, z);
  return g;
}

/** Electric motor lying along x, standing on its foot at `y`. */
function motor(kit: Kit, body: Paint, box: Paint, x: number, y: number, z: number, ry = 0): Object3D {
  const p = kit.theme.props;
  const g = new Group();
  g.add(kit.box(0.8, 0.1, 0.76, p.darkMetal, { r: 0.03 }));
  g.add(rodX(kit, 0.4, 0.9, body, 0, 0.46, 0, 16));
  for (const dx of [-0.2, 0.15]) g.add(rodX(kit, 0.44, 0.1, p.darkMetal, dx, 0.46, 0, 16));
  g.add(rodX(kit, 0.34, 0.16, p.metal, 0.52, 0.46, 0, 14));
  g.add(rodX(kit, 0.08, 0.36, p.metal, 0.76, 0.46, 0, 8));
  g.add(kit.box(0.34, 0.2, 0.34, box, { x: -0.02, y: 0.82, r: 0.05 }));
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

function motorFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'motorFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const wire = itemColor(theme, 'wire');
  const steel = itemColor(theme, 'steel');
  const motorPaint = itemColor(theme, 'motor');
  const parts: Parts = [];

  // Hall with one roof slope, tall on the left.
  const CX = 1.7;
  const CZ = -3;
  const W = 7;
  const D = 6.4;
  const WALL = 2.7;
  const RISE = 2.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.6, 5.8, -6.75, 2));
  parts.push(kit.box(3.4, 0.22, 1.3, p.concrete, { x: CX + 1.6, z: front + 0.7, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  parts.push(kit.prism(D - 0.02, RISE, W - 0.02, palette.wall, { x: CX, y: eave - 0.05, z: CZ, ry: HALF_PI }, 0));
  const pitch = Math.atan2(RISE, W);
  const span = (W + 1.2) / Math.cos(pitch);
  parts.push(kit.box(span, 0.34, D + 1.2, palette.roof, { x: CX, y: eave + RISE / 2 + 0.03, z: CZ, rz: -pitch, r: 0.14 }));
  parts.push(kit.box(span, 0.2, 0.22, p.sign, { x: CX, y: eave + RISE / 2 - 0.02, z: front + 0.56, rz: -pitch, r: 0.06 }));
  parts.push(kit.box(0.3, 0.3, D + 1.3, palette.accent, { x: left - 0.62, y: eave + RISE + 0.2, z: CZ, r: 0.1 }));
  for (const x of [left + 0.1, right - 0.1]) {
    parts.push(kit.box(0.42, WALL + 0.05, 0.42, palette.roof, { x, y: FLOOR, z: front - 0.1, r: 0.1 }));
  }

  parts.push(rollerDoor(kit, { cx: CX + 1.6, wall: front, y: FLOOR, height: 2.1, paint: trim }));
  parts.push(framedWindow(kit, { face: 'front', along: CX - 1.75, wall: front, y: FLOOR + 0.55, height: 1.1, sill: palette.roof }));
  parts.push(framedWindow(kit, { face: 'left', along: CZ, wall: left, y: FLOOR + 3, width: 3.4, height: 1.1, sill: palette.roof }));
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 0.85, sill: palette.roof }));
  }

  // The gear with a rotor at its hub, high on the tall side of the front.
  const gearX = CX - 1.75;
  const gearY = FLOOR + 3.05;
  parts.push(rodZ(kit, 1.22, 0.1, p.sign, gearX, gearY, front + 0.03, 28));
  parts.push(gear(kit, 0.84, palette.accent, wire, gearX, gearY, front + 0.15));

  // Gantry crane over the open floor.
  const GX = -4.95;
  const GZ = -1.6;
  const beamY = FLOOR + 3.85;
  for (const x of [GX - 2.35, GX + 2.35]) {
    for (const side of [-1, 1]) {
      parts.push(kit.box(0.26, 4.05, 0.26, p.hazard, { x, y: FLOOR - 0.05, z: GZ + side * 0.42, rx: -side * 0.2, r: 0.07 }));
    }
    parts.push(kit.box(0.4, 0.16, 2, p.darkMetal, { x, y: FLOOR, z: GZ, r: 0.05 }));
  }
  parts.push(kit.box(5.3, 0.42, 0.46, p.hazard, { x: GX, y: beamY, z: GZ, r: 0.1 }));
  const hookX = GX + 0.5;
  parts.push(kit.box(0.8, 0.36, 0.8, p.darkMetal, { x: hookX, y: beamY - 0.3, z: GZ, r: 0.08 }));
  parts.push(kit.cyl(0.04, 0.04, 1.5, p.darkMetal, { x: hookX, y: beamY - 1.8, z: GZ }, 6));
  parts.push(kit.box(0.3, 0.26, 0.3, p.metal, { x: hookX, y: beamY - 2.0, z: GZ, r: 0.07 }));
  parts.push(motor(kit, motorPaint, trim, hookX - 0.05, beamY - 2.95, GZ));
  parts.push(pallet(kit, hookX, FLOOR, GZ, 1.3));

  // Finished motors on pallets behind the crane.
  for (const [x, z, ry] of [[-6.3, -3.9, 0.15], [-4.7, -4.1, -0.1], [-6.35, -1.55, HALF_PI]] as const) {
    parts.push(pallet(kit, x, FLOOR, z, 1.3));
    parts.push(motor(kit, motorPaint, trim, x - 0.05, FLOOR + 0.2, z, ry));
  }

  // Winding bench: a stator on the spindle taking wire from the reel beside it.
  const BX = -5.7;
  const BZ = 0.85;
  const benchTop = FLOOR + 0.8;
  parts.push(kit.box(2.5, 0.16, 1.1, p.darkMetal, { x: BX, y: benchTop - 0.16, z: BZ, r: 0.05 }));
  for (const dx of [-1.05, 1.05]) parts.push(kit.box(0.2, 0.66, 0.95, p.darkMetal, { x: BX + dx, y: FLOOR, z: BZ, r: 0.06 }));
  for (const dx of [-0.55, 0.55]) parts.push(kit.box(0.14, 0.62, 0.4, palette.roof, { x: BX + dx, y: benchTop, z: BZ, r: 0.05 }));
  parts.push(rodX(kit, 0.42, 0.5, steel, BX, benchTop + 0.5, BZ, 16));
  parts.push(rodX(kit, 0.3, 0.74, wire, BX, benchTop + 0.5, BZ, 14));
  parts.push(rodX(kit, 0.07, 1.5, p.metal, BX, benchTop + 0.5, BZ, 8));
  parts.push(kit.box(0.3, 0.3, 0.3, kit.materials.lamp, { x: BX + 1, y: benchTop, z: BZ - 0.3, r: 0.07 }));
  const reelX = -3.5;
  for (const dx of [-0.36, 0.36]) {
    parts.push(rodX(kit, 0.62, 0.09, p.wood, reelX + dx, FLOOR + 0.78, BZ, 18));
    parts.push(kit.box(0.12, 0.8, 0.7, p.darkMetal, { x: reelX + dx * 1.45, y: FLOOR, z: BZ, r: 0.04 }));
  }
  parts.push(rodX(kit, 0.42, 0.66, wire, reelX, FLOOR + 0.78, BZ, 16));
  parts.push(rodX(kit, 0.03, 1.7, wire, -4.6, benchTop + 0.72, BZ, 6));

  // More wire on big reels, and steel plate, at the back.
  const RX = -3.1;
  const RZ = -5.3;
  parts.push(kit.cyl(0.9, 0.9, 0.1, p.wood, { x: RX, y: FLOOR, z: RZ }, 20));
  parts.push(kit.cyl(0.6, 0.6, 0.7, wire, { x: RX, y: FLOOR + 0.1, z: RZ }, 18));
  parts.push(kit.cyl(0.9, 0.9, 0.1, p.wood, { x: RX, y: FLOOR + 0.8, z: RZ }, 20));
  parts.push(kit.cyl(0.42, 0.42, 0.5, wire, { x: RX + 0.1, y: FLOOR + 0.9, z: RZ }, 16));
  parts.push(kit.cyl(0.65, 0.65, 0.08, p.wood, { x: RX + 0.1, y: FLOOR + 1.4, z: RZ }, 18));
  parts.push(pallet(kit, -6.3, FLOOR, -5.7, 1.3));
  for (let i = 0; i < 3; i += 1) {
    parts.push(kit.box(1.15, 0.13, 1.05, steel, { x: -6.3 + (i % 2 ? 0.05 : -0.05), y: FLOOR + 0.2 + i * 0.14, z: -5.7, r: 0.03 }));
  }

  parts.push(planter(kit, CX - 0.1, FLOOR, front + 0.5, palette.accent));
  parts.push(bush(kit, left - 0.85, FLOOR - 0.05, front - 0.9));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerMotorFactoryModel(registry: ModelRegistry): void {
  registry.register('building.motorFactory', motorFactory);
}
