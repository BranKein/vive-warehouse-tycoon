import { Color, Group, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
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
import { InstancedModel } from './InstancedModel';
import { facilityPileLocal, pileLocal, siteToWorld, type GroundPoint, type PileGroup, type Site } from './layout';
import { bounceStretch, log10Of, pileCrateCount, pileHeight, pileSlot, squashFor, type PickProxy } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { CRATE_MODEL, PALLET_MODEL, WASTE_HEAP_MODEL } from './models/goods';
import { carrierModel } from './models/vehicles';
import { buildingKey, diffKeys, laneShift, pilesToShow, vehiclePoses, vehicleSize } from './sync';
import { itemColor, type Theme } from './theme';

const UP = new Vector3(0, 1, 0);
const ZERO_SHIFT = { x: 0, z: 0 };

interface BuildingEntry {
  id: string;
  plotId: string;
}

/** What the view remembers about a vehicle from one frame to the next. */
interface VehicleTrack {
  model: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** Units per second, measured over the last frame; carries a vehicle on for a moment after it left. */
  vx: number;
  vy: number;
  vz: number;
  /** Sideways shift onto its lane, eased so corners and U-turns are rounded off. */
  shiftX: number;
  shiftZ: number;
  /** Seconds on screen. */
  age: number;
  /** Seconds since it left the snapshot; negative while it is still there. */
  gone: number;
  slow: boolean;
  /** Kinds of goods on board, for the crates on a carrier's bed. */
  cargo: string[];
  seen: boolean;
}

const ROAD_KINDS: ReadonlySet<string> = new Set(['carrier', 'inboundTruck', 'saleTruck']);
const SLOW_KINDS: ReadonlySet<string> = new Set(['ship', 'plane']);

/** Pick priorities: flat ground < things standing on it < special cargo. */
const PRIORITY_GROUND = 0;
const PRIORITY_BOX = 1;
const PRIORITY_SPECIAL = 2;

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
  private readonly tracks = new Map<string, VehicleTrack>();
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
  ) {}

  /** Switches to another island's layout (null shows nothing). Everything on screen is dropped. */
  setLayout(layout: IslandLayoutDef | null): void {
    this.clear();
    this.layout = layout;
    this.plots.clear();
    this.facilityDefs.clear();
    for (const plot of layout?.plots ?? []) this.plots.set(plot.id, plot);
    for (const facility of layout?.facilities ?? []) this.facilityDefs.set(facility.id, facility);
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
    this.tracks.clear();
    this.settled = false;
  }

  dispose(): void {
    this.clear();
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
   * Vehicles: interpolated between ticks, moved onto the right-hand lane, and
   * grown in and shrunk away as they come and go.
   */
  private vehicles(prev: GameSnapshot | null, curr: GameSnapshot, alpha: number, dt: number): void {
    const rule = renderConfig.vehicle;
    const list = curr.island.vehicles;
    // Snapshots that cannot be compared (another island, a loaded game): start over.
    if (!prev) {
      this.tracks.clear();
      this.settled = false;
    }
    for (const track of this.tracks.values()) track.seen = false;
    const drawn = vehiclePoses(prev ? prev.island.vehicles : null, list, alpha, rule.snapDistance);
    const ease = dt > 0 ? 1 - Math.exp(-rule.laneDamping * dt) : 1;
    for (let index = 0; index < drawn.length; index += 1) {
      const vehicle = list[index]!;
      const pose = drawn[index]!.pose;
      const onRoad = ROAD_KINDS.has(vehicle.kind) && vehicle.state === 'moving';
      const shift = onRoad ? laneShift(pose.heading, rule.laneOffset) : ZERO_SHIFT;
      let track = this.tracks.get(vehicle.id);
      if (!track) {
        track = {
          model: this.vehicleModel(vehicle),
          x: pose.x,
          y: pose.y,
          z: pose.z,
          heading: pose.heading,
          vx: 0,
          vy: 0,
          vz: 0,
          shiftX: shift.x,
          shiftZ: shift.z,
          age: this.settled ? 0 : Infinity,
          gone: -1,
          slow: SLOW_KINDS.has(vehicle.kind),
          cargo: [],
          seen: true,
        };
        this.tracks.set(vehicle.id, track);
      } else {
        const moved = Math.hypot(pose.x - track.x, pose.y - track.y, pose.z - track.z);
        const steady = dt > 0 && moved < rule.snapDistance;
        track.vx = steady ? (pose.x - track.x) / dt : 0;
        track.vy = steady ? (pose.y - track.y) / dt : 0;
        track.vz = steady ? (pose.z - track.z) / dt : 0;
        track.x = pose.x;
        track.y = pose.y;
        track.z = pose.z;
        track.heading = pose.heading;
        track.shiftX += (shift.x - track.shiftX) * ease;
        track.shiftZ += (shift.z - track.shiftZ) * ease;
        track.age += dt;
        track.gone = -1;
        track.seen = true;
      }
      track.cargo.length = 0;
      if (vehicle.kind === 'carrier') for (const load of vehicle.cargo) track.cargo.push(load.item);
    }
    this.settled = true;
    for (const [id, track] of this.tracks) {
      if (!track.seen) {
        // Gone from the game: it rolls on for a moment, slowing down, while it shrinks away.
        const disappearSec = track.slow ? rule.slowDisappearSec : rule.disappearSec;
        track.gone = Math.max(0, track.gone) + dt;
        if (track.gone >= disappearSec) {
          this.tracks.delete(id);
          continue;
        }
        const coast = (1 - track.gone / disappearSec) * dt;
        track.x += track.vx * coast;
        track.y += track.vy * coast;
        track.z += track.vz * coast;
      }
      const size = vehicleSize(
        track.age,
        track.gone,
        track.slow ? rule.slowAppearSec : rule.appearSec,
        track.slow ? rule.slowDisappearSec : rule.disappearSec,
      );
      if (size <= 0) continue;
      this.position.set(track.x + track.shiftX, track.y, track.z + track.shiftZ);
      this.rotation.setFromAxisAngle(UP, track.heading);
      this.scale.set(size, size, size);
      const model = this.model(track.model, 64);
      model.add(this.matrix.compose(this.position, this.rotation, this.scale));
      if (track.cargo.length > 0) this.cargoCrates(track.cargo, model.anchors.cargo ?? []);
    }
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

  /** Carriers are painted by who they work for, where the registry has a model for that owner. */
  private vehicleModel(vehicle: VehicleView): string {
    if (vehicle.kind !== 'carrier' || !vehicle.owner) return vehicle.model;
    const painted = carrierModel(vehicle.owner);
    return this.registry.has(painted) ? painted : vehicle.model;
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

  private selectedSite(): { site: Site; width: number; depth: number } | null {
    const layout = this.layout;
    const selection = this.selection;
    if (!layout || selection.type === 'none') return null;
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

  /** A flat coloured pad under whatever is selected. */
  private updateMarker(): void {
    const selected = this.selectedSite();
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
    this.marker.position.set(selected.site.x, 0, selected.site.z);
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
