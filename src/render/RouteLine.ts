import { BufferAttribute, BufferGeometry, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three';

/**
 * The rest of a selected vehicle's way, drawn as a flat band along the points
 * it will pass, with a disc where it ends. One flat colour that keeps its
 * brightness at night.
 */
export class RouteLine {
  readonly group = new Group();
  private readonly band: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly end: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly positions: Float32Array;

  constructor(
    color: number,
    private readonly max: number,
    private readonly width: number,
    endRadius: number,
    private readonly height: number,
  ) {
    const material = new MeshBasicMaterial({ color, toneMapped: false, fog: false, side: DoubleSide });
    this.positions = new Float32Array(max * 2 * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    const index: number[] = [];
    for (let i = 0; i < max - 1; i += 1) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    geometry.setIndex(index);
    this.band = new Mesh(geometry, material);
    this.band.frustumCulled = false;
    this.end = new Mesh(new CircleGeometry(endRadius, 24).rotateX(-Math.PI / 2), material);
    this.group.add(this.band, this.end);
    this.group.visible = false;
  }

  hide(): void {
    this.group.visible = false;
  }

  /** Draws the band through `points` (on the ground, in order). Needs two points or more. */
  show(points: ReadonlyArray<{ x: number; z: number }>): void {
    const count = Math.min(points.length, this.max);
    if (count < 2) {
      this.hide();
      return;
    }
    const half = this.width / 2;
    for (let i = 0; i < count; i += 1) {
      const before = points[Math.max(0, i - 1)]!;
      const after = points[Math.min(count - 1, i + 1)]!;
      const dx = after.x - before.x;
      const dz = after.z - before.z;
      const length = Math.hypot(dx, dz) || 1;
      const sideX = (dz / length) * half;
      const sideZ = (-dx / length) * half;
      const point = points[i]!;
      this.positions.set([point.x + sideX, this.height, point.z + sideZ, point.x - sideX, this.height, point.z - sideZ], i * 6);
    }
    const geometry = this.band.geometry;
    geometry.getAttribute('position').needsUpdate = true;
    geometry.setDrawRange(0, (count - 1) * 6);
    const last = points[count - 1]!;
    this.end.position.set(last.x, this.height + 0.01, last.z);
    this.group.visible = true;
  }

  dispose(): void {
    this.band.geometry.dispose();
    this.end.geometry.dispose();
    this.band.material.dispose();
  }
}
