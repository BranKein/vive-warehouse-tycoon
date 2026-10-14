/**
 * Dev page: shows the models of the registry one at a time (or all of them in
 * rows), under the game's own light at any time of day.
 * Open /src/render/models.html on the Vite dev server. Not part of the game build.
 * The list is read from the registry, so a newly registered model shows up by itself.
 * `#<model name>` or `#all` in the address picks the view; `&t=0.3` sets the time of day.
 *
 * Hand-drawn models are reviewed here: each is "확인 필요" until the user
 * approves it, and goes back to that when its shape changes. Approvals and
 * notes are saved through the dev server into models/review.json.
 */
import {
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { renderConfig } from './config';
import { celestialState, rgbToHex, sampleDayNight } from './dayNight';
import { applyLook, DEFAULT_LOOK, LOOKS } from './looks';
import { MaterialLibrary } from './materials';
import { ModelRegistry } from './ModelRegistry';
import { auditModel, modelFingerprint, type AuditIssue } from './models/audit';
import { registerDefaultModels } from './models/index';
import { Kit } from './models/kit';
import { carrierColor, defaultTheme as theme, itemColor } from './theme';
import { catalog } from '@/content';
import { ko } from '@/i18n/ko';

const ALL = 'all';
const REVIEW_URL = '/__models/review';

/** One entry of models/review.json. `approved` is the fingerprint of the model as it was when approved. */
interface ReviewEntry {
  approved?: string;
  note?: string;
}
type ReviewState = 'approved' | 'changed' | 'pending';
let review: Record<string, ReviewEntry> = {};
const fingerprints = new Map<string, string>();
const issuesOf = new Map<string, AuditIssue[]>();
/** Plot frame the building models are drawn for. */
const PLOT = { width: 16, depth: 14 };

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const list = document.querySelector<HTMLElement>('#list')!;
const info = document.querySelector<HTMLElement>('#info')!;
const timeInput = document.querySelector<HTMLInputElement>('#time')!;
const timeName = document.querySelector<HTMLElement>('#time-name')!;
const spinInput = document.querySelector<HTMLInputElement>('#spin')!;
const gridInput = document.querySelector<HTMLInputElement>('#grid')!;
const padInput = document.querySelector<HTMLInputElement>('#pad')!;

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
applyLook(renderer, LOOKS[DEFAULT_LOOK]);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const materials = new MaterialLibrary(theme);
const kit = new Kit(theme, materials);
const registry = new ModelRegistry(kit);
/** Models drawn by hand: the ones under review. The rest are old drafts. */
const handDrawn = new Set(registerDefaultModels(registry, kit));

const scene = new Scene();
const background = new Color();
scene.background = background;
const sun = new DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.05;
const ambient = new HemisphereLight(0xffffff, 0xffffff, 1);
const ground = new Mesh(new PlaneGeometry(2000, 2000), materials.solid(theme.ground.grass));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
const pad = kit.box(PLOT.width, 0.1, PLOT.depth, theme.ground.plotPad, { y: -0.1, r: 0.04 });
pad.receiveShadow = true;
const grid = new GridHelper(60, 60, 0x8fa88a, 0xa9c79c);
grid.position.y = 0.005;
const holder = new Group();
scene.add(sun, sun.target, ambient, ground, pad, grid, holder);

const camera = new PerspectiveCamera(renderConfig.camera.fovDeg, 1, 0.5, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.autoRotateSpeed = 1.2;

const bounds = new Box3();
const size = new Vector3();
const centre = new Vector3();
let reach = 20;

/** Fingerprint and problems of every hand-drawn model, worked out once per (re)load. */
function inspect(): void {
  fingerprints.clear();
  issuesOf.clear();
  for (const name of handDrawn) {
    const model = registry.create(name);
    fingerprints.set(name, modelFingerprint(model));
    issuesOf.set(name, auditModel(model));
  }
}

function stateOf(name: string): ReviewState {
  const approved = review[name]?.approved;
  if (!approved) return 'pending';
  return approved === fingerprints.get(name) ? 'approved' : 'changed';
}

function saveReview(): void {
  void fetch(REVIEW_URL, { method: 'POST', body: JSON.stringify(review) });
}

function make(name: string): Object3D {
  const model = registry.create(name);
  model.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return model;
}

function frame(target: Object3D): void {
  bounds.setFromObject(target);
  bounds.getSize(size);
  bounds.getCenter(centre);
  reach = Math.max(size.x, size.y, size.z, 2);
  const distance = reach * 1.55;
  controls.target.copy(centre);
  camera.position.set(centre.x + distance * 0.62, centre.y + distance * 0.5, centre.z + distance * 0.72);
  camera.near = reach / 100;
  camera.far = reach * 60;
  camera.updateProjectionMatrix();
  const half = reach * 1.2;
  const shadow = sun.shadow.camera;
  shadow.left = shadow.bottom = -half;
  shadow.right = shadow.top = half;
  shadow.near = 1;
  shadow.far = half * 8;
  shadow.updateProjectionMatrix();
  setTime(Number(timeInput.value));
}

/** A colour a model is painted in somewhere in the game, and where. */
interface Swatch {
  color: number;
  label: string;
}

const word = (key: string): string => (ko as Record<string, string>)[key] ?? key;

/** Every colour the game paints carriers in: by owner and by what its building makes. */
function carrierSwatches(): Swatch[] {
  const byColor = new Map<number, string[]>();
  const add = (color: number, label: string): void => void byColor.set(color, [...(byColor.get(color) ?? []), label]);
  for (const building of Object.values(catalog.buildings)) {
    const item = catalog.recipes[building.recipe]?.outputs[0]?.item;
    const made = item ? ` → ${word(`item.${item}.name`)}` : '';
    add(carrierColor(theme, building.category, item), `${word(`category.${building.category}`)} · ${word(`building.${building.id}.name`)}${made}`);
  }
  add(carrierColor(theme, 'facility'), '물류 시설');
  return [...byColor].map(([color, labels]) => ({ color, label: labels.join(', ') }));
}

/** The colours the game tints a model with, for the models it tints. */
const SWATCHES: Record<string, () => Swatch[]> = {
  'vehicle.carrier': carrierSwatches,
  'vehicle.wasteTanker': carrierSwatches,
  'vehicle.forklift': carrierSwatches,
  'prop.crate': () => Object.keys(catalog.items).map((item) => ({ color: itemColor(theme, item), label: word(`item.${item}.name`) })),
};

const swatchBox = document.querySelector<HTMLElement>('#swatches')!;
const swatchList = document.querySelector<HTMLElement>('#swatch-list')!;
const swatchName = document.querySelector<HTMLElement>('#swatch-name')!;
const TINTABLE_DARK = materials.tintableDark.color.clone();

/** Paints the tinted materials the way the game does for one copy; null puts the plain colours back. */
function paint(color: number | null): void {
  materials.paint.color.set(color ?? theme.vehicles.carrierCab);
  materials.tintable.color.set(color ?? 0xffffff);
  materials.tintableDark.color.copy(TINTABLE_DARK).multiply(materials.tintable.color);
}

function showSwatches(name: string): void {
  const swatches = SWATCHES[name]?.() ?? [];
  paint(null);
  swatchBox.hidden = swatches.length === 0;
  swatchName.textContent = '기본';
  swatchList.replaceChildren(
    ...swatches.map((swatch) => {
      const button = document.createElement('button');
      button.style.background = `#${swatch.color.toString(16).padStart(6, '0')}`;
      button.title = swatch.label;
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') !== 'true';
        for (const other of swatchList.children) other.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', String(on));
        paint(on ? swatch.color : null);
        swatchName.textContent = on ? swatch.label : '기본';
      });
      return button;
    }),
  );
}

