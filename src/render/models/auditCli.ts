/**
 * Command line entry: `npm run audit:models [-- <name prefix>]`.
 * Lists overlapping faces and floating pieces of every registered model, and
 * buildings or facilities that stand where the game stacks stock.
 */
import { Box3, Vector3, type Mesh } from 'three';
import { renderConfig } from '../config';
import { pilePosition, type PileGroup } from '../layout';
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
  // Piles are placed in the plot frame; a building model stands `buildingOffsetZ` in front of it.
  const shift = facility ? 0 : rule.buildingOffsetZ;
  const site = { x: 0, z: 0, facing: 0 };
  const counts: Array<[PileGroup, number]> = facility ? [['inputs', 9]] : [['inputs', 3], ['outputs', 2], ['waste', 2]];
  const boxes: Array<{ label: string; box: Box3 }> = [];
  for (const [group, count] of counts) {
    const half = (group === 'waste' ? rule.pile.wasteFootprint : rule.pile.footprint) / 2;
    for (let index = 0; index < count; index += 1) {
      const at = pilePosition(site, group, index, rule.yard);
      boxes.push({
        label: `${group} pile ${index + 1}`,
        box: new Box3(
          new Vector3(at.x - half, 0.35, at.z - shift - half),
          new Vector3(at.x + half, rule.pile.maxHeight, at.z - shift + half),
        ),
      });
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
