/**
 * Command line entry: `npm run audit:models [-- <name prefix>]`.
 * Lists overlapping faces and floating pieces of every registered model.
 */
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
let total = 0;
for (const name of registry.names().sort()) {
  if (!name.startsWith(prefix)) continue;
  const issues = auditModel(registry.create(name));
  total += issues.length;
  console.log(`${issues.length === 0 ? 'ok  ' : 'FIX '} ${name}${issues.length ? `  (${issues.length})` : ''}`);
  for (const issue of issues) {
    const at = issue.at.map((value) => value.toFixed(2)).join(', ');
    console.log(`       ${issue.kind.padEnd(8)} pieces ${issue.meshes.join(' & ')} at (${at}): ${issue.detail}`);
  }
}
console.log(`${total} issue(s)`);