let current = '';
function show(name: string): void {
  current = name;
  showSwatches(name);
  holder.clear();
  if (name === ALL) {
    // Rows by kind, each model on a cell as wide as the widest of its row.
    const rows = new Map<string, string[]>();
    for (const entry of registry.names()) {
      const kind = entry.split('.')[0]!;
      rows.set(kind, [...(rows.get(kind) ?? []), entry]);
    }
    let z = 0;
    for (const names of rows.values()) {
      const models = names.map(make);
      const cell = Math.max(...models.map((model) => bounds.setFromObject(model).getSize(size).x), 2) + 3;
      const depth = Math.max(...models.map((model) => bounds.setFromObject(model).getSize(size).z), 2) + 4;
      models.forEach((model, index) => {
        model.position.set((index - (models.length - 1) / 2) * cell, 0, z + depth / 2);
        holder.add(model);
      });
      z += depth;
    }
    info.textContent = `전체 ${registry.names().length}개`;
  } else {
    const model = make(name);
    holder.add(model);
    bounds.setFromObject(model).getSize(size);
    const meshes: Mesh[] = [];
    model.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh);
    });
    info.textContent = `${name}  ·  크기 ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} (가로 × 높이 × 세로)  ·  조각 ${meshes.length}개`;
  }
  pad.visible = padInput.checked && (name.startsWith('building.') || name.startsWith('facility.'));
  showReview();
  frame(holder);
  for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(button.dataset.name === name));
  list.querySelector('button[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  history.replaceState(null, '', `#${name}&t=${timeInput.value}`);
}

