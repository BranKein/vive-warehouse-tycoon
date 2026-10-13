/**
 * Looks: how the finished picture is graded. A look sets the tone curve, the
 * balance of sun and sky light and a final saturation and contrast step. The
 * colours of the theme stay as they are, so a look can be swapped while the
 * game runs without repainting anything. The player picks one in the settings.
 *
 * `classic` is the look the game had up to 2026-10-14.
 */
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  CustomToneMapping,
  ReinhardToneMapping,
  ShaderChunk,
  type ToneMapping,
  type WebGLRenderer,
} from 'three';

export interface Look {
  /** Tone curve: `aces` rolls bright colours off towards white, `neutral` keeps their colour. */
  curve: 'aces' | 'neutral';
  exposure: number;
  /** Multiplies the sun and the sky light of every time of day. */
  sun: number;
  ambient: number;
  /** 1 leaves the picture alone; above 1 is more colourful / more contrast. */
  saturation: number;
  contrast: number;
}

export const LOOKS = {
  /** The clear tone curve with the colours pushed a little. */
  soft: { curve: 'neutral', exposure: 0.62, sun: 1, ambient: 1, saturation: 1.13, contrast: 1.03 },
  /** A tone curve that does not wash bright colours out. */
  clear: { curve: 'neutral', exposure: 0.62, sun: 1, ambient: 1, saturation: 1.05, contrast: 1 },
  /** The old curve, colours pushed. */
  vivid: { curve: 'aces', exposure: 0.8, sun: 1, ambient: 1, saturation: 1.3, contrast: 1.06 },
  /** Less sky light and more sun: deeper shadows. */
  sunny: { curve: 'aces', exposure: 0.8, sun: 1.25, ambient: 0.72, saturation: 1.12, contrast: 1 },
  classic: { curve: 'aces', exposure: 0.8, sun: 1, ambient: 1, saturation: 1, contrast: 1 },
} satisfies Record<string, Look>;

export type LookName = keyof typeof LOOKS;
export const LOOK_NAMES = Object.keys(LOOKS) as LookName[];
export const DEFAULT_LOOK: LookName = 'soft';
export const LOOK_STORAGE_KEY = 'warehouse-tycoon.look';

export const isLook = (name: string | null | undefined): name is LookName => typeof name === 'string' && name in LOOKS;

/** Whether a look is the plain filmic curve, with no grade of its own. */
const plain = (look: Look): boolean => look.curve === 'aces' && look.saturation === 1 && look.contrast === 1;

/**
 * Three.js compiles one tone mapping function into each shader and recompiles
 * by itself when `renderer.toneMapping` changes. So every graded look takes
 * the place of one of the built-in curves the game does not use: its grade is
 * written into the shader source under that curve's name, and switching looks
 * is just switching `renderer.toneMapping`.
 */
const SLOTS: ReadonlyArray<readonly [ToneMapping, string]> = [
  [CustomToneMapping, 'CustomToneMapping'],
  [ReinhardToneMapping, 'ReinhardToneMapping'],
  [CineonToneMapping, 'CineonToneMapping'],
  [AgXToneMapping, 'AgXToneMapping'],
];
const slotOf = new Map<Look, ToneMapping>();
const glsl = (value: number): string => value.toFixed(4);

{
  const graded = Object.entries(LOOKS as Record<string, Look>).filter(([, look]) => !plain(look));
  let source = ShaderChunk.tonemapping_pars_fragment;
  graded.forEach(([name, look], index) => {
    const slot = SLOTS[index];
    if (!slot) throw new Error(`looks: no tone mapping slot left for "${name}"`);
    slotOf.set(look, slot[0]);
    source += `
vec3 wtLook_${name}( vec3 color ) {
  color = ${look.curve === 'aces' ? 'ACESFilmicToneMapping' : 'NeutralToneMapping'}( color );
  float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
  color = mix( vec3( luma ), color, ${glsl(look.saturation)} );
  color = ( color - 0.4 ) * ${glsl(look.contrast)} + 0.4;
  return clamp( color, 0.0, 1.0 );
}`;
  });
  // After every definition, so the built-in curves the looks are made of keep their own names.
  graded.forEach(([name], index) => {
    source += `\n#define ${SLOTS[index]![1]} wtLook_${name}`;
  });
  ShaderChunk.tonemapping_pars_fragment = source;
}

/** Sets the renderer's tone curve and exposure for a look. The light scales are read by the Environment. */
export function applyLook(renderer: WebGLRenderer, look: Look): void {
  renderer.toneMappingExposure = look.exposure;
  renderer.toneMapping = slotOf.get(look) ?? ACESFilmicToneMapping;
}
