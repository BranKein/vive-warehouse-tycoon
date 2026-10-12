/**
 * Primitive-built production buildings: low, wide warehouses with a loading
 * dock on the +z side. One parametric builder covers all types; a type is a
 * roof style, a height and a few extras, coloured from the theme.
 *
 * Plot frame (16 wide, 14 deep): the hall sits at the back, the yard with
 * the crate piles is in front of it, raw piles on the left, finished goods
 * on the right, the waste heap beside the hall on the right.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import { buildingPalette } from '../theme';
import type { Anchors, Kit } from './kit';

type Roof = 'flat' | 'gable' | 'sawtooth' | 'barrel';
type Extra =
  | 'chimney'
  | 'stack'
  | 'silos'
  | 'tanks'
  | 'logs'
  | 'dome'
  | 'vents'
  | 'tower'
  | 'office'
  | 'dish'
  | 'bins'
  | 'pipes'
  | 'planters';

interface Shape {
  height: number;
  roof: Roof;
  doors: number;
  extras: Extra[];
}

const SHAPES: Record<string, Shape> = {
  sawmill: { height: 3.0, roof: 'gable', doors: 2, extras: ['logs', 'chimney'] },
  steelMill: { height: 3.2, roof: 'sawtooth', doors: 2, extras: ['stack', 'pipes'] },
  textileMill: { height: 3.0, roof: 'sawtooth', doors: 2, extras: ['vents', 'planters'] },
  refinery: { height: 2.8, roof: 'flat', doors: 2, extras: ['tanks', 'stack', 'pipes'] },
  glassworks: { height: 3.0, roof: 'barrel', doors: 2, extras: ['chimney', 'dome'] },
  flourMill: { height: 3.0, roof: 'gable', doors: 2, extras: ['silos'] },
  wasteDisposal: { height: 2.7, roof: 'flat', doors: 1, extras: ['bins', 'stack', 'vents'] },
  furnitureFactory: { height: 3.4, roof: 'gable', doors: 3, extras: ['office', 'logs'] },
  toolFactory: { height: 3.4, roof: 'sawtooth', doors: 3, extras: ['chimney', 'pipes'] },
  bottleFactory: { height: 3.4, roof: 'barrel', doors: 3, extras: ['tanks', 'vents'] },
  snackFactory: { height: 3.4, roof: 'flat', doors: 3, extras: ['silos', 'vents', 'planters'] },
  partsFactory: { height: 3.4, roof: 'flat', doors: 3, extras: ['dish', 'office', 'vents'] },
  sofaWorkshop: { height: 3.8, roof: 'gable', doors: 3, extras: ['office', 'planters'] },
  packagingPlant: { height: 3.8, roof: 'barrel', doors: 3, extras: ['vents', 'pipes'] },
  applianceFactory: { height: 3.8, roof: 'sawtooth', doors: 3, extras: ['tower', 'stack'] },
  luxuryPackingCenter: { height: 4.2, roof: 'flat', doors: 3, extras: ['tower', 'dome', 'planters'] },
  smartHomeFactory: { height: 4.2, roof: 'flat', doors: 3, extras: ['tower', 'dish', 'vents'] },
  handmadeWorkshop: { height: 2.6, roof: 'gable', doors: 1, extras: ['chimney', 'planters', 'logs'] },
};

const DEFAULT_SHAPE: Shape = { height: 3.0, roof: 'gable', doors: 2, extras: ['chimney'] };

// Hall footprint inside the plot frame.
const HALL_WIDTH = 11;
const HALL_DEPTH = 7.6;
const HALL_Z = -2.8;
const HALL_FRONT = HALL_Z + HALL_DEPTH / 2;
const BASE = 0.25;
const SIDE_X = -6.85;

/** Where the view puts stock piles, the waste heap and the forklift route on a building plot. */
export const BUILDING_ANCHORS: Anchors = {
  inputs: [
    [-6.6, 0, 3.6],
    [-4.4, 0, 3.6],
    [-6.6, 0, 5.8],
    [-4.4, 0, 5.8],
  ],
  outputs: [
    [4.4, 0, 3.6],
    [6.6, 0, 3.6],
    [4.4, 0, 5.8],
    [6.6, 0, 5.8],
  ],
  waste: [[6.95, 0, -3.4]],
  forklift: [
    [0, 0, 3.0],
    [2.7, 0, 4.7],
    [0, 0, 6.3],
    [-2.7, 0, 4.7],
  ],
};

