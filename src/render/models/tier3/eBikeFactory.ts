/**
 * E-bike factory (tier 3): a flat-roofed head house with a big bicycle on its
 * front, a saw-tooth production hall behind it, and an open assembly yard on
 * the left with bikes on work stands and a charging post.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, bush, flatRoof, framedWindow, rollerDoor } from '../parts';
import { FLOOR, type Parts, bike, disc, glassBand, hall, pot } from './shared';

function eBikeFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'eBikeFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const frame = itemColor(theme, 'eBike');
  const motor = itemColor(theme, 'motor');
  const plastic = itemColor(theme, 'plastic');
  const tools = itemColor(theme, 'tools');
  const parts: Parts = [];

  // Production hall across the back, head house in front of its right half.
  const PX = -0.7;
  const PZ = -4.5;
  const PW = 12.4;
  const PD = 4.4;
  const PH = 3.2;
  const hallFront = PZ + PD / 2;
  const hallTop = FLOOR + PH;
  const hallLeft = PX - PW / 2;
  const OX = 2.1;
  const OZ = -1.0;
  const OW = 6.8;
  const OD = 2.6;
  const OH = 4.0;
  const headFront = OZ + OD / 2;
  const headTop = FLOOR + OH;
  const headLeft = OX - OW / 2;
  const headRight = OX + OW / 2;

  parts.push(kit.box(13.4, FLOOR, 8.7, p.concrete, { x: -0.8, z: -2.5, r: 0.1 }));

  parts.push(hall(kit, { cx: PX, cz: PZ, w: PW, d: PD, h: PH, wall: palette.wall }));
  parts.push(kit.box(PW + 0.3, 0.3, PD + 0.3, p.sign, { x: PX, y: hallTop - 0.12, z: PZ, r: 0.1 }));
  // Saw-tooth roof: four teeth, each with its glazing facing right.
  const TEETH = 4;
  const toothW = PW / TEETH;
  const RISE = 1.35;
  for (let i = 0; i < TEETH; i += 1) {
    const x = hallLeft + toothW * (i + 0.5);
    parts.push(kit.prism(PD, RISE, toothW, palette.roof, { x, y: hallTop + 0.16, z: PZ, ry: HALF_PI }, 1));
    parts.push(kit.box(0.12, RISE - 0.4, PD - 0.7, kit.materials.window, { x: x + toothW / 2 - 0.02, y: hallTop + 0.3, z: PZ, r: 0.04 }));
    parts.push(kit.box(0.3, 0.2, PD + 0.3, p.sign, { x: x + toothW / 2 - 0.1, y: hallTop + RISE + 0.06, z: PZ, r: 0.07 }));
  }

  parts.push(hall(kit, { cx: OX, cz: OZ, w: OW, d: OD, h: OH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: OX, cz: OZ, width: OW, depth: OD, top: headTop, roof: palette.roof, cap: p.sign }));
  parts.push(kit.box(OW + 0.12, 0.3, OD + 0.12, palette.accent, { x: OX, y: headTop - 0.55, z: OZ, r: 0.08 }));

  // The bicycle on the head house says what rolls out of here.
  const signX = headLeft + 2.25;
  parts.push(kit.box(4.0, 2.7, 0.14, palette.accent, { x: signX, y: FLOOR + 0.85, z: headFront + 0.02, r: 0.14 }));
  parts.push(kit.box(3.7, 2.4, 0.16, p.sign, { x: signX, y: FLOOR + 1.0, z: headFront + 0.05, r: 0.12 }));
  parts.push(bike(kit, { x: signX, y: FLOOR + 1.3, z: headFront + 0.24, s: 1.3, frame, detail: true }));

  parts.push(rollerDoor(kit, { cx: headRight - 1.45, wall: headFront, y: FLOOR, width: 2.1, paint: trim }));
  parts.push(framedWindow(kit, { face: 'right', along: OZ, wall: headRight, y: FLOOR + 1.4, width: 1.5, height: 1.5, sill: palette.accent }));
  parts.push(glassBand(kit, { face: 'front', along: -4.1, wall: hallFront, y: FLOOR + 1.0, width: 4.6, height: 1.4, panes: 4 }));
  parts.push(glassBand(kit, { face: 'left', along: PZ, wall: hallLeft, y: FLOOR + 1.0, width: 2.6, height: 1.4, panes: 2 }));

  // Tool board on the hall wall under the window.
  const boardX = -4.1;
  parts.push(kit.box(2.2, 0.7, 0.1, p.wood, { x: boardX, y: FLOOR + 0.22, z: hallFront + 0.08, r: 0.04 }));
  for (const [dx, w] of [[-0.7, 0.5], [0, 0.3], [0.6, 0.6]] as const) {
    parts.push(kit.box(w, 0.22, 0.1, tools, { x: boardX + dx, y: FLOOR + 0.46, z: hallFront + 0.14, r: 0.04 }));
  }

  // Assembly yard: two work stands, one bike finished in its colour, one still in bare plastic, spare tyres beside them.
  const standZ = -0.6;
  const stands = [-5.6, -3.2] as const;
  for (const x of stands) {
    parts.push(kit.cyl(0.4, 0.46, 0.12, p.darkMetal, { x, y: FLOOR, z: standZ - 0.3 }, 14));
    parts.push(kit.box(0.14, 1.7, 0.14, p.darkMetal, { x, y: FLOOR, z: standZ - 0.3, r: 0.04 }));
    parts.push(kit.box(0.2, 0.16, 0.5, palette.accent, { x, y: FLOOR + 1.55, z: standZ - 0.12, r: 0.05 }));
  }
  parts.push(bike(kit, { x: stands[0], y: FLOOR + 0.5, z: standZ, s: 0.95, frame }));
  parts.push(bike(kit, { x: stands[1], y: FLOOR + 0.5, z: standZ, s: 0.95, frame: plastic }));
  parts.push(kit.cyl(0.46, 0.46, 0.1, p.tire, { x: -1.9, y: FLOOR, z: 0.2 }, 18));
  parts.push(kit.cyl(0.46, 0.46, 0.1, p.tire, { x: -1.85, y: FLOOR + 0.1, z: 0.25 }, 18));

  // Parts crates: motors and plastic mouldings.
  parts.push(kit.box(1.0, 0.5, 0.9, p.wood, { x: -6.7, y: FLOOR, z: -1.5, r: 0.06 }));
  for (const dz of [-0.2, 0.2]) parts.push(disc(kit, 0.2, 0.5, motor, -6.7, FLOOR + 0.62, -1.5 + dz, 'x', 12));
  parts.push(kit.box(0.9, 0.6, 0.8, plastic, { x: -1.9, y: FLOOR, z: -1.6, r: 0.08 }));

  // Charging post with a finished e-bike plugged in.
  const postX = -6.7;
  const postZ = 1.15;
  parts.push(kit.box(0.44, 1.5, 0.36, trim, { x: postX, y: FLOOR, z: postZ, r: 0.1 }));
  parts.push(kit.box(0.52, 0.2, 0.44, p.sign, { x: postX, y: FLOOR + 1.45, z: postZ, r: 0.07 }));
  parts.push(kit.box(0.24, 0.34, 0.1, kit.materials.lamp, { x: postX, y: FLOOR + 0.95, z: postZ + 0.18, r: 0.04 }));
  parts.push(kit.box(0.14, 0.4, 0.08, p.hazard, { x: postX, y: FLOOR + 0.45, z: postZ + 0.19, rz: 0.5, r: 0.03 }));
  parts.push(kit.box(1.1, 0.07, 0.07, p.tire, { x: postX + 0.7, y: FLOOR + 0.62, z: postZ, rz: -0.25, r: 0.03 }));
  parts.push(bike(kit, { x: -4.9, y: FLOOR, z: postZ, s: 0.95, frame }));

  parts.push(pot(kit, headRight - 0.1, FLOOR, headFront + 0.5, palette.accent));
  parts.push(bush(kit, headLeft + 0.5, FLOOR - 0.05, headFront + 0.5));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerEBikeFactory(registry: ModelRegistry): void {
  registry.register('building.eBikeFactory', eBikeFactory);
}
