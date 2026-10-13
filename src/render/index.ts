import { PCFShadowMap, Scene, Vector3, WebGLRenderer } from 'three';
import type { GameEvent, GameRenderer, GameSnapshot, PickTarget, RendererOptions, ScreenPoint, Selection } from '@/contracts';
import { BLOCK_MODEL, registerBoxModels } from './boxModels';
import { registerGameModels } from './models/index';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { siteToWorld } from './layout';
import { renderConfig } from './config';
import { hexToRgb, lerpRgb, rgbToHex } from './dayNight';
import { Environment } from './Environment';
import { applyLook, DEFAULT_LOOK, isLook, LOOK_NAMES, LOOK_STORAGE_KEY, LOOKS, type LookName } from './looks';
import { MaterialLibrary } from './materials';
import { clamp, pickNearest, pointerToNdc, type Ray } from './math';
import { ModelRegistry } from './ModelRegistry';
import { Kit } from './models/kit';
import { defaultTheme, type Theme } from './theme';
import { ViewSync } from './ViewSync';

export interface CreateRendererOptions extends RendererOptions {
  /** Colours and lighting. Defaults to `defaultTheme`. */
  theme?: Theme;
}

export interface WarehouseRenderer extends GameRenderer {
  /**
   * Name -> model factory used for everything drawn. Registering another
   * factory under an existing name restyles the running view.
   */
  readonly models: ModelRegistry;
}

/**
 * Creates the 3D view on `canvas`. The caller owns the frame loop and the
 * canvas size: call `render` once per frame, `resize` with the canvas' CSS
 * size whenever it changes, and `dispose` when done.
 */
