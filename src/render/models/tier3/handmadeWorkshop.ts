/**
 * Handmade workshop: a small timber cottage with a cabinet on its gable and a
 * stone chimney, an open shed beside it for timber, cloth and glass, and a
 * forecourt where two people build a cabinet by hand.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { HALF_PI, bush, framedWindow, gableRoof, log } from '../parts';
import { FLOOR, type Parts } from './shared';

/** Little worker in an apron, facing +z, arms held out over the work. */
function worker(kit: Kit, x: number, y: number, z: number, ry: number, shirt: Paint, apron: Paint, cap: Paint): Object3D {
  const p = kit.theme.props;
  const g = new Group();
  g.add(kit.box(0.42, 0.5, 0.3, p.door, { r: 0.1 }));
  g.add(kit.box(0.52, 0.62, 0.36, shirt, { y: 0.44, r: 0.15 }));
  g.add(kit.box(0.36, 0.56, 0.08, apron, { y: 0.3, z: 0.19, r: 0.04 }));
  for (const side of [-1, 1]) g.add(kit.box(0.14, 0.14, 0.52, shirt, { x: side * 0.28, y: 0.72, z: 0.28, r: 0.06 }));
  g.add(kit.blob(0.24, 0.24, 0.24, p.houseWalls[1] ?? p.sign, { y: 1.02 }));
  g.add(kit.cyl(0.2, 0.25, 0.14, cap, { y: 1.4 }, 12));
  g.position.set(x, y, z);
  g.rotation.y = ry;
  return g;
}

