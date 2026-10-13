import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from 'three';
import type { IslandLayoutDef } from '@/contracts';
import { BLOCK_MODEL } from './boxModels';
import { renderConfig } from './config';
import { celestialState, dayPhase, lerpRgb, sampleDayNight, type Rgb } from './dayNight';
import { InstancedModel } from './InstancedModel';
import { roadStrips } from './layout';
import type { MaterialLibrary } from './materials';
import type { ModelRegistry } from './ModelRegistry';
import type { Theme } from './theme';

const UP = new Vector3(0, 1, 0);

/**
 * Everything that does not come from the snapshot: the grass, the board, the
 * roads and flat pads of an island layout, the sky colour and the two lights.
 * Deliberately plain; scenery is a later stage (PLAN.md 3.13).
 */
export class Environment {
  readonly group = new Group();
  private readonly sun = new DirectionalLight(0xffffff, 1);
  private readonly ambient = new HemisphereLight(0xffffff, 0xffffff, 1);
  private readonly background = new Color();
  private readonly fog: Fog;
  private readonly ground: Mesh;
  private flats: InstancedModel | null = null;
  private layout: IslandLayoutDef | null = null;
  private centre = new Vector3();
  private lightDistance = 300;

  constructor(
    private readonly scene: Scene,
    private readonly registry: ModelRegistry,
    private readonly theme: Theme,
    materials: MaterialLibrary,
  ) {
    const g = renderConfig.boxes.ground;
    this.ground = new Mesh(new PlaneGeometry(g.extent * 2, g.extent * 2), materials.solid(theme.ground.grass));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -g.boardThickness;
    this.ground.receiveShadow = true;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(renderConfig.shadow.mapSize, renderConfig.shadow.mapSize);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;

    this.fog = new Fog(0xffffff, theme.sky.fogNear, theme.sky.fogFar);
    scene.fog = this.fog;
    scene.background = this.background;
    this.group.add(this.ground, this.sun, this.sun.target, this.ambient);
    scene.add(this.group);
  }

  /** Rebuilds the board, roads and pads for an island (null clears them). */
  setLayout(layout: IslandLayoutDef | null): void {
    this.layout = layout;
    this.rebuild();
  }

  /** Call when the block model was re-registered. */
  rebuild(): void {
    if (this.flats) {
      this.group.remove(this.flats.group);
      this.flats.dispose();
      this.flats = null;
    }
    const layout = this.layout;
    if (!layout) return;
    const g = renderConfig.boxes.ground;
    const colors = this.theme.ground;
    const b = layout.bounds;
    this.centre.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    this.ground.position.set(this.centre.x, -g.boardThickness, this.centre.z);

    const flats = new InstancedModel(this.registry.create(BLOCK_MODEL), 128, { castShadow: false });
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const tint = new Color();
    const add = (x: number, y: number, z: number, w: number, h: number, d: number, heading: number, color: number): void => {
      position.set(x, y, z);
      rotation.setFromAxisAngle(UP, heading);
      scale.set(w, h, d);
      flats.add(matrix.compose(position, rotation, scale), tint.setHex(color));
    };
    const rect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, h: number, color: number): void =>
      add((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2, r.maxX - r.minX, h, r.maxZ - r.minZ, 0, color);

    flats.begin();
    add(this.centre.x, -g.boardThickness, this.centre.z, b.maxX - b.minX, g.boardThickness, b.maxZ - b.minZ, 0, colors.board);
    rect(layout.river, g.padHeight, colors.water);
    rect(layout.runway, g.padHeight, colors.runway);
    for (const plot of layout.plots) {
      const w = layout.plotSize.width - g.plotInset * 2;
      const d = layout.plotSize.depth - g.plotInset * 2;
      add(plot.x, 0, plot.z, w, g.padHeight, d, plot.facing, colors.plotPad);
    }
    for (const facility of layout.facilities) {
      add(facility.x, 0, facility.z, g.facilityPad[0], g.padHeight, g.facilityPad[1], facility.facing, colors.yardPad);
    }
    for (const strip of roadStrips(layout.roadNodes, layout.roadEdges)) {
      add(strip.x, 0, strip.z, layout.roadWidth, g.roadHeight, strip.length, strip.heading, colors.road);
    }
    // A square on every node closes the corners and caps the dead ends.
    for (const node of layout.roadNodes) add(node.x, 0, node.z, layout.roadWidth, g.roadHeight, layout.roadWidth, 0, colors.road);
    flats.end();
    this.flats = flats;
    this.group.add(flats.group);

    // One shadow map covers the whole board.
    const half = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + renderConfig.shadow.margin;
    this.lightDistance = half * 2;
    const camera = this.sun.shadow.camera;
    camera.left = -half;
    camera.right = half;
    camera.top = half;
    camera.bottom = -half;
    camera.near = 1;
    camera.far = half * 4;
    camera.updateProjectionMatrix();
    this.sun.target.position.copy(this.centre);
  }

  /** Moves the light and recolours the sky for the given real time. The cycle is visual only. */
  update(realTimeSec: number): void {
    const settings = this.theme.dayNight;
    const phase = dayPhase(realTimeSec, settings);
    const sample = sampleDayNight(settings.keyframes, phase);
    const sky = celestialState(phase, settings);
    this.sun.position.set(
      this.centre.x + sky.light.x * this.lightDistance,
      sky.light.y * this.lightDistance,
      this.centre.z + sky.light.z * this.lightDistance,
    );
    setRgb(this.sun.color, sample.light);
    this.sun.intensity = sample.lightIntensity;
    setRgb(this.ambient.color, sample.ambientSky);
    setRgb(this.ambient.groundColor, sample.ambientGround);
    this.ambient.intensity = sample.ambientIntensity;
    setRgb(this.background, lerpRgb(sample.skyHorizon, sample.skyTop, 0.5));
    setRgb(this.fog.color, sample.fog);
  }

  dispose(): void {
    this.flats?.dispose();
    this.flats = null;
    this.ground.geometry.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.remove(this.group);
    this.scene.fog = null;
    this.scene.background = null;
  }
}

const setRgb = (color: Color, rgb: Rgb): Color => color.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
