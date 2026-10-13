/**
 * Refinery: no hall, just plant. A distillation column with platforms, a big
 * crude tank carrying the oil-drop sign, a ball tank, a flare, a pipe rack,
 * and a pellet hopper filling crates with plastic.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { bush, flatRoof, framedWindow } from '../parts';
import { FLOOR, chimney, disc, drum, hall, pipe, sack, slab, tank, type Parts } from './shared';

function refinery(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'refinery');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const crude = itemColor(theme, 'crudeOil');
  const plastic = itemColor(theme, 'plastic');
  const wasteOil = itemColor(theme, 'wasteOil');
  const parts: Parts = [slab(kit)];

  // Distillation column: hoops, two platforms with railing posts, a ladder up the front.
  const COL_X = -1.9;
  const COL_Z = -4.6;
  const COL_R = 0.8;
  parts.push(kit.box(2.1, 0.5, 2.1, p.rock, { x: COL_X, y: FLOOR, z: COL_Z, r: 0.12 }));
  parts.push(kit.cyl(COL_R, COL_R, 6.2, palette.wall, { x: COL_X, y: FLOOR + 0.5, z: COL_Z }, 20));
  parts.push(kit.dome(COL_R, 0.5, COL_R, palette.roof, { x: COL_X, y: FLOOR + 6.68, z: COL_Z }));
  parts.push(kit.cyl(0.16, 0.16, 0.5, p.metal, { x: COL_X, y: FLOOR + 7.1, z: COL_Z }, 10));
  for (const y of [1.3, 2.4, 4.3, 6.3]) parts.push(kit.cyl(COL_R + 0.06, COL_R + 0.06, 0.16, palette.accent, { x: COL_X, y: FLOOR + y, z: COL_Z }, 20));
  for (const y of [3.2, 5.2]) {
    parts.push(kit.cyl(1.3, 1.3, 0.12, p.darkMetal, { x: COL_X, y: FLOOR + y, z: COL_Z }, 20));
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2;
      parts.push(kit.box(0.1, 0.55, 0.1, p.sign, { x: COL_X + Math.cos(angle) * 1.18, y: FLOOR + y + 0.1, z: COL_Z + Math.sin(angle) * 1.18, r: 0.03 }));
    }
  }
  parts.push(kit.box(0.34, 5.2, 0.1, p.darkMetal, { x: COL_X, y: FLOOR + 0.5, z: COL_Z + COL_R + 0.06, r: 0.03 }));

  // Flare behind the column.
  const FLARE_X = -0.1;
  const FLARE_Z = -6.1;
  parts.push(kit.cyl(0.12, 0.17, 7.7, p.darkMetal, { x: FLARE_X, y: FLOOR, z: FLARE_Z }, 10));
  parts.push(kit.cyl(0.22, 0.16, 0.24, p.metal, { x: FLARE_X, y: FLOOR + 7.66, z: FLARE_Z }, 10));
  parts.push(kit.blob(0.2, 0.36, 0.2, kit.materials.lamp, { x: FLARE_X, y: FLOOR + 7.86, z: FLARE_Z }));

  // Crude tank with the oil-drop sign on its front.
  const TANK_X = 3.75;
  const TANK_Z = -4.3;
  const TANK_R = 2.0;
  parts.push(kit.cyl(TANK_R + 0.12, TANK_R + 0.12, 0.3, p.rock, { x: TANK_X, y: FLOOR, z: TANK_Z }, 22));
  parts.push(tank(kit, { x: TANK_X, z: TANK_Z, y: FLOOR + 0.25, r: TANK_R, h: 2.8, body: palette.wall, top: palette.roof, band: palette.accent }));
  parts.push(kit.cyl(0.4, 0.4, 0.3, p.metal, { x: TANK_X, y: FLOOR + 3.7, z: TANK_Z }, 12));
  const signY = FLOOR + 1.75;
  const signZ = TANK_Z + TANK_R - 0.08;
  parts.push(disc(kit, 0.98, 0.3, p.sign, TANK_X, signY, signZ, 28));
  parts.push(kit.blob(0.44, 0.42, 0.14, crude, { x: TANK_X, y: signY - 0.62, z: signZ + 0.14 }));
  parts.push(kit.cone(0.33, 0.62, crude, { x: TANK_X, y: signY - 0.02, z: signZ + 0.14 }, 14));
  // Stair up the left of the tank.
  parts.push(kit.box(0.5, 0.12, 3.0, p.darkMetal, { x: TANK_X - TANK_R - 0.3, y: FLOOR + 1.5, z: TANK_Z, rx: 0.9, r: 0.04 }));

  // Ball tank on legs, front left.
  const BALL_X = -5.6;
  const BALL_Z = -0.6;
  const BALL_R = 1.25;
  parts.push(kit.blob(BALL_R, BALL_R, BALL_R, palette.roof, { x: BALL_X, y: FLOOR + 0.6, z: BALL_Z }));
  parts.push(kit.cyl(BALL_R + 0.03, BALL_R + 0.03, 0.14, p.sign, { x: BALL_X, y: FLOOR + 0.6 + BALL_R - 0.07, z: BALL_Z }, 20));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(kit.box(0.16, 1.7, 0.16, p.darkMetal, { x: BALL_X + sx * 0.85, y: FLOOR, z: BALL_Z + sz * 0.85, r: 0.05 }));
  }
  parts.push(kit.cyl(0.2, 0.2, 0.22, p.metal, { x: BALL_X, y: FLOOR + 0.55 + BALL_R * 2, z: BALL_Z }, 10));

  // Control hut with the heater stack, back left.
  const HX = -5.5;
  const HZ = -5.0;
  const HW = 3.2;
  const HD = 2.8;
  const HH = 2.3;
  parts.push(hall(kit, { cx: HX, cz: HZ, w: HW, d: HD, h: HH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: HX, cz: HZ, width: HW, depth: HD, top: FLOOR + HH, roof: palette.roof, cap: palette.accent }));
  parts.push(framedWindow(kit, { face: 'front', along: HX - 0.65, wall: HZ + HD / 2, y: FLOOR + 0.95, width: 1.2, height: 1.0, sill: palette.accent }));
  parts.push(kit.box(0.9, 1.75, 0.12, p.sign, { x: HX + 0.85, y: FLOOR, z: HZ + HD / 2 + 0.05, r: 0.05 }));
  parts.push(kit.box(0.7, 1.6, 0.16, trim, { x: HX + 0.85, y: FLOOR, z: HZ + HD / 2 + 0.08, r: 0.05 }));
  parts.push(kit.box(0.3, 0.2, 0.16, kit.materials.lamp, { x: HX + 0.85, y: FLOOR + 1.85, z: HZ + HD / 2 + 0.07, r: 0.06 }));
  const STACK_X = HX - 0.8;
  const STACK_Z = HZ - 0.5;
  parts.push(chimney(kit, { x: STACK_X, z: STACK_Z, y: FLOOR + HH + 0.3, r: 0.4, h: 2.4, body: p.metal }));

  // Pipe rack across the front: three lines on trestles, feeding the ball tank and the hopper.
  const RACK_Y = FLOOR + 2.5;
  const RACK_Z = -1.3;
  for (const x of [-3.5, -1.2, 1.1]) {
    for (const dz of [-0.55, 0.55]) parts.push(kit.box(0.16, 2.4, 0.16, p.darkMetal, { x, y: FLOOR, z: RACK_Z + dz, r: 0.05 }));
    parts.push(kit.box(0.2, 0.16, 1.4, p.darkMetal, { x, y: RACK_Y - 0.26, z: RACK_Z, r: 0.05 }));
  }
  parts.push(pipe(kit, 0.11, 5.6, 'x', -1.2, RACK_Y, RACK_Z - 0.35, palette.accent));
  parts.push(pipe(kit, 0.11, 5.6, 'x', -1.2, RACK_Y, RACK_Z, p.metal));
  parts.push(pipe(kit, 0.11, 6.4, 'x', -1.6, RACK_Y, RACK_Z + 0.35, trim));
  // Column to the rack, tank to the column, and the drop into the ball tank.
  parts.push(pipe(kit, 0.13, 2.5, 'z', COL_X, RACK_Y + 0.22, -2.55, p.metal));
  parts.push(pipe(kit, 0.13, 2.4, 'x', 0.1, FLOOR + 1.0, COL_Z, palette.accent));
  parts.push(disc(kit, 0.26, 0.08, p.hazard, 0.3, FLOOR + 1.0, COL_Z + 0.15, 12));
  parts.push(pipe(kit, 0.11, 0.9, 'y', -4.8, RACK_Y - 0.4, RACK_Z + 0.35, trim));

  // Pellet hopper at the end of the rack, a crate filling under it.
  const HOP_X = 1.6;
  const HOP_Z = RACK_Z + 0.35;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(kit.box(0.12, 1.5, 0.12, p.darkMetal, { x: HOP_X + sx * 0.55, y: FLOOR, z: HOP_Z + sz * 0.55, r: 0.04 }));
  }
  parts.push(kit.cyl(0.72, 0.2, 0.7, p.metal, { x: HOP_X, y: FLOOR + 0.95, z: HOP_Z }, 14));
  parts.push(kit.cyl(0.72, 0.72, 0.6, palette.accent, { x: HOP_X, y: FLOOR + 1.65, z: HOP_Z }, 14));
  parts.push(kit.cyl(0.2, 0.2, 0.4, trim, { x: HOP_X, y: FLOOR + 2.2, z: HOP_Z }, 10));
  parts.push(kit.box(0.9, 0.5, 0.9, p.wood, { x: HOP_X, y: FLOOR, z: HOP_Z, r: 0.06 }));
  parts.push(kit.dome(0.38, 0.26, 0.38, plastic, { x: HOP_X, y: FLOOR + 0.46, z: HOP_Z }));
  parts.push(kit.box(0.95, 0.55, 0.95, p.wood, { x: HOP_X + 0.2, y: FLOOR, z: HOP_Z + 1.35, r: 0.06 }));
  parts.push(kit.dome(0.42, 0.3, 0.42, plastic, { x: HOP_X + 0.2, y: FLOOR + 0.5, z: HOP_Z + 1.35 }));
  parts.push(sack(kit, HOP_X - 0.9, FLOOR, HOP_Z + 1.3, plastic, trim));
  parts.push(sack(kit, HOP_X - 1.55, FLOOR, HOP_Z + 1.5, plastic, trim));

  // Drums: crude waiting on the left, waste oil on the right.
  for (const [x, z] of [[-3.3, 0.9], [-2.6, 1.1], [-2.95, 0.4]] as const) parts.push(drum(kit, x, FLOOR, z, crude));
  for (const [x, z] of [[4.3, 0.2], [5.0, 0.35], [4.65, -0.4]] as const) parts.push(drum(kit, x, FLOOR, z, wasteOil));
  parts.push(kit.cyl(0.5, 0.5, 0.04, wasteOil, { x: 5.1, y: FLOOR, z: 1.0 }, 14));

  // Pump by the tank, bollards, greenery.
  parts.push(kit.box(0.9, 0.4, 0.6, p.darkMetal, { x: 0.9, y: FLOOR, z: COL_Z + 0.9, r: 0.08 }));
  parts.push(pipe(kit, 0.26, 0.7, 'x', 0.9, FLOOR + 0.62, COL_Z + 0.9, trim, 12));
  for (const x of [-0.6, 0.3]) parts.push(kit.cyl(0.1, 0.12, 0.6, p.hazard, { x, y: FLOOR, z: 1.3 }, 8));
  parts.push(bush(kit, -7.0, FLOOR - 0.05, -3.0));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[STACK_X, FLOOR + HH + 3.1, STACK_Z]] });
}

export function registerRefineryModel(registry: ModelRegistry): void {
  registry.register('building.refinery', refinery);
}
