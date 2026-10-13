/**
 * Packaging plant (tier 3): a long low hall beside a square tower that
 * carries a giant ribboned gift box, and a packing line out front where open
 * cartons are filled with snacks and bottles, closed and tied with a ribbon.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { flatRoof, framedWindow, rollerDoor } from '../parts';
import { FLOOR, type Parts, conveyor, disc, giftBox, glassBand, hall, pot } from './shared';

function packagingPlant(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'packagingPlant');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const gift = itemColor(theme, 'giftSet');
  const snack = itemColor(theme, 'snack');
  const bottle = itemColor(theme, 'bottle');
  const parts: Parts = [];

  // Low hall on the left, tower on the right.
  const HX = -2.4;
  const HZ = -3.9;
  const HW = 9.2;
  const HD = 5.2;
  const HH = 2.9;
  const hallFront = HZ + HD / 2;
  const hallTop = FLOOR + HH;
  const TX = 3.6;
  const TZ = -3.3;
  const TW = 4;
  const TD = 5.6;
  const TH = 5;
  const towerFront = TZ + TD / 2;
  const towerTop = FLOOR + TH;
  const towerRight = TX + TW / 2;

  parts.push(kit.box(13.4, FLOOR, 8.7, p.concrete, { x: -0.8, z: -2.5, r: 0.1 }));

  parts.push(hall(kit, { cx: HX, cz: HZ, w: HW, d: HD, h: HH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: HX, cz: HZ, width: HW, depth: HD, top: hallTop, roof: palette.roof, cap: p.sign }));
  parts.push(hall(kit, { cx: TX, cz: TZ, w: TW, d: TD, h: TH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: TX, cz: TZ, width: TW, depth: TD, top: towerTop, roof: palette.roof, cap: p.sign }));
  parts.push(kit.box(TW + 0.12, 0.4, TD + 0.12, palette.accent, { x: TX, y: towerTop - 0.75, z: TZ, r: 0.1 }));

  // The gift box on the tower says what leaves this plant.
  parts.push(kit.box(2.9, 0.3, 2.9, trim, { x: TX, y: towerTop + 0.4, z: TZ, r: 0.1 }));
  parts.push(giftBox(kit, { x: TX, y: towerTop + 0.68, z: TZ, w: 2.4, h: 1.9, d: 2.4, paint: gift, ribbon: trim }));

  // Tower front: dispatch door, glazing above it, windows on the open side.
  parts.push(rollerDoor(kit, { cx: TX, wall: towerFront, y: FLOOR, paint: palette.accent }));
  parts.push(glassBand(kit, { face: 'front', along: TX, wall: towerFront, y: FLOOR + 3.0, width: 2.8, height: 1.1, panes: 3 }));
  for (const y of [FLOOR + 1.0, FLOOR + 2.9]) {
    parts.push(framedWindow(kit, { face: 'right', along: TZ, wall: towerRight, y, width: 2.2, height: 1.2, sill: palette.accent }));
  }

  // Hall: two wide windows with a candy-striped fascia above them, skylights and vents on the roof.
  for (const x of [HX - 2.4, HX + 2.2]) {
    parts.push(glassBand(kit, { face: 'front', along: x, wall: hallFront, y: FLOOR + 1.05, width: 3.2, height: 1.3, panes: 3 }));
  }
  for (let i = 0; i < 6; i += 1) {
    parts.push(kit.box(1.5, 0.3, 0.14, i % 2 ? palette.roof : p.sign, { x: HX - 3.75 + i * 1.5, y: hallTop - 0.52, z: hallFront + 0.03, r: 0.05 }));
  }
  for (const x of [HX - 2.6, HX + 0.4]) {
    parts.push(kit.box(1.9, 0.3, 1.5, p.sign, { x, y: hallTop + 0.3, z: HZ - 0.6, r: 0.08 }));
    parts.push(kit.box(1.6, 0.14, 1.2, kit.materials.window, { x, y: hallTop + 0.56, z: HZ - 0.6, r: 0.05 }));
  }
  parts.push(kit.cyl(0.3, 0.34, 0.9, p.metal, { x: HX + 3.0, y: hallTop + 0.3, z: HZ - 0.9 }, 12));
  parts.push(kit.cone(0.5, 0.36, palette.accent, { x: HX + 3.0, y: hallTop + 1.15, z: HZ - 0.9 }, 12));

  // Packing line along the front of the hall.
  const LINE_Z = 0.1;
  const BELT = FLOOR + 0.95;
  parts.push(conveyor(kit, { x: -2.3, z: LINE_Z, length: 7.4, top: BELT, base: FLOOR, width: 1.1 }));
  // Filling machine at the head of the line, with a hopper.
  const fillX = -6.4;
  parts.push(kit.box(1.5, 1.9, 1.5, palette.accent, { x: fillX, y: FLOOR, z: LINE_Z, r: 0.16 }));
  parts.push(kit.cyl(0.62, 0.3, 0.6, trim, { x: fillX, y: FLOOR + 1.9, z: LINE_Z }, 14));
  parts.push(kit.box(0.14, 0.7, 0.9, p.darkMetal, { x: fillX + 0.76, y: FLOOR + 0.75, z: LINE_Z, r: 0.04 }));
  parts.push(kit.box(0.4, 0.2, 0.16, kit.materials.lamp, { x: fillX, y: FLOOR + 1.45, z: LINE_Z + 0.76, r: 0.06 }));
  // Open cartons with snacks and bottles showing, then a closed one.
  for (const x of [-5.0, -3.7]) {
    parts.push(kit.box(0.8, 0.5, 0.8, gift, { x, y: BELT, z: LINE_Z, r: 0.05 }));
    parts.push(kit.box(0.64, 0.08, 0.64, p.darkMetal, { x, y: BELT + 0.45, z: LINE_Z, r: 0.02 }));
    parts.push(kit.box(0.3, 0.22, 0.56, snack, { x: x - 0.15, y: BELT + 0.42, z: LINE_Z, r: 0.05 }));
    parts.push(kit.cyl(0.07, 0.11, 0.42, bottle, { x: x + 0.17, y: BELT + 0.4, z: LINE_Z - 0.14 }, 8));
    parts.push(kit.cyl(0.07, 0.11, 0.42, bottle, { x: x + 0.17, y: BELT + 0.4, z: LINE_Z + 0.14 }, 8));
  }
  parts.push(kit.box(0.8, 0.56, 0.8, gift, { x: -2.4, y: BELT, z: LINE_Z, r: 0.05 }));
  // Ribbon station: a portal over the belt with spools on top.
  const tieX = -1.2;
  for (const dz of [-0.75, 0.75]) parts.push(kit.box(0.24, 2.3, 0.24, palette.accent, { x: tieX, y: FLOOR, z: LINE_Z + dz, r: 0.08 }));
  parts.push(kit.box(0.5, 0.3, 1.9, palette.accent, { x: tieX, y: FLOOR + 2.2, z: LINE_Z, r: 0.1 }));
  parts.push(disc(kit, 0.36, 0.3, trim, tieX, FLOOR + 2.85, LINE_Z - 0.4, 'z', 16));
  parts.push(disc(kit, 0.36, 0.3, palette.roof, tieX, FLOOR + 2.85, LINE_Z + 0.4, 'z', 16));
  parts.push(kit.box(0.1, 0.75, 0.16, trim, { x: tieX, y: FLOOR + 1.5, z: LINE_Z, r: 0.03 }));
  for (const x of [-0.1, 0.85]) {
    parts.push(giftBox(kit, { x, y: BELT, z: LINE_Z, w: 0.8, h: 0.56, d: 0.8, paint: gift, ribbon: trim }));
  }

  // Finished gift sets stacked on a pallet at the end of the line.
  const palletX = 2.35;
  const palletZ = 0.95;
  parts.push(kit.box(1.5, 0.16, 1.5, theme.goods.pallet, { x: palletX, y: FLOOR, z: palletZ, r: 0.04 }));
  for (const [dx, dz, y] of [[-0.36, -0.3, 0], [0.36, 0.3, 0], [0, 0, 0.58]] as const) {
    parts.push(giftBox(kit, { x: palletX + dx, y: FLOOR + 0.16 + y, z: palletZ + dz, w: 0.66, h: 0.56, d: 0.66, paint: gift, ribbon: trim, bow: y > 0 }));
  }

  // Supplies beside the filling machine: a crate of snacks and a crate of bottles.
  parts.push(kit.box(1.0, 0.7, 0.9, snack, { x: -6.6, y: FLOOR, z: 1.25, r: 0.08 }));
  parts.push(kit.box(1.0, 0.45, 0.9, p.wood, { x: -5.4, y: FLOOR, z: 1.25, r: 0.06 }));
  for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [0, 0.2]] as const) {
    parts.push(kit.cyl(0.1, 0.16, 0.6, bottle, { x: -5.4 + dx, y: FLOOR + 0.3, z: 1.25 + dz }, 8));
  }

  parts.push(pot(kit, TX + 1.95, FLOOR, towerFront + 0.45, trim));
  parts.push(pot(kit, 1.2, FLOOR, 1.45, trim));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerPackagingPlant(registry: ModelRegistry): void {
  registry.register('building.packagingPlant', packagingPlant);
}
