import { Group, type Object3D } from 'three';
import type { Kit } from './models/kit';

/**
 * Builds one copy of a model. The result may be any Object3D tree (meshes
 * built from primitives now, a cloned glTF scene later).
 *
 * Conventions every model follows:
 * - Origin on the ground at the centre of the footprint, +y up.
 * - Front is +z (a vehicle drives towards +z, a building's dock faces +z).
 * - Optional `userData.anchors` (see `Anchors` in models/kit.ts) names points
 *   the view places things at, e.g. `inputs`, `outputs`, `waste`, `smoke`,
 *   `forklift`, `cargo`, `piles`.
 */
export type ModelFactory = (kit: Kit) => Object3D;

/**
 * Name -> model factory. The view never builds geometry itself; it asks the
 * registry by name, so replacing a registered factory restyles the whole
 * game. To use a loaded model file, load it first and then register
 * `() => loadedScene.clone(true)` under the same name: registering notifies
 * the view, which rebuilds everything that uses that name.
 */
export class ModelRegistry {
  private readonly factories = new Map<string, ModelFactory>();
  private readonly listeners = new Set<(name: string) => void>();

  constructor(private readonly kit: Kit) {}

  register(name: string, factory: ModelFactory): void {
    this.factories.set(name, factory);
    for (const listener of this.listeners) listener(name);
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  /** The factory registered under exactly this name. */
  get(name: string): ModelFactory | undefined {
    return this.factories.get(name);
  }

  names(): string[] {
    return [...this.factories.keys()];
  }

  /**
   * Builds the model registered as `name`. Unknown names fall back to
   * `<prefix>.default` (e.g. `building.default`), then to an empty group, so
   * new content never crashes the view.
   */
  create(name: string): Object3D {
    const factory = this.factories.get(name) ?? this.factories.get(fallbackName(name));
    return factory ? factory(this.kit) : new Group();
  }

  /** Calls `listener` with the name whenever a factory is (re)registered. Returns an unsubscribe function. */
  onChange(listener: (name: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** `building.sawmill` -> `building.default`. */
export function fallbackName(name: string): string {
  const dot = name.indexOf('.');
  return `${dot < 0 ? name : name.slice(0, dot)}.default`;
}
