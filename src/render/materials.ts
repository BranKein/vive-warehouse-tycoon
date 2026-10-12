import { AdditiveBlending, Color, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import type { Theme } from './theme';

/**
 * Shared materials. Every solid colour maps to exactly one material, so
 * models that use the same colour batch together, and the few glowing
 * materials can be driven by the day/night cycle from one place.
 */
export class MaterialLibrary {
  private readonly solids = new Map<number, MeshStandardMaterial>();
  private readonly extras: Material[] = [];
  /** Windows: pale glass by day, warm light at night. */
  readonly window: MeshStandardMaterial;
  /** Street lamp bulbs. */
  readonly lamp: MeshStandardMaterial;
  /** Vehicle headlights. */
  readonly headlight: MeshStandardMaterial;
  /** White base that is tinted per instance (crates). */
  readonly tintable: MeshStandardMaterial;
  readonly tintableDark: MeshStandardMaterial;

  constructor(readonly theme: Theme) {
    const surface = theme.surface;
    this.window = new MeshStandardMaterial({
      color: theme.glow.windowDay,
      emissive: theme.glow.windowNight,
      emissiveIntensity: 0,
      roughness: 0.5,
      metalness: 0,
    });
    this.lamp = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: theme.glow.lamp,
      emissiveIntensity: 0,
      roughness: 0.6,
    });
    this.headlight = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: theme.glow.headlight,
      emissiveIntensity: 0,
      roughness: 0.6,
    });
    this.tintable = new MeshStandardMaterial({ color: 0xffffff, roughness: surface.roughness, metalness: surface.metalness });
    this.tintableDark = new MeshStandardMaterial({ color: 0xd9d2cc, roughness: surface.roughness, metalness: surface.metalness });
    this.extras.push(this.window, this.lamp, this.headlight, this.tintable, this.tintableDark);
  }

  /** The one matte, clay-like material for a colour. */
  solid(color: number): MeshStandardMaterial {
    let material = this.solids.get(color);
    if (!material) {
      material = new MeshStandardMaterial({
        color,
        roughness: this.theme.surface.roughness,
        metalness: this.theme.surface.metalness,
      });
      this.solids.set(color, material);
    }
    return material;
  }

  /** Unlit, optionally see-through material for effects. Not cached: the caller owns its opacity. */
  effect(color: number, opacity = 1, additive = false): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: !(opacity < 1 || additive),
      fog: !additive,
    });
    if (additive) material.blending = AdditiveBlending;
    this.extras.push(material);
    return material;
  }

  /** `night` is 0 by day and 1 at night. */
  setNight(night: number): void {
    const glow = this.theme.glow;
    // Lights come on a little before it is fully dark.
    const on = Math.min(1, Math.max(0, (night - 0.2) / 0.5));
    this.window.emissiveIntensity = on * glow.windowIntensity;
    this.lamp.emissiveIntensity = on * glow.lampIntensity;
    this.headlight.emissiveIntensity = on * glow.lampIntensity;
  }

  dispose(): void {
    for (const material of this.solids.values()) material.dispose();
    for (const material of this.extras) material.dispose();
    this.solids.clear();
    this.extras.length = 0;
  }
}
