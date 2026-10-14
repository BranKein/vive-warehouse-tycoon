import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';

/** Where and how big the box is: centre on the ground, turn about the vertical, half sizes, bottom height. */
export interface BoxFrame {
  x: number;
  z: number;
  yaw: number;
  bottom: number;
  hx: number;
  hy: number;
  hz: number;
}

export interface SelectionBoxRule {
  /** Length of each bracket arm, as a share of its edge, and at most `maxArm`. */
  arm: number;
  maxArm: number;
  /** Thickness of the bars. */
  thickness: number;
  /** Space left between the box and what it marks. */
  margin: number;
  /** The box breathes in and out by this share of its size, this many times a second. */
  pulse: number;
  pulseHz: number;
}

/**
 * The mark round whatever is selected: the corners of a box round it, each a
 * bracket of three short bars along its edges. Drawn on top of the scene so it
 * shows through roofs, in one flat colour that keeps its brightness at night.
 */
export class SelectionBox {
  readonly group = new Group();
  private readonly bars: Mesh[] = [];
  private time = 0;

  constructor(color: number, private readonly rule: SelectionBoxRule) {
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color, toneMapped: false, fog: false, depthTest: false, transparent: true, opacity: 0.95 });
    for (let index = 0; index < 24; index += 1) {
      const bar = new Mesh(geometry, material);
      bar.renderOrder = 10;
      this.bars.push(bar);
      this.group.add(bar);
    }
    this.group.visible = false;
  }

  hide(): void {
    this.group.visible = false;
  }

  show(frame: BoxFrame, dt: number): void {
    const rule = this.rule;
    this.time += dt;
    const grow = 1 + rule.pulse * Math.sin(this.time * Math.PI * 2 * rule.pulseHz);
    const half = [frame.hx, frame.hy, frame.hz].map((h) => (h + rule.margin) * grow) as [number, number, number];
    const t = rule.thickness;
    this.group.visible = true;
    this.group.position.set(frame.x, frame.bottom + frame.hy, frame.z);
    this.group.rotation.set(0, frame.yaw, 0);
    let index = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const corner = [sx * half[0], sy * half[1], sz * half[2]];
          // One bar along each axis, running in from the corner.
          for (let axis = 0; axis < 3; axis += 1) {
            const length = Math.min(rule.maxArm, 2 * half[axis]! * rule.arm) + t;
            const bar = this.bars[index++]!;
            const sign = [sx, sy, sz][axis]!;
            const position = [...corner] as [number, number, number];
            position[axis] = corner[axis]! - sign * (length / 2 - t / 2);
            bar.position.set(position[0], position[1], position[2]);
            bar.scale.set(axis === 0 ? length : t, axis === 1 ? length : t, axis === 2 ? length : t);
          }
        }
      }
    }
  }

  dispose(): void {
    this.bars[0]?.geometry.dispose();
    (this.bars[0]?.material as MeshBasicMaterial | undefined)?.dispose();
  }
}
