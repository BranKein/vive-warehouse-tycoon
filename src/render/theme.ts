/**
 * Every colour and every lighting value of the 3D view lives here. Swap this
 * object (or parts of it) to restyle the whole game. Colours are 0xRRGGBB.
 *
 * The palette is warm, cozy pastel: creams, peaches, mints and lilacs, with
 * nothing fully saturated and nothing fully dark, even at night.
 */
import type { DayNightSettings } from './dayNight';
import { hashString } from './math';

export interface BuildingPalette {
  wall: number;
  roof: number;
  accent: number;
  /** Second, cooler colour for doors and small fittings. Hand-drawn models use it; falls back to `accent`. */
  trim?: number;
}

export interface Theme {
  surface: { roughness: number; metalness: number };
  ground: {
    grass: number;
    grassDark: number;
    hill: number[];
    board: number;
    boardRim: number;
    plotPad: number;
    yardPad: number;
    road: number;
    roadEdge: number;
    roadMark: number;
    runway: number;
    runwayMark: number;
    water: number;
    waterDeep: number;
    sand: number;
  };
  props: {
    trunk: number;
    foliage: number[];
    blossom: number;
    houseWalls: number[];
    houseRoofs: number[];
    fence: number;
    lampPole: number;
    cloud: number;
    rock: number;
    wood: number;
    metal: number;
    darkMetal: number;
    concrete: number;
    tire: number;
    glass: number;
    door: number;
    hazard: number;
    sign: number;
    /** The dark inside of a tunnel. */
    shade: number;
  };
  vehicles: {
    truckBody: number;
    truckCab: number;
    carrierCab: number;
    carrierBed: number;
    shipHull: number;
    shipDeck: number;
    shipCabin: number;
    shipStripe: number;
    planeBody: number;
    planeAccent: number;
    /** Cab colour of a carrier by who it works for; `carrierCab` where there is no entry. */
    carrierOwners: Record<string, number>;
    /** How far a carrier's colour moves from its owner's towards the colour of the goods its building makes, 0..1. */
    carrierGoodsMix: number;
  };
  goods: {
    pallet: number;
    /** Used for items without an entry in `items`. */
    fallback: number[];
    items: Record<string, number>;
    waste: number;
    wasteDark: number;
  };
  buildings: {
    fallback: BuildingPalette;
    byType: Record<string, BuildingPalette>;
  };
  /** Colour of the placeholder box of each logistics facility, by facility kind. */
  facilities: {
    fallback: number;
    byKind: Record<string, number>;
  };
  glow: {
    /** Window colour by day and the light it gives off at night. */
    windowDay: number;
    windowNight: number;
    windowIntensity: number;
    lamp: number;
    lampIntensity: number;
    /** Strength of the cone and pool of light under a street lamp at full night. */
    lampPoolOpacity: number;
    headlight: number;
    /** Colour of the headlight lens when it is not lit. */
    headlightDay: number;
  };
  effects: {
    selection: number;
    /** The dots along a selected vehicle's way. */
    route: number;
    hover: number;
    special: number;
    specialGlow: number;
    /** Ring of light on the ground under something that was just upgraded. */
    upgradeGlow: number;
    specialBeam: number;
    coin: number;
    smoke: number;
    dust: number;
    plotSign: number;
  };
  sky: {
    sun: number;
    moon: number;
    star: number;
    /** Scene fog start and end distances. */
    fogNear: number;
    fogFar: number;
  };
  dayNight: DayNightSettings;
}