function makeBuilding(kit: Kit, typeId: string, shape: Shape): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, typeId);
  const props = theme.props;
  const window = kit.materials.window;
  const h = shape.height;
  const top = BASE + h;
  const parts: Object3D[] = [];
  const smoke: Array<[number, number, number]> = [];

  // Foundation, walls and a coloured band under the eaves.
  parts.push(kit.box(HALL_WIDTH + 0.6, BASE + 0.05, HALL_DEPTH + 0.6, props.concrete, { z: HALL_Z, r: 0.1 }));
  parts.push(kit.box(HALL_WIDTH, h, HALL_DEPTH, palette.wall, { y: BASE, z: HALL_Z, r: 0.4 }));
  parts.push(kit.box(HALL_WIDTH + 0.08, 0.4, HALL_DEPTH + 0.08, palette.accent, { y: top - 0.85, z: HALL_Z, r: 0.12 }));

  // Loading dock: raised platform, roller doors and an awning.
  parts.push(kit.box(9.4, 0.55, 0.95, props.concrete, { z: HALL_FRONT + 0.42, r: 0.12 }));
  const doorSpan = 8;
  for (let i = 0; i < shape.doors; i += 1) {
    const x = shape.doors === 1 ? 0 : -doorSpan / 2 + 1.3 + (i * (doorSpan - 2.6)) / (shape.doors - 1);
    parts.push(kit.box(2.1, 2.05, 0.18, props.sign, { x, y: 0.5, z: HALL_FRONT, r: 0.08 }));
    parts.push(kit.box(1.75, 1.8, 0.2, props.door, { x, y: 0.55, z: HALL_FRONT + 0.03, r: 0.08 }));
    parts.push(kit.box(1.75, 0.08, 0.22, props.sign, { x, y: 1.15, z: HALL_FRONT + 0.04, r: 0.03 }));
    parts.push(kit.box(1.75, 0.08, 0.22, props.sign, { x, y: 1.7, z: HALL_FRONT + 0.04, r: 0.03 }));
    // Rubber bumpers on the dock edge.
    parts.push(kit.box(0.25, 0.4, 0.2, props.tire, { x: x - 0.7, y: 0.1, z: HALL_FRONT + 0.92, r: 0.06 }));
    parts.push(kit.box(0.25, 0.4, 0.2, props.tire, { x: x + 0.7, y: 0.1, z: HALL_FRONT + 0.92, r: 0.06 }));
  }
  parts.push(
    kit.box(shape.doors === 1 ? 3.4 : doorSpan + 1.2, 0.2, 1.5, palette.roof, {
      y: 2.75,
      z: HALL_FRONT + 0.7,
      rx: 0.14,
      r: 0.1,
    }),
  );

  // Windows on the sides and the back; they light up at night.
  for (let i = 0; i < 3; i += 1) {
    const z = HALL_Z - 2.3 + i * 2.3;
    parts.push(kit.box(0.16, 0.85, 1.2, window, { x: -HALL_WIDTH / 2 - 0.02, y: BASE + 1.0, z, r: 0.07 }));
    parts.push(kit.box(0.16, 0.85, 1.2, window, { x: HALL_WIDTH / 2 + 0.02, y: BASE + 1.0, z, r: 0.07 }));
  }
  for (let i = 0; i < 4; i += 1) {
    parts.push(
      kit.box(1.3, 0.85, 0.16, window, { x: -3.9 + i * 2.6, y: BASE + 1.0, z: HALL_Z - HALL_DEPTH / 2 - 0.02, r: 0.07 }),
    );
  }
  if (shape.doors === 1) {
    parts.push(kit.box(1.3, 0.9, 0.16, window, { x: -3.2, y: BASE + 0.9, z: HALL_FRONT + 0.02, r: 0.07 }));
    parts.push(kit.box(1.3, 0.9, 0.16, window, { x: 3.2, y: BASE + 0.9, z: HALL_FRONT + 0.02, r: 0.07 }));
  }

  // Name board with a round badge in the accent colour.
  parts.push(kit.box(3.0, 0.75, 0.14, props.sign, { x: 0, y: top - 0.82 + 0.0, z: HALL_FRONT + 0.03, r: 0.1 }));
  parts.push(kit.cyl(0.26, 0.26, 0.1, palette.roof, { x: -1.0, y: top - 0.5, z: HALL_FRONT + 0.1, rx: Math.PI / 2 }));
  parts.push(kit.box(1.3, 0.16, 0.06, palette.accent, { x: 0.35, y: top - 0.53, z: HALL_FRONT + 0.1, r: 0.03 }));

  // Roof.
  let roofTop = top;
  switch (shape.roof) {
    case 'flat':
      parts.push(kit.box(HALL_WIDTH + 0.5, 0.45, HALL_DEPTH + 0.5, palette.roof, { y: top - 0.1, z: HALL_Z, r: 0.2 }));
      parts.push(kit.box(HALL_WIDTH - 0.5, 0.1, HALL_DEPTH - 0.5, props.concrete, { y: top + 0.3, z: HALL_Z, r: 0.04 }));
      roofTop = top + 0.38;
      break;
    case 'gable':
      parts.push(kit.box(HALL_WIDTH + 0.5, 0.25, HALL_DEPTH + 0.7, palette.roof, { y: top - 0.1, z: HALL_Z, r: 0.1 }));
      parts.push(kit.prism(HALL_WIDTH + 0.5, 1.7, HALL_DEPTH + 0.7, palette.roof, { y: top + 0.12, z: HALL_Z }));
      roofTop = top + 1.0;
      break;
    case 'sawtooth': {
      const teeth = 3;
      const toothDepth = (HALL_DEPTH + 0.3) / teeth;
      parts.push(kit.box(HALL_WIDTH + 0.4, 0.25, HALL_DEPTH + 0.4, palette.roof, { y: top - 0.1, z: HALL_Z, r: 0.1 }));
      for (let i = 0; i < teeth; i += 1) {
        const z = HALL_Z + (i - (teeth - 1) / 2) * toothDepth;
        parts.push(kit.prism(HALL_WIDTH + 0.3, 1.25, toothDepth, palette.roof, { y: top + 0.12, z }, 0.86));
        // Glazing on the steep face of each tooth.
        parts.push(
          kit.box(HALL_WIDTH - 0.8, 0.6, 0.1, window, { y: top + 0.32, z: z + toothDepth / 2 - 0.1, rx: -0.14, r: 0.04 }),
        );
      }
      roofTop = top + 0.7;
      break;
    }
    case 'barrel':
      parts.push(kit.box(HALL_WIDTH + 0.4, 0.25, HALL_DEPTH + 0.4, palette.roof, { y: top - 0.1, z: HALL_Z, r: 0.1 }));
      parts.push(kit.barrel(HALL_WIDTH + 0.3, 1.7, HALL_DEPTH + 0.3, palette.roof, { y: top + 0.12, z: HALL_Z }));
      for (const x of [-3.6, 0, 3.6]) {
        parts.push(kit.barrel(0.3, 1.78, HALL_DEPTH + 0.45, palette.accent, { x, y: top + 0.12, z: HALL_Z }));
      }
      roofTop = top + 1.3;
      break;
  }

  for (const extra of shape.extras) {
    switch (extra) {
      case 'chimney': {
        const x = 3.6;
        const z = HALL_Z - 1.6;
        parts.push(kit.box(0.95, 2.6, 0.95, palette.accent, { x, y: top - 0.2, z, r: 0.14 }));
        parts.push(kit.box(1.15, 0.25, 1.15, props.sign, { x, y: top + 2.3, z, r: 0.08 }));
        smoke.push([x, top + 2.6, z]);
        break;
      }
      case 'stack': {
        const z = HALL_Z - 2.6;
        parts.push(kit.cyl(0.42, 0.62, 6.4, props.concrete, { x: SIDE_X, z }));
        parts.push(kit.cyl(0.46, 0.5, 0.5, palette.accent, { x: SIDE_X, y: 5.0, z }));
        parts.push(kit.cyl(0.52, 0.56, 0.5, palette.accent, { x: SIDE_X, y: 3.6, z }));
        smoke.push([SIDE_X, 6.6, z]);
        break;
      }
      case 'silos':
        for (const z of [HALL_Z - 1.3, HALL_Z + 1.2]) {
          parts.push(kit.cyl(1.0, 1.0, 4.4, props.sign, { x: SIDE_X, y: 0.3, z }, 20));
          parts.push(kit.cone(1.05, 0.9, palette.roof, { x: SIDE_X, y: 4.7, z }, 20));
          parts.push(kit.cyl(1.03, 1.03, 0.22, palette.accent, { x: SIDE_X, y: 2.9, z }, 20));
          parts.push(kit.cyl(0.6, 0.9, 0.35, props.darkMetal, { x: SIDE_X, z }, 12));
        }
        break;
      case 'tanks':
        for (const z of [HALL_Z - 1.4, HALL_Z + 1.1]) {
          parts.push(kit.cyl(1.0, 1.0, 2.2, props.metal, { x: SIDE_X, y: 0.1, z }, 20));
          parts.push(kit.dome(1.0, 0.55, 1.0, props.metal, { x: SIDE_X, y: 2.3, z }));
          parts.push(kit.cyl(1.03, 1.03, 0.2, palette.accent, { x: SIDE_X, y: 1.3, z }, 20));
        }
        break;
      case 'logs':
        for (const [dx, dy] of [
          [-0.42, 0],
          [0.42, 0],
          [0, 0.68],
        ] as const) {
          const log = kit.cyl(0.38, 0.38, 3.0, props.wood, { x: SIDE_X + dx, y: dy + 0.38 - 1.5, z: HALL_Z + 2.0, rx: Math.PI / 2 }, 12);
          parts.push(log);
          parts.push(kit.cyl(0.3, 0.3, 3.04, props.sign, { x: SIDE_X + dx, y: dy + 0.38 - 1.52, z: HALL_Z + 2.0, rx: Math.PI / 2 }, 12));
        }
        break;
      case 'dome':
        parts.push(kit.dome(1.5, 1.1, 1.5, window, { x: -2.6, y: roofTop - 0.25, z: HALL_Z }));
        parts.push(kit.cyl(1.6, 1.6, 0.2, props.sign, { x: -2.6, y: roofTop - 0.3, z: HALL_Z }, 20));
        break;
      case 'vents':
        for (const x of [-1.2, 1.2]) {
          parts.push(kit.cyl(0.32, 0.38, 0.7, props.metal, { x, y: roofTop - 0.1, z: HALL_Z - 1.9 }, 12));
          parts.push(kit.blob(0.48, 0.3, 0.48, props.metal, { x, y: roofTop + 0.5, z: HALL_Z - 1.9 }));
        }
        break;
      case 'tower': {
        const x = 3.2;
        const z = HALL_Z - 1.7;
        const towerHeight = h + 2.6;
        parts.push(kit.box(3.6, towerHeight, 3.6, palette.wall, { x, y: BASE, z, r: 0.35 }));
        parts.push(kit.box(3.9, 0.4, 3.9, palette.roof, { x, y: BASE + towerHeight - 0.1, z, r: 0.18 }));
        parts.push(kit.box(2.6, 0.9, 0.16, window, { x, y: top + 1.0, z: z + 1.8, r: 0.07 }));
        parts.push(kit.box(0.16, 0.9, 2.6, window, { x: x + 1.8, y: top + 1.0, z, r: 0.07 }));
        parts.push(kit.box(0.16, 0.9, 2.6, window, { x: x - 1.8, y: top + 1.0, z, r: 0.07 }));
        parts.push(kit.box(2.6, 0.9, 0.16, window, { x, y: top + 1.0, z: z - 1.8, r: 0.07 }));
        break;
      }
      case 'office': {
        const x = -3.2;
        const z = HALL_Z + 1.4;
        parts.push(kit.box(3.4, 1.5, 2.8, palette.wall, { x, y: roofTop - 0.2, z, r: 0.3 }));
        parts.push(kit.box(3.7, 0.3, 3.1, palette.roof, { x, y: roofTop + 1.2, z, r: 0.14 }));
        parts.push(kit.box(2.4, 0.7, 0.16, window, { x, y: roofTop + 0.25, z: z + 1.4, r: 0.07 }));
        break;
      }
      case 'dish': {
        const x = 3.4;
        const z = HALL_Z + 1.2;
        parts.push(kit.cyl(0.1, 0.14, 1.1, props.darkMetal, { x, y: roofTop - 0.1, z }, 8));
        parts.push(kit.dome(0.95, 0.4, 0.95, props.sign, { x, y: roofTop + 1.45, z, rx: Math.PI * 0.8 }));
        break;
      }
      case 'bins':
        for (const [z, color] of [
          [HALL_Z + 0.4, palette.roof],
          [HALL_Z + 2.4, palette.accent],
        ] as const) {
          parts.push(kit.box(1.5, 1.1, 1.6, color, { x: SIDE_X, z, r: 0.18 }));
          parts.push(kit.box(1.6, 0.16, 1.7, props.darkMetal, { x: SIDE_X, y: 1.08, z, rz: 0.1, r: 0.06 }));
        }
        break;
      case 'pipes':
        parts.push(kit.cyl(0.16, 0.16, HALL_DEPTH - 1.2, props.metal, { x: HALL_WIDTH / 2 + 0.22, y: BASE + 2.2 - (HALL_DEPTH - 1.2) / 2, z: HALL_Z, rx: Math.PI / 2 }, 10));
        parts.push(kit.cyl(0.16, 0.16, 2.2, props.metal, { x: HALL_WIDTH / 2 + 0.22, y: BASE, z: HALL_Z + HALL_DEPTH / 2 - 0.7 }, 10));
        break;
      case 'planters':
        for (const x of [-5.0, 5.0]) {
          parts.push(kit.box(0.9, 0.45, 0.9, props.wood, { x, z: HALL_FRONT + 0.75, r: 0.12 }));
          parts.push(kit.blob(0.5, 0.42, 0.5, theme.props.foliage[0] ?? 0xa2d9a5, { x, y: 0.35, z: HALL_FRONT + 0.75 }));
          parts.push(kit.blob(0.2, 0.2, 0.2, theme.props.blossom, { x: x + 0.2, y: 0.85, z: HALL_FRONT + 0.9 }));
        }
        break;
    }
  }

  return kit.group(parts, { ...BUILDING_ANCHORS, smoke });
}

export function registerBuildingModels(registry: ModelRegistry): void {
  for (const [typeId, shape] of Object.entries(SHAPES)) {
    registry.register(`building.${typeId}`, (kit) => makeBuilding(kit, typeId, shape));
  }
  registry.register('building.default', (kit) => makeBuilding(kit, 'default', DEFAULT_SHAPE));
}

export const BUILDING_MODEL_IDS = Object.keys(SHAPES);
