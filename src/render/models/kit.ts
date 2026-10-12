/**
 * Small modelling kit: rounded boxes, cylinders, blobs and prisms with
 * cached geometries, so the primitive-built models stay short. Every helper
 * returns a Mesh positioned by the centre of its base (`y` is the bottom).
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  SphereGeometry,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from '../materials';
import type { Theme } from '../theme';

export type Paint = number | Material;

export interface Place {
  x?: number;
  /** Height of the bottom of the shape. */
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Corner radius of boxes. */
  r?: number;
}

/** Named points on a model, in its local frame, that the view uses to place things around it. */
export type Anchors = Record<string, Array<[number, number, number]>>;

export class Kit {
  private readonly geometries = new Map<string, BufferGeometry>();

  constructor(
    readonly theme: Theme,
    readonly materials: MaterialLibrary,
  ) {}

  private material(paint: Paint): Material {
    return typeof paint === 'number' ? this.materials.solid(paint) : paint;
  }

  private cached(key: string, make: () => BufferGeometry): BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = make();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  private place(mesh: Mesh, height: number, place: Place): Mesh {
    mesh.position.set(place.x ?? 0, (place.y ?? 0) + height / 2, place.z ?? 0);
    mesh.rotation.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    return mesh;
  }

  /** Box with rounded edges. */
  box(width: number, height: number, depth: number, paint: Paint, place: Place = {}): Mesh {
    const radius = Math.min(place.r ?? 0.12, width / 2, height / 2, depth / 2);
    const key = `box:${width}:${height}:${depth}:${radius}`;
    const geometry = this.cached(key, () => new RoundedBoxGeometry(width, height, depth, 2, radius));
    return this.place(new Mesh(geometry, this.material(paint)), height, place);
  }

  /** Upright cylinder (or cone frustum). */
  cyl(radiusTop: number, radiusBottom: number, height: number, paint: Paint, place: Place = {}, segments = 16): Mesh {
    const key = `cyl:${radiusTop}:${radiusBottom}:${height}:${segments}`;
    const geometry = this.cached(key, () => new CylinderGeometry(radiusTop, radiusBottom, height, segments));
    return this.place(new Mesh(geometry, this.material(paint)), height, place);
  }

  cone(radius: number, height: number, paint: Paint, place: Place = {}, segments = 16): Mesh {
    const key = `cone:${radius}:${height}:${segments}`;
    const geometry = this.cached(key, () => new ConeGeometry(radius, height, segments));
    return this.place(new Mesh(geometry, this.material(paint)), height, place);
  }

  /** Sphere scaled into an ellipsoid; `y` is its bottom. */
  blob(radiusX: number, radiusY: number, radiusZ: number, paint: Paint, place: Place = {}): Mesh {
    const geometry = this.cached('sphere', () => new SphereGeometry(1, 18, 12));
    const mesh = new Mesh(geometry, this.material(paint));
    mesh.scale.set(radiusX, radiusY, radiusZ);
    return this.place(mesh, radiusY * 2, place);
  }

  /** Upper half of an ellipsoid sitting on `y`. */
  dome(radiusX: number, radiusY: number, radiusZ: number, paint: Paint, place: Place = {}): Mesh {
    const geometry = this.cached('dome', () => new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    const mesh = new Mesh(geometry, this.material(paint));
    mesh.scale.set(radiusX, radiusY, radiusZ);
    return this.place(mesh, 0, place);
  }

  /** Capsule lying along the z axis; `y` is its bottom. */
  capsule(radius: number, length: number, paint: Paint, place: Place = {}): Mesh {
    const key = `capsule:${radius}:${length}`;
    const geometry = this.cached(key, () => {
      const g = new CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, 14);
      g.rotateX(Math.PI / 2);
      return g;
    });
    return this.place(new Mesh(geometry, this.material(paint)), radius * 2, place);
  }

  /**
   * Roof prism: ridge along x, base `width` (x) by `depth` (z), `height` tall.
   * `apex` (0..1) moves the ridge from the back edge (-z) to the front edge.
   */
  prism(width: number, height: number, depth: number, paint: Paint, place: Place = {}, apex = 0.5): Mesh {
    const key = `prism:${width}:${height}:${depth}:${apex}`;
    const geometry = this.cached(key, () => prismGeometry(width, height, depth, apex));
    const mesh = new Mesh(geometry, this.material(paint));
    mesh.position.set(place.x ?? 0, place.y ?? 0, place.z ?? 0);
    mesh.rotation.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    return mesh;
  }

  /** Half cylinder lying along x, flat side down on `y`. */
  barrel(width: number, height: number, depth: number, paint: Paint, place: Place = {}): Mesh {
    const geometry = this.cached('barrel', () => {
      const g = new CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI);
      // Cylinder axis y -> x; the half circle (x >= 0) ends up pointing up.
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const mesh = new Mesh(geometry, this.material(paint));
    mesh.scale.set(width, height, depth / 2);
    mesh.position.set(place.x ?? 0, place.y ?? 0, place.z ?? 0);
    mesh.rotation.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    return mesh;
  }

  group(children: Array<Object3D | null | undefined | false>, anchors?: Anchors): Group {
    const group = new Group();
    for (const child of children) if (child) group.add(child);
    if (anchors) group.userData.anchors = anchors;
    return group;
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
  }
}

function prismGeometry(width: number, height: number, depth: number, apex: number): BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const ridgeZ = -hd + depth * apex;
  // Corners: back-left, back-right, front-right, front-left, ridge-left, ridge-right.
  const bl = [-hw, 0, -hd];
  const br = [hw, 0, -hd];
  const fr = [hw, 0, hd];
  const fl = [-hw, 0, hd];
  const rl = [-hw, height, ridgeZ];
  const rr = [hw, height, ridgeZ];
  const triangles = [
    // front slope
    fl, fr, rr, fl, rr, rl,
    // back slope
    br, bl, rl, br, rl, rr,
    // gable ends
    bl, fl, rl, fr, br, rr,
    // underside
    bl, br, fr, bl, fr, fl,
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const vertex of triangles) {
    positions.push(vertex[0]!, vertex[1]!, vertex[2]!);
    uvs.push(0, 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Reads the anchors a model declares, or an empty list. */
export function anchorsOf(model: Object3D, name: string): Array<[number, number, number]> {
  const anchors = model.userData.anchors as Anchors | undefined;
  return anchors?.[name] ?? [];
}
