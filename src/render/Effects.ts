import { Group, Matrix4, Quaternion, Vector3, type Camera } from 'three';
import type { BigNum } from '@/core/BigNum';
import { formatNumber } from '@/core/format';
import { renderConfig } from './config';
import { InstancedModel } from './InstancedModel';
import { smoothstep } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { COIN_MODEL, SPARK_MODEL } from './models/effects';
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
}

interface Label {
  el: HTMLElement;
  x: number;
  y: number;
  z: number;
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
  private readonly instanced = new Map<string, InstancedModel>();
  private readonly earnings = new Map<string, Earning>();
  /** Seconds since each source's last upgrade effect. */
  private readonly upgraded = new Map<string, number>();
  private sinceUpgrade = Infinity;
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
      // Pops in quickly, shrinks away over the last third.
      const size = p.size * smoothstep(t * 6) * (1 - smoothstep((t - 0.65) / 0.35));
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
    this.particles.length = 0;
    for (const label of this.labels) label.el.remove();
    this.labels.length = 0;
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