function handmadeWorkshop(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'handmadeWorkshop');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const lumber = itemColor(theme, 'lumber');
  const fabric = itemColor(theme, 'fabric');
  const glass = itemColor(theme, 'glass');
  const cabinet = itemColor(theme, 'handmadeCabinet');
  const sawdust = itemColor(theme, 'sawdust');
  const parts: Parts = [];

  const CX = 2.3;
  const CZ = -2.9;
  const W = 5.2;
  const D = 5.6;
  const WALL = 2.7;
  const RISE = 2.5;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(kit.box(12.2, FLOOR, 7.6, p.concrete, { x: -0.2, z: -2.3, r: 0.1 }));

  // Cottage: plastered walls in a timber frame, steep gable roof.
  parts.push(kit.box(W, WALL, D, palette.wall, { x: CX, y: FLOOR, z: CZ, r: 0.2 }));
  parts.push(kit.box(W + 0.16, 0.55, D + 0.16, p.rock, { x: CX, y: FLOOR, z: CZ, r: 0.14 }));
  for (const x of [left + 0.1, right - 0.1]) {
    for (const z of [front - 0.1, CZ - D / 2 + 0.1]) {
      parts.push(kit.box(0.4, WALL + 0.1, 0.4, p.wood, { x, y: FLOOR, z, r: 0.1 }));
    }
  }
  parts.push(kit.box(W + 0.1, 0.3, 0.3, p.wood, { x: CX, y: eave - 0.28, z: front + 0.02, r: 0.08 }));
  parts.push(gableRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, eave, rise: RISE, wall: palette.wall, roof: palette.roof, cap: palette.accent, overhang: 0.7 }));

  // The cabinet on the gable says what is made here.
  const signZ = front + 0.02;
  const cabY = eave + 0.22;
  parts.push(kit.cyl(1.05, 1.05, 0.1, p.sign, { x: CX, y: eave + 0.85, z: signZ, rx: HALF_PI }, 28));
  parts.push(kit.box(1.0, 1.3, 0.14, cabinet, { x: CX, y: cabY, z: signZ + 0.12, r: 0.05 }));
  parts.push(kit.box(1.16, 0.12, 0.22, trim, { x: CX, y: cabY + 1.26, z: signZ + 0.13, r: 0.04 }));
  parts.push(kit.box(1.1, 0.1, 0.2, trim, { x: CX, y: cabY - 0.06, z: signZ + 0.13, r: 0.03 }));
  for (const side of [-1, 1]) {
    parts.push(kit.box(0.4, 0.5, 0.08, p.wood, { x: CX + side * 0.23, y: cabY + 0.1, z: signZ + 0.2, r: 0.03 }));
    parts.push(kit.box(0.4, 0.5, 0.08, kit.materials.window, { x: CX + side * 0.23, y: cabY + 0.7, z: signZ + 0.2, r: 0.03 }));
    parts.push(kit.blob(0.05, 0.05, 0.05, p.darkMetal, { x: CX + side * 0.1, y: cabY + 0.3, z: signZ + 0.24 }));
  }

  // Plank door with a lamp, a window with a flower box.
  const doorX = CX + 1.2;
  parts.push(kit.box(1.3, 2.15, 0.12, p.sign, { x: doorX, y: FLOOR, z: front + 0.01, r: 0.06 }));
  parts.push(kit.box(1.04, 2.0, 0.16, trim, { x: doorX, y: FLOOR, z: front + 0.05, r: 0.07 }));
  parts.push(kit.blob(0.07, 0.07, 0.07, p.darkMetal, { x: doorX - 0.34, y: FLOOR + 0.95, z: front + 0.14 }));
  parts.push(kit.box(0.3, 0.2, 0.16, kit.materials.lamp, { x: doorX, y: FLOOR + 2.2, z: front + 0.1, r: 0.06 }));
  const winX = CX - 1.25;
  parts.push(framedWindow(kit, { face: 'front', along: winX, wall: front, y: FLOOR + 1.0, width: 1.5, sill: palette.accent }));
  parts.push(kit.box(1.5, 0.3, 0.4, palette.accent, { x: winX, y: FLOOR + 0.6, z: front + 0.3, r: 0.1 }));
  for (const dx of [-0.45, 0, 0.45]) {
    parts.push(kit.blob(0.22, 0.2, 0.2, p.foliage[0] ?? trim, { x: winX + dx, y: FLOOR + 0.8, z: front + 0.34 }));
  }
  parts.push(kit.blob(0.1, 0.1, 0.1, p.blossom, { x: winX - 0.25, y: FLOOR + 1.05, z: front + 0.42 }));
  parts.push(framedWindow(kit, { face: 'right', along: CZ + 1.7, wall: right, y: FLOOR + 1.0, width: 1.4, sill: palette.accent }));

  // Stone chimney against the right wall.
  const chimneyX = right + 0.3;
  const chimneyZ = CZ - 0.9;
  parts.push(kit.box(0.95, 3.2, 1.4, p.rock, { x: chimneyX, y: FLOOR, z: chimneyZ, r: 0.14 }));
  parts.push(kit.box(0.72, 3.5, 0.84, p.rock, { x: chimneyX, y: FLOOR + 3.0, z: chimneyZ, r: 0.12 }));
  parts.push(kit.box(0.94, 0.22, 1.06, p.sign, { x: chimneyX, y: FLOOR + 6.4, z: chimneyZ, r: 0.08 }));
  parts.push(kit.cyl(0.18, 0.22, 0.36, palette.roof, { x: chimneyX, y: FLOOR + 6.6, z: chimneyZ }, 10));

  // Open shed on the left: posts, a back wall, a low roof with its ridge running sideways.
  const SX = -3.0;
  const SZ = -3.55;
  const POST = 2.3;
  const shedBack = SZ - 1.75;
  const shedFront = SZ + 1.75;
  const shedLeft = -5.6;
  for (const [x, z] of [[shedLeft, shedFront], [SX + 0.1, shedFront], [shedLeft, shedBack]] as const) {
    parts.push(kit.box(0.34, POST, 0.34, p.wood, { x, y: FLOOR, z, r: 0.09 }));
  }
  parts.push(kit.box(5.6, 0.26, 0.3, p.wood, { x: SX + 0.05, y: FLOOR + POST - 0.1, z: shedFront, r: 0.08 }));
  parts.push(kit.box(0.3, 0.26, 3.8, p.wood, { x: shedLeft, y: FLOOR + POST - 0.1, z: SZ, r: 0.08 }));
  parts.push(kit.box(0.22, 1.0, 0.22, p.wood, { x: shedLeft, y: FLOOR + POST + 0.1, z: SZ, r: 0.06 }));
  parts.push(kit.box(5.5, POST, 0.24, palette.wall, { x: SX + 0.1, y: FLOOR, z: shedBack, r: 0.08 }));
  parts.push(kit.box(5.5, 0.2, 0.32, p.wood, { x: SX + 0.1, y: FLOOR + 1.1, z: shedBack, r: 0.06 }));
  const shedRise = 1.1;
  const span = 2.2;
  const shedPitch = Math.atan2(shedRise, 1.75);
  const ridgeY = FLOOR + POST + 0.15 + shedRise;
  for (const side of [-1, 1]) {
    parts.push(kit.box(6.3, 0.28, span / Math.cos(shedPitch), palette.roof, {
      x: -2.85,
      y: ridgeY - (span / 2) * Math.tan(shedPitch) - 0.14,
      z: SZ + (side * span) / 2,
      rx: side * shedPitch,
      r: 0.12,
    }));
  }
  parts.push(kit.box(6.7, 0.26, 0.6, palette.accent, { x: -2.75, y: ridgeY - 0.06, z: SZ, r: 0.12 }));
  parts.push(kit.box(6.3, 0.18, 0.2, p.sign, { x: -2.85, y: ridgeY - span * Math.tan(shedPitch) - 0.12, z: SZ + span + 0.02, rx: shedPitch, r: 0.06 }));

  // In the shed: boards on spacers, a tool board, bolts of cloth, glass panes, a lantern.
  const rackX = -4.2;
  const rackZ = SZ - 1.0;
  for (const dx of [-0.9, 0.9]) parts.push(kit.box(0.14, 0.12, 1.0, p.trunk, { x: rackX + dx, y: FLOOR, z: rackZ, r: 0.03 }));
  for (let layer = 0; layer < 3; layer += 1) {
    for (const dz of [-0.24, 0.24]) {
      parts.push(kit.box(2.6, 0.14, 0.42, lumber, { x: rackX + (layer % 2 ? 0.06 : -0.06), y: FLOOR + 0.12 + layer * 0.15, z: rackZ + dz, r: 0.03 }));
    }
  }
  parts.push(kit.box(1.7, 0.8, 0.08, p.wood, { x: rackX, y: FLOOR + 1.35, z: shedBack + 0.15, r: 0.03 }));
  parts.push(kit.box(0.8, 0.2, 0.06, p.metal, { x: rackX - 0.3, y: FLOOR + 1.75, z: shedBack + 0.21, r: 0.02 }));
  parts.push(kit.box(0.24, 0.26, 0.08, trim, { x: rackX - 0.72, y: FLOOR + 1.72, z: shedBack + 0.22, r: 0.04 }));
  parts.push(kit.box(0.12, 0.5, 0.06, p.trunk, { x: rackX + 0.5, y: FLOOR + 1.45, z: shedBack + 0.21, r: 0.02 }));
  parts.push(kit.box(0.34, 0.16, 0.1, p.darkMetal, { x: rackX + 0.5, y: FLOOR + 1.9, z: shedBack + 0.22, r: 0.03 }));
  parts.push(kit.cyl(0.24, 0.24, 1.4, fabric, { x: -1.0, y: FLOOR, z: shedBack + 0.5 }, 12));
  parts.push(kit.cyl(0.24, 0.24, 1.2, palette.accent, { x: -0.85, y: FLOOR, z: shedBack + 1.05 }, 12));
  for (const dz of [0, 0.14]) {
    parts.push(kit.box(1.0, 1.1, 0.06, glass, { x: -2.1, y: FLOOR + 0.02, z: shedBack + 0.3 + dz, rx: -0.14, r: 0.02 }));
  }
  parts.push(kit.box(0.06, 0.34, 0.06, p.darkMetal, { x: rackX, y: FLOOR + POST - 0.4, z: shedFront, r: 0.02 }));
  parts.push(kit.box(0.28, 0.32, 0.28, kit.materials.lamp, { x: rackX, y: FLOOR + POST - 0.7, z: shedFront, r: 0.08 }));

  // Forecourt: workbench with a board being planed, a cabinet half built, two people at work.
  const benchX = -3.7;
  const benchZ = -0.3;
  const benchTop = FLOOR + 0.88;
  parts.push(kit.box(2.8, 0.16, 1.0, p.wood, { x: benchX, y: benchTop - 0.16, z: benchZ, r: 0.05 }));
  for (const dx of [-1.05, 1.05]) parts.push(kit.box(0.2, 0.74, 0.86, p.trunk, { x: benchX + dx, y: FLOOR, z: benchZ, r: 0.05 }));
  parts.push(kit.box(0.3, 0.22, 0.3, p.darkMetal, { x: benchX - 1.1, y: benchTop - 0.02, z: benchZ + 0.3, r: 0.05 }));
  parts.push(kit.box(2.1, 0.1, 0.34, lumber, { x: benchX + 0.2, y: benchTop, z: benchZ - 0.1, r: 0.03 }));
  parts.push(kit.box(0.44, 0.16, 0.18, trim, { x: benchX + 0.1, y: benchTop + 0.1, z: benchZ - 0.1, r: 0.05 }));
  parts.push(kit.box(0.9, 0.5, 0.3, fabric, { x: benchX + 0.85, y: benchTop, z: benchZ + 0.3, r: 0.12 }));
  parts.push(kit.dome(0.5, 0.3, 0.42, sawdust, { x: benchX - 0.2, y: FLOOR - 0.02, z: benchZ + 0.85 }));
  parts.push(worker(kit, benchX + 0.1, FLOOR, benchZ - 0.95, 0, palette.accent, trim, palette.roof));

  const cabX = -1.2;
  const cabZ = 0.55;
  parts.push(kit.box(1.2, 1.8, 0.1, cabinet, { x: cabX, y: FLOOR, z: cabZ - 0.22, r: 0.03 }));
  for (const side of [-1, 1]) parts.push(kit.box(0.1, 1.8, 0.54, cabinet, { x: cabX + side * 0.55, y: FLOOR, z: cabZ, r: 0.03 }));
  for (const y of [0.04, 0.88, 1.72]) parts.push(kit.box(1.14, 0.1, 0.5, cabinet, { x: cabX, y: FLOOR + y, z: cabZ + 0.01, r: 0.03 }));
  parts.push(kit.box(0.5, 0.74, 0.06, p.wood, { x: cabX - 0.27, y: FLOOR + 0.14, z: cabZ + 0.3, r: 0.02 }));
  parts.push(kit.box(0.5, 0.74, 0.06, glass, { x: cabX + 0.27, y: FLOOR + 0.98, z: cabZ + 0.3, r: 0.02 }));
  parts.push(worker(kit, cabX - 1.05, FLOOR, cabZ + 0.35, HALF_PI, trim, palette.accent, palette.roof));

  // Stool, firewood by the chimney, a flower tub and a bush.
  parts.push(kit.cyl(0.26, 0.26, 0.1, p.wood, { x: -5.5, y: FLOOR + 0.42, z: 0.5 }, 12));
  parts.push(kit.cyl(0.1, 0.18, 0.44, p.trunk, { x: -5.5, y: FLOOR, z: 0.5 }, 8));
  const woodZ = front - 0.9;
  parts.push(log(kit, 0.2, 0.9, right + 0.3, FLOOR, woodZ, lumber));
  parts.push(log(kit, 0.2, 0.9, right + 0.7, FLOOR, woodZ, lumber));
  parts.push(log(kit, 0.2, 0.9, right + 0.5, FLOOR + 0.34, woodZ, lumber));
  parts.push(kit.cyl(0.34, 0.28, 0.5, p.wood, { x: doorX + 1.0, y: FLOOR, z: front + 0.55 }, 12));
  parts.push(kit.blob(0.34, 0.26, 0.34, p.foliage[1] ?? trim, { x: doorX + 1.0, y: FLOOR + 0.4, z: front + 0.55 }));
  parts.push(kit.blob(0.12, 0.12, 0.12, p.blossom, { x: doorX + 1.1, y: FLOOR + 0.78, z: front + 0.65 }));
  parts.push(bush(kit, -5.7, FLOOR - 0.05, -1.0));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[chimneyX, FLOOR + 7.1, chimneyZ]] });
}

export function registerHandmadeWorkshop(registry: ModelRegistry): void {
  registry.register('building.handmadeWorkshop', handmadeWorkshop);
}
