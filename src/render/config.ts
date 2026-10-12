/**
 * Tuning values of the 3D view that are not colours or lighting (those live
 * in `theme.ts`). Sizes are in world units, times in real seconds.
 */
export const renderConfig = {
  camera: {
    fovDeg: 34,
    near: 1,
    far: 4000,
    /** Pitch is the angle above the horizon. The low limit lets the sky into view. */
    minPitch: (6 * Math.PI) / 180,
    maxPitch: (82 * Math.PI) / 180,
    minDistance: 45,
    maxDistance: 430,
    initialYaw: (-38 * Math.PI) / 180,
    initialPitch: (36 * Math.PI) / 180,
    initialDistance: 285,
    /** Radians per pixel of right-button drag. */
    rotateSpeed: 0.0055,
    /** Distance factor per wheel "line" (100 px of deltaY). */
    zoomStep: 1.12,
    /** Higher is snappier. Used for exponential smoothing of yaw, pitch and distance. */
    damping: 9,
    /** Height of the orbit target above the board. */
    targetHeight: 2,
    idle: {
      /** Seconds without input before the camera starts to wander. */
      delaySec: 14,
      /** Radians per second once fully ramped up. */
      yawSpeed: 0.035,
      rampSec: 5,
      pitch: (24 * Math.PI) / 180,
      distance: 250,
      /** Smoothing used while drifting into the idle view (much softer than manual control). */
      damping: 0.5,
    },
  },
  pile: {
    /** Crates per layer side: a pile is `side x side` crates per layer. */
    side: 2,
    maxCrates: 16,
    /** Crates added for every tenfold increase of the amount. */
    cratesPerDecade: 2.5,
    crateSize: 0.82,
    palletHeight: 0.18,
  },
  waste: {
    maxBlobs: 8,
    /** Waste ratio at which the heap reaches its full size. */
    fullRatio: 1.5,
  },
  vehicle: {
    /** A jump longer than this between two ticks is a teleport, not a move. */
    snapDistance: 30,
    /** Radians per second the drawn heading may turn; rounds off corners. */
    turnRate: 7,
    appearSec: 0.35,
    disappearSec: 0.3,
  },
  building: {
    buildSec: 0.75,
    demolishSec: 0.45,
  },
  forklift: {
    speed: 3.2,
    acceleration: 5,
    pauseSec: 0.55,
    turnRate: 6,
    /** At most this many forklifts are drawn per yard. */
    maxPerYard: 2,
  },
  bounce: {
    durationSec: 0.7,
    amplitude: 0.22,
    frequency: 3,
  },
  click: {
    /** Pixels the pointer may travel between press and release and still count as a click. */
    maxTravelPx: 5,
  },
  shadow: {
    mapSize: 2048,
    /** Extra room around the board covered by the shadow map. */
    margin: 16,
  },
  scenery: {
    seed: 20261012,
    boardTrees: 70,
    villageHouses: 46,
    villageTrees: 260,
    hills: 16,
    clouds: 12,
    fenceSegment: 3.2,
  },
  maxPixelRatio: 2,
} as const;

export type RenderConfig = typeof renderConfig;