export const defaultTheme: Theme = {
  surface: { roughness: 0.9, metalness: 0 },
  ground: {
    grass: 0xbfe3a4,
    grassDark: 0xaedb9b,
    hill: [0xb2dca0, 0xa6d6a6, 0xc4e6a8],
    board: 0xd2ecb4,
    boardRim: 0xe8d5bb,
    plotPad: 0xf5ead9,
    yardPad: 0xefe2d3,
    road: 0xc9c0d3,
    roadEdge: 0xf7efe2,
    roadMark: 0xfffaf0,
    runway: 0xbdb6cc,
    runwayMark: 0xfff6e2,
    water: 0xa9def0,
    waterDeep: 0x8fd0ea,
    sand: 0xf6e4bd,
  },
  props: {
    trunk: 0xcfa987,
    foliage: [0xa2d9a5, 0xb6e2a1, 0x8fd0b0, 0xc9e9a6],
    blossom: 0xf9c9d6,
    houseWalls: [0xfff3df, 0xffe1d0, 0xe7f3ff, 0xf3e6ff, 0xfff0c2],
    houseRoofs: [0xf4a79d, 0xf6bd8f, 0x9fd3c7, 0xb7a9e0, 0xf2a2b8],
    fence: 0xfaf3e6,
    lampPole: 0xb3a9c2,
    cloud: 0xffffff,
    rock: 0xd9d2de,
    wood: 0xddb58a,
    metal: 0xcfd3e2,
    darkMetal: 0x9a93ab,
    concrete: 0xe9e2da,
    tire: 0x75697d,
    glass: 0xbfe6f5,
    door: 0xb9aacb,
    hazard: 0xffd27d,
    sign: 0xfff7ea,
    shade: 0x4a4258,
  },
  vehicles: {
    truckBody: 0xfffaf2,
    truckCab: 0xffb5a3,
    carrierCab: 0xf2887a,
    carrierBed: 0xf1e3cf,
    shipHull: 0xf59d93,
    shipDeck: 0xf7ead6,
    shipCabin: 0xfffaf2,
    shipStripe: 0x8fc7e8,
    planeBody: 0xfffaf2,
    planeAccent: 0xb9a8e6,
    carrierOwners: {
      tier2: 0xf5ad55,
      tier3: 0xc3b1ea,
      tier4: 0xe88bc0,
      handmade: 0xf7dc8a,
      disposal: 0xa9a3b8,
      facility: 0xc99b7d,
    },
    carrierGoodsMix: 0.4,
  },
  goods: {
    pallet: 0xdcb98f,
    fallback: [0xe9c898, 0xf6c7b0, 0xc8e6c0, 0xcbdcf7, 0xe4cdf3, 0xfbe6a6],
    items: {
      wood: 0xd9ae84,
      ironOre: 0xc2a9a4,
      cotton: 0xfdfaf3,
      crudeOil: 0x9d94b3,
      sand: 0xf6e2b0,
      grain: 0xf5d98a,
      copperOre: 0xe0a583,
      lumber: 0xecc89a,
      steel: 0xc9d3e6,
      fabric: 0xf7c1d4,
      plastic: 0xa9e3dd,
      glass: 0xc3ecf7,
      flour: 0xfff4dc,
      wire: 0xf2b384,
      chair: 0xe8b98f,
      tools: 0xf2a79a,
      bottle: 0xa8dcb9,
      electronicPart: 0xa9c4f5,
      snack: 0xfcd27e,
      motor: 0xb8c4d9,
      appliance: 0xdfe5f2,
      sofa: 0xd9b6ee,
      giftSet: 0xff9fb5,
      eBike: 0xa6e0b4,
      smartHomeSet: 0x9fd9f6,
      premiumGiftSet: 0xf7b6e4,
      handmadeCabinet: 0xc99a74,
      sawdust: 0xf0dcae,
      slag: 0xa59bb0,
      wasteOil: 0x8f86a8,
      eWaste: 0x9bb0a6,
    },
    waste: 0xa79bb5,
    wasteDark: 0x8f84a3,
  },
  buildings: {
    fallback: { wall: 0xfff3e0, roof: 0xf4a79d, accent: 0xffd27d },
    byType: {
      sawmill: { wall: 0xfdebd0, roof: 0xe8a98a, accent: 0xc99a74, trim: 0x8ccdb4 },
      steelMill: { wall: 0xe6e9f5, roof: 0xa9b6dc, accent: 0xf2a79a, trim: 0xffd27d },
      textileMill: { wall: 0xffe3ea, roof: 0xf2a2b8, accent: 0xfff3b0, trim: 0x9fd3c7 },
      refinery: { wall: 0xe9e3f6, roof: 0xb7a9e0, accent: 0xffc79a, trim: 0x8fd0b0 },
      glassworks: { wall: 0xe2f4f7, roof: 0x9fd3da, accent: 0xfff0c2, trim: 0xf4a79d },
      flourMill: { wall: 0xfff4cf, roof: 0xf2c26e, accent: 0xf4a79d, trim: 0x9fc7e8 },
      wasteDisposal: { wall: 0xe0efd9, roof: 0x9cc9a4, accent: 0xffd27d, trim: 0xb7a9e0 },
      furnitureFactory: { wall: 0xfde4cc, roof: 0xd99b7c, accent: 0x9fd3c7, trim: 0xf2c26e },
      toolFactory: { wall: 0xf1e7dc, roof: 0xf08f85, accent: 0xa9b6dc, trim: 0xffd27d },
      bottleFactory: { wall: 0xdff5e6, roof: 0x8fd0b0, accent: 0xfff0c2, trim: 0xf4a79d },
      snackFactory: { wall: 0xfff0c2, roof: 0xf7b267, accent: 0xf2a2b8, trim: 0x9fd3c7 },
      partsFactory: { wall: 0xe1ecfb, roof: 0x93b5ea, accent: 0xffd27d, trim: 0xf4a79d },
      wireMill: { wall: 0xfbe6d6, roof: 0xe09a72, accent: 0xa9b6dc, trim: 0x8fd0b0 },
      motorFactory: { wall: 0xe4e9f0, roof: 0x9aa9c7, accent: 0xf2b384, trim: 0xffd27d },
      eBikeFactory: { wall: 0xe2f6e6, roof: 0x86cf9c, accent: 0xffd27d, trim: 0x9fc7e8 },
      sofaWorkshop: { wall: 0xf3e3fa, roof: 0xc5a3e6, accent: 0xffc9b5, trim: 0x9fd3c7 },
      packagingPlant: { wall: 0xffe1e6, roof: 0xff9fb5, accent: 0xa9e3dd, trim: 0xffe08a },
      applianceFactory: { wall: 0xe8eef7, roof: 0x8fc7e8, accent: 0xf4a79d, trim: 0xffd27d },
      luxuryPackingCenter: { wall: 0xfdeaf5, roof: 0xe99ccf, accent: 0xffe08a, trim: 0xa9e3dd },
      smartHomeFactory: { wall: 0xe3f3fb, roof: 0x7fc4de, accent: 0xb9a8e6, trim: 0xffc9b5 },
      handmadeWorkshop: { wall: 0xfff1dc, roof: 0xc98f72, accent: 0x9cc9a4, trim: 0xf2c26e },
    },
  },
  facilities: {
    fallback: 0xd9d2de,
    byKind: {
      inboundYard: 0x9fdccb,
      truckYard: 0xffb5a3,
      dock: 0x8fc7e8,
      airport: 0xb9a8e6,
    },
  },
  glow: {
    windowDay: 0xcfeaf5,
    windowNight: 0xffdc8f,
    windowIntensity: 1.6,
    lamp: 0xffe2a1,
    lampIntensity: 2.2,
    lampPoolOpacity: 0.56,
    headlight: 0xfff3c4,
    headlightDay: 0xffdf7e,
  },
  effects: {
    selection: 0xff8fb0,
    route: 0xff4f86,
    hover: 0xffffff,
    special: 0xffd45e,
    specialGlow: 0xfff0a8,
    upgradeGlow: 0xffd45e,
    specialBeam: 0xfff2b8,
    coin: 0xffd45e,
    smoke: 0xffffff,
    dust: 0xf3e6d2,
    plotSign: 0xffc9b5,
  },
  sky: {
    sun: 0xfff1c2,
    moon: 0xf4f1ff,
    star: 0xffffff,
    fogNear: 420,
    fogFar: 1500,
  },
  dayNight: {
    cycleSec: 360,
    startPhase: 0.2,
    dayFraction: 0.68,
    maxElevation: (58 * Math.PI) / 180,
    minLightElevation: (24 * Math.PI) / 180,
    sunriseHeading: Math.PI / 2,
    keyframes: [
      {
        at: 0,
        name: 'dawn',
        skyTop: 0x9db4e8,
        skyHorizon: 0xffd3c4,
        fog: 0xf7d6cf,
        light: 0xffc9a6,
        lightIntensity: 0.15,
        ambientSky: 0xdcd6f5,
        ambientGround: 0xe9c9b8,
        ambientIntensity: 2.0,
        night: 0.45,
        cloud: 0xffd9d2,
      },
      {
        at: 0.08,
        name: 'morning',
        skyTop: 0x9ed2f5,
        skyHorizon: 0xffeeda,
        fog: 0xfdf0e2,
        light: 0xffe6c4,
        lightIntensity: 2.0,
        ambientSky: 0xe9f3ff,
        ambientGround: 0xe8dcc4,
        ambientIntensity: 2.0,
        night: 0,
        cloud: 0xfffaf2,
      },
      {
        at: 0.2,
        name: 'day',
        skyTop: 0x8fd0f7,
        skyHorizon: 0xeaf7fb,
        fog: 0xeaf5f6,
        light: 0xfff4de,
        lightIntensity: 2.5,
        ambientSky: 0xeef7ff,
        ambientGround: 0xdfe6c3,
        ambientIntensity: 2.1,
        night: 0,
        cloud: 0xffffff,
      },
      {
        at: 0.5,
        name: 'afternoon',
        skyTop: 0x8fcbf5,
        skyHorizon: 0xf4f3e6,
        fog: 0xf2f1e6,
        light: 0xfff0d2,
        lightIntensity: 2.5,
        ambientSky: 0xeef4ff,
        ambientGround: 0xe3e2c0,
        ambientIntensity: 2.1,
        night: 0,
        cloud: 0xfffdf6,
      },
      {
        at: 0.615,
        name: 'sunset',
        skyTop: 0x8a93dc,
        skyHorizon: 0xffb88f,
        fog: 0xfcc4a4,
        light: 0xffab7a,
        lightIntensity: 2.1,
        ambientSky: 0xe3c8ee,
        ambientGround: 0xf1bf9d,
        ambientIntensity: 1.7,
        night: 0.3,
        cloud: 0xffc3a8,
      },
      {
        at: 0.68,
        name: 'dusk',
        skyTop: 0x4b4f9c,
        skyHorizon: 0xf09a9c,
        fog: 0xc79bb5,
        light: 0xc9a2d8,
        lightIntensity: 0.1,
        ambientSky: 0xb9a9e6,
        ambientGround: 0xc59aa8,
        ambientIntensity: 1.7,
        night: 0.85,
        cloud: 0xd99bb4,
      },
      {
        at: 0.745,
        name: 'night',
        skyTop: 0x1d2352,
        skyHorizon: 0x4d5494,
        fog: 0x4a5190,
        light: 0xa9bcff,
        lightIntensity: 0.9,
        ambientSky: 0x8f9be6,
        ambientGround: 0x6d6aa8,
        ambientIntensity: 1.45,
        night: 1,
        cloud: 0x7b83c4,
      },
      {
        at: 0.94,
        name: 'lateNight',
        skyTop: 0x1f2658,
        skyHorizon: 0x565c9c,
        fog: 0x525896,
        light: 0xa9bcff,
        lightIntensity: 0.8,
        ambientSky: 0x8f9be6,
        ambientGround: 0x6d6aa8,
        ambientIntensity: 1.45,
        night: 1,
        cloud: 0x7b83c4,
      },
    ],
  },
};

