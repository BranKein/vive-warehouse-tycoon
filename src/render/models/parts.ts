/**
 * Building parts shared by the hand-drawn models, so that roofs, windows and
 * doors look the same from one building to the next. Everything is in the
 * plot frame of buildings.ts: +z is the front (towards the yard), `y` is up.
 */
import type { Object3D } from 'three';
import type { Kit, Paint } from './kit';

export const HALF_PI = Math.PI / 2;

/** Which wall a part sits on. */
export type Face = 'front' | 'back' | 'left' | 'right';

/**
 * Gable roof with its ridge along z (gable ends face the front and the back):
 * the gable triangles in the wall colour, two thick slabs with an overhang,
 * a ridge cap and pale barge boards on the front edge.
 * `eave` is the top of the walls, `rise` the height of the ridge above it.
 */
export function gableRoof(
  kit: Kit,
  o: { cx: number; cz: number; width: number; depth: number; eave: number; rise: number; wall: Paint; roof: Paint; cap: Paint; overhang?: number },
): Object3D[] {
  const overhang = o.overhang ?? 0.75;
  const pitch = Math.atan2(o.rise, o.width / 2);
  const span = o.width / 2 + overhang;
  const slab = span / Math.cos(pitch);
  const ridgeY = o.eave + o.rise + 0.12;
  const front = o.cz + o.depth / 2;
  const parts: Object3D[] = [
    kit.prism(o.depth - 0.1, o.rise, o.width - 0.1, o.wall, { x: o.cx, y: o.eave - 0.05, z: o.cz, ry: HALF_PI }),
    kit.box(0.7, 0.3, o.depth + 1.4, o.cap, { x: o.cx, y: ridgeY - 0.02, z: o.cz, r: 0.14 }),
  ];
  for (const side of [-1, 1]) {
    const x = o.cx + (side * span) / 2;
    const y = ridgeY - (span / 2) * Math.tan(pitch);
    parts.push(kit.box(slab, 0.34, o.depth + 1.3, o.roof, { x, y: y - 0.17, z: o.cz, rz: -side * pitch, r: 0.14 }));
    parts.push(kit.box(slab, 0.2, 0.22, kit.theme.props.sign, { x, y: y - 0.24, z: front + 0.62, rz: -side * pitch, r: 0.06 }));
  }
  return parts;
}

/** Flat roof: a thick slab with an overhang and a low parapet rim in the cap colour. `top` is the top of the walls. */
export function flatRoof(kit: Kit, o: { cx: number; cz: number; width: number; depth: number; top: number; roof: Paint; cap: Paint }): Object3D[] {
  return [
    kit.box(o.width + 0.7, 0.42, o.depth + 0.7, o.roof, { x: o.cx, y: o.top - 0.08, z: o.cz, r: 0.18 }),
    kit.box(o.width + 0.1, 0.16, o.depth + 0.1, o.cap, { x: o.cx, y: o.top + 0.3, z: o.cz, r: 0.06 }),
  ];
}

/**
 * Window with a pale frame, a mullion and a sill, flat on a wall.
 * `along` is the position along the wall (x for front/back walls, z for side walls),
 * `wall` the wall's coordinate on the other axis, `y` the underside of the frame.
 * The glass lights up at night.
 */
export function framedWindow(
  kit: Kit,
  o: { face: Face; along: number; wall: number; y: number; width?: number; height?: number; sill: Paint },
): Object3D[] {
  const p = kit.theme.props;
  const width = o.width ?? 1.6;
  const height = o.height ?? 1.3;
  const out = o.face === 'front' || o.face === 'right' ? 1 : -1;
  const sideways = o.face === 'left' || o.face === 'right';
  // Size (w along the wall, t out of the wall) and position of one piece.
  const piece = (w: number, h: number, t: number, paint: Paint, y: number, off: number, r: number): Object3D =>
    sideways
      ? kit.box(t, h, w, paint, { x: o.wall + out * off, y, z: o.along, r })
      : kit.box(w, h, t, paint, { x: o.along, y, z: o.wall + out * off, r });
  return [
    piece(width, height, 0.12, p.sign, o.y, 0.02, 0.05),
    piece(width - 0.25, height - 0.25, 0.16, kit.materials.window, o.y + 0.13, 0.04, 0.05),
    piece(0.1, height - 0.25, 0.2, p.sign, o.y + 0.13, 0.05, 0.03),
    piece(width + 0.2, 0.12, 0.34, o.sill, o.y - 0.07, 0.1, 0.05),
  ];
}