export function createRenderer(canvas: HTMLCanvasElement, options: CreateRendererOptions): WarehouseRenderer {
  const theme = options.theme ?? defaultTheme;
  const catalog = options.catalog;

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  let lookName: LookName = DEFAULT_LOOK;
  try {
    const remembered = globalThis.localStorage?.getItem(LOOK_STORAGE_KEY);
    if (isLook(remembered)) lookName = remembered;
  } catch {
    // No storage (private window): the default look.
  }
  const look = LOOKS[lookName];
  applyLook(renderer, look);

  const materials = new MaterialLibrary(theme);
  const kit = new Kit(theme, materials);
  const models = new ModelRegistry(kit);
  const facilityKinds = new Set<string>();
  for (const island of Object.values(catalog.islands)) {
    for (const facility of island.layout.facilities) facilityKinds.add(facility.kind);
  }
  registerBoxModels(models, Object.keys(catalog.buildings), facilityKinds);
  // Shaped models replace the boxes of the same name.
  registerGameModels(models, kit);

  const scene = new Scene();
  const environment = new Environment(scene, models, theme, materials, look);
  const view = new ViewSync(models, theme);
  scene.add(view.group);
  const effects = new Effects(models, theme, canvas);
  scene.add(effects.group);
  /** The latest snapshot drawn: events name buildings and channels, this says where they stand. */
  let latest: GameSnapshot | null = null;

  const listeners: Array<(target: PickTarget) => void> = [];
  const pickPoint = new Vector3();
  const anchorPoint = new Vector3();
  const anchorListeners: Array<(anchor: ScreenPoint | null) => void> = [];
  let anchored = false;
  const pickAt = (clientX: number, clientY: number): PickTarget => {
    const ndc = pointerToNdc(clientX, clientY, canvas.getBoundingClientRect());
    const origin = rig.camera.position;
    pickPoint.set(ndc.x, ndc.y, 0.5).unproject(rig.camera).sub(origin).normalize();
    const ray: Ray = { ox: origin.x, oy: origin.y, oz: origin.z, dx: pickPoint.x, dy: pickPoint.y, dz: pickPoint.z };
    return pickNearest(ray, view.pickProxies())?.target ?? { type: 'none' };
  };
  const rig = new CameraRig(canvas, (clientX, clientY) => {
    if (listeners.length === 0) return;
    const target = pickAt(clientX, clientY);
    for (const listener of [...listeners]) listener(target);
  });


  // Dev server only: lets a test session point the camera and watch the effects from the console.
  if (import.meta.env.DEV) Object.assign(globalThis, { __wtRig: rig, __wtEffects: effects, __wtView: view, __wtTheme: theme });

  // Hovering and carrying. The pointer position is kept and picked again every
  // frame, so what is under a still pointer stays right while the scene moves.
  const hoverListeners: Array<(target: PickTarget | null, clientX: number, clientY: number) => void> = [];
  const dropListeners: Array<(buildingId: string, target: PickTarget) => void> = [];
  let pointer: { x: number; y: number } | null = null;
  let pointerMoved = false;
  let hoverKey = '';
  let chosen: Selection = { type: 'none' };
  /** Building picked up by a double-click that is still held down. */
  let carrying: string | null = null;
  let lastPress = { time: 0, buildingId: null as string | null };
  const keyOf = (target: PickTarget | null): string => (target ? JSON.stringify(target) : '');
  const emitHover = (target: PickTarget | null): void => {
    hoverKey = keyOf(target);
    for (const listener of [...hoverListeners]) listener(target, pointer?.x ?? 0, pointer?.y ?? 0);
  };
  const refreshPointer = (): void => {
    if (!pointer) return;
    const picked = pickAt(pointer.x, pointer.y);
    if (carrying) {
      // Show where the building would land.
      const landing = picked.type === 'plot' || picked.type === 'building' ? picked : { type: 'building' as const, buildingId: carrying };
      view.setSelection(landing);
      return;
    }
    // The sightseeing view moves the scene under a still pointer; nothing is being pointed at then.
    const target = picked.type === 'none' || rig.sightseeing ? null : picked;
    if (pointerMoved || keyOf(target) !== hoverKey) emitHover(target);
    pointerMoved = false;
  };
  const stopCarrying = (): void => {
    carrying = null;
    canvas.style.cursor = '';
    view.setSelection(chosen);
  };
  const onPointerMove = (event: PointerEvent): void => {
    pointer = { x: event.clientX, y: event.clientY };
    pointerMoved = true;
  };
  const onPointerLeave = (): void => {
    if (carrying) return;
    pointer = null;
    emitHover(null);
  };
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    pointer = { x: event.clientX, y: event.clientY };
    const target = pickAt(event.clientX, event.clientY);
    const buildingId = target.type === 'building' ? target.buildingId : null;
    const now = performance.now();
    if (buildingId && buildingId === lastPress.buildingId && now - lastPress.time < renderConfig.click.doubleClickMs) {
      carrying = buildingId;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture?.(event.pointerId);
      emitHover(null);
    }
    lastPress = { time: now, buildingId };
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || !carrying) return;
    const buildingId = carrying;
    const target = pickAt(event.clientX, event.clientY);
    canvas.releasePointerCapture?.(event.pointerId);
    stopCarrying();
    const elsewhere = target.type === 'plot' || (target.type === 'building' && target.buildingId !== buildingId);
    if (elsewhere) for (const listener of [...dropListeners]) listener(buildingId, target);
  };
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', stopCarrying);

  // A re-registered model takes effect on the next frame.
  let stale = false;
  const stopWatching = models.onChange((name) => {
    stale = true;
    if (name === BLOCK_MODEL) environment.rebuild();
  });

  let islandId: string | null = null;
  let lastTimeSec: number | null = null;
  let disposed = false;

  const resize = (width: number, height: number): void => {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, renderConfig.maxPixelRatio));
    // The page lays the canvas out; only the drawing buffer is resized here.
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
  };
  resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);

  return {
    models,
    dayTime: {
      parts: theme.dayNight.keyframes.map((keyframe) => ({
        at: keyframe.at,
        name: keyframe.name,
        color: `#${rgbToHex(lerpRgb(hexToRgb(keyframe.skyHorizon), hexToRgb(keyframe.skyTop), 0.5)).toString(16).padStart(6, '0')}`,
      })),
      phase: () => environment.phase,
      setPhase: (phase: number) => environment.setPhase(phase),
    },
    looks: {
      names: LOOK_NAMES,
      current: () => lookName,
      set(name: string): void {
        if (!isLook(name) || name === lookName) return;
        lookName = name;
        applyLook(renderer, LOOKS[name]);
        environment.setLook(LOOKS[name]);
        try {
          globalThis.localStorage?.setItem(LOOK_STORAGE_KEY, name);
        } catch {
          // Not remembered, but it still applies.
        }
      },
    },
    render(prev: GameSnapshot, curr: GameSnapshot, alpha: number, realTimeSec: number): void {
      if (disposed) return;
      if (curr.island.id !== islandId) {
        islandId = curr.island.id;
        const layout = catalog.islands[islandId]?.layout ?? null;
        environment.setLayout(layout);
        view.setLayout(layout);
        effects.clear();
        if (layout) rig.setTarget((layout.bounds.minX + layout.bounds.maxX) / 2, (layout.bounds.minZ + layout.bounds.maxZ) / 2);
      }
      if (stale) {
        stale = false;
        view.clear();
        effects.clear();
      }
      const dt = lastTimeSec === null ? 0 : clamp(realTimeSec - lastTimeSec, 0, renderConfig.maxFrameSec);
      lastTimeSec = realTimeSec;
      rig.update(dt);
      // Windows, street lamps and headlights come on as it gets dark.
      materials.setNight(environment.update(realTimeSec));
      view.update(prev.island.id === curr.island.id ? prev : null, curr, alpha, dt);
      latest = curr;
      // A selected vehicle is followed; when it is gone the camera goes back by itself.
      const followed = chosen.type === 'vehicle' ? view.vehiclePoint(chosen.vehicleId) : null;
      rig.follow(followed);
      // Its card hangs beside it: tell where on the page that is.
      if (followed) {
        const rect = canvas.getBoundingClientRect();
        anchorPoint.set(followed.x, followed.y + renderConfig.vehicle.cardHeight, followed.z).project(rig.camera);
        const anchor = { clientX: rect.left + (anchorPoint.x * 0.5 + 0.5) * rect.width, clientY: rect.top + (-anchorPoint.y * 0.5 + 0.5) * rect.height };
        for (const listener of [...anchorListeners]) listener(anchor);
      } else if (anchored) {
        for (const listener of [...anchorListeners]) listener(null);
      }
      anchored = followed !== null;
      effects.update(dt, rig.camera);
      refreshPointer();
      renderer.render(scene, rig.camera);
    },
    resize,
    setSelection(selection: Selection): void {
      chosen = selection;
      if (!carrying) view.setSelection(selection);
    },
    onPick(listener: (target: PickTarget) => void): void {
      listeners.push(listener);
    },
    onHover(listener): void {
      hoverListeners.push(listener);
    },
    onDrop(listener): void {
      dropListeners.push(listener);
    },
    onVehicleAnchor(listener): void {
      anchorListeners.push(listener);
    },
    handleEvents(events: GameEvent[]): void {
      const layout = islandId === null ? null : (catalog.islands[islandId]?.layout ?? null);
      if (!latest || !layout) return;
      const sizes = renderConfig.boxes;
      const facilityOf = (channelId: string | null) => {
        const facility = latest!.island.facilities.find((candidate) => candidate.channelId === channelId);
        return facility ? layout.facilities.find((def) => def.id === facility.id) : undefined;
      };
      for (const event of events) {
        if (event.type === 'sale') {
          const def = facilityOf(event.channelId);
          if (def) effects.sale(def.id, siteToWorld(def, 0, sizes.siteOffsetZ), event.amount);
        } else if (event.type === 'upgraded' && event.scope === 'building') {
          const building = latest.island.buildings.find((candidate) => candidate.id === event.targetId);
          const plot = building && layout.plots.find((candidate) => candidate.id === building.plotId);
          if (building && plot) {
            const at = siteToWorld(plot, 0, sizes.siteOffsetZ + sizes.buildingOffsetZ);
            if (effects.upgrade(building.id, at, sizes.building[1])) view.bounce(building.id);
          }
        } else if (event.type === 'upgraded' && (event.scope === 'inbound' || event.scope === 'sale')) {
          const def = facilityOf(event.targetId);
          if (def && effects.upgrade(def.id, siteToWorld(def, 0, sizes.siteOffsetZ), sizes.building[1])) view.bounce(def.id);
        }
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopWatching();
      listeners.length = 0;
      hoverListeners.length = 0;
      dropListeners.length = 0;
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', stopCarrying);
      rig.dispose();
      view.dispose();
      effects.dispose();
      environment.dispose();
      kit.dispose();
      materials.dispose();
      renderer.dispose();
    },
  };
}

export { ModelRegistry, type ModelFactory } from './ModelRegistry';
export { defaultTheme, type Theme } from './theme';
