/**
 * Parts that recur in the tier 3 / tier 4 / handmade buildings of this folder:
 * hall walls, glass bands, conveyors and the goods (sofas, white goods, gift
 * boxes, bicycles) that show up both as emblems and as props.
 * Same plot frame as buildings.ts: +z is the front, `y` is up.
 */
import { Group, type Mesh, type Object3D } from 'three';
import type { Kit, Paint } from '../kit';
import { HALF_PI, type Face } from '../parts';

/** Top of the ground slab every building stands on. */
export const FLOOR = 0.3;

export type Parts = Array<Object3D | Object3D[]>;

/** Walls of one block on a stone footing. `y` is the floor it stands on. */
export function hall(kit: Kit, o: { cx: number; cz: number; w: number; d: number; h: number; wall: Paint; y?: number }): Object3D[] {
  const y = o.y ?? FLOOR;
  return [
    kit.box(o.w, o.h, o.d, o.wall, { x: o.cx, y, z: o.cz, r: 0.2 }),
    kit.box(o.w + 0.16, 0.55, o.d + 0.16, kit.theme.props.rock, { x: o.cx, y, z: o.cz, r: 0.14 }),
  ];
}

/**
 * Wide strip of glazing in one pale frame, split into `panes` by mullions and
 * into `rows` by transoms. Same conventions as `framedWindow`.
 */
export function glassBand(
  kit: Kit,
  o: { face: Face; along: number; wall: number; y: number; width: number; height: number; panes: number; rows?: number; frame?: Paint },
): Object3D[] {
  const frame = o.frame ?? kit.theme.props.sign;
  const out = o.face === 'front' || o.face === 'right' ? 1 : -1;
  const sideways = o.face === 'left' || o.face === 'right';
  const piece = (w: number, h: number, t: number, paint: Paint, y: number, off: number, r: number, shift = 0): Object3D =>
    sideways
      ? kit.box(t, h, w, paint, { x: o.wall + out * off, y, z: o.along + shift, r })
      : kit.box(w, h, t, paint, { x: o.along + shift, y, z: o.wall + out * off, r });
  const parts: Object3D[] = [
    piece(o.width, o.height, 0.12, frame, o.y, 0.02, 0.05),
    piece(o.width - 0.24, o.height - 0.24, 0.16, kit.materials.window, o.y + 0.12, 0.04, 0.05),
  ];
  for (let i = 1; i < o.panes; i += 1) {
    parts.push(piece(0.1, o.height - 0.24, 0.2, frame, o.y + 0.12, 0.05, 0.03, -o.width / 2 + (i * o.width) / o.panes));
  }
  const rows = o.rows ?? 1;
  for (let i = 1; i < rows; i += 1) {
    parts.push(piece(o.width - 0.24, 0.1, 0.2, frame, o.y + (i * o.height) / rows - 0.05, 0.05, 0.03));
  }
  return parts;
}

/** Disc standing upright, centred on (x, y, z); its axis points along z or along x. */
export function disc(kit: Kit, radius: number, thickness: number, paint: Paint, x: number, y: number, z: number, axis: 'x' | 'z' = 'z', segments = 20): Mesh {
  return axis === 'z'
    ? kit.cyl(radius, radius, thickness, paint, { x, y: y - thickness / 2, z, rx: HALF_PI }, segments)
    : kit.cyl(radius, radius, thickness, paint, { x, y: y - thickness / 2, z, rz: HALF_PI }, segments);
}

/** Bar between two points of the xy plane (for frames and struts drawn flat). */
export function tube(kit: Kit, x1: number, y1: number, x2: number, y2: number, thick: number, depth: number, paint: Paint, z = 0): Mesh {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return kit.box(Math.hypot(dx, dy) + thick, thick, depth, paint, {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2 - thick / 2,
    z,
    rz: Math.atan2(dy, dx),
    r: thick * 0.3,
  });
}

/** Belt conveyor running along x. `top` is the height of the belt surface, `base` the floor. */
export function conveyor(kit: Kit, o: { x: number; z: number; length: number; top: number; base: number; width?: number }): Object3D[] {
  const p = kit.theme.props;
  const width = o.width ?? 1;
  const parts: Object3D[] = [
    kit.box(o.length, 0.2, width, p.darkMetal, { x: o.x, y: o.top - 0.24, z: o.z, r: 0.08 }),
    kit.box(o.length - 0.15, 0.1, width - 0.24, p.tire, { x: o.x, y: o.top - 0.1, z: o.z, r: 0.04 }),
  ];
  const legs = Math.max(2, Math.round(o.length / 2.4) + 1);
  for (let i = 0; i < legs; i += 1) {
    const x = o.x - o.length / 2 + 0.3 + (i * (o.length - 0.6)) / (legs - 1);
    parts.push(kit.box(0.18, o.top - 0.2 - o.base, width - 0.12, p.darkMetal, { x, y: o.base, z: o.z, r: 0.06 }));
  }
  for (const side of [-1, 1]) parts.push(disc(kit, 0.13, width - 0.08, p.metal, o.x + (side * o.length) / 2, o.top - 0.14, o.z, 'z', 12));
  return parts;
}

