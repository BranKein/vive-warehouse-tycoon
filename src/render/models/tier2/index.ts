import type { ModelRegistry } from '../../ModelRegistry';
import { registerBottleFactoryModel } from './bottleFactory';
import { registerFurnitureFactoryModel } from './furnitureFactory';
import { registerMotorFactoryModel } from './motorFactory';
import { registerPartsFactoryModel } from './partsFactory';
import { registerSnackFactoryModel } from './snackFactory';
import { registerToolFactoryModel } from './toolFactory';

/** Hand-drawn buildings of this group; each lives in its own file in this folder. */
export function registerGroup2Models(registry: ModelRegistry): void {
  registerFurnitureFactoryModel(registry);
  registerToolFactoryModel(registry);
  registerBottleFactoryModel(registry);
  registerSnackFactoryModel(registry);
  registerPartsFactoryModel(registry);
  registerMotorFactoryModel(registry);
}
