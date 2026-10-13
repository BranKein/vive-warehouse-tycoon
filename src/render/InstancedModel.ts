import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Anchors } from './models/kit';

export interface InstancedModelOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface Part {
  geometry: BufferGeometry;
  material: Material;
}

/**
 * Draws many copies of one model cheaply. The model's meshes are merged into
 * one geometry per material and each of those becomes an InstancedMesh, so a
 * model costs "number of materials" draw calls no matter how many copies are
 * on screen.
 *
 * Usage is immediate-mode: `begin()`, `add(matrix)` for every copy this
 * frame, `end()`.
 */
export class InstancedModel {
  readonly group = new Group();
  readonly anchors: Anchors;
  private readonly parts: Part[];
  private meshes: InstancedMesh[] = [];
  private capacity = 0;
  private count = 0;
  private tinted = false;

  constructor(
    prototype: Object3D,
    capacity: number,
    private readonly options: InstancedModelOptions = {},
  ) {
    this.anchors = (prototype.userData.anchors as Anchors | undefined) ?? {};
    this.parts = extractParts(prototype);
    this.allocate(Math.max(1, capacity));
  }

  get size(): number {
    return this.count;
  }

  begin(): void {
    this.count = 0;
  }

  /** Adds one copy. `tint` multiplies the model's colours (once used, pass it for every copy). */
  add(matrix: Matrix4, tint?: Color): number {
    if (this.count >= this.capacity) this.allocate(this.capacity * 2);
    const index = this.count;
    for (const mesh of this.meshes) {
      mesh.setMatrixAt(index, matrix);
      if (tint) mesh.setColorAt(index, tint);
    }
    if (tint) this.tinted = true;
    this.count += 1;
    return index;
  }

  end(): void {
    for (const mesh of this.meshes) {
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;
      if (this.tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private allocate(capacity: number): void {
    const old = this.meshes;
    this.meshes = this.parts.map((part, index) => {
      const mesh = new InstancedMesh(part.geometry, part.material, capacity);
      // Instances move every frame; a stale bounding sphere would cull them wrongly.
      mesh.frustumCulled = false;
      mesh.castShadow = (this.options.castShadow ?? true) && !part.material.transparent;
      mesh.receiveShadow = this.options.receiveShadow ?? true;
      mesh.count = this.count;
      const previous = old[index];
      if (previous) {
        mesh.instanceMatrix.array.set(previous.instanceMatrix.array);
        if (previous.instanceColor) {
          mesh.setColorAt(0, WHITE);
          mesh.instanceColor!.array.set(previous.instanceColor.array);
        }
      }
      return mesh;
    });
    for (const mesh of old) {
      this.group.remove(mesh);
      mesh.dispose();
    }
    for (const mesh of this.meshes) this.group.add(mesh);
    this.capacity = capacity;
  }

  /** Frees the merged geometries and GPU buffers. Materials are shared and stay alive. */
  dispose(): void {
    for (const mesh of this.meshes) {
      this.group.remove(mesh);
      mesh.dispose();
    }
    for (const part of this.parts) part.geometry.dispose();
    this.meshes = [];
  }
}

const WHITE = new Color(1, 1, 1);

/** Merges all meshes of a model into one world-space geometry per material. */
export function extractParts(prototype: Object3D): Part[] {
  prototype.updateMatrixWorld(true);
  const byMaterial = new Map<Material, BufferGeometry[]>();
  prototype.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    const source = mesh.geometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    // Keep only what every primitive has, so the merge never fails on mismatched attributes.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    if (!geometry.getAttribute('uv')) {
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    geometry.morphAttributes = {};
    geometry.applyMatrix4(mesh.matrixWorld);
    const list = byMaterial.get(material) ?? [];
    list.push(geometry);
    byMaterial.set(material, list);
  });
  const parts: Part[] = [];
  for (const [material, geometries] of byMaterial) {
    const merged = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
    if (!merged) continue;
    if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
    merged.computeBoundingSphere();
    parts.push({ geometry: merged, material });
  }
  return parts;
}
