import { CircleGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
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
  SELECTION_MODEL,
  SPECIAL_CARGO_MODEL,
} from './boxModels';
import { renderConfig } from './config';
import { FadingModels } from './FadingModels';
import { InstancedModel } from './InstancedModel';
import { facilityPileLocal, pileLocal, siteToWorld, type GroundPoint, type PileGroup, type Site } from './layout';
import { bounceStretch, log10Of, smoothstep, type Pose, pileCrateCount, pileHeight, pileSlot, squashFor, type PickProxy } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { CRATE_MODEL, PALLET_MODEL, WASTE_HEAP_MODEL } from './models/goods';
import { backOutPose, buildingKey, diffKeys, laneShift, parkedShift, routeDots, trailPoint, type Leaving, type TrailPoint, pilesToShow, vehicleFade, vehiclePoses } from './sync';
import { carrierColor, itemColor, type Theme } from './theme';

const UP = new Vector3(0, 1, 0);
const ZERO_SHIFT = { x: 0, z: 0 };

interface BuildingEntry {
  id: string;
  plotId: string;
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
  /** How far it fell behind, and the distance from which it has been catching up. */
  lag: number;
  lagFrom: number;
  /** A sideways step left over when it went back onto the trail, smoothed away from `from` on. */
  slip: { x: number; z: number; from: number } | null;
  /** Units per second it pulls in at once the game has stopped it: fast enough to be in before it sets off again. */
  pull: number;
  /** True once it stands at its site; false while it is still driving in, or out on the road. */
  parked: boolean;
  /** The way into the site it stands at, which is the way it drove in. */
  parkHeading: number | null;
  /** Set while it backs out of that site. */
  leaving: Leaving | null;
}

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
  private readonly facilities = new Map<string, Object3D>();
  private readonly instanced = new Map<string, InstancedModel>();
  private readonly itemColors = new Map<string, Color>();
  private readonly paints = new Map<number, Color>();
  private routeMesh: InstancedMesh | null = null;
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
  private marker: Object3D | null = null;
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
      if (this.plots.has(building.plotId)) this.buildings.set(key, { id: building.id, plotId: building.plotId });
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
      this.model(buildingModel(building.typeId), 8).add(this.matrix.compose(this.position, this.rotation, this.scale));
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
    this.updateMarker();
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
    const standing = (site: Site, size: readonly [number, number, number], target: PickTarget, shift = 0): void => {
      const centre = siteToWorld(site, 0, sizes.siteOffsetZ + shift);
      proxies.push({
        target,
        priority: PRIORITY_BOX,
        volume: {
          shape: 'box',
          cx: centre.x,
          cy: size[1] / 2,
          cz: centre.z,
          hx: size[0] / 2,
          hy: size[1] / 2,
          hz: size[2] / 2,
          yaw: site.facing,
        },
      });
    };

    const occupied = new Map<string, string>();
    for (const building of this.buildings.values()) occupied.set(building.plotId, building.id);
    for (const plot of layout.plots) {
      const buildingId = occupied.get(plot.id);
      // The whole plot of a building selects that building, not just its box.
      const target: PickTarget = buildingId ? { type: 'building', buildingId } : { type: 'plot', plotId: plot.id };
      flat(plot, layout.plotSize.width, layout.plotSize.depth, target);
      if (buildingId) standing(plot, sizes.building, target, sizes.buildingOffsetZ);
    }
    for (const facility of layout.facilities) {
      const target: PickTarget = { type: 'facility', facilityId: facility.id };
      flat(facility, sizes.ground.facilityPad[0], sizes.ground.facilityPad[1], target);
      standing(facility, sizes.facility, target);
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
    for (const object of this.facilities.values()) this.group.remove(object);
    this.facilities.clear();
    if (this.specialObject) this.group.remove(this.specialObject);
    this.specialObject = null;
    this.special = null;
    if (this.marker) this.group.remove(this.marker);
    this.marker = null;
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
    if (this.routeMesh) {
      this.group.remove(this.routeMesh);
      this.routeMesh.geometry.dispose();
      (this.routeMesh.material as MeshBasicMaterial).dispose();
      this.routeMesh.dispose();
      this.routeMesh = null;
    }
  }

  /** A model wrapped in a holder, so moving and scaling it never disturbs the model's own transform. */
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

  private model(name: string, capacity: number): InstancedModel {
    let model = this.instanced.get(name);
    if (!model) {
      model = new InstancedModel(this.registry.create(name), capacity);
      model.begin();
      this.instanced.set(name, model);
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
        track = {
          model: vehicle.model,
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
            ? { trail: [{ x: pose.x, z: pose.z, d: 0 }], dist: 0, floor: 0, at: 0, speed: 0, lag: 0, lagFrom: 0, slip: null, pull: 0, parked: false, parkHeading: null, leaving: null }
            : null,
          lift: surfaceLift(vehicle.kind),
          cargo: [],
          paint: vehicle.kind === 'carrier' ? this.carrierPaint(vehicle, curr) : null,
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
      const model = this.model(track.model, 64);
      model.add(this.matrix, track.paint ?? undefined);
      if (track.cargo.length > 0) this.cargoCrates(track.cargo, model.anchors.cargo ?? []);
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
      road.lag = 0;
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
        road.lag = 0;
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
          : { heading: road.parkHeading, x: track.x + track.shiftX, z: track.z + track.shiftZ, since: road.dist, from: null, straight: 0, turn: 0, radius: 0 };
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
    if (stopped) {
      // The game has it at its stop already and will not keep it there long: it drives the rest of the way
      // in, faster than usual if it has far to go.
      const left = road.dist + reach - road.at + inset;
      road.pull = Math.max(road.pull, road.speed, this.gameSpeed > 0 ? (left * this.gameSpeed) / rule.arriveSec : 0);
      road.at = Math.min(road.at + road.pull * dt, road.dist + reach);
    } else {
      road.pull = 0;
      const lag = road.lag * (1 - smoothstep((road.dist - road.lagFrom) / back.catchUp));
      road.at = Math.max(road.at, road.dist - reach - lag);
    }
    const rear = trailPoint(road.trail, road.at - reach, road.floor);
    const front = trailPoint(road.trail, road.at + reach, road.floor);
    if (Math.hypot(front.x - rear.x, front.z - rear.z) > 0.05) heading = Math.atan2(front.x - rear.x, front.z - rear.z);
    else if (fresh) heading = pose.heading;
    const lane = laneShift(heading, rule.laneOffset);
    x = (rear.x + front.x) / 2 + lane.x;
    z = (rear.z + front.z) / 2 + lane.z;
    if (road.slip) {
      if (road.slip.from < 0) road.slip = { x: road.slip.x - x, z: road.slip.z - z, from: road.dist };
      const left = 1 - smoothstep((road.dist - road.slip.from) / back.settle);
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
    road.lag = Math.hypot(x - pose.x, z - pose.z);
    road.lagFrom = road.dist;
    road.at = road.dist - renderConfig.vehicle.steerReach - road.lag;
    // `from` below zero: the step is measured against the trail on the first frame it is drawn there.
    road.slip = { x, z, from: -1 };
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
  private cargoCrates(items: ReadonlyArray<string>, places: ReadonlyArray<readonly [number, number, number]>): void {
    const crates = this.model(CRATE_MODEL, 1024);
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

  private selectedSite(): { site: Site; width: number; depth: number; y?: number } | null {
    const layout = this.layout;
    const selection = this.selection;
    if (!layout || selection.type === 'none' || selection.type === 'vehicle') return null;
    if (selection.type === 'facility') {
      const site = this.facilityDefs.get(selection.facilityId);
      const pad = renderConfig.boxes.ground.facilityPad;
      return site ? { site, width: pad[0], depth: pad[1] } : null;
    }
    let plotId: string | undefined;
    if (selection.type === 'plot') plotId = selection.plotId;
    else for (const building of this.buildings.values()) if (building.id === selection.buildingId) plotId = building.plotId;
    const site = plotId === undefined ? undefined : this.plots.get(plotId);
    return site ? { site, width: layout.plotSize.width, depth: layout.plotSize.depth } : null;
  }

  /** The selected vehicle as a site of its own size that moves with it. */
  private selectedVehicle(): { site: Site; width: number; depth: number; y: number } | null {
    if (this.selection.type !== 'vehicle') return null;
    const track = this.tracks.get(this.selection.vehicleId);
    if (!track || !track.seen || this.inTunnel(track)) return null;
    const size = vehicleBox(track.model);
    const grow = renderConfig.vehicle.markerScale;
    return {
      site: { x: track.x + track.shiftX, z: track.z + track.shiftZ, facing: track.heading },
      width: size[0] * grow,
      depth: size[2] * grow,
      // Over the road it stands on; in the air under a plane.
      y: track.y + track.lift,
    };
  }

  /** Dots on the road along the rest of the selected road vehicle's way, with a larger one where it ends. */
  private updateRoute(): void {
    const rule = renderConfig.vehicle.route;
    const track = this.selection.type === 'vehicle' ? this.tracks.get(this.selection.vehicleId) : undefined;
    const route = track && track.seen && track.road && !track.road.leaving ? track.route : null;
    if (!route) {
      if (this.routeMesh) this.routeMesh.count = 0;
      return;
    }
    if (!this.routeMesh) {
      const geometry = new CircleGeometry(1, 16).rotateX(-Math.PI / 2);
      const material = new MeshBasicMaterial({ color: this.theme.effects.route, toneMapped: false, fog: false });
      this.routeMesh = new InstancedMesh(geometry, material, rule.max);
      this.routeMesh.frustumCulled = false;
      this.group.add(this.routeMesh);
    }
    const dots = routeDots(route.points, route.travelled + rule.ahead, rule.spacing, renderConfig.vehicle.laneOffset);
    const count = Math.min(dots.length, rule.max);
    for (let index = 0; index < count; index += 1) {
      // The end of the way is always drawn, even when the dots run out.
      const end = index === count - 1;
      const dot = end ? dots[dots.length - 1]! : dots[index]!;
      const size = rule.radius * (end ? rule.endScale : 1);
      this.routeMesh.setMatrixAt(index, this.local.makeScale(size, 1, size).setPosition(dot.x, rule.height, dot.z));
    }
    this.routeMesh.count = count;
    this.routeMesh.instanceMatrix.needsUpdate = true;
  }

  /** A flat coloured pad under whatever is selected. */
  private updateMarker(): void {
    const selected = this.selectedSite() ?? this.selectedVehicle();
    if (!selected) {
      if (this.marker) this.marker.visible = false;
      return;
    }
    if (!this.marker) {
      this.marker = this.instantiate(SELECTION_MODEL);
      this.marker.traverse((child) => {
        child.receiveShadow = true;
      });
      this.group.add(this.marker);
    }
    this.marker.visible = true;
    this.marker.position.set(selected.site.x, selected.y ?? 0, selected.site.z);
    this.marker.rotation.y = selected.site.facing;
    this.marker.scale.set(selected.width, renderConfig.boxes.ground.selectionHeight, selected.depth);
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
