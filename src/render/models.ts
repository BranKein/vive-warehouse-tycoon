/**
 * Dev page: shows the models of the registry one at a time (or all of them in
 * rows), under the game's own light at any time of day.
 * Open /src/render/models.html on the Vite dev server. Not part of the game build.
 * The list is read from the registry, so a newly registered model shows up by itself.
 * `#<model name>` or `#all` in the address picks the view; `&t=0.3` sets the time of day.
 */
import {
  ACESFilmicToneMapping,
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
import { MaterialLibrary } from './materials';
import { ModelRegistry } from './ModelRegistry';
import { registerDefaultModels, STYLE_SAMPLES } from './models/index';
import { Kit } from './models/kit';
import { defaultTheme as theme } from './theme';

const ALL = 'all';
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
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = renderConfig.exposure;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const materials = new MaterialLibrary(theme);
const kit = new Kit(theme, materials);
const registry = new ModelRegistry(kit);
registerDefaultModels(registry, kit);

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

let current = '';
function show(name: string): void {
  current = name;
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
  pad.visible = padInput.checked && name.startsWith('building.');
  frame(holder);
  for (const button of list.querySelectorAll('button')) button.setAttribute('aria-current', String(button.dataset.name === name));
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

function buildList(): void {
  list.replaceChildren();
  const add = (name: string, label: string, sample = false): void => {
    const button = document.createElement('button');
    button.dataset.name = name;
    button.textContent = label;
    if (sample) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '시안';
      button.append(tag);
    }
    button.addEventListener('click', () => show(name));
    list.append(button);
  };
  add(ALL, '전체 보기');
  let kind = '';
  // Style samples first within their kind, so the models under review are easy to find.
  const names = registry.names().sort((a, b) => {
    const [ka, kb] = [a.split('.')[0]!, b.split('.')[0]!];
    if (ka !== kb) return ka.localeCompare(kb);
    return Number(STYLE_SAMPLES.includes(b)) - Number(STYLE_SAMPLES.includes(a)) || a.localeCompare(b);
  });
  for (const name of names) {
    const prefix = name.split('.')[0]!;
    if (prefix !== kind) {
      kind = prefix;
      const heading = document.createElement('h2');
      heading.textContent = prefix.toUpperCase();
      list.append(heading);
    }
    add(name, name.slice(prefix.length + 1), STYLE_SAMPLES.includes(name));
  }
}

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
  buildList();
  show(current);
});

// For poking at the view from the browser console.
Object.assign(window, { modelView: { camera, controls, registry, show } });

buildList();
fit();
show(hashName === ALL || registry.has(hashName) ? hashName : (STYLE_SAMPLES[0] ?? registry.names()[0] ?? ALL));

const tick = (): void => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
