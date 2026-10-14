import { Box3, Color, Group, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import type {
  FacilityDef,
  GameSnapshot,
  IslandLayoutDef,
  PickTarget,
  PlotDef,
  Selection,
  StockView,
  VehicleView,
} from '@/contracts';
import {
  buildingModel,
  facilityModel,
  SPECIAL_CARGO_MODEL,
} from './boxModels';
import { renderConfig } from './config';
import { RouteLine } from './RouteLine';
import { SelectionBox, type BoxFrame } from './SelectionBox';
import { FadingModels } from './FadingModels';
import { InstancedModel } from './InstancedModel';
import { facilityPileLocal, pileLocal, siteToWorld, type GroundPoint, type PileGroup, type Site } from './layout';
import { bounceStretch, log10Of, smoothstep, type Pose, pileCrateCount, pileHeight, pileSlot, squashFor, type PickProxy } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { CRATE_MODEL, PALLET_MODEL, WASTE_HEAP_MODEL } from './models/goods';
import { backOutPose, buildingKey, crossingPose, cruiseStep, drawnLength, planCrossing, diffKeys, onTrail, parkedShift, routeDots, type Crossing, type Leaving, type TrailPoint, pilesToShow, vehicleFade, vehiclePoses } from './sync';
import { carrierColor, itemColor, type Theme } from './theme';

const UP = new Vector3(0, 1, 0);
const ZERO_SHIFT = { x: 0, z: 0 };

interface BuildingEntry {
  id: string;
  plotId: string;
  typeId: string;
}

/** What the view remembers about a vehicle from one frame to the next. */
interface VehicleTrack {
  model: string;
  /** Where the game has it. */
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Units per second, measured over the last frame; carries a vehicle on for a moment after it left. */
  vx: number;
  vy: number;
  vz: number;
  /** From where the game has it to where it is drawn. */
  shiftX: number;
  shiftZ: number;
  /** Seconds on screen. */
  age: number;
  /** Seconds since it left the snapshot; negative while it is still there. */
  gone: number;
  slow: boolean;
  /** Trucks come and go through the tunnel at the gate, which hides them: they neither grow nor shrink there. */
  truck: boolean;
  /** Road vehicles only: the way they came, which is what they are drawn along. */
  road: RoadTrack | null;
  /** Height of the surface it stands on (road, runway) above the board. */
  lift: number;
  /** Kinds of goods on board, for the crates on a carrier's bed. */
  cargo: string[];
  /** Body colour of a carrier; null for the vehicles that keep their model's colours. */
  paint: Color | null;
  /** The way it is on, from the game; null while it stands. */
  route: VehicleView['route'] | null;
  seen: boolean;
}

/**
 * A road vehicle is drawn on the way the game has taken it, a little behind
 * where the game has it now. That gives it a stretch of road ahead to steer
 * by, so it swings round corners, and it lets it fall behind for a while
 * (backing out of a site takes time the game does not spend) and catch up
 * along the road instead of across the grass.
 */
interface RoadTrack {
  trail: TrailPoint[];
  /** How far the game has moved it in all. */
  dist: number;
  /** It is not drawn on the trail before this distance: that part led into the site it left. */
  floor: number;
  /** How far along the trail it is drawn. */
  at: number;
  /** Units per second the game last moved it at. */
  speed: number;
  /** A sideways step left over when it went back onto the trail, smoothed away from `from` on. */
  slip: { x: number; z: number; from: number; over: number } | null;
  /** Units per second it pulls in at once the game has stopped it: fast enough to be in before it sets off again. */
  pull: number;
  /** True once it stands at its site; false while it is still driving in, or out on the road. */
  parked: boolean;
  /** The way into the site it stands at, which is the way it drove in. */
  parkHeading: number | null;
  /** Set while it backs out of that site. */
  leaving: Leaving | null;
}

/** Step along the trail over which `cruiseStep` measures how far a vehicle moves on screen. */
const STRETCH_STEP = 0.5;

const ROAD_KINDS: ReadonlySet<string> = new Set(['carrier', 'inboundTruck', 'saleTruck']);
const SLOW_KINDS: ReadonlySet<string> = new Set(['ship', 'plane']);
const TRUCK_KINDS: ReadonlySet<string> = new Set(['inboundTruck', 'saleTruck']);

/** Rough size of a vehicle, [width, height, length], by the second part of its model name (`vehicle.carrier.tier2` -> carrier). */
function vehicleBox(model: string): readonly [number, number, number] {
  const sizes: Record<string, readonly [number, number, number]> = renderConfig.boxes.vehicles;
  return sizes[model.split('.')[1] ?? ''] ?? sizes.fallback!;
}

/** Height of what a vehicle stands on, relative to the board: the road, the runway or the sea. */
function surfaceLift(kind: string): number {
  const ground = renderConfig.boxes.ground;
  if (ROAD_KINDS.has(kind)) return ground.roadHeight;
  // Ships float on the sea, which lies at ground level, below the board.
  if (kind === 'ship') return -ground.boardThickness;
  return kind === 'plane' ? ground.runwayHeight : 0;
}

/** Pick priorities: flat ground < things standing on it < vehicles < special cargo. */
const PRIORITY_GROUND = 0;
const PRIORITY_BOX = 1;
const PRIORITY_VEHICLE = 2;
const PRIORITY_SPECIAL = 3;

/**
 * Keeps the scene in step with the snapshot. Facilities and the special cargo
 * are objects that are created and removed as they come and go; buildings,
 * vehicles and piles are redrawn every frame through instancing, so a model
 * costs one draw call per material no matter how many copies there are.
 */
export class ViewSync {
  readonly group = new Group();
  private layout: IslandLayoutDef | null = null;
  private readonly plots = new Map<string, PlotDef>();
  private readonly facilityDefs = new Map<string, FacilityDef>();
  private readonly buildings = new Map<string, BuildingEntry>();
  /** Box each model fills in its own frame, measured the first time it is clicked at. */
  private readonly bounds = new Map<string, Box3>();
  /** Chimneys of the buildings at work, in the world, as of the last update. */
  readonly chimneys: Array<{ key: string; x: number; y: number; z: number }> = [];
  private readonly chimney = new Vector3();
  private readonly facilities = new Map<string, Object3D>();
  private readonly instanced = new Map<string, InstancedModel>();
  private readonly itemColors = new Map<string, Color>();
  private readonly paints = new Map<number, Color>();
  private readonly routeLine: RouteLine;
  private readonly tracks = new Map<string, VehicleTrack>();
  /** Ships and planes while they fade in or out. */
  private readonly fading: FadingModels;
  private gate: GroundPoint | null = null;
  /** How fast the game runs (0 paused, 1, 2, 4): what happens in game time is drawn that much faster. */
  private gameSpeed = 1;
  /** Buildings and facilities that are hopping, by id, with the seconds since they started. */
  private readonly bounces = new Map<string, number>();
  /** False until the first frame of a layout has been drawn: what is there then does not grow in. */
  private settled = false;
  private specialObject: Object3D | null = null;
  private special: { id: string; x: number; z: number } | null = null;
  private readonly selectionBox: SelectionBox;
  private selection: Selection = { type: 'none' };

  private readonly matrix = new Matrix4();
  private readonly local = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();

  constructor(
    private readonly registry: ModelRegistry,
    private readonly theme: Theme,
  ) {
    this.fading = new FadingModels(registry);
    this.group.add(this.fading.group);
    const pick = theme.effects.selection;
    this.selectionBox = new SelectionBox(pick, renderConfig.selection);
    const route = renderConfig.vehicle.route;
    this.routeLine = new RouteLine(pick, route.max, route.width, route.endRadius, route.height);
    this.group.add(this.selectionBox.group, this.routeLine.group);
  }

  /** Switches to another island's layout (null shows nothing). Everything on screen is dropped. */
  setLayout(layout: IslandLayoutDef | null): void {
    this.clear();
    this.layout = layout;
    this.plots.clear();
    this.facilityDefs.clear();
    for (const plot of layout?.plots ?? []) this.plots.set(plot.id, plot);
    for (const facility of layout?.facilities ?? []) this.facilityDefs.set(facility.id, facility);
    const gate = layout?.roadNodes.find((node) => node.id === layout.roadGate);
    this.gate = gate ? { x: gate.x, z: gate.z } : null;
  }

  /** Makes a building or facility hop once (it was just upgraded). */
  bounce(id: string): void {
    this.bounces.set(id, 0);
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
  }

  /**
   * Draws the state `alpha` of the way from `prev` to `curr`. Pass `prev` as
   * null when it cannot be compared with `curr` (another island).
   */
  update(prev: GameSnapshot | null, curr: GameSnapshot, alpha: number, dt = 0): void {
    if (!this.layout) return;
    const island = curr.island;

    // Buildings.
    const wanted = new Map(island.buildings.map((building) => [buildingKey(building), building]));
    const diff = diffKeys(this.buildings.keys(), wanted.keys());
    for (const key of diff.remove) this.buildings.delete(key);
    for (const key of diff.create) {
      const building = wanted.get(key)!;
      if (this.plots.has(building.plotId)) this.buildings.set(key, { id: building.id, plotId: building.plotId, typeId: building.typeId });
    }

    // Facility placeholders.
    const facilityKeys = new Map(island.facilities.map((facility) => [`${facility.id}|${facility.kind}`, facility]));
    const facilityDiff = diffKeys(this.facilities.keys(), facilityKeys.keys());
    for (const key of facilityDiff.remove) {
      this.group.remove(this.facilities.get(key)!);
      this.facilities.delete(key);
    }
    for (const key of facilityDiff.create) {
      const facility = facilityKeys.get(key)!;
      const def = this.facilityDefs.get(facility.id);
      if (!def) continue;
      this.facilities.set(key, this.place(this.instantiate(facilityModel(facility.kind)), def));
    }

    // Special cargo.
    const special = island.specialCargo;
    if (special && !this.specialObject) {
      this.specialObject = withShadows(this.instantiate(SPECIAL_CARGO_MODEL));
      this.group.add(this.specialObject);
    } else if (!special && this.specialObject) {
      this.group.remove(this.specialObject);
      this.specialObject = null;
    }
    this.special = special ? { id: special.id, x: special.x, z: special.z } : null;
    if (special && this.specialObject) this.specialObject.position.set(special.x, 0, special.z);

    // Vehicles and piles are rebuilt from scratch every frame.
    for (const model of this.instanced.values()) model.begin();

    this.vehicles(prev, curr, alpha, dt);

    const hop = renderConfig.effects.upgrade.bounce;
    for (const [id, elapsed] of this.bounces) {
      if (elapsed + dt >= hop.durationSec) this.bounces.delete(id);
      else this.bounces.set(id, elapsed + dt);
    }
    const stretchOf = (id: string): number => {
      const elapsed = this.bounces.get(id);
      return elapsed === undefined ? 1 : bounceStretch(elapsed, hop);
    };

    this.chimneys.length = 0;
    for (const building of island.buildings) {
      const plot = this.plots.get(building.plotId);
      if (!plot) continue;
      // Building models are drawn in the plot's own frame, then stand a little closer to the road.
      const stand = siteToWorld(plot, 0, renderConfig.boxes.buildingOffsetZ);
      this.position.set(stand.x, 0, stand.z);
      this.rotation.setFromAxisAngle(UP, plot.facing);
      const stretch = stretchOf(building.id);
      const squash = squashFor(stretch);
      this.scale.set(squash, stretch, squash);
      const model = this.model(buildingModel(building.typeId), 8);
      model.add(this.matrix.compose(this.position, this.rotation, this.scale));
      if (building.status === 'working') {
        (model.anchors.smoke ?? []).forEach(([x, y, z], index) => {
          this.chimney.set(x, y, z).applyMatrix4(this.matrix);
          this.chimneys.push({ key: `${building.id}#${index}`, x: this.chimney.x, y: this.chimney.y, z: this.chimney.z });
        });
      }
      this.piles(plot, 'inputs', building.inputs);
      this.piles(plot, 'outputs', building.outputs);
      this.piles(plot, 'waste', building.waste);
    }
    for (const facility of island.facilities) {
      const def = this.facilityDefs.get(facility.id);
      if (def && facility.unlocked) this.facilityPiles(def, facility.stock);
      const stretch = stretchOf(facility.id);
      const squash = squashFor(stretch);
      this.facilities.get(`${facility.id}|${facility.kind}`)?.scale.set(squash, stretch, squash);
    }

    for (const model of this.instanced.values()) model.end();
    this.updateMarker(dt);
    this.updateRoute();
  }

  /** Click targets for what is on screen now. */
  pickProxies(): Array<PickProxy<PickTarget>> {
    const layout = this.layout;
    if (!layout) return [];
    const sizes = renderConfig.boxes;
    const proxies: Array<PickProxy<PickTarget>> = [];
    const flat = (site: Site, width: number, depth: number, target: PickTarget): void => {
      proxies.push({
        target,
        priority: PRIORITY_GROUND,
        volume: { shape: 'box', cx: site.x, cy: 0, cz: site.z, hx: width / 2, hy: 0.3, hz: depth / 2, yaw: site.facing },
      });
    };
    // The click target of a building or facility is the box its model fills, so tall parts can be clicked
    // and the yard in front still selects the site underneath.
    const standing = (site: Site, model: string, fallback: readonly [number, number, number], target: PickTarget, shift = 0): void => {
      const box = this.boundsOf(model);
      const [cx, cy, cz, hx, hy, hz] = box.isEmpty()
        ? [0, fallback[1] / 2, sizes.siteOffsetZ, fallback[0] / 2, fallback[1] / 2, fallback[2] / 2]
        : [
            (box.min.x + box.max.x) / 2,
            (box.min.y + box.max.y) / 2,
            (box.min.z + box.max.z) / 2,
            (box.max.x - box.min.x) / 2,
            (box.max.y - box.min.y) / 2,
            (box.max.z - box.min.z) / 2,
          ];
      const centre = siteToWorld(site, cx, cz + shift);
      proxies.push({
        target,
        priority: PRIORITY_BOX,
        volume: { shape: 'box', cx: centre.x, cy, cz: centre.z, hx, hy, hz, yaw: site.facing },
      });
    };

    const occupied = new Map<string, BuildingEntry>();
    for (const building of this.buildings.values()) occupied.set(building.plotId, building);
    for (const plot of layout.plots) {
      const building = occupied.get(plot.id);
      // The whole plot of a building selects that building, not just its box.
      const target: PickTarget = building ? { type: 'building', buildingId: building.id } : { type: 'plot', plotId: plot.id };
      flat(plot, layout.plotSize.width, layout.plotSize.depth, target);
      if (building) standing(plot, buildingModel(building.typeId), sizes.building, target, sizes.buildingOffsetZ);
    }
    for (const facility of layout.facilities) {
      const target: PickTarget = { type: 'facility', facilityId: facility.id };
      flat(facility, sizes.ground.facilityPad[0], sizes.ground.facilityPad[1], target);
      standing(facility, facilityModel(facility.kind), sizes.facility, target);
    }
    const grow = renderConfig.vehicle.pickScale;
    for (const [id, track] of this.tracks) {
      // Not those that have left the game and are only fading away, nor trucks hidden in the tunnel.
      if (!track.seen || this.inTunnel(track)) continue;
      const size = vehicleBox(track.model);
      proxies.push({
        target: { type: 'vehicle', vehicleId: id },
        priority: PRIORITY_VEHICLE,
        volume: {
          shape: 'box',
          cx: track.x + track.shiftX,
          cy: track.y + track.lift + size[1] / 2,
          cz: track.z + track.shiftZ,
          hx: (size[0] * grow) / 2,
          hy: (size[1] * grow) / 2,
          hz: (size[2] * grow) / 2,
          yaw: track.heading,
        },
      });
    }
    if (this.special) {
      const radius = sizes.specialPickRadius;
      proxies.push({
        target: { type: 'specialCargo', id: this.special.id },
        priority: PRIORITY_SPECIAL,
        volume: { shape: 'sphere', cx: this.special.x, cy: sizes.specialCargo[1] / 2, cz: this.special.z, radius },
      });
    }
    return proxies;
  }

  /** Drops every object so the next frame rebuilds it from the registry. Call when a model was re-registered. */
  clear(): void {
    this.buildings.clear();
    this.bounds.clear();
    for (const object of this.facilities.values()) this.group.remove(object);
    this.facilities.clear();
    if (this.specialObject) this.group.remove(this.specialObject);
    this.specialObject = null;
    this.special = null;
    this.selectionBox.hide();
    this.routeLine.hide();
    for (const model of this.instanced.values()) {
      this.group.remove(model.group);
      model.dispose();
    }
    this.instanced.clear();
    this.fading.clear();
    this.tracks.clear();
    this.settled = false;
  }

  dispose(): void {
    this.clear();
    this.selectionBox.dispose();
    this.routeLine.dispose();
  }

  /** A model wrapped in a holder, so moving and scaling it never disturbs the model's own transform. */
  private boundsOf(name: string): Box3 {
    let box = this.bounds.get(name);
    if (!box) {
      box = new Box3().setFromObject(this.registry.create(name));
      this.bounds.set(name, box);
    }
    return box;
  }

  private instantiate(name: string): Object3D {
    const holder = new Group();
    holder.add(this.registry.create(name));
    return holder;
  }

  private place(object: Object3D, site: Site): Object3D {
    // Models are drawn in the frame of their site.
    object.position.set(site.x, 0, site.z);
    object.rotation.y = site.facing;
    this.group.add(withShadows(object));
    return object;
  }

  /** The instanced copies of a model; `ghost` ones are drawn see-through. */
  private model(name: string, capacity: number, ghost = false): InstancedModel {
    const key = ghost ? `${name}|ghost` : name;
    let model = this.instanced.get(key);
    if (!model) {
      const options = ghost ? { opacity: renderConfig.vehicle.othersOpacity } : {};
      model = new InstancedModel(this.registry.create(name), capacity, options);
      model.begin();
      this.instanced.set(key, model);
      this.group.add(model.group);
    }
    return model;
  }


  /**
   * Vehicles: interpolated between ticks. Road vehicles keep to the right,
   * stand on their site the way they drove in and back out of it again.
   * Carriers grow in and shrink away as they come and go, ships and planes
   * fade, and trucks are hidden by the tunnel at the gate.
   */
  private vehicles(prev: GameSnapshot | null, curr: GameSnapshot, alpha: number, dt: number): void {
    const rule = renderConfig.vehicle;
    const list = curr.island.vehicles;
    // Snapshots that cannot be compared (another island, a loaded game): start over.
    if (!prev) {
      this.tracks.clear();
      this.settled = false;
    }
    this.gameSpeed = curr.speed;
    for (const track of this.tracks.values()) track.seen = false;
    const drawn = vehiclePoses(prev ? prev.island.vehicles : null, list, alpha, rule.snapDistance);
    for (let index = 0; index < drawn.length; index += 1) {
      const vehicle = list[index]!;
      const pose = drawn[index]!.pose;
      let track = this.tracks.get(vehicle.id);
      if (!track) {
        const onRoad = ROAD_KINDS.has(vehicle.kind);
        // Some owners' carriers are drawn as another vehicle; only the carrier itself is painted by owner and goods.
        const ownModel = vehicle.kind === 'carrier' && vehicle.owner ? rule.ownerModels[vehicle.owner] : undefined;
        const model = ownModel?.model ?? vehicle.model;
        track = {
          model,
          x: pose.x,
          y: pose.y,
          z: pose.z,
          heading: pose.heading,
          vx: 0,
          vy: 0,
          vz: 0,
          shiftX: 0,
          shiftZ: 0,
          age: this.settled ? 0 : Infinity,
          gone: -1,
          slow: SLOW_KINDS.has(vehicle.kind),
          truck: TRUCK_KINDS.has(vehicle.kind),
          road: onRoad
            ? { trail: [{ x: pose.x, z: pose.z, d: 0 }], dist: 0, floor: 0, at: 0, speed: 0, slip: null, pull: 0, parked: false, parkHeading: null, leaving: null }
            : null,
          lift: surfaceLift(vehicle.kind),
          cargo: [],
          paint: vehicle.kind === 'carrier' && (ownModel?.painted ?? true) ? this.carrierPaint(vehicle, curr) : null,
          route: null,
          seen: true,
        };
        this.tracks.set(vehicle.id, track);
        if (track.road) this.drive(track, track.road, vehicle, pose, 0, 0, true);
      } else {
        const moved = Math.hypot(pose.x - track.x, pose.y - track.y, pose.z - track.z);
        const steady = dt > 0 && moved < rule.snapDistance;
        track.vx = steady ? (pose.x - track.x) / dt : 0;
        track.vy = steady ? (pose.y - track.y) / dt : 0;
        track.vz = steady ? (pose.z - track.z) / dt : 0;
        if (track.road) this.drive(track, track.road, vehicle, pose, moved < rule.snapDistance ? moved : -1, dt, false);
        else track.heading = pose.heading;
        track.x = pose.x;
        track.y = pose.y;
        track.z = pose.z;
        track.age += dt;
        track.gone = -1;
        track.seen = true;
      }
      track.route = vehicle.route ?? null;
      track.cargo.length = 0;
      if (vehicle.kind === 'carrier') for (const load of vehicle.cargo) track.cargo.push(load.item);
    }
    this.settled = true;
    this.fading.begin();
    const focus = this.selection.type === 'vehicle' && this.tracks.get(this.selection.vehicleId)?.seen ? this.selection.vehicleId : null;
    for (const [id, track] of this.tracks) {
      const inTunnel = this.inTunnel(track);
      if (!track.seen) {
        // Gone from the game: it rolls on for a moment, slowing down, while it shrinks or fades away.
        const disappearSec = track.slow ? rule.slowDisappearSec : rule.disappearSec;
        track.gone = Math.max(0, track.gone) + dt;
        if (track.gone >= disappearSec || inTunnel) {
          this.tracks.delete(id);
          continue;
        }
        const coast = (1 - track.gone / disappearSec) * dt;
        track.x += track.vx * coast;
        track.y += track.vy * coast;
        track.z += track.vz * coast;
      }
      const fade = inTunnel
        ? 1
        : vehicleFade(
            track.age,
            track.gone,
            track.slow ? rule.slowAppearSec : rule.appearSec,
            track.slow ? rule.slowDisappearSec : rule.disappearSec,
          );
      if (fade <= 0) continue;
      const size = track.slow ? 1 : fade;
      this.position.set(track.x + track.shiftX, track.y + track.lift, track.z + track.shiftZ);
      this.rotation.setFromAxisAngle(UP, track.heading);
      this.scale.set(size, size, size);
      this.matrix.compose(this.position, this.rotation, this.scale);
      if (track.slow && fade < 1) {
        this.fading.show(id, track.model, this.matrix, fade);
        continue;
      }
      // While one vehicle is selected the others fade back.
      const ghost = focus !== null && id !== focus;
      const model = this.model(track.model, 64, ghost);
      model.add(this.matrix, track.paint ?? undefined);
      if (track.cargo.length > 0) this.cargoCrates(track.cargo, model.anchors.cargo ?? [], ghost);
    }
    this.fading.end();
  }

  /**
   * Works out where a road vehicle is drawn this frame (`track.shiftX/Z` and
   * `track.heading`). `pose` is where the game has it now, `track.x/z` where
   * it had it last frame, `moved` the distance between the two (negative for a jump).
   */
  private drive(track: VehicleTrack, road: RoadTrack, vehicle: VehicleView, pose: Pose, moved: number, dt: number, fresh: boolean): void {
    const rule = renderConfig.vehicle;
    const back = rule.backOut;
    const reach = rule.steerReach;
    if (moved < 0) {
      // A jump: forget the way it came.
      road.trail = [{ x: pose.x, z: pose.z, d: road.dist }];
      road.floor = road.dist;
      road.at = road.dist;
      road.slip = null;
      road.leaving = null;
      road.parked = false;
    } else if (moved > 0) {
      road.dist += moved;
      road.trail.push({ x: pose.x, z: pose.z, d: road.dist });
      if (dt > 0) road.speed = moved / dt;
      // Keep what it may still be drawn on, and a little more.
      const keep = Math.max(road.floor, road.at - reach) - 1;
      while (road.trail.length > 2 && road.trail[1]!.d < keep) road.trail.shift();
    }
    const stopped = vehicle.state !== 'moving';
    const inset = track.truck ? rule.parkInset.truck : rule.parkInset.carrier;
    let x: number;
    let z: number;
    let heading = track.heading;

    if (stopped && (fresh || road.parked || road.at >= road.dist + reach - 1e-3)) {
      // Standing at its site: on the lane it came in on, pulled in off the road.
      if (!road.parked) {
        road.parked = true;
        road.parkHeading = this.headingIntoSite(pose.x, pose.z);
        road.leaving = null;
        road.slip = null;
      }
      const into = road.parkHeading ?? pose.heading;
      const target = road.parkHeading === null ? ZERO_SHIFT : parkedShift(into, rule.laneOffset, inset);
      const gap = Math.hypot(target.x - track.shiftX, target.z - track.shiftZ);
      const step = fresh ? gap : Math.max(road.pull, road.speed, 1) * dt;
      const part = gap <= step ? 1 : step / gap;
      track.shiftX += (target.x - track.shiftX) * part;
      track.shiftZ += (target.z - track.shiftZ) * part;
      track.heading = into;
      return;
    }

    if (road.parked) {
      // Setting off. It waits where it stands until the game has taken it round the corner onto the road,
      // which shows which way it has to back out.
      road.parked = false;
      road.pull = 0;
      road.trail = [{ x: track.x, z: track.z, d: road.dist - Math.max(0, moved) }, { x: pose.x, z: pose.z, d: road.dist }];
      road.floor = road.dist;
      road.at = road.dist;
      road.leaving =
        road.parkHeading === null
          ? null
          : { heading: road.parkHeading, x: track.x + track.shiftX, z: track.z + track.shiftZ, since: road.dist, from: null, straight: 0, turn: 0, radius: 0, cross: this.crossing(vehicle, road.parkHeading, track, inset) };
    }

    const cross = road.leaving?.cross;
    if (cross) {
      // Straight across the road to the site opposite: back out round, then drive round into it.
      if (stopped) {
        if (cross.pull === 0) {
          const left = cross.plan.length - cross.done;
          cross.pull = Math.max(road.speed, this.gameSpeed > 0 ? (left * this.gameSpeed) / rule.arriveSec : 0);
        }
        cross.done += cross.pull * dt;
      } else {
        cross.done += Math.max(0, moved);
      }
      const at = crossingPose(cross.plan, cross.done);
      track.shiftX = at.x - pose.x;
      track.shiftZ = at.z - pose.z;
      track.heading = at.heading;
      if (at.done && stopped) {
        // In: it stands at the new site as if it had driven in.
        road.leaving = null;
        road.parked = true;
        road.parkHeading = cross.heading;
        road.at = road.dist + reach;
        road.slip = null;
      }
      return;
    }

    const leaving = road.leaving;
    if (leaving) {
      if (leaving.from === null) {
        const turn = Math.atan2(Math.sin(vehicle.heading - leaving.heading), Math.cos(vehicle.heading - leaving.heading));
        if (Math.abs(Math.abs(turn) - Math.PI / 2) < 0.6) {
          // The game has it on the middle of the road now, which says how far back the road is.
          // The curve ends on the lane it will drive in.
          const toRoad = (leaving.x - pose.x) * Math.sin(leaving.heading) + (leaving.z - pose.z) * Math.cos(leaving.heading);
          const lane = Math.max(0, toRoad - Math.sin(turn) * rule.laneOffset);
          leaving.from = road.dist;
          leaving.turn = turn;
          leaving.radius = Math.min(back.radius, lane);
          leaving.straight = lane - leaving.radius;
          road.floor = road.dist;
        } else if (road.dist - leaving.since > back.giveUp) {
          // Its way leads straight on: nothing to back round. It drives off from where it stands.
          this.rejoin(road, leaving.x, leaving.z, pose);
        }
      }
      if (road.leaving) {
        const at = leaving.from === null ? { x: leaving.x, z: leaving.z, heading: leaving.heading, done: false } : backOutPose(leaving, road.dist - leaving.from);
        if (!at.done) {
          track.shiftX = at.x - pose.x;
          track.shiftZ = at.z - pose.z;
          track.heading = at.heading;
          return;
        }
        // Facing the right way now, but behind where the game has it.
        this.rejoin(road, at.x, at.z, pose);
        heading = at.heading;
      }
    }

    // On the road: drawn on the way it came, steering by a point ahead and one behind.
    const stretch = (at: number): number => {
      const here = onTrail(road.trail, at, reach, road.floor, rule.laneOffset, heading);
      const on = onTrail(road.trail, at + STRETCH_STEP, reach, road.floor, rule.laneOffset, heading);
      return Math.hypot(on.x - here.x, on.z - here.z) / STRETCH_STEP;
    };
    if (stopped) {
      // The game has it at its stop already and will not keep it there long: it drives the rest of the way
      // in, faster than usual if it has far to go on screen.
      const end = road.dist + reach;
      if (road.pull === 0) {
        const left = drawnLength(road.at, end, stretch, STRETCH_STEP) + inset;
        road.pull = Math.max(road.speed, this.gameSpeed > 0 ? (left * this.gameSpeed) / rule.arriveSec : 0);
      }
      road.at = Math.min(road.at + (road.pull * dt) / Math.max(0.2, stretch(road.at)), end);
    } else {
      road.pull = 0;
      road.at = cruiseStep(road.at, moved, road.dist - reach, stretch, rule.cruise);
    }
    const drawn = onTrail(road.trail, road.at, reach, road.floor, rule.laneOffset, fresh ? pose.heading : heading);
    heading = drawn.heading;
    x = drawn.x;
    z = drawn.z;
    if (road.slip) {
      if (road.slip.from < 0) {
        // A long step is smoothed away over a longer way, so it does not look like a spurt.
        const step = { x: road.slip.x - x, z: road.slip.z - z };
        road.slip = { ...step, from: road.dist, over: Math.max(back.settle, Math.hypot(step.x, step.z) * back.settlePerUnit) };
      }
      const left = 1 - smoothstep((road.dist - road.slip.from) / road.slip.over);
      if (left <= 0) road.slip = null;
      else {
        x += road.slip.x * left;
        z += road.slip.z * left;
      }
    }
    track.shiftX = x - pose.x;
    track.shiftZ = z - pose.z;
    track.heading = heading;
  }

  /** Puts a vehicle that stands at (x, z) back on the trail: as far behind the game as it is, with the step to the trail smoothed away. */
  private rejoin(road: RoadTrack, x: number, z: number, pose: Pose): void {
    road.leaving = null;
    road.at = road.dist - renderConfig.vehicle.steerReach - Math.hypot(x - pose.x, z - pose.z);
    // `from` below zero: the step is measured against the trail on the first frame it is drawn there.
    road.slip = { x, z, from: -1, over: 0 };
  }

  /**
   * The crossing for a vehicle setting off from a site, standing at `track` and facing `heading`, when its
   * way leads straight across the road to the site opposite; null for any other way.
   */
  private crossing(vehicle: VehicleView, heading: number, track: VehicleTrack, inset: number): Leaving['cross'] {
    const points = vehicle.route?.points;
    if (!points || points.length !== 3) return null;
    const [a, b, c] = [points[0]!, points[1]!, points[2]!];
    const first = Math.atan2(b.x - a.x, b.z - a.z);
    const second = Math.atan2(c.x - b.x, c.z - b.z);
    if (Math.abs(Math.atan2(Math.sin(second - first), Math.cos(second - first))) > 0.05) return null;
    const into = this.headingIntoSite(c.x, c.z);
    if (into === null) return null;
    const end = parkedShift(into, renderConfig.vehicle.laneOffset, inset);
    const plan: Crossing | null = planCrossing(
      { x: track.x + track.shiftX, z: track.z + track.shiftZ, heading },
      { x: c.x + end.x, z: c.z + end.z },
      renderConfig.vehicle.backOut.crossRadius,
    );
    return plan ? { plan, done: 0, heading: into, pull: 0 } : null;
  }

  /** Heading from a loading point towards the centre of the site it belongs to: the nearest plot or facility. */
  private headingIntoSite(x: number, z: number): number | null {
    let best: GroundPoint | null = null;
    let nearest: number = renderConfig.vehicle.parkReach;
    for (const sites of [this.plots, this.facilityDefs]) {
      for (const site of sites.values()) {
        const distance = Math.hypot(site.x - x, site.z - z);
        if (distance < nearest && distance > 1e-6) {
          nearest = distance;
          best = site;
        }
      }
    }
    return best ? Math.atan2(best.x - x, best.z - z) : null;
  }

  /** One crate per kind of goods on a carrier's bed; `this.matrix` holds the carrier's transform. */
  private cargoCrates(items: ReadonlyArray<string>, places: ReadonlyArray<readonly [number, number, number]>, ghost = false): void {
    const crates = this.model(CRATE_MODEL, 1024, ghost);
    const size = renderConfig.vehicle.cargoCrateScale;
    for (let index = 0; index < items.length && index < places.length; index += 1) {
      const place = places[index]!;
      this.local.makeScale(size, size, size).setPosition(place[0], place[1], place[2]);
      crates.add(this.local.premultiply(this.matrix), this.colorOf(items[index]!));
    }
  }

  /** Where a vehicle is drawn right now; null once it has left the game or is hidden in the tunnel. */
  vehiclePoint(id: string): { x: number; y: number; z: number } | null {
    const track = this.tracks.get(id);
    if (!track || !track.seen || this.inTunnel(track)) return null;
    return { x: track.x + track.shiftX, y: track.y + track.lift, z: track.z + track.shiftZ };
  }

  private inTunnel(track: VehicleTrack): boolean {
    return track.truck && this.gate !== null && Math.hypot(track.x - this.gate.x, track.z - this.gate.z) < renderConfig.vehicle.tunnelCover;
  }

  /** Carriers are painted by who they work for and, for a building's own, by what it makes. */
  private carrierPaint(vehicle: VehicleView, snapshot: GameSnapshot): Color {
    const home = vehicle.owner === 'facility' ? undefined : snapshot.island.buildings.find((building) => building.id === vehicle.home);
    const key = carrierColor(this.theme, vehicle.owner, home?.outputs[0]?.item);
    let color = this.paints.get(key);
    if (!color) {
      color = new Color(key);
      this.paints.set(key, color);
    }
    return color;
  }

  private piles(site: Site, group: PileGroup, stocks: ReadonlyArray<StockView>): void {
    for (let index = 0; index < stocks.length; index += 1) {
      const stock = stocks[index]!;
      const at = pileLocal(group, index, renderConfig.boxes.yard);
      if (group === 'waste') this.wasteHeap(site, at, stock);
      else this.pile(site, at, stock, 1);
    }
  }

  private facilityPiles(site: Site, stocks: ReadonlyArray<StockView>): void {
    const rule = renderConfig.boxes.yard.facility;
    const shown = pilesToShow(stocks.map((stock) => log10Of(stock.amount)), rule.perRow * rule.rows);
    // While everything fits a stock stands at the place of its index; otherwise the shown ones close ranks.
    const fits = stocks.length <= rule.perRow * rule.rows;
    shown.forEach((index, order) => this.pile(site, facilityPileLocal(fits ? index : order, rule), stocks[index]!, rule.scale));
  }

  /** One stock: a pallet with crates in the item's colour, more of them the more there is. */
  private pile(site: Site, local: GroundPoint, stock: StockView, size: number): void {
    const rule = renderConfig.pile;
    const count = pileCrateCount(stock.amount, rule);
    if (count <= 0) return;
    const centre = siteToWorld(site, local.x, local.z);
    this.rotation.setFromAxisAngle(UP, site.facing);
    this.scale.set(size, size, size);
    this.position.set(centre.x, 0, centre.z);
    this.model(PALLET_MODEL, 256).add(this.matrix.compose(this.position, this.rotation, this.scale));
    const crates = this.model(CRATE_MODEL, 1024);
    const color = this.colorOf(stock.item);
    for (let index = 0; index < count; index += 1) {
      const slot = pileSlot(index, rule.side);
      const at = siteToWorld(site, local.x + slot.col * rule.cratePitch * size, local.z + slot.row * rule.cratePitch * size);
      this.position.set(at.x, (rule.palletHeight + slot.layer * rule.crateSize) * size, at.z);
      crates.add(this.matrix.compose(this.position, this.rotation, this.scale), color);
    }
  }

  private wasteHeap(site: Site, local: GroundPoint, stock: StockView): void {
    const size = pileHeight(stock.amount, renderConfig.waste);
    if (size <= 0) return;
    const at = siteToWorld(site, local.x, local.z);
    this.position.set(at.x, 0, at.z);
    this.rotation.setFromAxisAngle(UP, site.facing);
    this.scale.set(size, size, size);
    this.model(WASTE_HEAP_MODEL, 64).add(this.matrix.compose(this.position, this.rotation, this.scale));
  }

  private colorOf(item: string): Color {
    let color = this.itemColors.get(item);
    if (!color) {
      color = new Color(itemColor(this.theme, item));
      this.itemColors.set(item, color);
    }
    return color;
  }

  /** The box round whatever is selected: what its model fills, or a low box over an empty plot. */
  private selectionFrame(): BoxFrame | null {
    const layout = this.layout;
    const selection = this.selection;
    if (!layout) return null;
    const around = (site: Site, model: string, shift: number): BoxFrame => {
      const box = this.boundsOf(model);
      const centre = siteToWorld(site, (box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2 + shift);
      return {
        x: centre.x,
        z: centre.z,
        yaw: site.facing,
        bottom: box.min.y,
        hx: (box.max.x - box.min.x) / 2,
        hy: (box.max.y - box.min.y) / 2,
        hz: (box.max.z - box.min.z) / 2,
      };
    };
    if (selection.type === 'facility') {
      const site = this.facilityDefs.get(selection.facilityId);
      return site ? around(site, facilityModel(site.kind), 0) : null;
    }
    if (selection.type === 'building') {
      for (const building of this.buildings.values()) {
        const site = building.id === selection.buildingId ? this.plots.get(building.plotId) : undefined;
        if (site) return around(site, buildingModel(building.typeId), renderConfig.boxes.buildingOffsetZ);
      }
      return null;
    }
    if (selection.type === 'plot') {
      const site = this.plots.get(selection.plotId);
      const height = renderConfig.selection.plotHeight;
      return site ? { x: site.x, z: site.z, yaw: site.facing, bottom: 0, hx: layout.plotSize.width / 2, hy: height / 2, hz: layout.plotSize.depth / 2 } : null;
    }
    if (selection.type === 'vehicle') {
      const track = this.tracks.get(selection.vehicleId);
      if (!track || !track.seen || this.inTunnel(track)) return null;
      const box = this.boundsOf(track.model);
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      const cos = Math.cos(track.heading);
      const sin = Math.sin(track.heading);
      return {
        x: track.x + track.shiftX + cx * cos + cz * sin,
        z: track.z + track.shiftZ - cx * sin + cz * cos,
        yaw: track.heading,
        bottom: track.y + track.lift + box.min.y,
        hx: (box.max.x - box.min.x) / 2,
        hy: (box.max.y - box.min.y) / 2,
        hz: (box.max.z - box.min.z) / 2,
      };
    }
    return null;
  }

  private updateRoute(): void {
    const rule = renderConfig.vehicle.route;
    const track = this.selection.type === 'vehicle' ? this.tracks.get(this.selection.vehicleId) : undefined;
    const route = track && track.seen && track.road && !track.road.leaving ? track.route : null;
    if (!route) {
      this.routeLine.hide();
      return;
    }
    this.routeLine.show(routeDots(route.points, route.travelled + rule.ahead, rule.spacing, renderConfig.vehicle.laneOffset));
  }

  private updateMarker(dt: number): void {
    const frame = this.selectionFrame();
    if (frame) this.selectionBox.show(frame, dt);
    else this.selectionBox.hide();
  }

}

function withShadows(object: Object3D): Object3D {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}
