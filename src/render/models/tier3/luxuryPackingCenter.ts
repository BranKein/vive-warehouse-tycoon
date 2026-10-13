/**
 * Luxury packing center (tier 4): a boutique rather than a factory. A glazed
 * rotunda under a dome with a gold finial, a low glass-fronted wing, a
 * columned portico carrying a large ribboned box, and a packing table where
 * gift sets go into a premium box.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { flatRoof, framedWindow } from '../parts';
import { FLOOR, type Parts, disc, giftBox, glassBand, hall } from './shared';

function luxuryPackingCenter(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'luxuryPackingCenter');
  const p = theme.props;
  const gold = palette.accent;
  const trim = palette.trim ?? palette.accent;
  const gift = itemColor(theme, 'giftSet');
  const premium = itemColor(theme, 'premiumGiftSet');
  const glass = kit.materials.window;
  const parts: Parts = [];

  parts.push(kit.box(13.4, FLOOR, 8.7, p.concrete, { x: -0.8, z: -2.5, r: 0.1 }));

  // Rotunda: two rings of glazing between pilasters, a cornice, a dome and a finial.
  const RX = 3.4;
  const RZ = -2.7;
  const R = 2.3;
  const RH = 5.5;
  const drumTop = FLOOR + RH;
  parts.push(kit.cyl(R + 0.12, R + 0.12, 0.55, p.rock, { x: RX, y: FLOOR, z: RZ }, 28));
  parts.push(kit.cyl(R, R, RH, palette.wall, { x: RX, y: FLOOR, z: RZ }, 28));
  for (const y of [FLOOR + 0.95, FLOOR + 3.35]) parts.push(kit.cyl(R + 0.04, R + 0.04, 1.75, glass, { x: RX, y, z: RZ }, 28));
  for (const y of [FLOOR + 0.62, FLOOR + 2.86, FLOOR + 5.14]) parts.push(kit.cyl(R + 0.1, R + 0.1, 0.2, gold, { x: RX, y, z: RZ }, 28));
  const PILASTERS = 10;
  for (let i = 0; i < PILASTERS; i += 1) {
    const angle = ((i + 0.5) / PILASTERS) * Math.PI * 2;
    parts.push(kit.box(0.28, RH - 0.2, 0.28, p.sign, { x: RX + Math.cos(angle) * (R + 0.02), y: FLOOR, z: RZ + Math.sin(angle) * (R + 0.02), ry: -angle, r: 0.08 }));
  }
  parts.push(kit.cyl(R + 0.26, R + 0.1, 0.4, palette.roof, { x: RX, y: drumTop, z: RZ }, 28));
  parts.push(kit.cyl(R + 0.04, R + 0.04, 0.14, p.sign, { x: RX, y: drumTop + 0.38, z: RZ }, 28));
  parts.push(kit.dome(R - 0.12, 1.5, R - 0.12, palette.roof, { x: RX, y: drumTop + 0.48, z: RZ }));
  parts.push(kit.cyl(0.12, 0.22, 0.5, gold, { x: RX, y: drumTop + 1.9, z: RZ }, 10));
  parts.push(kit.blob(0.22, 0.22, 0.22, gold, { x: RX, y: drumTop + 2.34, z: RZ }));

  // Low wing with a gold-rimmed roof and a skylight.
  const WX = -2.9;
  const WZ = -3.9;
  const WW = 8.4;
  const WD = 4.8;
  const WH = 3.6;
  const wingTop = FLOOR + WH;
  const wingFront = WZ + WD / 2;
  const wingLeft = WX - WW / 2;
  parts.push(hall(kit, { cx: WX, cz: WZ, w: WW, d: WD, h: WH, wall: palette.wall }));
  parts.push(flatRoof(kit, { cx: WX, cz: WZ, width: WW, depth: WD, top: wingTop, roof: palette.roof, cap: gold }));
  parts.push(kit.box(2.6, 0.3, 1.7, p.sign, { x: WX + 0.6, y: wingTop + 0.3, z: WZ - 0.4, r: 0.08 }));
  parts.push(kit.box(2.3, 0.16, 1.4, glass, { x: WX + 0.6, y: wingTop + 0.56, z: WZ - 0.4, r: 0.05 }));
  parts.push(glassBand(kit, { face: 'left', along: WZ, wall: wingLeft, y: FLOOR + 0.9, width: 3.4, height: 2.0, panes: 3 }));
  for (const x of [WX - 2.2, WX + 1.6]) {
    parts.push(framedWindow(kit, { face: 'back', along: x, wall: WZ - WD / 2, y: FLOOR + 1.1, sill: gold }));
  }

  // Shop window with an awning, behind the packing table.
  const SHOP_X = -0.9;
  parts.push(glassBand(kit, { face: 'front', along: SHOP_X, wall: wingFront, y: FLOOR + 0.7, width: 3.9, height: 2.2, panes: 4, rows: 2 }));
  parts.push(kit.box(4.1, 0.14, 0.36, gold, { x: SHOP_X, y: FLOOR + 0.6, z: wingFront + 0.12, r: 0.05 }));
  parts.push(kit.box(4.1, 0.16, 1.0, palette.roof, { x: SHOP_X, y: FLOOR + 3.0, z: wingFront + 0.46, rx: 0.36, r: 0.06 }));
  parts.push(kit.box(4.1, 0.22, 0.1, p.sign, { x: SHOP_X, y: FLOOR + 2.76, z: wingFront + 0.93, r: 0.04 }));

  // Portico: two columns, a slab, and on it the big ribboned box that says what this house does.
  const PX = -4.9;
  const PZ = wingFront + 1.2;
  for (const dx of [-1.5, 1.5]) {
    const x = PX + dx;
    const z = PZ + 0.85;
    parts.push(kit.cyl(0.2, 0.2, 2.7, p.sign, { x, y: FLOOR, z }, 14));
    parts.push(kit.cyl(0.3, 0.32, 0.18, gold, { x, y: FLOOR, z }, 14));
    parts.push(kit.cyl(0.32, 0.24, 0.18, gold, { x, y: FLOOR + 2.56, z }, 14));
    parts.push(kit.blob(0.2, 0.2, 0.2, kit.materials.lamp, { x, y: FLOOR + 3.14, z: z + 0.1 }));
  }
  parts.push(kit.box(3.9, 0.36, 2.6, palette.roof, { x: PX, y: FLOOR + 2.72, z: PZ, r: 0.14 }));
  parts.push(kit.box(3.5, 0.14, 2.2, gold, { x: PX, y: FLOOR + 3.04, z: PZ, r: 0.06 }));
  parts.push(kit.box(2.4, 0.22, 2.0, p.sign, { x: PX, y: FLOOR + 3.14, z: PZ - 0.05, r: 0.08 }));
  parts.push(giftBox(kit, { x: PX, y: FLOOR + 3.34, z: PZ - 0.05, w: 2.1, h: 1.7, d: 1.8, paint: premium, ribbon: gold }));
  // Glass doors and a carpet under it.
  parts.push(kit.box(2.2, 2.45, 0.12, gold, { x: PX, y: FLOOR, z: wingFront + 0.02, r: 0.08 }));
  parts.push(kit.box(1.9, 2.25, 0.16, glass, { x: PX, y: FLOOR + 0.06, z: wingFront + 0.04, r: 0.06 }));
  parts.push(kit.box(0.1, 2.25, 0.2, gold, { x: PX, y: FLOOR + 0.06, z: wingFront + 0.05, r: 0.03 }));
  for (const side of [-1, 1]) parts.push(kit.box(0.08, 0.6, 0.1, p.sign, { x: PX + side * 0.2, y: FLOOR + 0.95, z: wingFront + 0.16, r: 0.03 }));
  parts.push(kit.box(1.7, 0.05, 2.9, palette.roof, { x: PX, y: FLOOR - 0.01, z: PZ + 0.2, r: 0.02 }));

  // Packing table: gift sets come in, go into an open premium box, and leave tied in gold.
  const TABLE_X = -0.9;
  const TABLE_Z = 0.2;
  const tableTop = FLOOR + 0.9;
  parts.push(kit.box(3.3, 0.14, 1.15, p.sign, { x: TABLE_X, y: tableTop - 0.14, z: TABLE_Z, r: 0.05 }));
  for (const dx of [-1.35, 1.35]) parts.push(kit.box(0.16, 0.78, 0.95, gold, { x: TABLE_X + dx, y: FLOOR, z: TABLE_Z, r: 0.05 }));
  parts.push(kit.box(0.7, 0.03, 1.2, palette.roof, { x: TABLE_X + 0.05, y: tableTop - 0.01, z: TABLE_Z, r: 0.01 }));
  for (const [dx, dz] of [[-1.3, -0.15], [-0.75, 0.15]] as const) {
    parts.push(giftBox(kit, { x: TABLE_X + dx, y: tableTop, z: TABLE_Z + dz, w: 0.46, h: 0.36, d: 0.46, paint: gift, ribbon: trim, bow: false }));
  }
  parts.push(kit.box(0.95, 0.5, 0.8, premium, { x: TABLE_X + 0.05, y: tableTop, z: TABLE_Z, r: 0.05 }));
  parts.push(kit.box(0.8, 0.08, 0.65, p.sign, { x: TABLE_X + 0.05, y: tableTop + 0.45, z: TABLE_Z, r: 0.02 }));
  parts.push(kit.box(0.4, 0.2, 0.4, gift, { x: TABLE_X - 0.08, y: tableTop + 0.46, z: TABLE_Z, r: 0.04 }));
  parts.push(giftBox(kit, { x: TABLE_X + 1.1, y: tableTop, z: TABLE_Z, w: 0.75, h: 0.56, d: 0.7, paint: premium, ribbon: gold }));
  // Ribbon spools on a stand at the end of the table.
  const spoolX = TABLE_X + 2.05;
  parts.push(kit.cyl(0.3, 0.34, 0.1, gold, { x: spoolX, y: FLOOR, z: TABLE_Z }, 12));
  parts.push(kit.box(0.1, 1.9, 0.1, gold, { x: spoolX, y: FLOOR, z: TABLE_Z, r: 0.03 }));
  parts.push(disc(kit, 0.3, 0.24, gold, spoolX, FLOOR + 1.65, TABLE_Z, 'x', 16));
  parts.push(disc(kit, 0.26, 0.24, trim, spoolX, FLOOR + 1.0, TABLE_Z, 'x', 16));

  // A finished box on show in front of the rotunda.
  const showX = RX + 0.3;
  const showZ = 0.75;
  parts.push(kit.cyl(0.75, 0.8, 0.34, p.sign, { x: showX, y: FLOOR, z: showZ }, 20));
  parts.push(giftBox(kit, { x: showX, y: FLOOR + 0.34, z: showZ, w: 0.9, h: 0.7, d: 0.9, paint: premium, ribbon: gold }));

  // Clipped topiary in gold pots.
  for (const [x, z] of [[wingLeft + 0.05, 0.75], [1.95, 1.2]] as const) {
    parts.push(kit.cyl(0.32, 0.24, 0.42, gold, { x, y: FLOOR, z }, 12));
    parts.push(kit.cyl(0.06, 0.06, 0.5, p.trunk, { x, y: FLOOR + 0.4, z }, 8));
    parts.push(kit.blob(0.4, 0.4, 0.4, p.foliage[2] ?? trim, { x, y: FLOOR + 0.8, z }));
    parts.push(kit.blob(0.26, 0.26, 0.26, p.foliage[0] ?? trim, { x, y: FLOOR + 1.5, z }));
  }

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerLuxuryPackingCenter(registry: ModelRegistry): void {
  registry.register('building.luxuryPackingCenter', luxuryPackingCenter);
}
