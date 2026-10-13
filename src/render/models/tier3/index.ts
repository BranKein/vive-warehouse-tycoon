import type { ModelRegistry } from '../../ModelRegistry';
import { registerApplianceFactory } from './applianceFactory';
import { registerEBikeFactory } from './eBikeFactory';
import { registerHandmadeWorkshop } from './handmadeWorkshop';
import { registerLuxuryPackingCenter } from './luxuryPackingCenter';
import { registerPackagingPlant } from './packagingPlant';
import { registerSmartHomeFactory } from './smartHomeFactory';
import { registerSofaWorkshop } from './sofaWorkshop';

/** Hand-drawn buildings of this group; each lives in its own file in this folder. */
export function registerGroup3Models(registry: ModelRegistry): void {
  registerSofaWorkshop(registry);
  registerPackagingPlant(registry);
  registerEBikeFactory(registry);
  registerApplianceFactory(registry);
  registerLuxuryPackingCenter(registry);
  registerSmartHomeFactory(registry);
  registerHandmadeWorkshop(registry);
}