/** Box tied with a ribbon; `bow` adds the loops on top. `y` is its underside. */
export function giftBox(
  kit: Kit,
  o: { x: number; y: number; z: number; w: number; h: number; d: number; paint: Paint; ribbon: Paint; bow?: boolean },
): Object3D[] {
  const e = Math.max(0.03, o.w * 0.03);
  const r = Math.min(0.14, o.w * 0.08);
  const parts: Object3D[] = [
    kit.box(o.w, o.h, o.d, o.paint, { x: o.x, y: o.y, z: o.z, r }),
    kit.box(o.w * 0.2, o.h + e - 0.04, o.d + e * 2, o.ribbon, { x: o.x, y: o.y + 0.04, z: o.z, r: r * 0.6 }),
    kit.box(o.w + e * 2, o.h + e - 0.04, o.d * 0.2, o.ribbon, { x: o.x, y: o.y + 0.04, z: o.z, r: r * 0.6 }),
  ];
  if (o.bow ?? true) {
    const top = o.y + o.h;
    for (const side of [-1, 1]) {
      parts.push(kit.blob(o.w * 0.24, o.w * 0.13, o.w * 0.15, o.ribbon, { x: o.x + side * o.w * 0.2, y: top + o.w * 0.02, z: o.z, rz: side * 0.45 }));
    }
    parts.push(kit.blob(o.w * 0.1, o.w * 0.1, o.w * 0.1, o.ribbon, { x: o.x, y: top - o.w * 0.02, z: o.z }));
  }
  return parts;
}

