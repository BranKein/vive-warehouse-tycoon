import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3, type Camera } from 'three';
import type { BigNum } from '@/core/BigNum';
import { formatNumber } from '@/core/format';
import { renderConfig } from './config';
import { InstancedModel } from './InstancedModel';
import { smoothstep } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { COIN_MODEL, SMOKE_MODEL, SPARK_MODEL } from './models/effects';
import type { Theme } from './theme';

interface Particle {
  model: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  size: number;
  spin: number;
  angle: number;
  age: number;
  life: number;
  /** Swells to this many times its size over its life instead of popping in (smoke). */
  grow?: number;
}

interface Label {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
  age: number;
}

/** A ring of light spreading over the ground under something that was just upgraded. */
interface Glow {
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  age: number;
}

/** A sale that is waiting for its facility's turn to show an effect; money earned meanwhile adds up. */
interface Earning {
  x: number;
  z: number;
  /** Seconds since the facility last showed an effect. */
  quiet: number;
  amount: BigNum | null;
}

const UP = new Vector3(0, 1, 0);
const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Short-lived decoration on top of the scene: sparks over an upgraded
 * building, coins and a floating amount over a facility that sold goods.
 * It only draws; nothing here feeds back into the game. Every source has a
 * minimum time between two effects, so auto mode buying several upgrades a
 * second, or a burst of sales, never turns into a flicker.
 */
