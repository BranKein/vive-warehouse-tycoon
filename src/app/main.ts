/**
 * Entry point: builds the simulation, the 3D view, the HTML overlay and the
 * save store, and connects them through the game loop.
 */
import { catalog } from '@/content';
import type { CommandResult, GameCommands, GameEngine, SaveController, SaveData, SaveStore, Selection } from '@/contracts';
import { createRenderer } from '@/render';
import { CloudSync, browserStorage, createCloudProviders, createSaveStore, currentDeviceName, migrate } from '@/save';
import { createGame } from '@/sim';
import { TICKS_PER_SECOND } from '@/core/time';
import { createUI } from '@/ui';
import { gameAreaWidth, setupAdRail } from './adRail';
import { APP_CONFIG } from './config';
import { GameLoop } from './GameLoop';
import './app.css';

async function start(): Promise<void> {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui') as HTMLElement;
  const store = createSaveStore();

  /** Builds a game from a stored save. A save that cannot be read is reported and skipped. */
  const restore = (data: SaveData | null): GameEngine | null => {
    if (!data) return null;
    try {
      return createGame({ catalog, save: migrate(data) });
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const autoSaved = await store.getAuto().catch(() => null);
  const restored = restore(autoSaved);
  // The next auto save would overwrite a save that could not be read; keep it among the manual saves instead.
  if (autoSaved && !restored) await store.addManual(autoSaved).catch((error: unknown) => console.error(error));
  let engine: GameEngine = restored ?? createGame({ catalog });
  let selection: Selection = { type: 'none' };

  const renderer = createRenderer(canvas, { catalog });
  const loop = new GameLoop(engine, {
    onFrame(prev, curr, alpha, realTimeSec) {
      const events = engine.drainEvents();
      if (events.length > 0) {
        renderer.handleEvents(events);
        ui.handleEvents(events);
      }
      ui.update(curr);
      renderer.render(prev, curr, alpha, realTimeSec);
    },
    onAway(earned, awaySeconds) {
      ui.showAwayNotice(earned, awaySeconds);
    },
  });

  // The UI keeps this one object for the whole session, while the engine
  // behind it is replaced on load and reset. Every command also asks the
  // loop for a fresh snapshot, so its effect shows without waiting for a tick.
  const changed = <T>(result: T): T => {
    loop.invalidate();
    return result;
  };
  const commands: GameCommands = {
    build: (plotId, typeId): CommandResult => changed(engine.commands.build(plotId, typeId)),
    demolish: (buildingId) => changed(engine.commands.demolish(buildingId)),
    moveBuilding: (buildingId, plotId) => changed(engine.commands.moveBuilding(buildingId, plotId)),
    upgradeBuilding: (buildingId, trackId) => changed(engine.commands.upgradeBuilding(buildingId, trackId)),
    upgradeChannel: (channelId, trackId) => changed(engine.commands.upgradeChannel(channelId, trackId)),
    upgradeGlobal: (trackId) => changed(engine.commands.upgradeGlobal(trackId)),
    unlock: (unlockId) => changed(engine.commands.unlock(unlockId)),
    collectSpecialCargo: (id) => changed(engine.commands.collectSpecialCargo(id)),
    setSpeed: (speed) => changed(engine.commands.setSpeed(speed)),
    setAutoPilot: (enabled) => changed(engine.commands.setAutoPilot(enabled)),
    switchIsland: (islandId) => changed(engine.commands.switchIsland(islandId)),
  };

  const setSelection = (next: Selection): void => {
    selection = next;
    renderer.setSelection(next);
  };

  const useEngine = (next: GameEngine): void => {
    engine = next;
    loop.setEngine(next);
    setSelection({ type: 'none' });
    ui.setSelection(selection);
  };

  const load = (data: SaveData | null): boolean => {
    const next = restore(data);
    if (!next) return false;
    useEngine(next);
    return true;
  };

  const cloud = createCloud(() => engine.serialize(), store, (data) => {
    if (!load(data)) return false;
    // The loaded game becomes this device's auto save, so it is what the next visit opens.
    void putAuto();
    return true;
  });

  const putAuto = (): Promise<void> => store.putAuto(engine.serialize()).catch((error: unknown) => console.error(error));
  /** `leaving`: the tab is being hidden or closed, when the cloud copy matters most. */
  const autoSave = (leaving = false): void => {
    void putAuto();
    void cloud?.backup({ force: leaving });
  };

  const saves: SaveController = {
    saveManual: async () => {
      const entry = await store.addManual(engine.serialize());
      void cloud?.backup({ force: true });
      return entry;
    },
    listManual: () => store.listManual(),
    loadManual: async (id) => load(await store.getManual(id)),
    deleteManual: (id) => store.deleteManual(id),
    hasAuto: async () => (await store.getAuto()) !== null,
    loadAuto: async () => load(await store.getAuto()),
    reset: async () => {
      await store.clear();
      useEngine(createGame({ catalog }));
    },
  };

  const ui = createUI(uiRoot, {
    catalog,
    commands,
    saves,
    ...(cloud ? { cloud } : {}),
    looks: renderer.looks,
    dayTime: renderer.dayTime,
    onSelectionChange: setSelection,
  });

  renderer.onPick((target) => {
    if (target.type === 'specialCargo') {
      commands.collectSpecialCargo(target.id);
      return;
    }
    setSelection(target);
    ui.setSelection(target);
  });

  renderer.onHover((target, clientX, clientY) => ui.setHover(target, clientX, clientY));
  renderer.onVehicleAnchor((anchor) => ui.setVehicleAnchor(anchor));
  renderer.onDrop((buildingId, target) => {
    // Dropping on a building means its plot: the two swap places.
    const plotId =
      target.type === 'plot'
        ? target.plotId
        : target.type === 'building'
          ? engine.snapshot().island.buildings.find((building) => building.id === target.buildingId)?.plotId
          : undefined;
    if (plotId) commands.moveBuilding(buildingId, plotId);
  });

  // With an ad rail on screen the game gets only the width beside it (the CSS does the same).
  const layoutAdRail = setupAdRail();
  const resize = (): void => renderer.resize(gameAreaWidth(window.innerWidth, layoutAdRail()), window.innerHeight);
  window.addEventListener('resize', resize);
  resize();

  // Hidden tab: no frames are drawn, a timer catches the simulation up instead.
  let hiddenTimer: number | null = null;
  const hiddenStep = (): void => {
    if (loop.hiddenStep(performance.now()) === 0) return;
    // Nothing is drawn, so only the notifications are kept.
    ui.handleEvents(engine.drainEvents());
  };
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    if (!visible) autoSave(true);
    loop.setVisible(visible, performance.now());
    if (visible && hiddenTimer !== null) {
      window.clearInterval(hiddenTimer);
      hiddenTimer = null;
    } else if (!visible && hiddenTimer === null) {
      hiddenTimer = window.setInterval(hiddenStep, APP_CONFIG.hiddenStepIntervalMs);
    }
  });
  window.addEventListener('pagehide', () => autoSave(true));
  window.setInterval(() => autoSave(), APP_CONFIG.autoSaveIntervalSeconds * 1000);
  void cloud?.start();

  // Dev server only: runs the game ahead with auto mode on, to reach a later stage quickly.
  // `?skip=90` in the address skips 90 minutes; `?skip=ship` or `?skip=plane` runs until one is on the board.
  if (import.meta.env.DEV) {
    const skip = (until: (snapshot: ReturnType<GameEngine['snapshot']>) => boolean, maxMinutes: number): number => {
      const wasAuto = engine.snapshot().autoPilot.enabled;
      engine.commands.setAutoPilot(true);
      const step = 5 * TICKS_PER_SECOND;
      let ticks = 0;
      while (ticks < maxMinutes * 60 * TICKS_PER_SECOND && !until(engine.snapshot())) {
        engine.tick(step);
        ticks += step;
      }
      engine.commands.setAutoPilot(wasAuto);
      engine.drainEvents();
      loop.setEngine(engine);
      autoSave();
      return ticks / TICKS_PER_SECOND / 60;
    };
    const skipTo = (what: string): number => {
      const minutes = Number(what);
      if (Number.isFinite(minutes) && minutes > 0) return skip(() => false, minutes);
      if (what === 'ship' || what === 'plane') return skip((snapshot) => snapshot.island.vehicles.some((vehicle) => vehicle.kind === what), 24 * 60);
      return 0;
    };
    Object.assign(globalThis, { __wtSkip: skipTo });
    const url = new URL(window.location.href);
    const asked = url.searchParams.get('skip');
    if (asked) {
      console.info(`[dev] skipped ${skipTo(asked).toFixed(1)} minutes`);
      url.searchParams.delete('skip');
      window.history.replaceState(null, '', url);
    }
  }

  // The intro in index.html (title and blurb for search engines and slow loads) fades out after the first frame.
  let intro = document.getElementById('loading');
  const frame = (now: number): void => {
    loop.frame(now);
    if (intro) {
      const shown = intro;
      intro = null;
      shown.style.opacity = '0';
      window.setTimeout(() => shown.remove(), 400);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/**
 * Cloud saves, when the build has a provider key. On the dev server `?cloud=fake` uses a pretend cloud in
 * `localStorage` that every tab shares, and `?device=Phone` names the tab, to try two devices side by side.
 */
function createCloud(current: () => SaveData, store: SaveStore, load: (data: SaveData) => boolean): CloudSync | null {
  const params = new URLSearchParams(window.location.search);
  const fake = import.meta.env.DEV && params.get('cloud') === 'fake';
  const providers = createCloudProviders({ googleClientId: __GOOGLE_OAUTH_CLIENT_ID__, fake }, fake ? browserStorage() : undefined);
  if (providers.length === 0) return null;
  return new CloudSync({
    providers,
    current,
    localSavedAt: async () => (await store.getAuto())?.savedAt ?? null,
    load,
    device: (fake && params.get('device')) || currentDeviceName(),
  });
}

void start();
