import type { ModelRegistry } from '../../ModelRegistry';
import { registerFlourMillModel } from './flourMill';
import { registerGlassworksModel } from './glassworks';
import { registerRefineryModel } from './refinery';
import { registerSteelMillModel } from './steelMill';
import { registerTextileMillModel } from './textileMill';
import { registerWasteDisposalModel } from './wasteDisposal';
import { registerWireMillModel } from './wireMill';

/** Hand-drawn buildings of this group; each lives in its own file in this folder. */
export function registerGroup1Models(registry: ModelRegistry): void {
  registerSteelMillModel(registry);
  registerTextileMillModel(registry);
  registerRefineryModel(registry);
  registerGlassworksModel(registry);
  registerFlourMillModel(registry);
  registerWireMillModel(registry);
  registerWasteDisposalModel(registry);
}
