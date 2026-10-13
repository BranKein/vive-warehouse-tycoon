/**
 * Dev page: runs the UI alone on the fixture snapshot. Commands only log to
 * the console (speed and auto mode are also echoed back so their buttons
 * respond). Saves go to a separate IndexedDB database through the real store.
 * Open /src/ui/dev.html on the Vite dev server.
 */
import { catalog } from '@/content';
import type { CommandResult, GameCommands, GameSnapshot, GameSpeed, SaveController, SaveData, Selection } from '@/contracts';
import { bn } from '@/core/BigNum';
import { createFixtureSnapshot } from '@/dev/fixtures';
import { createSaveStore, CURRENT_SAVE_VERSION } from '@/save';
import { createUI } from './index';

let speed: GameSpeed = 1;
let autoPilot = false;
let timeSec = 0;
let current: GameSnapshot = createFixtureSnapshot(catalog, timeSec);

const log = (name: string, ...args: unknown[]): CommandResult => {
  console.log(`[command] ${name}`, ...args);
  return { ok: true };
};

const commands: GameCommands = {
  build: (plotId, typeId) => log('build', plotId, typeId),
  demolish: (buildingId) => log('demolish', buildingId),
  moveBuilding: (buildingId, plotId) => log('moveBuilding', buildingId, plotId),
  upgradeBuilding: (buildingId, trackId) => log('upgradeBuilding', buildingId, trackId),
  upgradeChannel: (channelId, trackId) => log('upgradeChannel', channelId, trackId),
  upgradeGlobal: (trackId) => log('upgradeGlobal', trackId),
  unlock: (unlockId) => log('unlock', unlockId),
  collectSpecialCargo: (id) => log('collectSpecialCargo', id),
  setSpeed: (next) => {
    log('setSpeed', next);
    speed = next;
  },
  setAutoPilot: (enabled) => {
    log('setAutoPilot', enabled);
    autoPilot = enabled;
  },
  switchIsland: (islandId) => log('switchIsland', islandId),
};

const store = createSaveStore({ dbName: 'warehouse-tycoon-ui-dev' });
const makeSave = (): SaveData => ({
  version: CURRENT_SAVE_VERSION,
  savedAt: Date.now(),
  summary: {
    money: current.money.toString(),
    buildings: current.island.buildings.length,
    playSeconds: current.playSeconds,
  },
  state: { timeSec },
});
const restore = (data: SaveData | null): boolean => {
  console.log('[save] load', data);
  const state = data?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state) || typeof state.timeSec !== 'number') return false;
  timeSec = state.timeSec;
  return true;
};
const saves: SaveController = {
  saveManual: () => store.addManual(makeSave()),
  listManual: () => store.listManual(),
  loadManual: async (id) => restore(await store.getManual(id)),
  deleteManual: (id) => store.deleteManual(id),
  hasAuto: async () => (await store.getAuto()) !== null,
  loadAuto: async () => restore(await store.getAuto()),
  reset: async () => {
    await store.clear();
    timeSec = 0;
  },
};
setInterval(() => void store.putAuto(makeSave()), 15000);

const root = document.getElementById('ui') as HTMLElement;
const ui = createUI(root, {
  catalog,
  commands,
  saves,
  onSelectionChange: (selection: Selection) => console.log('[selection]', selection),
});

let lastFrame = performance.now();
function frame(now: number): void {
  timeSec += ((now - lastFrame) / 1000) * speed;
  lastFrame = now;
  const snapshot = createFixtureSnapshot(catalog, timeSec);
  current = {
    ...snapshot,
    speed,
    autoPilot: {
      enabled: autoPilot,
      target: autoPilot ? { key: 'auto.target.upgradeBuilding', params: { building: 'sawmill', track: 'building.level' } } : null,
      targetCost: autoPilot ? snapshot.money.mul(1.5) : null,
    },
  };
  ui.update(current);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Buttons for the things only the app can trigger. Dev-only, so not translated.
const tools = document.getElementById('dev-tools') as HTMLElement;
const tool = (label: string, run: () => void): void => {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', run);
  tools.append(el);
};
tool('away notice', () => ui.showAwayNotice(bn('3.4e9'), 754));
tool('unlock event', () => ui.handleEvents([{ type: 'unlocked', unlockId: 'unlock.building.toolFactory' }]));
tool('special cargo', () => ui.handleEvents([{ type: 'specialCargoCollected', id: 'special-1', reward: bn('1.2e6') }]));
tool('select from scene', () => ui.setSelection({ type: 'building', buildingId: 'b2' }));
tool('select dock', () => ui.setSelection({ type: 'facility', facilityId: 'dock' }));

Object.assign(window, { __ui: ui });
