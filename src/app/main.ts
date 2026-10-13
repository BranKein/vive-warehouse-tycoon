/**
 * Entry point: builds the simulation, the 3D view, the HTML overlay and the
 * save store, and connects them through the game loop.
 */
import { catalog } from '@/content';
import type { CommandResult, GameCommands, GameEngine, SaveController, SaveData, Selection } from '@/contracts';
import { createRenderer } from '@/render';
import { createSaveStore, migrate } from '@/save';
import { createGame } from '@/sim';
import { createUI } from '@/ui';
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

  let engine: GameEngine = restore(await store.getAuto().catch(() => null)) ?? createGame({ catalog });
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

  const autoSave = (): void => {
    store.putAuto(engine.serialize()).catch((error: unknown) => console.error(error));
  };

  const load = (data: SaveData | null): boolean => {
    const next = restore(data);
    if (!next) return false;
    useEngine(next);
    return true;
  };

  const saves: SaveController = {
    saveManual: () => store.addManual(engine.serialize()),
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

  const resize = (): void => renderer.resize(window.innerWidth, window.innerHeight);
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
    if (!visible) autoSave();
    loop.setVisible(visible, performance.now());
    if (visible && hiddenTimer !== null) {
      window.clearInterval(hiddenTimer);
      hiddenTimer = null;
    } else if (!visible && hiddenTimer === null) {
      hiddenTimer = window.setInterval(hiddenStep, APP_CONFIG.hiddenStepIntervalMs);
    }
  });
  window.addEventListener('pagehide', autoSave);
  window.setInterval(autoSave, APP_CONFIG.autoSaveIntervalSeconds * 1000);

  const frame = (now: number): void => {
    loop.frame(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
