/**
 * Small parts the tier-2 factories have in common: the ground slab, walls on
 * a footing, rods and discs, pallets, crates, planters and a belt conveyor.
 * Same plot frame as buildings.ts (+z is the front, `y` is up).
 */
import type { Object3D } from 'three';
import type { Kit, Paint } from '../kit';
import { HALF_PI } from '../parts';

/** Height of the ground slab every building stands on. */
export const FLOOR = 0.3;

export type Parts = Array<Object3D | Object3D[]>;

/** Ground slab covering x0..x1 by z0..z1. */
export function slab(kit: Kit, x0: number, x1: number, z0: number, z1: number): Object3D {
  return kit.box(x1 - x0, FLOOR, z1 - z0, kit.theme.props.concrete, { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: 0.1 });
}

/** Walls of one block on a stone footing. */
export function walls(kit: Kit, o: { cx: number; cz: number; width: number; depth: number; height: number; wall: Paint }): Object3D[] {
  return [
    kit.box(o.width, o.height, o.depth, o.wall, { x: o.cx, y: FLOOR, z: o.cz, r: 0.2 }),
    kit.box(o.width + 0.16, 0.55, o.depth + 0.16, kit.theme.props.rock, { x: o.cx, y: FLOOR, z: o.cz, r: 0.14 }),
  ];
}

/** Round bar lying along x; `y` is the height of its axis. */
export function rodX(kit: Kit, radius: number, length: number, paint: Paint, x: number, y: number, z: number, segments = 14): Object3D {
  return kit.cyl(radius, radius, length, paint, { x, y: y - length / 2, z, rz: HALF_PI }, segments);
}

/** Round bar lying along z (a disc facing the front when short); `y` is the height of its axis. */
export function rodZ(kit: Kit, radius: number, length: number, paint: Paint, x: number, y: number, z: number, segments = 14): Object3D {
  return kit.cyl(radius, radius, length, paint, { x, y: y - length / 2, z, rx: HALF_PI }, segments);
}

/** Wooden pallet; `y` is the ground under it. Its deck is at y + 0.2. */
export function pallet(kit: Kit, x: number, y: number, z: number, size = 1.2): Object3D[] {
  const wood = kit.theme.goods.pallet;
  return [
    kit.box(size, 0.08, size, wood, { x, y: y + 0.12, z, r: 0.03 }),
    kit.box(size, 0.12, 0.18, wood, { x, y, z: z - size * 0.36, r: 0.03 }),
    kit.box(size, 0.12, 0.18, wood, { x, y, z: z + size * 0.36, r: 0.03 }),
  ];
}

/** Crate with a pale band round its top. */
export function crate(kit: Kit, x: number, y: number, z: number, size: number, paint: Paint): Object3D[] {
  return [
    kit.box(size, size * 0.8, size, paint, { x, y, z, r: 0.07 }),
    kit.box(size + 0.06, 0.12, size + 0.06, kit.theme.props.sign, { x, y: y + size * 0.8 - 0.16, z, r: 0.04 }),
  ];
}

/** Potted plant with a blossom. */
export function planter(kit: Kit, x: number, y: number, z: number, pot: Paint): Object3D[] {
  const p = kit.theme.props;
  return [
    kit.cyl(0.32, 0.25, 0.42, pot, { x, y, z }, 14),
    kit.blob(0.36, 0.32, 0.36, p.foliage[0] ?? p.blossom, { x, y: y + 0.34, z }),
    kit.blob(0.12, 0.12, 0.12, p.blossom, { x: x + 0.12, y: y + 0.82, z: z + 0.1 }),
  ];
}

/** Mushroom vent for a flat roof. */
export function roofVent(kit: Kit, x: number, y: number, z: number): Object3D[] {
  const p = kit.theme.props;
  return [kit.cyl(0.16, 0.2, 0.34, p.metal, { x, y, z }, 12), kit.cyl(0.32, 0.32, 0.14, p.darkMetal, { x, y: y + 0.32, z }, 12)];
}

/**
 * Belt conveyor running along z: frame, belt, four legs and the two end rollers.
 * `top` is the height of the belt surface.
 */
export function conveyor(kit: Kit, o: { x: number; z: number; length: number; top: number; width?: number }): Object3D[] {
  const p = kit.theme.props;
  const width = o.width ?? 0.9;
  const parts: Object3D[] = [
    kit.box(width, 0.18, o.length, p.darkMetal, { x: o.x, y: o.top - 0.2, z: o.z, r: 0.06 }),
    kit.box(width - 0.2, 0.06, o.length - 0.1, p.tire, { x: o.x, y: o.top - 0.05, z: o.z, r: 0.02 }),
  ];
  for (const side of [-1, 1]) {
    const z = o.z + side * (o.length / 2 - 0.3);
    for (const dx of [-1, 1]) {
      parts.push(kit.box(0.14, o.top - 0.2 - FLOOR, 0.14, p.darkMetal, { x: o.x + dx * (width / 2 - 0.1), y: FLOOR, z, r: 0.04 }));
    }
    parts.push(rodX(kit, 0.1, width + 0.06, p.metal, o.x, o.top - 0.1, o.z + side * (o.length / 2), 10));
  }
  return parts;
}
