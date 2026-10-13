import type { InboundChannelDef, SaleChannelDef, UnlockDef } from '@/contracts';
import { INBOUND_TRACKS, SALE_TRACKS } from './upgrades';

export const INBOUND_CHANNELS: InboundChannelDef[] = [
  {
    id: 'inbound.truck',
    facility: 'inboundYard',
    vehicleModel: 'vehicle.boxTruck',
    baseIntervalSec: 10,
    baseLoad: 24,
    vehicleSpeed: 14,
    upgradeTracks: INBOUND_TRACKS,
  },
];

/** Trucks are the baseline; ships take a lot at once and shrug off weight; planes pay best but hate weight. */
export const SALE_CHANNELS: SaleChannelDef[] = [
  {
    id: 'sale.truck',
    kind: 'truck',
    facility: 'truckYard',
    vehicleModel: 'vehicle.boxTruck',
    baseIntervalSec: 10,
    baseLoad: 20,
    vehicleSpeed: 14,
    priceMultiplier: 1,
    weightSensitivity: 0.5,
    unlock: null,
    upgradeTracks: SALE_TRACKS,
  },
  {
    id: 'sale.ship',
    kind: 'ship',
    facility: 'dock',
    vehicleModel: 'vehicle.cargoShip',
    baseIntervalSec: 60,
    baseLoad: 80,
    vehicleSpeed: 7,
    priceMultiplier: 1.25,
    weightSensitivity: 0.1,
    unlock: 'unlock.channel.ship',
    upgradeTracks: SALE_TRACKS,
  },
  {
    id: 'sale.plane',
    kind: 'plane',
    facility: 'airport',
    vehicleModel: 'vehicle.cargoPlane',
    baseIntervalSec: 45,
    baseLoad: 20,
    vehicleSpeed: 30,
    priceMultiplier: 1.6,
    weightSensitivity: 1,
    unlock: 'unlock.channel.plane',
    upgradeTracks: SALE_TRACKS,
  },
];

export const CHANNEL_UNLOCKS: UnlockDef[] = [
  { id: 'unlock.channel.ship', cost: 1.5e6, requires: [], grants: { type: 'saleChannel', channel: 'sale.ship' } },
  { id: 'unlock.channel.plane', cost: 3e9, requires: ['unlock.channel.ship'], grants: { type: 'saleChannel', channel: 'sale.plane' } },
];
