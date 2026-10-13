/**
 * Smart home factory (tier 4): a glass tower with a mast and a dish, and a
 * wedge-shaped block whose tall front carries a little house sending out a
 * signal. On the terrace in front a robot fits out a demo living room with a
 * sofa, white goods and a hub.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, bush, flatRoof, framedWindow } from '../parts';
import { FLOOR, type Parts, fridge, glassBand, hall, robotArm, sofa, washer } from './shared';

function smartHomeFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'smartHomeFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const lamp = kit.materials.lamp;
  const sofaPaint = itemColor(theme, 'sofa');
  const tools = itemColor(theme, 'tools');
  const setPaint = itemColor(theme, 'smartHomeSet');
  const eWaste = itemColor(theme, 'eWaste');
  const parts: Parts = [];

  parts.push(kit.box(13.4, FLOOR, 8.7, p.concrete, { x: -0.8, z: -2.5, r: 0.1 }));

  // Glass tower at the back left.
  const TX = -5.2;
  const TZ = -4.4;
  const TS = 3.6;
  const TH = 6.4;
  const towerTop = FLOOR + TH;
  const towerFront = TZ + TS / 2;
  const towerRoof = towerTop + 0.34;
  parts.push(hall(kit, { cx: TX, cz: TZ, w: TS, d: TS, h: TH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: TX, cz: TZ, width: TS, depth: TS, top: towerTop, roof: palette.roof, cap: p.sign }));
  parts.push(glassBand(kit, { face: 'front', along: TX, wall: towerFront, y: FLOOR + 1.0, width: 2.8, height: 5.0, panes: 2, rows: 4 }));
  parts.push(glassBand(kit, { face: 'left', along: TZ, wall: TX - TS / 2, y: FLOOR + 1.0, width: 2.8, height: 5.0, panes: 2, rows: 4 }));
  for (const side of [-1, 1]) {
    parts.push(kit.box(0.14, TH - 1.2, 0.14, lamp, { x: TX + side * (TS / 2 - 0.12), y: FLOOR + 0.8, z: towerFront + 0.03, r: 0.04 }));
  }
  // Mast with cross arms and a light, and a dish beside it.
  const mastX = TX - 0.9;
  const mastZ = TZ - 0.8;
  parts.push(kit.cyl(0.07, 0.11, 1.7, p.darkMetal, { x: mastX, y: towerRoof, z: mastZ }, 8));
  parts.push(kit.box(0.9, 0.07, 0.07, p.darkMetal, { x: mastX, y: towerRoof + 0.85, z: mastZ, r: 0.02 }));
  parts.push(kit.box(0.6, 0.07, 0.07, p.darkMetal, { x: mastX, y: towerRoof + 1.25, z: mastZ, r: 0.02 }));
  parts.push(kit.blob(0.11, 0.11, 0.11, lamp, { x: mastX, y: towerRoof + 1.66, z: mastZ }));
  const dishX = TX + 0.6;
  const dishZ = TZ + 0.5;
  parts.push(kit.cyl(0.1, 0.18, 0.6, p.darkMetal, { x: dishX, y: towerRoof, z: dishZ }, 10));
  parts.push(kit.cyl(0.8, 0.2, 0.32, p.sign, { x: dishX, y: towerRoof + 0.5, z: dishZ + 0.1, rx: 0.9 }, 18));
  parts.push(kit.blob(0.12, 0.12, 0.12, palette.accent, { x: dishX, y: towerRoof + 0.86, z: dishZ + 0.42 }));

  // Wedge block: low at the back, tall at the front, solar panels on the slope.
  const BX = 1.15;
  const BZ = -3.6;
  const BW = 9.1;
  const BD = 5.4;
  const LOW = 3.2;
  const RISE = 1.8;
  const lowTop = FLOOR + LOW;
  const front = BZ + BD / 2;
  const right = BX + BW / 2;
  const pitch = Math.atan2(RISE, BD);
  const slabLen = Math.hypot(BD, RISE) + 0.7;
  const slabY = lowTop + RISE / 2 + 0.2;
  parts.push(hall(kit, { cx: BX, cz: BZ, w: BW, d: BD, h: LOW, wall: palette.wall }));
  parts.push(kit.prism(BW - 0.1, RISE, BD - 0.1, palette.wall, { x: BX, y: lowTop - 0.05, z: BZ }, 1));
  parts.push(kit.box(BW + 0.4, 0.3, slabLen, palette.roof, { x: BX, y: slabY - 0.15, z: BZ, rx: -pitch, r: 0.12 }));
  parts.push(kit.box(BW + 0.4, 0.22, 0.24, p.sign, {
    x: BX,
    y: slabY + (slabLen / 2) * Math.sin(pitch) - 0.2,
    z: BZ + (slabLen / 2) * Math.cos(pitch) + 0.04,
    rx: -pitch,
    r: 0.07,
  }));
  for (const dx of [-2.95, 0, 2.95]) {
    parts.push(kit.box(2.6, 0.08, slabLen - 1.3, p.glass, {
      x: BX + dx,
      y: slabY + 0.19 * Math.cos(pitch) - 0.04,
      z: BZ - 0.19 * Math.sin(pitch) - 0.2,
      rx: -pitch,
      r: 0.03,
    }));
  }

  // Glazed ground floor and, above it, the house with its signal.
  parts.push(glassBand(kit, { face: 'front', along: BX, wall: front, y: FLOOR + 0.6, width: 7.6, height: 2.1, panes: 6, rows: 2 }));
  parts.push(glassBand(kit, { face: 'right', along: BZ, wall: right, y: FLOOR + 0.9, width: 3.6, height: 1.6, panes: 3 }));
  for (const x of [BX - 2.4, BX + 2.4]) {
    parts.push(framedWindow(kit, { face: 'back', along: x, wall: BZ - BD / 2, y: FLOOR + 1.0, sill: palette.accent }));
  }
  const signY = FLOOR + 2.9;
  parts.push(kit.box(3.4, 2.05, 0.14, palette.accent, { x: BX, y: signY, z: front + 0.03, r: 0.14 }));
  parts.push(kit.box(3.1, 1.75, 0.16, p.sign, { x: BX, y: signY + 0.15, z: front + 0.07, r: 0.12 }));
  const houseY = signY + 0.27;
  const faceZ = front + 0.15;
  parts.push(kit.box(0.95, 0.55, 0.2, trim, { x: BX, y: houseY, z: faceZ + 0.06, r: 0.05 }));
  parts.push(kit.prism(0.2, 0.42, 1.3, palette.roof, { x: BX, y: houseY + 0.55, z: faceZ + 0.06, ry: HALF_PI }));
  parts.push(kit.box(0.24, 0.36, 0.08, p.sign, { x: BX, y: houseY, z: faceZ + 0.17, r: 0.03 }));
  const arcY = houseY + 0.98;
  const arcs = [
    [0.62, palette.accent],
    [0.47, p.sign],
    [0.32, palette.accent],
    [0.17, p.sign],
  ] as const;
  arcs.forEach(([radius, paint], i) => {
    parts.push(kit.barrel(0.1 + i * 0.08, radius, radius * 2, paint, { x: BX, y: arcY, z: faceZ, ry: HALF_PI }));
  });
  parts.push(kit.box(3.0, 0.1, 0.12, lamp, { x: BX, y: signY - 0.16, z: front + 0.05, r: 0.04 }));

  // Demo living room on a deck: sofa, fridge, floor lamp, hub, and the boxed set ready to go.
  const DECK_X = 2.9;
  const DECK_Z = 0.4;
  const deck = FLOOR + 0.14;
  parts.push(kit.box(4.8, 0.14, 2.1, p.wood, { x: DECK_X, y: FLOOR, z: DECK_Z, r: 0.05 }));
  parts.push(kit.box(2.6, 0.04, 1.3, palette.accent, { x: DECK_X - 0.5, y: deck, z: DECK_Z + 0.1, r: 0.02 }));
  parts.push(sofa(kit, { x: DECK_X - 0.5, y: deck + 0.04, z: DECK_Z - 0.3, w: 1.9, h: 0.8, d: 0.8, paint: sofaPaint, cushion: p.sign }));
  parts.push(fridge(kit, { x: DECK_X + 1.75, y: deck, z: DECK_Z - 0.55, s: 0.78 }));
  parts.push(kit.cyl(0.2, 0.24, 0.08, p.darkMetal, { x: DECK_X - 2.0, y: deck, z: DECK_Z - 0.5 }, 10));
  parts.push(kit.cyl(0.04, 0.04, 1.3, p.darkMetal, { x: DECK_X - 2.0, y: deck, z: DECK_Z - 0.5 }, 8));
  parts.push(kit.cyl(0.16, 0.26, 0.32, lamp, { x: DECK_X - 2.0, y: deck + 1.26, z: DECK_Z - 0.5 }, 12));
  parts.push(kit.cyl(0.3, 0.3, 0.32, p.sign, { x: DECK_X - 0.5, y: deck + 0.04, z: DECK_Z + 0.55 }, 14));
  parts.push(kit.cyl(0.2, 0.2, 0.1, lamp, { x: DECK_X - 0.5, y: deck + 0.34, z: DECK_Z + 0.55 }, 14));
  parts.push(kit.box(1.1, 0.9, 0.9, setPaint, { x: DECK_X + 1.7, y: deck, z: DECK_Z + 0.5, r: 0.07 }));
  parts.push(kit.box(1.16, 0.2, 0.96, p.sign, { x: DECK_X + 1.7, y: deck + 0.4, z: DECK_Z + 0.5, r: 0.04 }));

  // The robot that fits it out, its tool crate, and appliances waiting their turn.
  parts.push(robotArm(kit, { x: -0.7, y: FLOOR, z: DECK_Z, paint: palette.accent, tool: tools }));
  parts.push(kit.box(1.0, 0.55, 0.8, p.wood, { x: -2.2, y: FLOOR, z: 0.9, r: 0.06 }));
  parts.push(kit.box(0.84, 0.14, 0.64, tools, { x: -2.2, y: FLOOR + 0.5, z: 0.9, r: 0.04 }));
  parts.push(washer(kit, { x: -4.4, y: FLOOR, z: towerFront + 0.75, s: 0.85, panel: palette.accent }));
  parts.push(fridge(kit, { x: -5.6, y: FLOOR, z: towerFront + 0.75, s: 0.8 }));
  parts.push(kit.box(1.2, 0.6, 0.9, p.darkMetal, { x: -6.6, y: FLOOR, z: -0.3, r: 0.1 }));
  parts.push(kit.box(1.0, 0.14, 0.7, eWaste, { x: -6.6, y: FLOOR + 0.52, z: -0.3, r: 0.04 }));
  parts.push(bush(kit, -6.7, FLOOR - 0.05, 1.1));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerSmartHomeFactory(registry: ModelRegistry): void {
  registry.register('building.smartHomeFactory', smartHomeFactory);
}
