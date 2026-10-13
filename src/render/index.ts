import { ACESFilmicToneMapping, PCFShadowMap, Scene, Vector3, WebGLRenderer } from 'three';
import type { GameEvent, GameRenderer, GameSnapshot, PickTarget, RendererOptions, Selection } from '@/contracts';
import { BLOCK_MODEL, registerBoxModels } from './boxModels';
import { CameraRig } from './CameraRig';
import { renderConfig } from './config';
import { Environment } from './Environment';
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
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = renderConfig.exposure;

  const materials = new MaterialLibrary(theme);
  const kit = new Kit(theme, materials);
  const models = new ModelRegistry(kit);
  const facilityKinds = new Set<string>();
  for (const island of Object.values(catalog.islands)) {
    for (const facility of island.layout.facilities) facilityKinds.add(facility.kind);
  }
  registerBoxModels(models, Object.keys(catalog.buildings), facilityKinds);

  const scene = new Scene();
  const environment = new Environment(scene, models, theme, materials);
  const view = new ViewSync(models, theme);
  scene.add(view.group);

  const listeners: Array<(target: PickTarget) => void> = [];
  const pickPoint = new Vector3();
  const rig = new CameraRig(canvas, (clientX, clientY) => {
    if (listeners.length === 0) return;
    const ndc = pointerToNdc(clientX, clientY, canvas.getBoundingClientRect());
    const origin = rig.camera.position;
    pickPoint.set(ndc.x, ndc.y, 0.5).unproject(rig.camera).sub(origin).normalize();
    const ray: Ray = { ox: origin.x, oy: origin.y, oz: origin.z, dx: pickPoint.x, dy: pickPoint.y, dz: pickPoint.z };
    const target: PickTarget = pickNearest(ray, view.pickProxies())?.target ?? { type: 'none' };
    for (const listener of [...listeners]) listener(target);
  });

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
    render(prev: GameSnapshot, curr: GameSnapshot, alpha: number, realTimeSec: number): void {
      if (disposed) return;
      if (curr.island.id !== islandId) {
        islandId = curr.island.id;
        const layout = catalog.islands[islandId]?.layout ?? null;
        environment.setLayout(layout);
        view.setLayout(layout);
        if (layout) rig.setTarget((layout.bounds.minX + layout.bounds.maxX) / 2, (layout.bounds.minZ + layout.bounds.maxZ) / 2);
      }
      if (stale) {
        stale = false;
        view.clear();
      }
      const dt = lastTimeSec === null ? 0 : clamp(realTimeSec - lastTimeSec, 0, renderConfig.maxFrameSec);
      lastTimeSec = realTimeSec;
      rig.update(dt);
      environment.update(realTimeSec);
      view.update(prev.island.id === curr.island.id ? prev : null, curr, alpha);
      renderer.render(scene, rig.camera);
    },
    resize,
    setSelection(selection: Selection): void {
      view.setSelection(selection);
    },
    onPick(listener: (target: PickTarget) => void): void {
      listeners.push(listener);
    },
    handleEvents(_events: GameEvent[]): void {
      // Nothing reacts to events yet: build, demolish and sale effects belong to the deferred decoration stage.
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopWatching();
      listeners.length = 0;
      rig.dispose();
      view.dispose();
      environment.dispose();
      kit.dispose();
      materials.dispose();
      renderer.dispose();
    },
  };
}

export { ModelRegistry, type ModelFactory } from './ModelRegistry';
export { defaultTheme, type Theme } from './theme';
