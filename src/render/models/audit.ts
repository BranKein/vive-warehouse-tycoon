/**
 * Finds the two modelling mistakes that are easy to make when a model is put
 * together from primitives and hard to see in code:
 *
 * - `overlap`: two flat faces of different colours lie in the same plane and
 *   cover each other, so the picture flickers between them (z-fighting);
 * - `floating`: a piece touches nothing and does not stand on the ground.
 *
 * Works on geometry alone, so it runs without a screen (`npm run audit:models`)
 * as well as on the model page. Pieces turned at an odd angle are not checked
 * for overlaps; their bounding box still counts for the floating check. Faces
 * hidden behind a third piece are skipped. Decals should stand at least 0.03
 * proud of the surface they sit on; closer than `COPLANAR` is reported.
 */
import { Box3, Matrix4, Vector3, type BufferGeometry, type Mesh, type Object3D } from 'three';

export interface AuditIssue {
  kind: 'overlap' | 'floating';
  /** Indices of the pieces involved, in traversal order. */
  meshes: number[];
  /** Where to look, in the model's frame. */
  at: [number, number, number];
  detail: string;
}

/** Faces closer together than this flicker when seen from the game's distance. */
const COPLANAR = 0.012;
/** Overlaps smaller than this area are not worth reporting. */
const MIN_AREA = 0.015;
const TOUCH = 0.03;
const GROUND = 0.08;

interface LocalFace {
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  coord: number;
  /** Extent of the flat part in the two other axes: [minU, maxU, minV, maxV]. */
  rect: [number, number, number, number];
}

interface WorldFace {
  mesh: number;
  axis: number;
  sign: number;
  coord: number;
  rect: [number, number, number, number];
}

const faceCache = new WeakMap<BufferGeometry, LocalFace[]>();
const OTHER: Array<[number, number]> = [
  [1, 2],
  [0, 2],
  [0, 1],
];

/** The flat faces a geometry has on the outside of its bounding box. */
function localFaces(geometry: BufferGeometry): LocalFace[] {
  const cached = faceCache.get(geometry);
  if (cached) return cached;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const min = box.min.toArray();
  const max = box.max.toArray();
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const faces = new Map<string, LocalFace & { area: number }>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    normal.subVectors(b, a).cross(c.clone().sub(a));
    const area = normal.length() / 2;
    if (area < 1e-9) continue;
    normal.normalize();
    const n = normal.toArray();
    for (const axis of [0, 1, 2] as const) {
      if (Math.abs(n[axis]!) < 0.999) continue;
      const sign = n[axis]! > 0 ? 1 : -1;
      const extreme = sign > 0 ? max[axis]! : min[axis]!;
      const points = [a.toArray(), b.toArray(), c.toArray()];
      if (points.some((point) => Math.abs(point[axis]! - extreme) > 1e-3)) continue;
      const key = `${axis}:${sign}`;
      const [u, v] = OTHER[axis]!;
      const face = faces.get(key) ?? { axis, sign, coord: extreme, rect: [Infinity, -Infinity, Infinity, -Infinity], area: 0 };
      for (const point of points) {
        face.rect[0] = Math.min(face.rect[0], point[u]!);
        face.rect[1] = Math.max(face.rect[1], point[u]!);
        face.rect[2] = Math.min(face.rect[2], point[v]!);
        face.rect[3] = Math.max(face.rect[3], point[v]!);
      }
      face.area += area;
      faces.set(key, face);
    }
  }
  const result = [...faces.values()].filter((face) => face.area > 1e-4);
  faceCache.set(geometry, result);
  return result;
}

/** Maps each local axis to the world axis it points along, or null when the piece is turned at an odd angle. */
function axisMap(matrix: Matrix4): Array<{ axis: number; sign: number }> | null {
  const e = matrix.elements;
  const map: Array<{ axis: number; sign: number }> = [];
  for (let column = 0; column < 3; column += 1) {
    const v = [e[column * 4]!, e[column * 4 + 1]!, e[column * 4 + 2]!];
    const length = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
    const axis = v.findIndex((value) => Math.abs(Math.abs(value) / length - 1) < 1e-3);
    if (axis < 0) return null;
    map.push({ axis, sign: Math.sign(v[axis]!) });
  }
  return map;
}

