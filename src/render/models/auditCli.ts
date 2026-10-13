/**
 * Command line entry: `npm run audit:models [-- <name prefix>]`.
 * Lists overlapping faces and floating pieces of every registered model, and
 * buildings or facilities that stand where the game stacks stock.
 */
import { Box3, Vector3, type Mesh } from 'three';
import { renderConfig } from '../config';
import { facilityPileLocal, pileLocal, type PileGroup } from '../layout';
import { MaterialLibrary } from '../materials';
import { ModelRegistry } from '../ModelRegistry';
import { defaultTheme } from '../theme';
import { auditModel } from './audit';
import { registerDefaultModels } from './index';
import { Kit } from './kit';

const prefix = process.argv[2] ?? '';
const kit = new Kit(defaultTheme, new MaterialLibrary(defaultTheme));
const registry = new ModelRegistry(kit);
registerDefaultModels(registry, kit);
/** Where the game stacks stock on a site, as boxes of the tallest pile: a model must stay out of them. */
function pileBoxes(facility: boolean): Array<{ label: string; box: Box3 }> {
  const rule = renderConfig.boxes;
  const pile = renderConfig.pile;
  // Piles are placed in the plot frame; a building model stands `buildingOffsetZ` in front of it.
  const shift = facility ? 0 : rule.buildingOffsetZ;
  const stackHeight = pile.palletHeight + (pile.maxCrates / (pile.side * pile.side)) * pile.crateSize;
  const boxes: Array<{ label: string; box: Box3 }> = [];
  const add = (label: string, at: { x: number; z: number }, half: number, height: number): void => {
    boxes.push({
      label,
      box: new Box3(new Vector3(at.x - half, 0.35, at.z - shift - half), new Vector3(at.x + half, height, at.z - shift + half)),
    });
  };
  if (facility) {
    const yard = rule.yard.facility;
    for (let slot = 0; slot < yard.perRow * yard.rows; slot += 1) {
      add(`pile ${slot + 1}`, facilityPileLocal(slot, yard), (pile.palletSize * yard.scale) / 2, stackHeight * yard.scale);
    }
    return boxes;
  }
  const counts: Array<[PileGroup, number]> = [['inputs', 3], ['outputs', 2], ['waste', 2]];
  for (const [group, count] of counts) {
    const waste = group === 'waste';
    for (let index = 0; index < count; index += 1) {
      const half = (waste ? renderConfig.waste.footprint : pile.palletSize) / 2;
      add(`${group} pile ${index + 1}`, pileLocal(group, index, rule.yard), half, waste ? 0.7 : stackHeight);
    }
  }
  return boxes;
}

let total = 0;
for (const name of registry.names().sort()) {
  if (!name.startsWith(prefix)) continue;
  const model = registry.create(name);
  const issues = auditModel(model);
  const blocked: string[] = [];
  if (name.startsWith('building.') || name.startsWith('facility.')) {
    model.updateMatrixWorld(true);
    const box = new Box3();
    for (const pile of pileBoxes(name.startsWith('facility.'))) {
      let hit = false;
      model.traverse((node) => {
        if ((node as Mesh).isMesh && box.setFromObject(node).intersectsBox(pile.box)) hit = true;
      });
      if (hit) blocked.push(pile.label);
    }
  }
  total += issues.length + blocked.length;
  const count = issues.length + blocked.length;
  console.log(`${count === 0 ? 'ok  ' : 'FIX '} ${name}${count ? `  (${count})` : ''}`);
  for (const label of blocked) console.log(`       blocked  the model stands where the game puts the ${label}`);
  for (const issue of issues) {
    const at = issue.at.map((value) => value.toFixed(2)).join(', ');
    console.log(`       ${issue.kind.padEnd(8)} pieces ${issue.meshes.join(' & ')} at (${at}): ${issue.detail}`);
  }
}
console.log(`${total} issue(s)`);
