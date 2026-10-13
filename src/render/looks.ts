/**
 * Looks: how the finished picture is graded. A look sets the tone curve, the
 * balance of sun and sky light and a final saturation and contrast step. The
 * colours of the theme stay as they are, so a look can be swapped without
 * repainting anything.
 *
 * `classic` is the look the game had up to 2026-10-14, kept so it can be
 * compared with and gone back to. On the dev server `?look=<name>` picks one.
 */
import { ACESFilmicToneMapping, CustomToneMapping, ShaderChunk, type WebGLRenderer } from 'three';

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
  classic: { curve: 'aces', exposure: 0.8, sun: 1, ambient: 1, saturation: 1, contrast: 1 },
  /** Same light, colours pushed a little. */
  vivid: { curve: 'aces', exposure: 0.8, sun: 1, ambient: 1, saturation: 1.3, contrast: 1.06 },
  /** Less sky light and more sun: deeper shadows, colours as painted. */
  sunny: { curve: 'aces', exposure: 0.8, sun: 1.25, ambient: 0.72, saturation: 1.12, contrast: 1 },
  /** A tone curve that does not wash bright colours out. */
  clear: { curve: 'neutral', exposure: 0.62, sun: 1, ambient: 1, saturation: 1.05, contrast: 1 },
  /** The clear curve with the sunnier light. */
  crisp: { curve: 'neutral', exposure: 0.66, sun: 1.2, ambient: 0.75, saturation: 1.15, contrast: 1.04 },
} satisfies Record<string, Look>;

export type LookName = keyof typeof LOOKS;
export const DEFAULT_LOOK: LookName = 'classic';

export const isLook = (name: string | null): name is LookName => name !== null && name in LOOKS;

const STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const original = ShaderChunk.tonemapping_pars_fragment;
const glsl = (value: number): string => value.toFixed(4);

/**
 * Sets the renderer up for a look. Call before anything is drawn: the grade is
 * compiled into the shaders. The light scales are read by the Environment.
 */
export function applyLook(renderer: WebGLRenderer, look: Look): void {
  renderer.toneMappingExposure = look.exposure;
  if (look.curve === 'aces' && look.saturation === 1 && look.contrast === 1) {
    ShaderChunk.tonemapping_pars_fragment = original;
    renderer.toneMapping = ACESFilmicToneMapping;
    return;
  }
  const curve = look.curve === 'aces' ? 'ACESFilmicToneMapping' : 'NeutralToneMapping';
  ShaderChunk.tonemapping_pars_fragment = original.replace(
    STUB,
    `vec3 CustomToneMapping( vec3 color ) {
      color = ${curve}( color );
      float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color = mix( vec3( luma ), color, ${glsl(look.saturation)} );
      color = ( color - 0.4 ) * ${glsl(look.contrast)} + 0.4;
      return clamp( color, 0.0, 1.0 );
    }`,
  );
  renderer.toneMapping = CustomToneMapping;
}
