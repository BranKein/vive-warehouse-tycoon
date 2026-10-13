/**
 * Parts repeated across the tier 1 workshops: the ground slab, walls on a
 * stone footing, pipes, tanks, chimneys and a few small props. Same plot
 * frame as buildings.ts: +z is the front, `y` is up.
 */
import type { Object3D } from 'three';
import type { Kit, Paint } from '../kit';
import { HALF_PI } from '../parts';

export type Parts = Array<Object3D | Object3D[]>;

/** Height of the ground slab; walls start here. */
export const FLOOR = 0.3;

/** Ground slab that fills the allowed footprint. */
export function slab(kit: Kit, width = 13.2, depth = 8.6, x = -0.8, z = -2.6): Object3D {
  return kit.box(width, FLOOR, depth, kit.theme.props.concrete, { x, z, r: 0.1 });
}

/** Walls of a hall with a stone footing around them. */
export function hall(kit: Kit, o: { cx: number; cz: number; w: number; d: number; h: number; wall: Paint; y?: number }): Object3D[] {
  const y = o.y ?? FLOOR;
  return [
    kit.box(o.w, o.h, o.d, o.wall, { x: o.cx, y, z: o.cz, r: 0.2 }),
    kit.box(o.w + 0.16, 0.55, o.d + 0.16, kit.theme.props.rock, { x: o.cx, y, z: o.cz, r: 0.14 }),
  ];
}

/** Four corner posts of a hall. */
export function cornerPosts(kit: Kit, o: { cx: number; cz: number; w: number; d: number; h: number; paint: Paint; y?: number }): Object3D[] {
  const parts: Object3D[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(kit.box(0.42, o.h + 0.1, 0.42, o.paint, { x: o.cx + sx * (o.w / 2 - 0.1), y: o.y ?? FLOOR, z: o.cz + sz * (o.d / 2 - 0.1), r: 0.1 }));
    }
  }
  return parts;
}

/** Straight pipe along an axis; (x, y, z) is its centre. */
export function pipe(kit: Kit, radius: number, length: number, axis: 'x' | 'y' | 'z', x: number, y: number, z: number, paint: Paint, segments = 10): Object3D {
  const place = { x, y: y - length / 2, z, rx: axis === 'z' ? HALF_PI : 0, rz: axis === 'x' ? HALF_PI : 0 };
  return kit.cyl(radius, radius, length, paint, place, segments);
}

/** Pipe in the xy plane from (x0, y0) to (x1, y1) at depth z. */
export function slantPipe(kit: Kit, radius: number, x0: number, y0: number, x1: number, y1: number, z: number, paint: Paint): Object3D {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  return kit.cyl(radius, radius, length, paint, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - length / 2, z, rz: angle - HALF_PI }, 10);
}

/** Disc facing the front (+z); (x, y, z) is its centre. */
export function disc(kit: Kit, radius: number, thick: number, paint: Paint, x: number, y: number, z: number, segments = 24): Object3D {
  return kit.cyl(radius, radius, thick, paint, { x, y: y - thick / 2, z, rx: HALF_PI }, segments);
}

/** Upright tank with a domed top and hoops. `y` is its underside. */
export function tank(kit: Kit, o: { x: number; z: number; y: number; r: number; h: number; body: Paint; top: Paint; band: Paint; bands?: number }): Object3D[] {
  const parts: Object3D[] = [
    kit.cyl(o.r, o.r, o.h, o.body, { x: o.x, y: o.y, z: o.z }, 22),
    kit.dome(o.r, o.r * 0.38, o.r, o.top, { x: o.x, y: o.y + o.h - 0.02, z: o.z }),
  ];
  const bands = o.bands ?? 2;
  for (let i = 0; i < bands; i += 1) {
    const y = o.y + ((i + 0.5) / bands) * o.h + (i === bands - 1 ? o.h / bands / 2 - 0.2 : 0);
    parts.push(kit.cyl(o.r + 0.05, o.r + 0.05, 0.16, o.band, { x: o.x, y, z: o.z }, 22));
  }
  return parts;
}

/** Round chimney, slightly tapered, with a pale rim. `y` is its underside; the top is at y + h + 0.17. */
export function chimney(kit: Kit, o: { x: number; z: number; y: number; r: number; h: number; body: Paint }): Object3D[] {
  return [
    kit.cyl(o.r * 0.8, o.r, o.h, o.body, { x: o.x, y: o.y, z: o.z }, 16),
    kit.cyl(o.r * 0.8 + 0.12, o.r * 0.8 + 0.12, 0.22, kit.theme.props.sign, { x: o.x, y: o.y + o.h - 0.05, z: o.z }, 16),
  ];
}

/** Tied sack standing on `y`. */
export function sack(kit: Kit, x: number, y: number, z: number, paint: Paint, tie: Paint, scale = 1): Object3D[] {
  return [
    kit.blob(0.34 * scale, 0.4 * scale, 0.3 * scale, paint, { x, y, z }),
    kit.cyl(0.1 * scale, 0.14 * scale, 0.16 * scale, tie, { x, y: y + 0.74 * scale, z }, 8),
  ];
}

/** Oil drum standing on `y`. */
export function drum(kit: Kit, x: number, y: number, z: number, paint: Paint, radius = 0.3, height = 0.75): Object3D[] {
  return [
    kit.cyl(radius, radius, height, paint, { x, y, z }, 14),
    kit.cyl(radius + 0.02, radius + 0.02, 0.08, kit.theme.props.darkMetal, { x, y: y + height - 0.04, z }, 14),
  ];
}

/** Flower pot with a leafy blob and a blossom. */
export function planter(kit: Kit, x: number, y: number, z: number, pot: Paint): Object3D[] {
  const p = kit.theme.props;
  return [
    kit.cyl(0.3, 0.22, 0.4, pot, { x, y, z }, 12),
    kit.blob(0.36, 0.3, 0.36, p.foliage[0] ?? pot, { x, y: y + 0.32, z }),
    kit.blob(0.12, 0.12, 0.12, p.blossom, { x: x + 0.12, y: y + 0.78, z: z + 0.1 }),
  ];
}
