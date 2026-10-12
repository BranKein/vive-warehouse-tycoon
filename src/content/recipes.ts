import type { RecipeDef, RecipeIO } from '@/contracts';

const io = (item: string, amount = 1): RecipeIO => ({ item, amount });

export const RECIPES: RecipeDef[] = [
  // Tier 1: one raw material in, one basic material out
  { id: 'sawmill', inputs: [io('wood', 2)], outputs: [io('lumber'), io('sawdust', 0.5)], durationSec: 4 },
  { id: 'steelMill', inputs: [io('ironOre', 2)], outputs: [io('steel'), io('slag', 0.5)], durationSec: 4 },
  { id: 'textileMill', inputs: [io('cotton', 2)], outputs: [io('fabric')], durationSec: 4 },
  { id: 'refinery', inputs: [io('crudeOil', 2)], outputs: [io('plastic'), io('wasteOil', 0.5)], durationSec: 4 },
  { id: 'glassworks', inputs: [io('sand', 2)], outputs: [io('glass')], durationSec: 4 },
  { id: 'flourMill', inputs: [io('grain', 2)], outputs: [io('flour')], durationSec: 4 },
  // Tier 2: two materials combined
  { id: 'furnitureFactory', inputs: [io('lumber', 2), io('fabric')], outputs: [io('chair')], durationSec: 8 },
  { id: 'toolFactory', inputs: [io('steel', 2), io('lumber')], outputs: [io('tools')], durationSec: 8 },
  { id: 'bottleFactory', inputs: [io('glass', 2), io('plastic')], outputs: [io('bottle')], durationSec: 8 },
  {
    id: 'partsFactory',
    inputs: [io('steel'), io('plastic', 2)],
    outputs: [io('electronicPart'), io('wasteOil', 0.25)],
    durationSec: 8,
  },
  { id: 'snackFactory', inputs: [io('flour', 2), io('sawdust')], outputs: [io('snack')], durationSec: 8 },
  // Tier 3: further processing or three-way combination
  {
    id: 'applianceFactory',
    inputs: [io('electronicPart', 2), io('steel', 2), io('glass')],
    outputs: [io('appliance'), io('eWaste', 0.5)],
    durationSec: 16,
  },
  { id: 'sofaWorkshop', inputs: [io('chair', 2), io('fabric', 2)], outputs: [io('sofa')], durationSec: 16 },
  { id: 'packagingPlant', inputs: [io('snack', 3), io('bottle', 2)], outputs: [io('giftSet')], durationSec: 16 },
  // Tier 4
  {
    id: 'smartHomeFactory',
    inputs: [io('appliance', 2), io('sofa'), io('tools', 3)],
    outputs: [io('smartHomeSet'), io('eWaste', 1)],
    durationSec: 30,
  },
  { id: 'luxuryPackingCenter', inputs: [io('giftSet', 2)], outputs: [io('premiumGiftSet')], durationSec: 30 },
  // Handmade: slow, people at work, large price jump
  {
    id: 'handmadeWorkshop',
    inputs: [io('lumber', 4), io('fabric', 2), io('glass', 2)],
    outputs: [io('handmadeCabinet'), io('sawdust', 1)],
    durationSec: 90,
  },
  // Disposal: takes whichever waste is available and charges a fee
  {
    id: 'wasteDisposal',
    inputs: [io('slag'), io('wasteOil'), io('eWaste')],
    outputs: [],
    durationSec: 3,
    inputMode: 'any',
    moneyCostPerCycle: 1,
  },
];