export class Effects {
  readonly group = new Group();
  private readonly particles: Particle[] = [];
  private readonly labels: Label[] = [];
  private readonly glows: Glow[] = [];
  private glowGeometry: BufferGeometry | null = null;
  private readonly instanced = new Map<string, InstancedModel>();
  private readonly earnings = new Map<string, Earning>();
  /** Seconds since each source's last upgrade effect. */
  private readonly upgraded = new Map<string, number>();
  private sinceUpgrade = Infinity;
  /** Seconds until each chimney's next puff. */
  private readonly puffs = new Map<string, number>();
  private readonly layer: HTMLElement | null;

  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly theme: Theme,
    private readonly canvas: HTMLCanvasElement,
  ) {
    // Floating amounts are plain text over the canvas, under the game's panels.
    this.layer = typeof document === 'undefined' ? null : document.createElement('div');
    if (this.layer) {
      this.layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;';
      canvas.after(this.layer);
    }
  }

  /**
   * Sparks rising around a building or facility `height` tall that was just
   * upgraded. Returns false when it was skipped because the last one is too recent.
   */
  upgrade(key: string, at: { x: number; z: number }, height: number): boolean {
    const rule = renderConfig.effects.upgrade;
    if (this.sinceUpgrade < rule.minGapSec || (this.upgraded.get(key) ?? Infinity) < rule.minGapPerTargetSec) return false;
    this.sinceUpgrade = 0;
    this.upgraded.set(key, 0);
    this.glow(at.x, at.z);
    for (let index = 0; index < rule.sparks; index += 1) {
      const angle = (index / rule.sparks) * Math.PI * 2 + Math.random();
      const radius = rule.radius * (0.7 + Math.random() * 0.5);
      this.spawn({
        model: SPARK_MODEL,
        x: at.x + Math.sin(angle) * radius,
        y: height * (0.25 + Math.random() * 0.5),
        z: at.z + Math.cos(angle) * radius,
        vx: 0,
        vy: rule.rise * (0.8 + Math.random() * 0.5),
        vz: 0,
        gravity: 0,
        size: rule.size * (0.8 + Math.random() * 0.5),
        spin: 3 + Math.random() * 3,
        angle,
        age: -Math.random() * 0.15,
        life: rule.lifeSec,
      });
    }
    return true;
  }

  /** Money earned by a facility. Shown at once, or added to what its next effect shows. */
  sale(key: string, at: { x: number; z: number }, amount: BigNum): void {
    const earning = this.earnings.get(key) ?? { x: at.x, z: at.z, quiet: Infinity, amount: null };
    earning.x = at.x;
    earning.z = at.z;
    earning.amount = earning.amount ? earning.amount.add(amount) : amount;
    this.earnings.set(key, earning);
  }

  /** Chimneys smoking this frame, in the world. Each puffs now and then while it is listed. */
  smoke(chimneys: ReadonlyArray<{ key: string; x: number; y: number; z: number }>, dt: number): void {
    const rule = renderConfig.effects.smoke;
    const listed = new Set<string>();
    for (const chimney of chimneys) {
      listed.add(chimney.key);
      // A chimney that just started waits a random part of the gap, so neighbours do not puff together.
      const left = (this.puffs.get(chimney.key) ?? Math.random() * rule.everySec) - dt;
      if (left > 0) {
        this.puffs.set(chimney.key, left);
        continue;
      }
      this.puffs.set(chimney.key, rule.everySec * (1 + (Math.random() * 2 - 1) * rule.jitter));
      if (this.particles.length >= renderConfig.effects.maxParticles * rule.share) continue;
      this.spawn({
        model: SMOKE_MODEL,
        x: chimney.x,
        y: chimney.y,
        z: chimney.z,
        vx: rule.wind.x * (0.8 + Math.random() * 0.4),
        vy: rule.rise * (0.85 + Math.random() * 0.3),
        vz: rule.wind.z * (0.8 + Math.random() * 0.4),
        gravity: 0,
        size: rule.size * (0.85 + Math.random() * 0.3),
        spin: (Math.random() - 0.5) * 0.8,
        angle: Math.random() * Math.PI * 2,
        age: 0,
        life: rule.lifeSec,
        grow: rule.grow,
      });
    }
    for (const key of this.puffs.keys()) if (!listed.has(key)) this.puffs.delete(key);
  }

  update(dt: number, camera: Camera): void {
    this.sinceUpgrade += dt;
    for (const [key, quiet] of this.upgraded) this.upgraded.set(key, quiet + dt);
    for (const earning of this.earnings.values()) {
      earning.quiet += dt;
      if (earning.amount && earning.quiet >= renderConfig.effects.sale.minGapSec) {
        this.burst(earning.x, earning.z, earning.amount);
        earning.amount = null;
        earning.quiet = 0;
      }
    }

    const glowRule = renderConfig.effects.upgrade.glow;
    for (let index = this.glows.length - 1; index >= 0; index -= 1) {
      const glow = this.glows[index]!;
      glow.age += dt;
      const t = glow.age / glowRule.lifeSec;
      if (t >= 1) {
        this.group.remove(glow.mesh);
        glow.mesh.material.dispose();
        this.glows.splice(index, 1);
        continue;
      }
      // Spreads out quickly and slows down; lights up at once and dims over the rest of its life.
      const size = glowRule.radius * (glowRule.startSize + (1 - glowRule.startSize) * (1 - (1 - t) * (1 - t)));
      glow.mesh.scale.set(size, 1, size);
      glow.mesh.material.opacity = glowRule.opacity * smoothstep(t * 8) * (1 - smoothstep((t - 0.25) / 0.75));
    }

    for (const model of this.instanced.values()) model.begin();
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const p = this.particles[index]!;
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(index, 1);
        continue;
      }
      if (p.age < 0) continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.angle += p.spin * dt;
      const t = p.age / p.life;
      // Pops in quickly, shrinks away over the last third. Smoke swells as it goes, and leaves more slowly.
      const size = p.grow
        ? p.size * (1 + (p.grow - 1) * t) * smoothstep(t * 4) * (1 - smoothstep((t - 0.5) / 0.5))
        : p.size * smoothstep(t * 6) * (1 - smoothstep((t - 0.65) / 0.35));
      this.position.set(p.x, p.y, p.z);
      this.rotation.setFromAxisAngle(UP, p.angle);
      this.scale.set(size, size, size);
      this.model(p.model).add(this.matrix.compose(this.position, this.rotation, this.scale));
    }
    for (const model of this.instanced.values()) model.end();

    const rule = renderConfig.effects.sale;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    for (let index = this.labels.length - 1; index >= 0; index -= 1) {
      const label = this.labels[index]!;
      label.age += dt;
      const t = label.age / rule.labelSec;
      if (t >= 1) {
        label.el.remove();
        this.labels.splice(index, 1);
        continue;
      }
      this.position.set(label.x, label.y + rule.labelRise * smoothstep(t), label.z).project(camera);
      const visible = this.position.z < 1 && Math.abs(this.position.x) < 1.2 && Math.abs(this.position.y) < 1.2;
      label.el.style.opacity = visible ? String(1 - smoothstep((t - 0.6) / 0.4)) : '0';
      const left = (this.position.x * 0.5 + 0.5) * width;
      const top = (-this.position.y * 0.5 + 0.5) * height;
      label.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  /** Drops everything on screen and forgets what was pending. */
  clear(): void {
    this.puffs.clear();
    this.particles.length = 0;
    for (const label of this.labels) label.el.remove();
    this.labels.length = 0;
    for (const glow of this.glows) {
      this.group.remove(glow.mesh);
      glow.mesh.material.dispose();
    }
    this.glows.length = 0;
    this.earnings.clear();
    this.upgraded.clear();
    for (const model of this.instanced.values()) {
      this.group.remove(model.group);
      model.dispose();
    }
    this.instanced.clear();
  }

  dispose(): void {
    this.clear();
    this.glowGeometry?.dispose();
    this.glowGeometry = null;
    this.layer?.remove();
  }

  /** Coins jumping out of a facility, and the amount floating up above them. */
  private burst(x: number, z: number, amount: BigNum): void {
    const rule = renderConfig.effects.sale;
    for (let index = 0; index < rule.coins; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const out = rule.spread * (0.4 + Math.random() * 0.6);
      this.spawn({
        model: COIN_MODEL,
        x,
        y: rule.height,
        z,
        vx: Math.sin(angle) * out,
        vy: rule.jump * (0.8 + Math.random() * 0.4),
        vz: Math.cos(angle) * out,
        gravity: rule.gravity,
        size: rule.coinSize,
        spin: 8 + Math.random() * 6,
        angle,
        age: -index * 0.04,
        life: rule.coinSec,
      });
    }
    if (!this.layer || this.labels.length >= rule.maxLabels) return;
    const el = document.createElement('div');
    el.textContent = `+${formatNumber(amount)}`;
    const glow = hex(this.theme.effects.specialGlow);
    el.style.cssText =
      'position:absolute;left:0;top:0;white-space:nowrap;font-weight:800;font-size:18px;line-height:1;will-change:transform,opacity;' +
      `color:${rule.labelColor};text-shadow:0 0 3px ${glow},0 0 3px ${glow},0 1px 0 #fff;opacity:0;`;
    this.layer.append(el);
    this.labels.push({ el, x, y: rule.height + 2.5, z, age: 0 });
  }

  /** A soft ring of light on the ground around (x, z). */
  private glow(x: number, z: number): void {
    const rule = renderConfig.effects.upgrade.glow;
    this.glowGeometry ??= glowRingGeometry();
    // Each ring fades on its own, so each has a material of its own.
    const material = new MeshBasicMaterial({
      color: this.theme.effects.upgradeGlow,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
    const mesh = new Mesh(this.glowGeometry, material);
    mesh.position.set(x, rule.height, z);
    mesh.renderOrder = 1;
    this.group.add(mesh);
    this.glows.push({ mesh, age: 0 });
  }

  private spawn(particle: Particle): void {
    if (this.particles.length < renderConfig.effects.maxParticles) this.particles.push(particle);
  }

  private model(name: string): InstancedModel {
    let model = this.instanced.get(name);
    if (!model) {
      model = new InstancedModel(this.registry.create(name), 32, { castShadow: false, receiveShadow: false });
      model.begin();
      this.instanced.set(name, model);
      this.group.add(model.group);
    }
    return model;
  }
}

/**
 * Flat disc one unit in radius, lying on y = 0. Its opacity is painted on
 * the vertices: faint in the middle, brightest in a band towards the rim and
 * gone at the rim itself, so it reads as a soft ring of light.
 */
function glowRingGeometry(): BufferGeometry {
  const bands: ReadonlyArray<readonly [radius: number, alpha: number]> = [
    [0, 0.2],
    [0.5, 0.3],
    [0.8, 1],
    [1, 0],
  ];
  const segments = 48;
  const positions: number[] = [];
  const colors: number[] = [];
  const corner = (band: number, step: number): void => {
    const [radius, alpha] = bands[band]!;
    const angle = (step / segments) * Math.PI * 2;
    positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    colors.push(1, 1, 1, alpha);
  };
  for (let band = 1; band < bands.length; band += 1) {
    for (let step = 0; step < segments; step += 1) {
      corner(band - 1, step);
      corner(band, step);
      corner(band, step + 1);
      if (band === 1) continue;
      corner(band - 1, step);
      corner(band, step + 1);
      corner(band - 1, step + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
  return geometry;
}
