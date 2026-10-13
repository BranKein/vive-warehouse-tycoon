import { Color, Group, Matrix4, Quaternion, Vector3, type Mesh, type Object3D } from 'three';
import type {
  FacilityDef,
  GameSnapshot,
  IslandLayoutDef,
  PickTarget,
  PlotDef,
  Selection,
  StockView,
} from '@/contracts';
import {
  buildingModel,
  CRATE_MODEL,
  facilityModel,
  SELECTION_MODEL,
  SPECIAL_CARGO_MODEL,
  WASTE_MODEL,
} from './boxModels';
import { renderConfig } from './config';
import { InstancedModel } from './InstancedModel';
import { pilePosition, siteToWorld, type PileGroup, type Site } from './layout';
import { pileHeight, type PickProxy } from './math';
import type { ModelRegistry } from './ModelRegistry';
import { buildingKey, diffKeys, vehiclePoses } from './sync';
import { itemColor, type Theme } from './theme';

const UP = new Vector3(0, 1, 0);

interface BuildingEntry {
  id: string;
  plotId: string;
}

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
  private specialObject: Object3D | null = null;
  private special: { id: string; x: number; z: number } | null = null;
  private marker: Object3D | null = null;
  private selection: Selection = { type: 'none' };

  private readonly matrix = new Matrix4();
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

  setSelection(selection: Selection): void {
    this.selection = selection;
  }

  /**
   * Draws the state `alpha` of the way from `prev` to `curr`. Pass `prev` as
   * null when it cannot be compared with `curr` (another island).
   */
  update(prev: GameSnapshot | null, curr: GameSnapshot, alpha: number): void {
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

    const vehicles = vehiclePoses(prev ? prev.island.vehicles : null, island.vehicles, alpha, renderConfig.vehicle.snapDistance);
    for (const vehicle of vehicles) {
      const pose = vehicle.pose;
      this.position.set(pose.x, pose.y, pose.z);
      this.rotation.setFromAxisAngle(UP, pose.heading);
      this.scale.set(1, 1, 1);
      this.model(vehicle.model, 64).add(this.matrix.compose(this.position, this.rotation, this.scale));
    }

    for (const building of island.buildings) {
      const plot = this.plots.get(building.plotId);
      if (!plot) continue;
      // Building models are drawn in the plot's own frame, so they stand on the plot centre.
      this.position.set(plot.x, 0, plot.z);
      this.rotation.setFromAxisAngle(UP, plot.facing);
      this.scale.set(1, 1, 1);
      this.model(buildingModel(building.typeId), 8).add(this.matrix.compose(this.position, this.rotation, this.scale));
      this.piles(plot, 'inputs', building.inputs);
      this.piles(plot, 'outputs', building.outputs);
      this.piles(plot, 'waste', building.waste);
    }
    for (const facility of island.facilities) {
      const def = this.facilityDefs.get(facility.id);
      if (def && facility.unlocked) this.piles(def, 'inputs', facility.stock);
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
    const standing = (site: Site, size: readonly [number, number, number], target: PickTarget): void => {
      const centre = siteToWorld(site, 0, sizes.siteOffsetZ);
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
      if (buildingId) standing(plot, sizes.building, target);
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

  private piles(site: Site, group: PileGroup, stocks: ReadonlyArray<StockView>): void {
    const rule = renderConfig.boxes.pile;
    const waste = group === 'waste';
    const footprint = waste ? rule.wasteFootprint : rule.footprint;
    for (let index = 0; index < stocks.length; index += 1) {
      const stock = stocks[index]!;
      const height = pileHeight(stock.amount, rule);
      if (height <= 0) continue;
      const at = pilePosition(site, group, index, renderConfig.boxes.yard);
      this.position.set(at.x, 0, at.z);
      this.rotation.setFromAxisAngle(UP, site.facing);
      this.scale.set(footprint, height, footprint);
      this.matrix.compose(this.position, this.rotation, this.scale);
      if (waste) this.model(WASTE_MODEL, 64).add(this.matrix);
      else this.model(CRATE_MODEL, 256).add(this.matrix, this.colorOf(stock.item));
    }
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