function setTime(phase: number): void {
  const sample = sampleDayNight(theme.dayNight.keyframes, phase);
  background.setHex(rgbToHex(sample.skyHorizon));
  sun.color.setHex(rgbToHex(sample.light));
  sun.intensity = sample.lightIntensity;
  ambient.color.setHex(rgbToHex(sample.ambientSky));
  ambient.groundColor.setHex(rgbToHex(sample.ambientGround));
  ambient.intensity = sample.ambientIntensity;
  materials.setNight(sample.night);
  const light = celestialState(phase, theme.dayNight).light;
  sun.target.position.copy(controls.target);
  sun.position.set(light.x, light.y, light.z).multiplyScalar(reach * 3).add(controls.target);
  const keyframes = theme.dayNight.keyframes;
  timeName.textContent = [...keyframes].reverse().find((keyframe) => keyframe.at <= phase)?.name ?? keyframes[0]!.name;
}

const reviewBox = document.querySelector<HTMLElement>('#review')!;
const reviewState = document.querySelector<HTMLElement>('#review-state')!;
const reviewIssues = document.querySelector<HTMLElement>('#review-issues')!;
const reviewNote = document.querySelector<HTMLTextAreaElement>('#review-note')!;
const approveButton = document.querySelector<HTMLButtonElement>('#review-approve')!;
const nextButton = document.querySelector<HTMLButtonElement>('#review-next')!;
let pendingOnly = false;

const STATE_LABEL: Record<ReviewState, string> = { approved: '승인', changed: '바뀜 · 확인 필요', pending: '확인 필요' };

function showReview(): void {
  reviewBox.hidden = !handDrawn.has(current);
  if (reviewBox.hidden) return;
  const state = stateOf(current);
  reviewState.textContent = `${current} — ${STATE_LABEL[state]}`;
  approveButton.textContent = state === 'approved' ? '승인 취소' : '승인';
  approveButton.className = state === 'approved' ? 'undo' : '';
  reviewNote.value = review[current]?.note ?? '';
  reviewIssues.replaceChildren(
    ...(issuesOf.get(current) ?? []).map((issue) => {
      const item = document.createElement('li');
      const at = issue.at.map((value) => value.toFixed(1)).join(', ');
      item.textContent = `${issue.kind === 'overlap' ? '겹친 면(깜빡임)' : '떠 있는 조각'} (${at})`;
      return item;
    }),
  );
}

