/**
 * Steel mill: a small blast furnace with a skip hoist and a tall stack, the
 * tap runner pouring into a ladle in the open, and a flat-roofed casting shed
 * with an I-beam sign on its roof.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { flatRoof, framedWindow, rollerDoor } from '../parts';
import { FLOOR, chimney, cornerPosts, disc, drum, hall, pipe, planter, slab, slantPipe, type Parts } from './shared';

function steelMill(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'steelMill');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const steel = itemColor(theme, 'steel');
  const ore = itemColor(theme, 'ironOre');
  const slag = itemColor(theme, 'slag');
  const glow = kit.materials.lamp;
  const parts: Parts = [slab(kit)];

  // Blast furnace: stone base, brick shaft in two tapers, hoops, a bustle ring and the stack.
  const FX = -4.3;
  const FZ = -3.8;
  parts.push(kit.cyl(1.75, 1.95, 0.9, p.rock, { x: FX, y: FLOOR, z: FZ }, 20));
  parts.push(kit.cyl(1.45, 1.75, 1.6, palette.accent, { x: FX, y: 1.2, z: FZ }, 20));
  parts.push(kit.cyl(1.15, 1.45, 2.2, palette.accent, { x: FX, y: 2.8, z: FZ }, 20));
  parts.push(kit.cyl(0.7, 1.15, 0.8, palette.roof, { x: FX, y: 5.0, z: FZ }, 20));
  parts.push(kit.cyl(1.8, 1.8, 0.18, p.darkMetal, { x: FX, y: 1.12, z: FZ }, 20));
  parts.push(kit.cyl(1.9, 1.9, 0.26, trim, { x: FX, y: 2.0, z: FZ }, 20));
  parts.push(kit.cyl(1.5, 1.5, 0.18, p.darkMetal, { x: FX, y: 2.72, z: FZ }, 20));
  parts.push(kit.cyl(1.22, 1.22, 0.18, p.sign, { x: FX, y: 4.9, z: FZ }, 20));
  parts.push(chimney(kit, { x: FX, z: FZ, y: 5.8, r: 0.52, h: 2.0, body: p.metal }));

  // Tap hole, the runner with molten iron, and the ladle it pours into.
  parts.push(kit.box(1.0, 0.85, 0.4, p.darkMetal, { x: FX, y: 1.2, z: FZ + 1.62, r: 0.2 }));
  parts.push(kit.box(0.55, 0.5, 0.44, glow, { x: FX, y: 1.4, z: FZ + 1.64, r: 0.2 }));
  parts.push(kit.box(0.5, 0.2, 1.95, p.darkMetal, { x: FX, y: 1.33, z: -1.1, rx: 0.14, r: 0.06 }));
  parts.push(kit.box(0.24, 0.1, 1.95, glow, { x: FX, y: 1.46, z: -1.1, rx: 0.14, r: 0.04 }));
  parts.push(kit.box(0.5, 1.02, 0.16, p.darkMetal, { x: FX, y: FLOOR, z: -0.55, r: 0.05 }));
  const ladleZ = 0.4;
  parts.push(kit.cyl(0.62, 0.48, 0.8, p.darkMetal, { x: FX, y: FLOOR + 0.1, z: ladleZ }, 16));
  parts.push(kit.cyl(0.54, 0.54, 0.06, glow, { x: FX, y: FLOOR + 0.87, z: ladleZ }, 16));
  for (const side of [-1, 1]) parts.push(kit.box(0.2, 0.9, 0.5, p.metal, { x: FX + side * 0.85, y: FLOOR, z: ladleZ, r: 0.06 }));
  parts.push(pipe(kit, 0.07, 1.9, 'x', FX, FLOOR + 0.7, ladleZ, p.metal));

  // Mould bench: two ingots still glowing, three cooled.
  parts.push(kit.box(2.8, 0.35, 1.0, p.darkMetal, { x: -1.55, y: FLOOR, z: 0.8, r: 0.08 }));
  for (let i = 0; i < 5; i += 1) {
    parts.push(kit.box(0.4, 0.22, 0.75, i < 2 ? glow : steel, { x: -2.65 + i * 0.55, y: FLOOR + 0.35, z: 0.8, r: 0.06 }));
  }

  // Slag pot and slag heap.
  parts.push(kit.cyl(0.5, 0.36, 0.6, p.darkMetal, { x: -6.2, y: FLOOR, z: 0.7 }, 14));
  parts.push(kit.dome(0.46, 0.3, 0.46, slag, { x: -6.2, y: FLOOR + 0.56, z: 0.7 }));
  parts.push(kit.dome(0.6, 0.4, 0.55, slag, { x: -6.75, y: FLOOR - 0.02, z: -0.5 }));

  // Skip hoist up to the furnace top, with a car of ore and the ore heap at its foot.
  const slope = Math.atan2(5.0, 2.0);
  parts.push(kit.box(5.4, 0.22, 0.9, p.darkMetal, { x: -6.1, y: 3.0, z: FZ, rz: slope, r: 0.06 }));
  parts.push(kit.box(0.22, 2.5, 0.7, p.darkMetal, { x: -6.15, y: FLOOR, z: FZ, r: 0.06 }));
  const car = kit.box(0.75, 0.55, 0.7, trim, { r: 0.1 });
  car.position.set(-6.78, 2.5, FZ);
  car.rotation.z = slope;
  parts.push(car);
  const load = kit.blob(0.3, 0.24, 0.3, ore);
  load.position.set(-6.98, 2.74, FZ);
  parts.push(load);
  parts.push(kit.dome(0.85, 0.6, 0.75, ore, { x: -6.5, y: FLOOR - 0.02, z: FZ + 1.5 }));
  parts.push(kit.dome(0.5, 0.36, 0.5, ore, { x: -5.85, y: FLOOR - 0.02, z: FZ + 2.0 }));

  // Downcomer from the furnace top to the dust catcher.
  const DX = -1.75;
  for (const side of [-1, 1]) parts.push(kit.box(0.14, 1.1, 0.14, p.darkMetal, { x: DX + side * 0.4, y: FLOOR, z: FZ, r: 0.04 }));
  parts.push(kit.cyl(0.6, 0.15, 0.8, p.metal, { x: DX, y: 1.0, z: FZ }, 14));
  parts.push(kit.cyl(0.6, 0.6, 1.5, p.metal, { x: DX, y: 1.8, z: FZ }, 14));
  parts.push(kit.cyl(0.2, 0.6, 0.5, p.metal, { x: DX, y: 3.3, z: FZ }, 14));
  parts.push(kit.cyl(0.64, 0.64, 0.14, trim, { x: DX, y: 2.5, z: FZ }, 14));
  parts.push(slantPipe(kit, 0.2, FX + 0.6, 5.55, DX, 3.7, FZ, p.metal));

  // Casting shed: flat roof with a raised monitor.
  const CX = 2.3;
  const CZ = -3.4;
  const W = 6.4;
  const D = 6.0;
  const WALL = 2.8;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const right = CX + W / 2;
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(cornerPosts(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, paint: palette.accent }));
  parts.push(flatRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, top: eave, roof: palette.roof, cap: palette.accent }));
  const MZ = CZ - 0.9;
  parts.push(kit.box(3.8, 1.0, 3.0, palette.wall, { x: CX, y: eave + 0.3, z: MZ, r: 0.12 }));
  parts.push(kit.box(3.0, 0.5, 0.12, kit.materials.window, { x: CX, y: eave + 0.6, z: MZ + 1.5, r: 0.04 }));
  for (const side of [-1, 1]) parts.push(kit.box(0.12, 0.5, 2.2, kit.materials.window, { x: CX + side * 1.9, y: eave + 0.6, z: MZ, r: 0.04 }));
  parts.push(flatRoof(kit, { cx: CX, cz: MZ, width: 3.8, depth: 3.0, top: eave + 1.3, roof: palette.roof, cap: palette.accent }));

  // I-beam sign standing on the roof edge.
  const signY = eave + 1.5;
  const signZ = front - 0.55;
  parts.push(disc(kit, 1.1, 0.14, p.sign, CX, signY, signZ, 28));
  parts.push(kit.box(0.2, 0.5, 0.2, p.darkMetal, { x: CX, y: eave + 0.3, z: signZ - 0.12, r: 0.05 }));
  parts.push(kit.box(1.2, 0.28, 0.16, palette.roof, { x: CX, y: signY + 0.4, z: signZ + 0.1, r: 0.05 }));
  parts.push(kit.box(0.32, 0.9, 0.14, palette.roof, { x: CX, y: signY - 0.45, z: signZ + 0.1, r: 0.05 }));
  parts.push(kit.box(1.2, 0.28, 0.16, palette.roof, { x: CX, y: signY - 0.68, z: signZ + 0.1, r: 0.05 }));

  parts.push(rollerDoor(kit, { cx: CX + 0.2, wall: front, y: FLOOR, paint: trim }));
  parts.push(kit.box(3.4, 0.2, 1.2, p.concrete, { x: CX + 0.2, y: FLOOR - 0.02, z: front + 0.5, r: 0.08 }));
  for (const z of [CZ - 1.5, CZ + 1.5]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1.0, sill: palette.accent }));
  }

  // Finished ingots on a pallet by the door.
  const stackX = CX + 2.3;
  const stackZ = front + 0.85;
  parts.push(kit.box(1.5, 0.12, 1.1, p.wood, { x: stackX, y: FLOOR, z: stackZ, r: 0.04 }));
  for (const [dx, layer] of [[-0.45, 0], [0, 0], [0.45, 0], [-0.22, 1], [0.22, 1], [0, 2]] as const) {
    parts.push(kit.box(0.4, 0.22, 0.9, steel, { x: stackX + dx, y: FLOOR + 0.12 + layer * 0.22, z: stackZ, r: 0.06 }));
  }

  // Small props.
  parts.push(planter(kit, CX - 2.6, FLOOR, front + 0.4, palette.accent));
  parts.push(drum(kit, CX - 1.9, FLOOR, front + 0.45, palette.roof));
  for (const x of [-5.5, -3.1]) parts.push(kit.cyl(0.1, 0.12, 0.6, p.hazard, { x, y: FLOOR, z: 1.4 }, 8));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[FX, 8.2, FZ]] });
}

export function registerSteelMillModel(registry: ModelRegistry): void {
  registry.register('building.steelMill', steelMill);
}