/** Sofa facing +z, standing on `y`: plinth, seat, back, two arms, two cushions. */
export function sofa(
  kit: Kit,
  o: { x: number; y: number; z: number; w: number; h: number; d: number; paint: Paint; cushion: Paint; ry?: number },
): Object3D {
  const { w, h, d } = o;
  const r = Math.min(0.16, h * 0.14);
  const g = new Group();
  g.add(kit.box(w * 0.88, h * 0.12, d * 0.8, kit.theme.props.wood, { r: 0.03 }));
  g.add(kit.box(w, h * 0.36, d, o.paint, { y: h * 0.1, r }));
  g.add(kit.box(w, h * 0.9, d * 0.32, o.paint, { y: h * 0.1, z: -d * 0.34, r }));
  for (const side of [-1, 1]) {
    g.add(kit.box(w * 0.17, h * 0.6, d, o.paint, { x: side * w * 0.415, y: h * 0.1, r }));
    g.add(kit.box(w * 0.31, h * 0.16, d * 0.62, o.cushion, { x: side * w * 0.165, y: h * 0.43, z: d * 0.14, r: r * 0.6 }));
  }
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Two-door fridge facing +z, standing on `y`. */
export function fridge(kit: Kit, o: { x: number; y: number; z: number; s: number; body?: Paint; ry?: number; depth?: number }): Object3D {
  const p = kit.theme.props;
  const s = o.s;
  const d = o.depth ?? 0.7 * s;
  const g = new Group();
  g.add(kit.box(0.8 * s, 1.8 * s, d, o.body ?? p.sign, { r: 0.1 * s }));
  g.add(kit.box(0.82 * s, 0.05 * s, d + 0.02 * s, p.metal, { y: 1.12 * s, r: 0.02 * s }));
  for (const y of [0.6, 1.26]) g.add(kit.box(0.07 * s, 0.38 * s, 0.1 * s, p.darkMetal, { x: 0.27 * s, y: y * s, z: d / 2, r: 0.03 * s }));
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Front-loading washing machine facing +z, standing on `y`. */
export function washer(kit: Kit, o: { x: number; y: number; z: number; s: number; panel: Paint; body?: Paint; ry?: number; depth?: number }): Object3D {
  const p = kit.theme.props;
  const s = o.s;
  const d = o.depth ?? 0.75 * s;
  const g = new Group();
  g.add(kit.box(0.95 * s, 1.05 * s, d, o.body ?? p.sign, { r: 0.1 * s }));
  g.add(disc(kit, 0.31 * s, 0.08 * s, p.darkMetal, 0, 0.45 * s, d / 2, 'z'));
  g.add(disc(kit, 0.22 * s, 0.12 * s, p.glass, 0, 0.45 * s, d / 2, 'z'));
  g.add(kit.box(0.8 * s, 0.13 * s, 0.06 * s, o.panel, { y: 0.84 * s, z: d / 2, r: 0.03 * s }));
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/**
 * Bicycle seen from the side (its length runs along x), wheels standing on `y`.
 * `detail` adds pale wheel discs, hubs and seat stays, for the big emblem.
 */
export function bike(kit: Kit, o: { x: number; y: number; z: number; s: number; frame: Paint; detail?: boolean; ry?: number }): Object3D {
  const p = kit.theme.props;
  const s = o.s;
  const g = new Group();
  const R = 0.5 * s;
  for (const wx of [-0.8 * s, 0.8 * s]) {
    g.add(disc(kit, R, 0.1 * s, p.tire, wx, R, 0, 'z', 22));
    if (o.detail) {
      g.add(disc(kit, R * 0.74, 0.12 * s, p.sign, wx, R, 0, 'z', 22));
      g.add(disc(kit, R * 0.24, 0.2 * s, p.metal, wx, R, 0, 'z', 12));
    }
  }
  const rear = [-0.8, 0.5] as const;
  const fore = [0.8, 0.5] as const;
  const crank = [-0.1, 0.45] as const;
  const seat = [-0.38, 1.15] as const;
  const head = [0.5, 1.12] as const;
  const bars: Array<readonly [readonly [number, number], readonly [number, number]]> = [
    [rear, crank],
    [crank, seat],
    [seat, head],
    [crank, head],
    [head, fore],
  ];
  if (o.detail) bars.push([rear, seat]);
  for (const [a, b] of bars) g.add(tube(kit, a[0] * s, a[1] * s, b[0] * s, b[1] * s, 0.1 * s, 0.16 * s, o.frame));
  g.add(kit.box(0.36 * s, 0.1 * s, 0.22 * s, p.tire, { x: seat[0] * s, y: 1.2 * s, r: 0.04 * s }));
  g.add(kit.box(0.12 * s, 0.1 * s, 0.62 * s, p.tire, { x: (head[0] + 0.02) * s, y: 1.2 * s, r: 0.04 * s }));
  // The battery on the down tube makes it an e-bike.
  g.add(kit.box(0.46 * s, 0.17 * s, 0.2 * s, p.hazard, { x: 0.2 * s, y: 0.7 * s, rz: Math.atan2(0.67, 0.6), r: 0.05 * s }));
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Jointed robot arm reaching towards +x from its base at (x, y, z). */
export function robotArm(kit: Kit, o: { x: number; y: number; z: number; paint: Paint; ry?: number; tool?: Paint }): Object3D {
  const p = kit.theme.props;
  const g = new Group();
  g.add(kit.cyl(0.3, 0.38, 0.3, p.darkMetal, {}, 14));
  g.add(kit.box(0.26, 1.15, 0.26, o.paint, { x: 0.12, y: 0.25, rz: -0.22, r: 0.09 }));
  g.add(kit.blob(0.2, 0.2, 0.2, p.darkMetal, { x: 0.25, y: 1.22 }));
  g.add(kit.box(1.0, 0.22, 0.22, o.paint, { x: 0.7, y: 1.2, rz: -0.35, r: 0.08 }));
  g.add(kit.box(0.2, 0.34, 0.3, o.tool ?? p.darkMetal, { x: 1.16, y: 0.82, r: 0.06 }));
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Plant pot with a round shrub. */
export function pot(kit: Kit, x: number, y: number, z: number, paint: Paint): Object3D[] {
  return [
    kit.cyl(0.3, 0.22, 0.42, paint, { x, y, z }, 12),
    kit.blob(0.36, 0.34, 0.36, kit.theme.props.foliage[0] ?? paint, { x, y: y + 0.34, z }),
  ];
}

/** Roof-top air handling unit. */
export function roofUnit(kit: Kit, x: number, y: number, z: number): Object3D[] {
  const p = kit.theme.props;
  return [kit.box(1.3, 0.6, 0.95, p.metal, { x, y, z, r: 0.1 }), kit.box(0.95, 0.1, 0.62, p.darkMetal, { x, y: y + 0.58, z, r: 0.04 })];
}