/** Names in list order: by kind, hand-drawn before drafts, those still to review first. */
function orderedNames(): string[] {
  const rank = (name: string): number => (!handDrawn.has(name) ? 2 : stateOf(name) === 'approved' ? 1 : 0);
  return registry.names().sort((a, b) => {
    const [ka, kb] = [a.split('.')[0]!, b.split('.')[0]!];
    if (ka !== kb) return ka.localeCompare(kb);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

function buildList(): void {
  list.replaceChildren();
  const add = (name: string, label: string): void => {
    const button = document.createElement('button');
    button.dataset.name = name;
    button.textContent = label;
    if (handDrawn.has(name)) {
      const state = stateOf(name);
      const tag = document.createElement('span');
      tag.className = `tag ${state === 'approved' ? 'ok' : 'todo'}`;
      tag.textContent = STATE_LABEL[state];
      button.append(tag);
      const issues = issuesOf.get(name)?.length ?? 0;
      if (issues > 0) {
        const bad = document.createElement('span');
        bad.className = 'tag bad';
        bad.textContent = `문제 ${issues}`;
        button.append(bad);
      }
    } else if (name !== ALL) {
      button.className = 'draft';
      button.title = '예전 초안 (검토 대상 아님)';
    }
    button.setAttribute('aria-current', String(name === current));
    button.addEventListener('click', () => show(name));
    list.append(button);
  };
  const reviewed = [...handDrawn];
  const approved = reviewed.filter((name) => stateOf(name) === 'approved').length;
  const summary = document.createElement('div');
  summary.id = 'summary';
  summary.textContent = `승인 ${approved} / ${reviewed.length} · 확인 필요 ${reviewed.length - approved}`;
  const filter = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = pendingOnly;
  box.addEventListener('change', () => {
    pendingOnly = box.checked;
    buildList();
  });
  filter.append(box, '확인 필요만 보기');
  summary.append(filter);
  list.append(summary);
  add(ALL, '전체 보기');
  let kind = '';
  for (const name of orderedNames()) {
    if (pendingOnly && (!handDrawn.has(name) || stateOf(name) === 'approved')) continue;
    const prefix = name.split('.')[0]!;
    if (prefix !== kind) {
      kind = prefix;
      const heading = document.createElement('h2');
      heading.textContent = prefix.toUpperCase();
      list.append(heading);
    }
    add(name, name.slice(prefix.length + 1));
  }
}

approveButton.addEventListener('click', () => {
  const entry = (review[current] ??= {});
  if (stateOf(current) === 'approved') delete entry.approved;
  else entry.approved = fingerprints.get(current) ?? '';
  saveReview();
  buildList();
  showReview();
});
nextButton.addEventListener('click', () => {
  const todo = orderedNames().filter((name) => handDrawn.has(name) && stateOf(name) !== 'approved');
  const next = todo[(todo.indexOf(current) + 1) % Math.max(1, todo.length)];
  if (next) show(next);
});
reviewNote.addEventListener('change', () => {
  const entry = (review[current] ??= {});
  if (reviewNote.value.trim()) entry.note = reviewNote.value.trim();
  else delete entry.note;
  saveReview();
});

const fit = (): void => {
  const { clientWidth, clientHeight } = canvas.parentElement!;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(1, clientHeight);
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', fit);

const [hashName = '', hashTime = ''] = decodeURIComponent(location.hash.slice(1)).split('&t=');
timeInput.value = hashTime || '0.3';
timeInput.addEventListener('input', () => {
  setTime(Number(timeInput.value));
  history.replaceState(null, '', `#${current}&t=${timeInput.value}`);
});
spinInput.addEventListener('change', () => (controls.autoRotate = spinInput.checked));
gridInput.addEventListener('change', () => (grid.visible = gridInput.checked));
padInput.addEventListener('change', () => show(current));
controls.autoRotate = spinInput.checked;
// A model that is registered again (hot reload, a loaded file) refreshes the list and the view.
registry.onChange(() => {
  inspect();
  buildList();
  show(current);
});

// For poking at the view from the browser console.
Object.assign(window, { modelView: { camera, controls, registry, show } });

inspect();
try {
  review = (await (await fetch(REVIEW_URL)).json()) as Record<string, ReviewEntry>;
} catch {
  // Opened without the dev server: reviewing still works, nothing is saved.
}
fit();
show(hashName === ALL || registry.has(hashName) ? hashName : (orderedNames().find((name) => handDrawn.has(name)) ?? ALL));
buildList();

const tick = (): void => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
