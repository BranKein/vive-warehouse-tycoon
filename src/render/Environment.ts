import {
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Shape,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from 'three';
import type { IslandLayoutDef } from '@/contracts';
import { BLOCK_MODEL } from './boxModels';
import { renderConfig } from './config';
import { celestialState, dayPhase, lerpRgb, sampleDayNight, type Rgb } from './dayNight';
import { InstancedModel } from './InstancedModel';
import { lampSpots, roadStrips, treeSpots, type PropSpot } from './layout';
import { HOUSE_MODEL, LAMP_MODEL, TREE_MODEL } from './models/props';
import { CLOUD_MODEL, HILL_MODEL } from './models/scenery';
import { gapTreeSpots, outskirts, type ScaledSpot } from './scenery';
import type { MaterialLibrary } from './materials';
import type { ModelRegistry } from './ModelRegistry';
import type { Theme } from './theme';

const UP = new Vector3(0, 1, 0);

/**
 * Everything that does not come from the snapshot: the grass, the board, the
 * roads and flat pads of an island layout, the street lamps and trees on it,
 * the countryside around it, the sky colour and the two lights.
 */
export class Environment {
  readonly group = new Group();
  private readonly sun = new DirectionalLight(0xffffff, 1);
  private readonly ambient = new HemisphereLight(0xffffff, 0xffffff, 1);
  private readonly background = new Color();
  private readonly fog: Fog;
  private readonly ground: Mesh;
  private flats: InstancedModel | null = null;
  /** Trees and street lamps standing on the board, and the countryside around it. */
  private props: InstancedModel[] = [];
  /** The board, its rim and the water: slabs with rounded corners, so each has a mesh of its own. */
  private slabs: Mesh[] = [];
  private layout: IslandLayoutDef | null = null;
  private centre = new Vector3();
  private lightDistance = 300;

  constructor(
    private readonly scene: Scene,
    private readonly registry: ModelRegistry,
    private readonly theme: Theme,
    private readonly materials: MaterialLibrary,
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
    for (const prop of this.props) {
      this.group.remove(prop.group);
      prop.dispose();
    }
    this.props = [];
    for (const slab of this.slabs) {
      this.group.remove(slab);
      slab.geometry.dispose();
    }
    this.slabs = [];
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
    const rect = (r: Area, h: number, color: number): void => {
      if (r.maxX > r.minX && r.maxZ > r.minZ) add((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2, r.maxX - r.minX, h, r.maxZ - r.minZ, 0, color);
    };

    // The board on a wider, lower rim; the river follows the board's rounded corners where it meets them.
    const [rimWidth, rimDrop] = g.rim;
    const R = g.cornerRadius;
    const slab = (area: Area, bottom: number, height: number, color: number, radii: CornerRadii): void => {
      const mesh = new Mesh(slabGeometry(area, height, radii), this.materials.solid(color));
      mesh.position.y = bottom;
      mesh.receiveShadow = true;
      this.slabs.push(mesh);
      this.group.add(mesh);
    };
    const grown = (area: Area, by: number): Area => ({ minX: area.minX - by, maxX: area.maxX + by, minZ: area.minZ - by, maxZ: area.maxZ + by });
    const all = (radius: number): CornerRadii => ({ nw: radius, ne: radius, se: radius, sw: radius });
    slab(grown(b, rimWidth / 2), -g.boardThickness, g.boardThickness - rimDrop, colors.boardRim, all(R + rimWidth / 2));
    slab(b, -g.boardThickness, g.boardThickness, colors.board, all(R));
    // A corner of the water is rounded only where it is a corner of the board too.
    const river = clip(layout.river, b);
    const waterCorners = (area: Area): CornerRadii => ({
      nw: area.minX <= b.minX && area.minZ <= b.minZ ? R : 0,
      ne: area.maxX >= b.maxX && area.minZ <= b.minZ ? R : 0,
      se: area.maxX >= b.maxX && area.maxZ >= b.maxZ ? R : 0,
      sw: area.minX <= b.minX && area.maxZ >= b.maxZ ? R : 0,
    });
    const deep = { ...river, minZ: river.minZ + (river.maxZ - river.minZ) * 0.45 };
    slab(river, 0, g.waterHeight, colors.water, waterCorners(river));
    slab(deep, 0, g.waterHeight + 0.008, colors.waterDeep, waterCorners(deep));

    flats.begin();
    rect({ ...river, minZ: river.minZ - 2.2, maxZ: river.minZ }, g.runwayHeight + 0.008, colors.sand);
    const runway = layout.runway;
    rect(runway, g.runwayHeight, colors.runway);
    const runwayZ = (runway.minZ + runway.maxZ) / 2;
    for (let x = runway.minX + 5; x < runway.maxX - 4; x += 9) add(x, 0, runwayZ, 4.5, g.runwayHeight + 0.012, 0.5, 0, colors.runwayMark);
    for (const plot of layout.plots) {
      const w = layout.plotSize.width - g.plotInset * 2;
      const d = layout.plotSize.depth - g.plotInset * 2;
      add(plot.x, 0, plot.z, w, g.padHeight, d, plot.facing, colors.plotPad);
    }
    for (const facility of layout.facilities) {
      add(facility.x, 0, facility.z, g.facilityPad[0], g.padHeight, g.facilityPad[1], facility.facing, colors.yardPad);
    }
    // Roads: a pale curb under each, the roadway on top, dashes down the middle.
    const strips = roadStrips(layout.roadNodes, layout.roadEdges);
    const curb = layout.roadWidth + g.curbWidth * 2;
    const [dashLength, dashWidth, dashStep] = g.dash;
    for (const strip of strips) {
      add(strip.x, 0, strip.z, curb, g.curbHeight, strip.length, strip.heading, colors.roadEdge);
      add(strip.x, 0, strip.z, layout.roadWidth, g.roadHeight, strip.length, strip.heading, colors.road);
      // Dashes stop short of both ends, where the crossings are.
      const run = strip.length - layout.roadWidth - dashLength;
      const count = Math.floor(run / dashStep);
      for (let i = 0; i <= count && run > 0; i += 1) {
        const along = (i - count / 2) * dashStep;
        add(strip.x + Math.sin(strip.heading) * along, 0, strip.z + Math.cos(strip.heading) * along, dashWidth, g.markHeight, dashLength, strip.heading, colors.roadMark);
      }
    }
    // A square on every node closes the corners and caps the dead ends.
    // Cut off at the edge of the board: the gate road ends there instead of sticking out.
    const square = (x: number, z: number, size: number): Area => clip({ minX: x - size / 2, maxX: x + size / 2, minZ: z - size / 2, maxZ: z + size / 2 }, b);
    for (const node of layout.roadNodes) {
      rect(square(node.x, node.z, curb), g.curbHeight, colors.roadEdge);
      rect(square(node.x, node.z, layout.roadWidth), g.roadHeight, colors.road);
    }
    // Beyond the board the river and the gate road run on over the grass, until the haze takes them.
    const runOn = renderConfig.scenery.outskirts.runOn;
    const low = -g.boardThickness;
    const outside = (area: Area, lift: number, color: number): void => {
      if (area.maxX > area.minX) add((area.minX + area.maxX) / 2, low, (area.minZ + area.maxZ) / 2, area.maxX - area.minX, lift, area.maxZ - area.minZ, 0, color);
    };
    const edge = rimWidth / 2;
    for (const [minX, maxX] of [[b.minX - runOn, b.minX - edge], [b.maxX + edge, b.maxX + runOn]] as const) {
      outside({ minX, maxX, minZ: river.minZ - 2.2, maxZ: river.maxZ + 2.2 }, 0.03, colors.sand);
      outside({ minX, maxX, minZ: river.minZ, maxZ: river.maxZ }, 0.05, colors.water);
      outside({ minX, maxX, minZ: deep.minZ, maxZ: river.maxZ - 1.5 }, 0.06, colors.waterDeep);
    }
    const gate = layout.roadNodes.find((node) => node.id === layout.roadGate);
    if (gate) {
      const lane = { minX: b.minX - runOn, maxX: b.minX - edge };
      outside({ ...lane, minZ: gate.z - curb / 2, maxZ: gate.z + curb / 2 }, 0.03, colors.roadEdge);
      outside({ ...lane, minZ: gate.z - layout.roadWidth / 2, maxZ: gate.z + layout.roadWidth / 2 }, 0.05, colors.road);
      for (let x = lane.maxX - dashStep; x > lane.maxX - 300; x -= dashStep) add(x, low, gate.z, dashLength, 0.06, dashWidth, 0, colors.roadMark);
    }
    flats.end();
    this.flats = flats;
    this.group.add(flats.group);

    // Street lamps along the roads and trees on the free ground.
    const scenery = renderConfig.scenery;
    const stand = (name: string, spots: ReadonlyArray<PropSpot & { scale?: number }>, y: number = g.padHeight, shadows = true): void => {
      if (spots.length === 0) return;
      const model = new InstancedModel(this.registry.create(name), spots.length, { castShadow: shadows, receiveShadow: shadows });
      model.begin();
      for (const spot of spots) {
        const size = spot.scale ?? 1;
        position.set(spot.x, y, spot.z);
        rotation.setFromAxisAngle(UP, spot.heading);
        scale.set(size, size, size);
        model.add(matrix.compose(position, rotation, scale));
      }
      model.end();
      this.props.push(model);
      this.group.add(model.group);
    };
    /** Stands spots that name a model variant, each kind as its own instanced model. */
    const standKinds = (name: (kind: number) => string, kinds: number, spots: ReadonlyArray<ScaledSpot>, y?: number, shadows?: boolean): void => {
      for (let kind = 0; kind < kinds; kind += 1) stand(name(kind), spots.filter((spot) => spot.kind % kinds === kind), y, shadows);
    };
    stand(LAMP_MODEL, lampSpots(layout.roadNodes, layout.roadEdges, scenery.lampOffset));
    const trees = treeSpots(layout, {
      count: scenery.boardTrees,
      seed: scenery.seed,
      clearance: scenery.treeClearance,
      spacing: scenery.treeSpacing,
      facilityPad: g.facilityPad,
    });
    const kinds = this.theme.props.foliage.length;
    for (let kind = 0; kind < kinds; kind += 1) {
      stand(TREE_MODEL(kind), trees.filter((_, index) => index % kinds === kind));
    }
    // Small trees in the strips between plots.
    standKinds(TREE_MODEL, kinds, gapTreeSpots(layout, { ...scenery.gapTrees, seed: scenery.seed + 1 }));

    // The countryside: nothing there casts or takes shadows, the shadow map only covers the board.
    const far = 2000;
    const corridors: Area[] = [
      { minX: -far, maxX: far, minZ: river.minZ - 5, maxZ: river.maxZ + 5 },
      // Planes come in low from the west of the runway.
      { minX: b.minX - 260, maxX: b.minX, minZ: layout.runway.minZ - 14, maxZ: layout.runway.maxZ + 14 },
    ];
    if (gate) corridors.push({ minX: -far, maxX: b.minX, minZ: gate.z - 7, maxZ: gate.z + 7 });
    const land = outskirts(b, corridors, { ...scenery.outskirts, seed: scenery.seed + 2 });
    standKinds(TREE_MODEL, kinds, land.trees, low, false);
    standKinds(HOUSE_MODEL, this.theme.props.houseWalls.length, land.houses, low, false);
    const hills = new InstancedModel(this.registry.create(HILL_MODEL), Math.max(1, land.hills.length), { castShadow: false, receiveShadow: false });
    hills.begin();
    rotation.identity();
    for (const hill of land.hills) {
      position.set(hill.x, low, hill.z);
      scale.set(hill.radius, hill.height, hill.radius);
      hills.add(matrix.compose(position, rotation, scale), tint.setHex(colors.hill[hill.kind % colors.hill.length] ?? colors.grassDark));
    }
    hills.end();
    const clouds = new InstancedModel(this.registry.create(CLOUD_MODEL), Math.max(1, land.clouds.length), { castShadow: false, receiveShadow: false });
    clouds.begin();
    for (const cloud of land.clouds) {
      position.set(cloud.x, cloud.y, cloud.z);
      rotation.setFromAxisAngle(UP, cloud.heading);
      scale.set(cloud.scale, cloud.scale * 0.8, cloud.scale);
      clouds.add(matrix.compose(position, rotation, scale));
    }
    clouds.end();
    for (const model of [hills, clouds]) {
      this.props.push(model);
      this.group.add(model.group);
    }

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

  /**
   * Moves the light and recolours the sky for the given real time. The cycle is visual only.
   * Returns how far into the night it is (0 by day, 1 at night), which the glowing materials follow.
   */
  update(realTimeSec: number): number {
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
    return sample.night;
  }

  dispose(): void {
    this.flats?.dispose();
    this.flats = null;
    for (const prop of this.props) prop.dispose();
    this.props = [];
    for (const slab of this.slabs) slab.geometry.dispose();
    this.slabs = [];
    this.ground.geometry.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.remove(this.group);
    this.scene.fog = null;
    this.scene.background = null;
  }
}

interface Area {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Corner radii of a slab seen from above: north is -z, west is -x. */
interface CornerRadii {
  nw: number;
  ne: number;
  se: number;
  sw: number;
}

const clip = (area: Area, to: Area): Area => ({
  minX: Math.max(area.minX, to.minX),
  maxX: Math.min(area.maxX, to.maxX),
  minZ: Math.max(area.minZ, to.minZ),
  maxZ: Math.min(area.maxZ, to.maxZ),
});

/** Flat slab over `area` with its underside at y = 0, `height` thick, each corner rounded by its own radius. */
function slabGeometry(area: Area, height: number, radii: CornerRadii): ExtrudeGeometry {
  // Drawn in the shape's own plane with y = -z, then laid flat.
  const shape = new Shape();
  const { minX, maxX, minZ, maxZ } = area;
  shape.moveTo(minX + radii.nw, -minZ);
  shape.lineTo(maxX - radii.ne, -minZ);
  shape.quadraticCurveTo(maxX, -minZ, maxX, -(minZ + radii.ne));
  shape.lineTo(maxX, -(maxZ - radii.se));
  shape.quadraticCurveTo(maxX, -maxZ, maxX - radii.se, -maxZ);
  shape.lineTo(minX + radii.sw, -maxZ);
  shape.quadraticCurveTo(minX, -maxZ, minX, -(maxZ - radii.sw));
  shape.lineTo(minX, -(minZ + radii.nw));
  shape.quadraticCurveTo(minX, -minZ, minX + radii.nw, -minZ);
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const setRgb = (color: Color, rgb: Rgb): Color => color.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