/**
 * Colour of a carrier's cab: the colour of who it works for, moved towards the
 * colour of the goods its building makes (when it makes any).
 */
export function carrierColor(theme: Theme, owner: string | undefined, itemId?: string): number {
  const v = theme.vehicles;
  const base = (owner !== undefined ? v.carrierOwners[owner] : undefined) ?? v.carrierCab;
  if (itemId === undefined) return base;
  const goods = itemColor(theme, itemId);
  const mix = (shift: number): number => {
    const from = (base >> shift) & 0xff;
    const to = (goods >> shift) & 0xff;
    return Math.round(from + (to - from) * v.carrierGoodsMix) << shift;
  };
  return mix(16) | mix(8) | mix(0);
}

/** Colour of the crates that carry an item. Unknown items get a stable colour from the fallback list. */
export function itemColor(theme: Theme, itemId: string): number {
  const known = theme.goods.items[itemId];
  if (known !== undefined) return known;
  const list = theme.goods.fallback;
  return list[hashString(itemId) % list.length] ?? 0xe9c898;
}

export function buildingPalette(theme: Theme, typeId: string): BuildingPalette {
  return theme.buildings.byType[typeId] ?? theme.buildings.fallback;
}

export function facilityColor(theme: Theme, kind: string): number {
  return theme.facilities.byKind[kind] ?? theme.facilities.fallback;
}
