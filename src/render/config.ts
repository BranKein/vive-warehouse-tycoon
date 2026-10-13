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
    maxDistance: 520,
    initialYaw: (-38 * Math.PI) / 180,
    initialPitch: (36 * Math.PI) / 180,
    initialDistance: 340,
    /** Radians per pixel of right-button drag. */
    rotateSpeed: 0.0055,
    /** How far the middle-button drag may move the view away from the board centre, per axis. */
    panLimit: 70,
    /** While a vehicle is selected the camera stays on it, no further away than `distance`. */
    follow: { distance: 62, damping: 5 },
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
    /** Three layers of four: low enough to leave the building behind it in view. */
    maxCrates: 12,
    /** Crates added for every tenfold increase of the amount. */
    cratesPerDecade: 2,
    crateSize: 0.56,
    /** Distance from one crate to the next on a pallet. */
    cratePitch: 0.6,
    palletSize: 1.3,
    palletHeight: 0.16,
  },
  /** Size of the waste heap: its scale grows with the amount on a log scale. */
  waste: {
    footprint: 1.9,
    minHeight: 0.5,
    heightPerDecade: 0.12,
    maxHeight: 1,
  },
  vehicle: {
    /** A jump longer than this between two ticks is a teleport, not a move. */
    snapDistance: 30,
    /** Radians per second the drawn heading may turn; rounds off corners. */
    turnRate: 7,
    /** Carriers grow in when they first show and shrink away when they leave. */
    appearSec: 0.35,
    disappearSec: 0.3,
    /** Ships and planes fade in and out instead, slowly, over the board. */
    slowAppearSec: 1.6,
    slowDisappearSec: 1.2,
    /** Road vehicles keep to the right: this far from the centre line (half a lane of a 6 wide road). */
    laneOffset: 1.5,
    /**
     * A parked vehicle pulls this much further in than the loading point the game puts it at,
     * so it stands on the pad and off the road.
     */
    parkInset: { carrier: 2.4, truck: 1.8 },
    /**
     * A road vehicle is drawn on the way the game took it, steering by a point this far ahead of it and
     * one this far behind; it is drawn that much behind where the game has it. Rounds off the corners.
     */
    steerReach: 2.6,
    /**
     * Setting off, a vehicle waits until the game has taken it round the corner onto the road, then backs
     * out at the speed the game moves it: straight first, then round a curve of `radius` that ends on its
     * lane, facing the way it will drive. All that leaves the drawing behind the game; it catches up over
     * the next `catchUp` of the way. A vehicle whose way has not turned after `giveUp` drives off as it
     * stands. The step from the end of the curve onto the lane is smoothed away over `settle`.
     */
    backOut: { radius: 3, giveUp: 12, catchUp: 40, settle: 6 },
    /** A vehicle the game has stopped at a site is in and standing within this many seconds of game time. */
    arriveSec: 0.45,
    /** A parked vehicle belongs to the site whose centre is within this distance. */
    parkReach: 12,
    /** A truck this close to the gate is inside the tunnel: it shows whole, and is dropped at once when it leaves. */
    tunnelCover: 3,
    /** The card of a selected vehicle hangs from a point this high above the ground under it. */
    cardHeight: 4,
    /** Click targets are this much bigger than the vehicle, which is small and moving. */
    pickScale: 1.4,
    /** The pad under a selected vehicle is this much bigger than the vehicle. */
    markerScale: 1.5,
    /** The dots that show a selected road vehicle's way: how far apart, how big, how high over the ground, and how far ahead of it they begin. */
    route: { spacing: 1.6, radius: 0.34, endScale: 2.6, height: 0.14, ahead: 2.5, max: 400 },
    /** Size of the crates on a carrier's bed, relative to a crate of a stock pile. */
    cargoCrateScale: 1.25,
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
  /** Decoration shown when something happens (Effects.ts). Times in real seconds. */
  effects: {
    maxParticles: 160,
    upgrade: {
      /** At most one upgrade effect this often anywhere, and this often on the same building. */
      minGapSec: 0.25,
      minGapPerTargetSec: 1.2,
      sparks: 7,
      size: 2,
      radius: 4.2,
      rise: 5,
      lifeSec: 0.8,
      /** A ring of light spreads over the ground under it: up to this radius, starting at this share of it. */
      glow: { radius: 9.5, startSize: 0.35, lifeSec: 0.9, opacity: 0.85, height: 0.14 },
      /** The upgraded building hops: a small, quick wobble of its height. */
      bounce: { durationSec: 0.6, amplitude: 0.09, frequency: 2 },
    },
    sale: {
      /** A facility shows at most one effect this often; money earned in between is added to the next. */
      minGapSec: 1.5,
      coins: 5,
      coinSize: 1.6,
      /** Where the coins start, above the ground. */
      height: 3.5,
      jump: 11,
      spread: 3,
      gravity: 24,
      coinSec: 0.9,
      labelSec: 1.3,
      labelRise: 3.5,
      maxLabels: 6,
      labelColor: '#b9791f',
    },
  },
  click: {
    /** Pixels the pointer may travel between press and release and still count as a click. */
    maxTravelPx: 5,
    /** A second press on the same building within this time picks it up. */
    doubleClickMs: 400,
  },
  shadow: {
    mapSize: 2048,
    /** Extra room around the board covered by the shadow map. */
    margin: 16,
  },
  scenery: {
    seed: 20261012,
    boardTrees: 70,
    /** Trees keep this far from plots, pads, roads, water and each other. */
    treeClearance: 1.6,
    treeSpacing: 3.4,
    /** Street lamps stand this far from the centre of their road. */
    lampOffset: 3.75,
    /** Small trees in the strips between neighbouring plots: about half of the possible places get one. */
    gapTrees: {
      share: 0.5,
      /** Along the strip, from the plots' centre line: at the back edge, behind the middle, just in front of it. */
      offsets: [-7, -2.5, 1.5],
      maxGap: 4,
      scale: 0.55,
    },
    /** The countryside around the board. */
    outskirts: {
      hills: 16,
      villages: 3,
      housesPerVillage: 10,
      trees: 260,
      clouds: 12,
      margin: 8,
      reach: 260,
    },
    fenceSegment: 3.2,
  },
  maxPixelRatio: 2,
  /** Longest real-time step a single frame may advance the camera by. */
  maxFrameSec: 0.1,
  /**
   * Sizes of the plain-box first version of the view (PLAN.md 3.13). Box
   * sizes are [width, height, depth]; "front" is local +z.
   */
  boxes: {
    /** Building and facility boxes sit this far behind the centre of their site, leaving a yard in front. */
    siteOffsetZ: -2,
    /** Building models are drawn in the plot frame and then moved this far towards the road. */
    buildingOffsetZ: 1.3,
    building: [10, 5, 7],
    facility: [12, 2, 7],
    vehicles: {
      carrier: [1.5, 1.3, 2.6],
      boxTruck: [2.3, 2.5, 5.6],
      cargoShip: [7, 4, 20],
      cargoPlane: [6, 3, 16],
      fallback: [2, 2, 4],
    },
    specialCargo: [3, 3, 3],
    /** Radius of the click target around special cargo. */
    specialPickRadius: 3.2,
    /** Where piles stand on a site, in the site's local frame. */
    yard: {
      /** z of the row of input and output piles in front of the box. */
      frontZ: 5.5,
      /** Inputs start at -edgeX and run towards the centre, outputs start at +edgeX. */
      edgeX: 7,
      step: 1.7,
      /** Waste piles stand beside the box and run towards the back. */
      wasteX: 7,
      wasteZ: 0.7,
      wasteStep: 2.3,
      /**
       * Transport facilities hold many kinds of goods: their piles are smaller
       * and wrap into rows that run from the front of the pad towards the model.
       */
      facility: {
        scale: 0.8,
        perRow: 11,
        rows: 3,
        edgeX: 6.5,
        step: 1.3,
        frontZ: 5.6,
        rowStep: 1.3,
      },
    },
    ground: {
      /** Half size of the grass plane around the board. */
      extent: 1600,
      boardThickness: 0.6,
      /** Heights of the flat pads above the board; each layer sits a little higher to avoid flicker. */
      /** Water and tarmac lie lowest, so a pad that reaches over them never shares their plane. */
      runwayHeight: 0.04,
      /** Runway lights: distance between two along an edge, how far in from the edge they stand, and how far they keep from where planes taxi off. */
      runwayLights: { step: 7, inset: 0.45, endStep: 1.4, clearance: 3 },
      /** Width of the beach between the grass and the sea. */
      beachWidth: 5,
      padHeight: 0.06,
      curbHeight: 0.08,
      /** How far the pale curb shows on each side of a road. */
      curbWidth: 0.7,
      roadHeight: 0.1,
      markHeight: 0.115,
      /** Centre-line dashes: length, width and the distance from one to the next. */
      dash: [2, 0.28, 5],
      /** The rim is a ledge this much wider than the board and this much lower. */
      rim: [2.4, 0.22],
      /** Radius of the board's corners, seen from above. */
      cornerRadius: 7,
      selectionHeight: 0.16,
      /** Gap left around a plot pad so neighbouring plots read as separate. */
      plotInset: 0.7,
      facilityPad: [16, 14],
    },
  },
} as const;

export type RenderConfig = typeof renderConfig;
