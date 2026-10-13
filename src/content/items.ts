import type { ItemDef, ItemKind } from '@/contracts';

const item = (
  id: string,
  kind: ItemKind,
  tier: number,
  weight: number,
  basePrice: number,
): ItemDef => ({ id, kind, tier, weight, basePrice, sellable: kind === 'product' || kind === 'byproduct' });

/** Weight and price are independent on purpose: some goods are light and pricey, others heavy and cheap. */
export const ITEMS: ItemDef[] = [
  // Raw materials (arrive by inbound truck, never sold as is)
  item('wood', 'raw', 0, 3, 1),
  item('ironOre', 'raw', 0, 5, 1.2),
  item('cotton', 'raw', 0, 1, 1),
  item('crudeOil', 'raw', 0, 4, 1.5),
  item('sand', 'raw', 0, 4, 0.8),
  item('grain', 'raw', 0, 2, 0.9),
  item('copperOre', 'raw', 0, 5, 1.4),
  // Tier 1
  item('lumber', 'product', 1, 3, 4),
  item('steel', 'product', 1, 5, 6),
  item('fabric', 'product', 1, 1, 4),
  item('plastic', 'product', 1, 2, 6),
  item('glass', 'product', 1, 3, 4),
  item('flour', 'product', 1, 2, 3.5),
  item('wire', 'product', 1, 2, 7),
  // Tier 2
  item('chair', 'product', 2, 3, 30),
  item('tools', 'product', 2, 3, 35),
  item('bottle', 'product', 2, 2, 30),
  item('electronicPart', 'product', 2, 1, 45),
  item('snack', 'product', 2, 1, 20),
  item('motor', 'product', 2, 4, 55),
  // Tier 3
  item('appliance', 'product', 3, 5, 400),
  item('sofa', 'product', 3, 5, 220),
  item('giftSet', 'product', 3, 2, 200),
  item('eBike', 'product', 3, 5, 450),
  // Tier 4
  item('smartHomeSet', 'product', 4, 5, 5000),
  item('premiumGiftSet', 'product', 4, 2, 1200),
  // Handmade
  item('handmadeCabinet', 'product', 4, 4, 3000),
  // Byproducts and waste
  item('sawdust', 'byproduct', 1, 1, 0.5),
  item('slag', 'waste', 1, 4, 0),
  item('wasteOil', 'waste', 1, 3, 0),
  item('eWaste', 'waste', 3, 3, 0),
];
