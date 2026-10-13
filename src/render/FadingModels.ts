import { Group, Mesh, MeshBasicMaterial, type Material, type Matrix4 } from 'three';
import { extractParts, type Part } from './InstancedModel';
import type { ModelRegistry } from './ModelRegistry';

interface Layer {
  source: Material;
  material: Material;
  mesh: Mesh;
}

interface Ghost {
  holder: Group;
  layers: Layer[];
  used: boolean;
}

/**
 * Draws models that are fading in or out. Instanced copies share their
 * materials, so a copy cannot be see-through on its own; while a model fades
 * it is drawn here instead, as an object with materials of its own.
 *
 * Each copy is drawn twice: first only into the depth buffer, then in colour.
 * That way only its outer surface shows, and the far side and the inside of
 * the model do not shine through.
 *
 * Usage is immediate-mode, like InstancedModel: `begin()`, `show(...)` for
 * every fading copy this frame, `end()`.
 */
export class FadingModels {
  readonly group = new Group();
  private readonly parts = new Map<string, Part[]>();
  private readonly ghosts = new Map<string, Ghost>();
  private readonly depthOnly = new MeshBasicMaterial({ colorWrite: false, transparent: true });

  constructor(private readonly registry: ModelRegistry) {}

  begin(): void {
    for (const ghost of this.ghosts.values()) ghost.used = false;
  }

  /** Draws the copy `id` of model `name` at `matrix`, `opacity` (0..1) of the way to solid. */
  show(id: string, name: string, matrix: Matrix4, opacity: number): void {
    const key = `${id}|${name}`;
    let ghost = this.ghosts.get(key);
    if (!ghost) {
      ghost = this.create(name);
      this.ghosts.set(key, ghost);
      this.group.add(ghost.holder);
    }
    ghost.used = true;
    matrix.decompose(ghost.holder.position, ghost.holder.quaternion, ghost.holder.scale);
    for (const layer of ghost.layers) {
      layer.material.opacity = layer.source.opacity * opacity;
      // Lights that come on at night are driven on the shared material; follow it.
      const lit = layer.source as Material & { emissiveIntensity?: number };
      if (lit.emissiveIntensity !== undefined) (layer.material as typeof lit).emissiveIntensity = lit.emissiveIntensity;
      layer.mesh.castShadow = opacity > 0.5;
    }
  }

  end(): void {
    for (const [key, ghost] of this.ghosts) {
      if (ghost.used) continue;
      this.remove(ghost);
      this.ghosts.delete(key);
    }
  }

  clear(): void {
    for (const ghost of this.ghosts.values()) this.remove(ghost);
    this.ghosts.clear();
    for (const parts of this.parts.values()) for (const part of parts) part.geometry.dispose();
    this.parts.clear();
  }

  dispose(): void {
    this.clear();
    this.depthOnly.dispose();
  }

  private create(name: string): Ghost {
    let parts = this.parts.get(name);
    if (!parts) {
      parts = extractParts(this.registry.create(name));
      this.parts.set(name, parts);
    }
    const holder = new Group();
    const layers: Layer[] = [];
    for (const part of parts) {
      const depth = new Mesh(part.geometry, this.depthOnly);
      depth.renderOrder = 1;
      const material = part.material.clone();
      material.transparent = true;
      const mesh = new Mesh(part.geometry, material);
      mesh.renderOrder = 2;
      mesh.receiveShadow = true;
      holder.add(depth, mesh);
      layers.push({ source: part.material, material, mesh });
    }
    return { holder, layers, used: true };
  }

  private remove(ghost: Ghost): void {
    this.group.remove(ghost.holder);
    for (const layer of ghost.layers) layer.material.dispose();
  }
}
