/**
 * The light a street lamp throws at night: a faint cone from its head down to
 * the ground and a pool of light where it lands. All lamps share one instanced
 * mesh that fades in as night falls.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  type Matrix4,
} from 'three';

export interface LampLightShape {
  /** Where the lamp's head is, in the lamp model's frame. */
  head: readonly [x: number, y: number, z: number];
  /** Radius of the cone at the head and on the ground. */
  topRadius: number;
  radius: number;
  /** Height of the pool of light, in the lamp model's frame. */
  ground: number;
  /** How strong the cone is at the head, next to 1 for the middle of the pool. */
  coneAlpha: number;
}

/** The cone (open, fading towards the ground) and the pool (fading towards its edge), in the lamp model's frame. */
export function lampLightGeometry(shape: LampLightShape, segments = 24): BufferGeometry {
  const [hx, hy, hz] = shape.head;
  const positions: number[] = [];
  const colors: number[] = [];
  const point = (radius: number, y: number, step: number, alpha: number): void => {
    const angle = (step / segments) * Math.PI * 2;
    positions.push(hx + Math.sin(angle) * radius, y, hz + Math.cos(angle) * radius);
    colors.push(1, 1, 1, alpha);
  };
  for (let step = 0; step < segments; step += 1) {
    // Side of the cone.
    point(shape.topRadius, hy, step, shape.coneAlpha);
    point(shape.radius, shape.ground, step, 0);
    point(shape.radius, shape.ground, step + 1, 0);
    point(shape.topRadius, hy, step, shape.coneAlpha);
    point(shape.radius, shape.ground, step + 1, 0);
    point(shape.topRadius, hy, step + 1, shape.coneAlpha);
    // Pool on the ground: bright in the middle, gone at the edge.
    point(0, shape.ground, step, 1);
    point(shape.radius * 0.45, shape.ground, step, 0.55);
    point(shape.radius * 0.45, shape.ground, step + 1, 0.55);
    point(shape.radius * 0.45, shape.ground, step, 0.55);
    point(shape.radius, shape.ground, step, 0);
    point(shape.radius, shape.ground, step + 1, 0);
    point(shape.radius * 0.45, shape.ground, step, 0.55);
    point(shape.radius, shape.ground, step + 1, 0);
    point(shape.radius * 0.45, shape.ground, step + 1, 0.55);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
  return geometry;
}

export class LampLights {
  readonly mesh: InstancedMesh;
  private readonly material: MeshBasicMaterial;

  constructor(
    shape: LampLightShape,
    color: number,
    private readonly opacity: number,
    lamps: ReadonlyArray<Matrix4>,
  ) {
    this.material = new MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      fog: false,
    });
    this.mesh = new InstancedMesh(lampLightGeometry(shape), this.material, Math.max(1, lamps.length));
    lamps.forEach((matrix, index) => this.mesh.setMatrixAt(index, matrix));
    this.mesh.count = lamps.length;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
  }

  /** `on` is 0 by day and 1 once the lamps are fully lit. */
  setOn(on: number): void {
    this.material.opacity = this.opacity * on;
    this.mesh.visible = on > 0.01;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
