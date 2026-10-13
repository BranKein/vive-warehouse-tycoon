/**
 * Electronic parts factory: a clean flat-roofed block with a plant room and
 * vents on top, a circuit board with a big chip standing over the front wall,
 * and an assembly line in the open where boards ride through the placer.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { bush, flatRoof, framedWindow, rollerDoor } from '../parts';
import { FLOOR, conveyor, crate, pallet, planter, rodZ, roofVent, slab, walls, type Parts } from './shared';

function partsFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'partsFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const steel = itemColor(theme, 'steel');
  const plastic = itemColor(theme, 'plastic');
  const board = itemColor(theme, 'electronicPart');
  const oil = itemColor(theme, 'wasteOil');
  const parts: Parts = [];

  // Main block.
  const CX = 0.9;
  const CZ = -3;
  const W = 8.6;
  const D = 6.2;
  const WALL = 3.4;
  const top = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.55, 5.8, -6.75, 2));
  parts.push(kit.box(3.4, 0.22, 1.3, p.concrete, { x: 3.5, z: front + 0.7, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  parts.push(kit.box(W + 0.08, 0.3, D + 0.08, palette.roof, { x: CX, y: top - 0.85, z: CZ, r: 0.06 }));
  parts.push(flatRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, top, roof: palette.roof, cap: p.sign }));
  const roofTop = top + 0.34;

  // Plant room on the roof with a louvre, air handlers and vents around it.
  const PX = CX + 2;
  const PZ = CZ - 0.9;
  parts.push(kit.box(4, 1.5, 3.4, palette.wall, { x: PX, y: roofTop, z: PZ, r: 0.16 }));
  parts.push(flatRoof(kit, { cx: PX, cz: PZ, width: 4, depth: 3.4, top: roofTop + 1.5, roof: palette.roof, cap: p.sign }));
  parts.push(kit.box(2.4, 0.9, 0.12, p.sign, { x: PX, y: roofTop + 0.3, z: PZ + 1.72, r: 0.05 }));
  for (let i = 0; i < 4; i += 1) {
    parts.push(kit.box(2.1, 0.1, 0.2, p.darkMetal, { x: PX, y: roofTop + 0.42 + i * 0.19, z: PZ + 1.74, rx: 0.5, r: 0.03 }));
  }
  for (const z of [CZ - 1.6, CZ + 0.5]) {
    parts.push(kit.box(1.3, 0.65, 1.1, p.metal, { x: left + 1.5, y: roofTop, z, r: 0.1 }));
    parts.push(kit.cyl(0.4, 0.4, 0.08, p.darkMetal, { x: left + 1.5, y: roofTop + 0.64, z }, 16));
  }
  for (const x of [PX - 1.2, PX, PX + 1.2]) parts.push(roofVent(kit, x, roofTop, front - 0.75));
  parts.push(kit.box(0.4, 0.4, 1.9, p.metal, { x: PX - 2.3, y: roofTop + 0.1, z: PZ - 0.4, r: 0.1 }));

  parts.push(rollerDoor(kit, { cx: 3.5, wall: front, y: FLOOR, paint: trim }));
  parts.push(framedWindow(kit, { face: 'front', along: 0.95, wall: front, y: FLOOR + 1, width: 2, height: 1.3, sill: palette.roof }));
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1, sill: palette.roof }));
  }

  // The sign: a circuit board with a chip, standing above the parapet.
  const BX = -1.75;
  const boardZ = front + 0.14;
  const chipY = FLOOR + 3.45;
  for (const dx of [-0.9, 0.9]) parts.push(kit.box(0.2, 1.7, 0.5, p.darkMetal, { x: BX + dx, y: roofTop - 0.1, z: front - 0.22, r: 0.05 }));
  parts.push(kit.box(2.9, 2.9, 0.22, board, { x: BX, y: chipY - 1.45, z: boardZ, r: 0.14 }));
  parts.push(kit.box(3.06, 3.06, 0.12, p.sign, { x: BX, y: chipY - 1.53, z: boardZ - 0.04, r: 0.16 }));
  parts.push(kit.box(1.5, 1.5, 0.2, p.tire, { x: BX, y: chipY - 0.75, z: boardZ + 0.16, r: 0.1 }));
  parts.push(kit.box(0.8, 0.8, 0.08, p.darkMetal, { x: BX, y: chipY - 0.4, z: boardZ + 0.28, r: 0.06 }));
  parts.push(rodZ(kit, 0.11, 0.08, palette.accent, BX - 0.52, chipY + 0.52, boardZ + 0.28, 10));
  for (const d of [-0.5, -0.17, 0.17, 0.5]) {
    for (const side of [-1, 1]) {
      parts.push(kit.box(0.34, 0.14, 0.1, palette.accent, { x: BX + side * 0.88, y: chipY + d - 0.07, z: boardZ + 0.15, r: 0.03 }));
      parts.push(kit.box(0.14, 0.34, 0.1, palette.accent, { x: BX + d, y: chipY + side * 0.88 - 0.17, z: boardZ + 0.15, r: 0.03 }));
    }
  }
  // Solder pads in the corners of the board.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) parts.push(rodZ(kit, 0.13, 0.06, p.sign, BX + sx * 1.18, chipY + sy * 1.18, boardZ + 0.12, 10));
  }

  // Material bay on the left under a thin canopy with a glass screen behind.
  const SX = -5.5;
  const SZ = -4.3;
  parts.push(kit.box(3.8, 2.2, 0.14, kit.materials.window, { x: SX, y: FLOOR, z: SZ - 1.55, r: 0.05 }));
  parts.push(kit.box(3.9, 0.3, 0.24, p.sign, { x: SX, y: FLOOR, z: SZ - 1.55, r: 0.06 }));
  for (const z of [SZ - 1.5, SZ + 1.4]) parts.push(kit.box(0.2, 2.45, 0.2, p.metal, { x: -7.2, y: FLOOR, z, r: 0.06 }));
  parts.push(kit.box(4.1, 0.24, 3.4, palette.roof, { x: SX - 0.05, y: FLOOR + 2.42, z: SZ, r: 0.1 }));
  parts.push(kit.box(4.2, 0.12, 3.5, p.sign, { x: SX - 0.05, y: FLOOR + 2.44, z: SZ, r: 0.05 }));
  parts.push(pallet(kit, -6.4, FLOOR, SZ - 0.4, 1.3));
  for (let i = 0; i < 3; i += 1) {
    parts.push(kit.box(1.15, 0.12, 1.05, steel, { x: -6.4 + (i % 2 ? 0.04 : -0.04), y: FLOOR + 0.2 + i * 0.13, z: SZ - 0.4, r: 0.03 }));
  }
  for (const x of [-4.95, -4.2]) {
    parts.push(kit.cyl(0.33, 0.33, 0.8, p.metal, { x, y: FLOOR, z: SZ - 0.6 }, 14));
    parts.push(kit.dome(0.29, 0.14, 0.29, plastic, { x, y: FLOOR + 0.78, z: SZ - 0.6 }));
  }

  // Assembly line in the open: placer, reflow oven, boards on the belt.
  const LX = -5.6;
  const beltTop = FLOOR + 0.85;
  parts.push(conveyor(kit, { x: LX, z: -0.3, length: 3.8, top: beltTop }));
  const placerZ = -1.2;
  for (const dx of [-0.7, 0.7]) parts.push(kit.box(0.24, 1.25, 1.2, p.sign, { x: LX + dx, y: FLOOR, z: placerZ, r: 0.08 }));
  parts.push(kit.box(1.75, 0.8, 1.3, p.sign, { x: LX, y: FLOOR + 1.2, z: placerZ, r: 0.14 }));
  parts.push(kit.box(1.2, 0.42, 0.12, kit.materials.window, { x: LX, y: FLOOR + 1.4, z: placerZ + 0.62, r: 0.05 }));
  parts.push(kit.box(1.79, 0.14, 1.34, palette.roof, { x: LX, y: FLOOR + 1.22, z: placerZ, r: 0.05 }));
  parts.push(kit.cyl(0.07, 0.07, 0.34, p.metal, { x: LX + 0.6, y: FLOOR + 2, z: placerZ - 0.4 }, 8));
  parts.push(kit.cyl(0.1, 0.1, 0.16, kit.materials.lamp, { x: LX + 0.6, y: FLOOR + 2.3, z: placerZ - 0.4 }, 10));
  const ovenZ = 0.55;
  parts.push(kit.box(1.5, 0.6, 1, trim, { x: LX, y: beltTop + 0.28, z: ovenZ, r: 0.14 }));
  for (const dx of [-0.66, 0.66]) parts.push(kit.box(0.2, 1.1, 0.9, trim, { x: LX + dx, y: FLOOR, z: ovenZ, r: 0.07 }));
  parts.push(kit.cyl(0.12, 0.12, 0.5, p.metal, { x: LX - 0.4, y: beltTop + 0.86, z: ovenZ }, 10));
  for (const z of [-2, -0.3, 1.3]) {
    parts.push(kit.box(0.52, 0.05, 0.42, board, { x: LX, y: beltTop, z, r: 0.02 }));
    if (z > placerZ) parts.push(kit.box(0.2, 0.06, 0.2, p.tire, { x: LX, y: beltTop + 0.05, z, r: 0.02 }));
  }

  // Trays of finished parts, and drums of used oil by the wall.
  parts.push(crate(kit, -6.9, FLOOR, 1.2, 0.8, p.sign));
  parts.push(kit.box(0.6, 0.06, 0.6, board, { x: -6.9, y: FLOOR + 0.64, z: 1.2, r: 0.03 }));
  for (const z of [-1.9, -1.1]) {
    parts.push(kit.cyl(0.32, 0.32, 0.8, oil, { x: left - 0.5, y: FLOOR, z }, 14));
    parts.push(kit.cyl(0.33, 0.33, 0.08, p.darkMetal, { x: left - 0.5, y: FLOOR + 0.52, z }, 14));
  }

  parts.push(planter(kit, 1.95, FLOOR, front + 0.5, palette.accent));
  parts.push(bush(kit, BX - 0.9, FLOOR - 0.05, front + 0.55));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerPartsFactoryModel(registry: ModelRegistry): void {
  registry.register('building.partsFactory', partsFactory);
}
