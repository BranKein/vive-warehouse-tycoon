/**
 * Day/night cycle maths. Pure: colours are plain 0xRRGGBB numbers and the
 * result is plain numbers, so this is unit tested without Three.js.
 * The cycle is purely visual and driven by real time.
 */
import { clamp01, lerp, smoothstep, TAU } from './math';

export interface DayNightKeyframe {
  /** Position in the cycle, 0..1. Keyframes must be sorted by this. */
  at: number;
  name: string;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  /** Colour and strength of the single shadow-casting light (sun by day, moon by night). */
  light: number;
  lightIntensity: number;
  /** Hemisphere (ambient) light. */
  ambientSky: number;
  ambientGround: number;
  ambientIntensity: number;
  /** 0 = day, 1 = night. Drives window and street lamp glow and the stars. */
  night: number;
  /** Tint multiplied into clouds. */
  cloud: number;
}

export interface DayNightSettings {
  /** Real seconds for one full cycle. */
  cycleSec: number;
  /** Phase at time zero. */
  startPhase: number;
  /** Fraction of the cycle during which the sun is above the horizon, starting at phase 0. */
  dayFraction: number;
  /** Highest elevation of the sun and the moon, radians. */
  maxElevation: number;
  /** The light never drops below this elevation so shadows stay readable. */
  minLightElevation: number;
  /** Compass direction (heading, 0 = +z) the sun rises from. */
  sunriseHeading: number;
  keyframes: DayNightKeyframe[];
}

export type Rgb = [number, number, number];

export interface DayNightSample {
  skyTop: Rgb;
  skyHorizon: Rgb;
  fog: Rgb;
  light: Rgb;
  lightIntensity: number;
  ambientSky: Rgb;
  ambientGround: Rgb;
  ambientIntensity: number;
  night: number;
  cloud: Rgb;
}

export const hexToRgb = (hex: number): Rgb => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

export const rgbToHex = (rgb: Rgb): number =>
  (Math.round(clamp01(rgb[0]) * 255) << 16) | (Math.round(clamp01(rgb[1]) * 255) << 8) | Math.round(clamp01(rgb[2]) * 255);

export const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const lerpHex = (a: number, b: number, t: number): Rgb => lerpRgb(hexToRgb(a), hexToRgb(b), t);

/** Wraps any number into [0, 1). */
export const wrapPhase = (phase: number): number => ((phase % 1) + 1) % 1;

/** Cycle phase (0..1) for a real time in seconds. */
export function dayPhase(realTimeSec: number, settings: Pick<DayNightSettings, 'cycleSec' | 'startPhase'>): number {
  return wrapPhase(settings.startPhase + realTimeSec / settings.cycleSec);
}

/**
 * Finds the two keyframes around `phase` and how far between them it lies.
 * The list wraps: after the last keyframe comes the first one again.
 */
export function keyframeSpan(
  keyframes: ReadonlyArray<{ at: number }>,
  phase: number,
): { from: number; to: number; t: number } {
  const count = keyframes.length;
  if (count === 0) throw new Error('Day/night cycle needs at least one keyframe');
  if (count === 1) return { from: 0, to: 0, t: 0 };
  const p = wrapPhase(phase);
  let from = count - 1;
  for (let i = 0; i < count; i += 1) {
    if (keyframes[i]!.at <= p) from = i;
  }
  // Before the first keyframe we are on the wrapping span from the last one.
  if (p < keyframes[0]!.at) from = count - 1;
  const to = (from + 1) % count;
  const start = keyframes[from]!.at;
  let end = keyframes[to]!.at;
  let position = p;
  if (to <= from) {
    end += 1;
    if (position < start) position += 1;
  }
  const length = end - start;
  return { from, to, t: length <= 0 ? 0 : clamp01((position - start) / length) };
}

/** Blends the keyframes at `phase`. Transitions are eased so no change is abrupt. */
export function sampleDayNight(keyframes: ReadonlyArray<DayNightKeyframe>, phase: number): DayNightSample {
  const span = keyframeSpan(keyframes, phase);
  const a = keyframes[span.from]!;
  const b = keyframes[span.to]!;
  const t = smoothstep(span.t);
  return {
    skyTop: lerpHex(a.skyTop, b.skyTop, t),
    skyHorizon: lerpHex(a.skyHorizon, b.skyHorizon, t),
    fog: lerpHex(a.fog, b.fog, t),
    light: lerpHex(a.light, b.light, t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    ambientSky: lerpHex(a.ambientSky, b.ambientSky, t),
    ambientGround: lerpHex(a.ambientGround, b.ambientGround, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    night: lerp(a.night, b.night, t),
    cloud: lerpHex(a.cloud, b.cloud, t),
  };
}

export interface CelestialState {
  /** Unit vectors pointing from the scene towards the body. */
  sun: { x: number; y: number; z: number };
  moon: { x: number; y: number; z: number };
  /** True while the sun is the light source. */
  sunUp: boolean;
  /** Direction towards the shadow-casting light, kept above the minimum elevation. */
  light: { x: number; y: number; z: number };
}

function arcDirection(progress: number, maxElevation: number, sunriseHeading: number, minElevation = -Infinity) {
  // The body travels a half circle from the sunrise side, over the top, to the opposite side.
  const angle = progress * Math.PI;
  const elevation = Math.max(minElevation, Math.sin(angle) * maxElevation);
  const along = Math.cos(angle);
  const horizontal = Math.cos(elevation);
  // A little sideways tilt keeps shadows from lying exactly along the grid.
  const tiltHeading = sunriseHeading + 0.45;
  return {
    x: Math.sin(tiltHeading) * along * horizontal + Math.cos(tiltHeading) * 0.25 * Math.sin(angle) * horizontal,
    y: Math.sin(elevation),
    z: Math.cos(tiltHeading) * along * horizontal - Math.sin(tiltHeading) * 0.25 * Math.sin(angle) * horizontal,
  };
}

function normalize(v: { x: number; y: number; z: number }) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Where the sun and the moon are, and where the light comes from, at `phase`. */
export function celestialState(
  phase: number,
  settings: Pick<DayNightSettings, 'dayFraction' | 'maxElevation' | 'minLightElevation' | 'sunriseHeading'>,
): CelestialState {
  const p = wrapPhase(phase);
  const dayFraction = Math.min(0.95, Math.max(0.05, settings.dayFraction));
  const sunUp = p < dayFraction;
  const dayProgress = p / dayFraction;
  const nightProgress = (p - dayFraction) / (1 - dayFraction);
  // Off-duty bodies keep moving below the horizon so they never pop.
  const sunProgress = sunUp ? dayProgress : 1 + nightProgress;
  const moonProgress = sunUp ? 1 + dayProgress : nightProgress;
  const sun = normalize(arcDirection(sunProgress, settings.maxElevation, settings.sunriseHeading));
  const moon = normalize(arcDirection(moonProgress, settings.maxElevation, settings.sunriseHeading + TAU / 9));
  const lightProgress = sunUp ? dayProgress : nightProgress;
  const light = normalize(
    arcDirection(
      lightProgress,
      settings.maxElevation,
      sunUp ? settings.sunriseHeading : settings.sunriseHeading + TAU / 9,
      settings.minLightElevation,
    ),
  );
  return { sun, moon, sunUp, light };
}