export function auditModel(model: Object3D): AuditIssue[] {
  model.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(model.matrixWorld).invert();
  const meshes: Mesh[] = [];
  model.traverse((node) => {
    if ((node as Mesh).isMesh) meshes.push(node as Mesh);
  });
  const boxes: Box3[] = [];
  const faces: WorldFace[] = [];
  const corner = new Vector3();
  meshes.forEach((mesh, meshIndex) => {
    const matrix = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    boxes.push(new Box3().copy(mesh.geometry.boundingBox!).applyMatrix4(matrix));
    const map = axisMap(matrix);
    if (!map) return;
    for (const face of localFaces(mesh.geometry)) {
      const [u, v] = OTHER[face.axis]!;
      const rect: [number, number, number, number] = [Infinity, -Infinity, Infinity, -Infinity];
      const world = map[face.axis]!;
      const [wu, wv] = OTHER[world.axis]!;
      let coord = 0;
      for (const pu of [face.rect[0], face.rect[1]]) {
        for (const pv of [face.rect[2], face.rect[3]]) {
          const local = [0, 0, 0];
          local[face.axis] = face.coord;
          local[u] = pu;
          local[v] = pv;
          corner.set(local[0]!, local[1]!, local[2]!).applyMatrix4(matrix);
          const p = corner.toArray();
          coord = p[world.axis]!;
          rect[0] = Math.min(rect[0], p[wu]!);
          rect[1] = Math.max(rect[1], p[wu]!);
          rect[2] = Math.min(rect[2], p[wv]!);
          rect[3] = Math.max(rect[3], p[wv]!);
        }
      }
      faces.push({ mesh: meshIndex, axis: world.axis, sign: face.sign * world.sign, coord, rect });
    }
  });

  const issues: AuditIssue[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < faces.length; i += 1) {
    for (let j = i + 1; j < faces.length; j += 1) {
      const f = faces[i]!;
      const g = faces[j]!;
      if (f.mesh === g.mesh || f.axis !== g.axis || f.sign !== g.sign) continue;
      // Undersides resting on the ground are never seen.
      if (f.axis === 1 && f.sign < 0 && f.coord < GROUND) continue;
      if (Math.abs(f.coord - g.coord) > COPLANAR) continue;
      if (meshes[f.mesh]!.material === meshes[g.mesh]!.material) continue;
      const du = Math.min(f.rect[1], g.rect[1]) - Math.max(f.rect[0], g.rect[0]);
      const dv = Math.min(f.rect[3], g.rect[3]) - Math.max(f.rect[2], g.rect[2]);
      if (du <= 0 || dv <= 0 || du * dv < MIN_AREA) continue;
      const key = `${f.mesh}:${g.mesh}:${f.axis}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [wu, wv] = OTHER[f.axis]!;
      const at: [number, number, number] = [0, 0, 0];
      at[f.axis] = f.coord;
      at[wu] = (Math.max(f.rect[0], g.rect[0]) + Math.min(f.rect[1], g.rect[1])) / 2;
      at[wv] = (Math.max(f.rect[2], g.rect[2]) + Math.min(f.rect[3], g.rect[3])) / 2;
      // Covered by a third piece just outside the faces: nobody sees it.
      const probe = new Vector3(at[0], at[1], at[2]);
      probe.setComponent(f.axis, f.coord + f.sign * 0.04);
      if (boxes.some((box, index) => index !== f.mesh && index !== g.mesh && box.containsPoint(probe))) continue;
      issues.push({
        kind: 'overlap',
        meshes: [f.mesh, g.mesh],
        at,
        detail: `${'xyz'[f.axis]}${f.sign > 0 ? '+' : '-'} faces ${Math.abs(f.coord - g.coord).toFixed(3)} apart, ${(du * dv).toFixed(2)} overlapping`,
      });
    }
  }

  boxes.forEach((box, index) => {
    if (box.min.y <= GROUND) return;
    const grown = box.clone().expandByScalar(TOUCH);
    if (boxes.some((other, otherIndex) => otherIndex !== index && grown.intersectsBox(other))) return;
    const centre = box.getCenter(new Vector3());
    issues.push({
      kind: 'floating',
      meshes: [index],
      at: [centre.x, centre.y, centre.z],
      detail: `touches nothing, ${box.min.y.toFixed(2)} above the ground`,
    });
  });
  return issues;
}

/** Fingerprint of a model's shape and colours; changes whenever the model is edited. */
export function modelFingerprint(model: Object3D): string {
  model.updateMatrixWorld(true);
  let hash = 2166136261;
  const mix = (value: number): void => {
    hash ^= Math.round(value * 1000) | 0;
    hash = Math.imul(hash, 16777619);
  };
  let count = 0;
  model.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    count += 1;
    for (const element of mesh.matrixWorld.elements) mix(element);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    for (const value of [...mesh.geometry.boundingBox!.min.toArray(), ...mesh.geometry.boundingBox!.max.toArray()]) mix(value);
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as { color?: { getHex(): number } } | undefined;
    mix((material?.color?.getHex() ?? 0) / 1000);
  });
  return `${count}-${(hash >>> 0).toString(16)}`;
}