/**
 * Sliding barn door on the front wall: pale frame, coloured leaf with cross
 * braces, a rail above and a lamp over it. `y` is the floor level, `wall` the z of the front wall.
 */
export function barnDoor(kit: Kit, o: { cx: number; wall: number; y: number; width?: number; height?: number; paint: Paint }): Object3D[] {
  const p = kit.theme.props;
  const width = o.width ?? 3;
  const height = o.height ?? 2.45;
  const z = o.wall + 0.06;
  const parts: Object3D[] = [
    kit.box(width + 0.4, height + 0.2, 0.12, p.sign, { x: o.cx, y: o.y, z: o.wall + 0.01, r: 0.06 }),
    kit.box(width, height, 0.16, o.paint, { x: o.cx, y: o.y, z, r: 0.07 }),
    kit.box(width + 1.6, 0.14, 0.16, p.darkMetal, { x: o.cx, y: o.y + height + 0.18, z: z + 0.06, r: 0.05 }),
    kit.box(0.34, 0.22, 0.16, kit.materials.lamp, { x: o.cx, y: o.y + height + 0.42, z: o.wall + 0.12, r: 0.07 }),
  ];
  const brace = Math.hypot(width - 0.3, height - 0.3);
  const angle = Math.atan2(height - 0.3, width - 0.3);
  for (const side of [-1, 1]) {
    parts.push(kit.box(brace, 0.2, 0.1, p.sign, { x: o.cx, y: o.y + height / 2 - 0.1, z: z + 0.08, rz: side * angle, r: 0.04 }));
    parts.push(kit.box(0.2, height, 0.1, p.sign, { x: o.cx + side * (width / 2 - 0.1), y: o.y, z: z + 0.08, r: 0.04 }));
  }
  for (const y of [o.y + 0.02, o.y + height - 0.22]) parts.push(kit.box(width, 0.2, 0.1, p.sign, { x: o.cx, y, z: z + 0.08, r: 0.04 }));
  return parts;
}

/** Roller shutter door on the front wall, for the more industrial buildings: pale frame, slatted leaf, a lamp over it. */
export function rollerDoor(kit: Kit, o: { cx: number; wall: number; y: number; width?: number; height?: number; paint?: Paint }): Object3D[] {
  const p = kit.theme.props;
  const width = o.width ?? 2.4;
  const height = o.height ?? 2.3;
  const parts: Object3D[] = [
    kit.box(width + 0.4, height + 0.2, 0.12, p.sign, { x: o.cx, y: o.y, z: o.wall + 0.01, r: 0.06 }),
    kit.box(width, height, 0.16, o.paint ?? p.door, { x: o.cx, y: o.y, z: o.wall + 0.05, r: 0.07 }),
    kit.box(0.34, 0.22, 0.2, kit.materials.lamp, { x: o.cx, y: o.y + height + 0.22, z: o.wall + 0.08, r: 0.07 }),
  ];
  const slats = Math.max(2, Math.floor(height / 0.5));
  for (let i = 1; i <= slats; i += 1) {
    parts.push(kit.box(width - 0.1, 0.07, 0.2, p.sign, { x: o.cx, y: o.y + (i * height) / (slats + 1), z: o.wall + 0.05, r: 0.02 }));
  }
  return parts;
}

/** Log lying along z with pale cut ends; `y` is its underside. */
export function log(kit: Kit, radius: number, length: number, x: number, y: number, z: number, cut: Paint): Object3D[] {
  return [
    kit.cyl(radius, radius, length, kit.theme.props.trunk, { x, y: y + radius - length / 2, z, rx: HALF_PI }, 14),
    kit.cyl(radius * 0.8, radius * 0.8, length + 0.06, cut, { x, y: y + radius - length / 2 - 0.03, z, rx: HALF_PI }, 14),
  ];
}

/** Small bush made of two blobs, for softening a corner. */
export function bush(kit: Kit, x: number, y: number, z: number): Object3D[] {
  const foliage = kit.theme.props.foliage;
  return [
    kit.blob(0.6, 0.5, 0.6, foliage[2] ?? 0x8fd0b0, { x, y, z }),
    kit.blob(0.4, 0.36, 0.4, foliage[1] ?? 0xb6e2a1, { x: x + 0.65, y, z: z + 0.15 }),
  ];
}
