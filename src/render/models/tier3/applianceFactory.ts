/**
 * Appliance factory (tier 3): one tall flat-roofed block with a fridge and a
 * washing machine on its front, a tank and a stack for silhouette, and an
 * open assembly line in front where steel shells turn into white goods.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, flatRoof, rollerDoor } from '../parts';
import { FLOOR, type Parts, conveyor, disc, fridge, glassBand, hall, robotArm, roofUnit, washer } from './shared';

function applianceFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'applianceFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const steel = itemColor(theme, 'steel');
  const glass = itemColor(theme, 'glass');
  const chip = itemColor(theme, 'electronicPart');
  const boxed = itemColor(theme, 'appliance');
  const eWaste = itemColor(theme, 'eWaste');
  const parts: Parts = [];

  const CX = -0.4;
  const CZ = -4.0;
  const W = 10.4;
  const D = 5.2;
  const H = 5.0;
  const top = FLOOR + H;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;
  const roofY = top + 0.34;

  parts.push(kit.box(13.4, FLOOR, 8.7, p.concrete, { x: -0.8, z: -2.5, r: 0.1 }));
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: H, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, top, roof: palette.roof, cap: p.sign }));
  for (const x of [left + 0.12, right - 0.12]) {
    parts.push(kit.box(0.46, H, 0.46, palette.accent, { x, y: FLOOR, z: front - 0.1, r: 0.1 }));
  }
  parts.push(kit.box(W + 0.1, 0.3, 0.3, palette.accent, { x: CX, y: FLOOR + 2.1, z: front + 0.02, r: 0.08 }));

  // The fridge and the washing machine on the front say what is built here.
  parts.push(kit.box(4.6, 2.4, 0.14, palette.roof, { x: CX, y: FLOOR + 2.5, z: front + 0.03, r: 0.14 }));
  parts.push(kit.box(4.3, 2.1, 0.16, p.sign, { x: CX, y: FLOOR + 2.65, z: front + 0.06, r: 0.12 }));
  parts.push(fridge(kit, { x: CX - 1.05, y: FLOOR + 2.72, z: front + 0.26, s: 1.08, body: palette.wall, depth: 0.3 }));
  parts.push(washer(kit, { x: CX + 0.75, y: FLOOR + 2.72, z: front + 0.26, s: 1.35, panel: palette.accent, body: palette.wall, depth: 0.3 }));

  // Roof: air handlers and a slim stack.
  parts.push(roofUnit(kit, CX - 3.2, roofY, CZ - 0.6));
  parts.push(roofUnit(kit, CX - 1.2, roofY, CZ - 0.6));
  const stackX = CX + 3.6;
  const stackZ = CZ - 1.2;
  parts.push(kit.cyl(0.36, 0.46, 2.7, palette.accent, { x: stackX, y: roofY, z: stackZ }, 16));
  parts.push(kit.cyl(0.42, 0.42, 0.26, p.sign, { x: stackX, y: roofY + 2.1, z: stackZ }, 16));
  parts.push(kit.cyl(0.44, 0.44, 0.16, p.darkMetal, { x: stackX, y: roofY + 2.66, z: stackZ }, 16));

  // Coolant tank on the left, piped into the wall.
  const tankX = -6.6;
  const tankZ = CZ - 0.5;
  parts.push(kit.cyl(0.85, 0.85, 3.9, p.metal, { x: tankX, y: FLOOR, z: tankZ }, 20));
  parts.push(kit.dome(0.85, 0.5, 0.85, p.metal, { x: tankX, y: FLOOR + 3.9, z: tankZ }));
  for (const y of [FLOOR + 0.9, FLOOR + 2.8]) parts.push(kit.cyl(0.9, 0.9, 0.2, palette.accent, { x: tankX, y, z: tankZ }, 20));
  parts.push(disc(kit, 0.14, 1.0, p.darkMetal, tankX + 0.75, FLOOR + 3.3, tankZ, 'x', 10));
  parts.push(kit.box(0.1, 3.7, 0.4, p.darkMetal, { x: tankX, y: FLOOR, z: tankZ + 0.88, r: 0.03 }));

  // Front wall at ground level and the open right side.
  parts.push(rollerDoor(kit, { cx: CX + 3.5, wall: front, y: FLOOR, height: 1.8, paint: trim }));
  parts.push(glassBand(kit, { face: 'front', along: CX - 2.6, wall: front, y: FLOOR + 0.75, width: 4.4, height: 1.25, panes: 4 }));
  for (const y of [FLOOR + 1.0, FLOOR + 3.1]) {
    parts.push(glassBand(kit, { face: 'right', along: CZ, wall: right, y, width: 3.6, height: 1.3, panes: 3 }));
  }

  // Assembly line: bare steel shell, door glass going on under the gantry, then finished machines.
  const LINE_Z = 0.0;
  const BELT = FLOOR + 0.6;
  parts.push(conveyor(kit, { x: -0.5, z: LINE_Z, length: 9.0, top: BELT, base: FLOOR, width: 1.2 }));
  parts.push(kit.box(1.3, 1.5, 1.5, trim, { x: -5.75, y: FLOOR, z: LINE_Z, r: 0.14 }));
  parts.push(kit.box(0.5, 0.2, 0.16, kit.materials.lamp, { x: -5.75, y: FLOOR + 1.05, z: LINE_Z + 0.76, r: 0.06 }));
  parts.push(kit.box(0.85, 1.05, 0.75, steel, { x: -4.1, y: BELT, z: LINE_Z, r: 0.08 }));
  const gantryX = -2.3;
  parts.push(kit.box(0.9, 1.0, 0.75, p.sign, { x: gantryX, y: BELT, z: LINE_Z, r: 0.1 }));
  for (const dz of [-0.85, 0.85]) parts.push(kit.box(0.26, 2.7, 0.26, palette.accent, { x: gantryX, y: FLOOR, z: LINE_Z + dz, r: 0.08 }));
  parts.push(kit.box(0.4, 0.3, 2.1, palette.accent, { x: gantryX, y: FLOOR + 2.6, z: LINE_Z, r: 0.1 }));
  parts.push(kit.box(0.12, 0.62, 0.12, p.darkMetal, { x: gantryX, y: FLOOR + 2.0, z: LINE_Z + 0.42, r: 0.03 }));
  parts.push(disc(kit, 0.3, 0.1, glass, gantryX, FLOOR + 1.75, LINE_Z + 0.5, 'z', 16));
  parts.push(robotArm(kit, { x: 0.36, y: FLOOR, z: LINE_Z - 1.0, paint: palette.accent, ry: -HALF_PI, tool: trim }));
  parts.push(washer(kit, { x: -0.6, y: BELT, z: LINE_Z, s: 0.95, panel: palette.accent }));
  parts.push(fridge(kit, { x: 1.2, y: BELT, z: LINE_Z, s: 0.82 }));
  parts.push(washer(kit, { x: 2.9, y: BELT, z: LINE_Z, s: 0.95, panel: palette.roof }));

  // Supplies at the head of the line: steel coils, glass sheets, a crate of electronics.
  for (const z of [-2.5, -1.5]) {
    parts.push(disc(kit, 0.45, 0.6, steel, -6.6, FLOOR + 0.45, z, 'x', 16));
    parts.push(disc(kit, 0.16, 0.64, p.darkMetal, -6.6, FLOOR + 0.45, z, 'x', 10));
  }
  parts.push(kit.box(0.9, 0.6, 0.9, chip, { x: -6.75, y: FLOOR, z: 1.3, r: 0.08 }));
  for (const dx of [0, 0.16]) parts.push(kit.box(0.07, 1.0, 1.1, glass, { x: -5.6 + dx, y: FLOOR + 0.02, z: 1.3, rz: -0.2, r: 0.02 }));
  parts.push(kit.box(0.5, 0.14, 1.2, p.wood, { x: -5.5, y: FLOOR, z: 1.3, r: 0.04 }));

  // Boxed machines by the door and a skip for the scrapped electronics.
  parts.push(kit.box(1.0, 1.1, 0.9, boxed, { x: 5.2, y: FLOOR, z: front + 0.55, r: 0.06 }));
  parts.push(kit.box(1.04, 0.2, 0.94, p.sign, { x: 5.2, y: FLOOR + 0.5, z: front + 0.55, r: 0.04 }));
  parts.push(kit.box(1.3, 0.6, 1.0, p.darkMetal, { x: 5.15, y: FLOOR, z: 1.0, r: 0.1 }));
  parts.push(kit.box(1.1, 0.14, 0.8, eWaste, { x: 5.15, y: FLOOR + 0.52, z: 1.0, r: 0.04 }));
  parts.push(kit.box(0.4, 0.3, 0.4, eWaste, { x: 4.95, y: FLOOR + 0.55, z: 0.9, ry: 0.5, r: 0.05 }));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[stackX, roofY + 3.0, stackZ]] });
}

export function registerApplianceFactory(registry: ModelRegistry): void {
  registry.register('building.applianceFactory', applianceFactory);
}
