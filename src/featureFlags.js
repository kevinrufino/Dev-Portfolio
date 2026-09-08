/**
 * Feature flags
 *
 * Build-time switches for expensive or in-progress experiences. Each flag is a
 * plain module const with an optional `REACT_APP_*` override, so the value is
 * fixed at build time and the disabled branch costs nothing at runtime.
 *
 * To flip one locally without editing code, set the env var in `.env.local`:
 *
 *   REACT_APP_SHADER_BACKGROUND=true
 *
 * Accepted truthy values are `true` and `1`; anything else is false. An unset
 * or empty var falls through to the default below.
 *
 * Note: Create React App inlines `process.env.REACT_APP_*` only for static
 * member reads, so each flag must reference its variable literally — do not
 * refactor these into a lookup keyed by a string.
 */

const readFlag = (raw, fallback) => {
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
};

/**
 * Three.js / WebGL shader background (`MikaShaderEffect`).
 *
 * Off by default. The effect repaints a full-screen CPU control map and
 * re-uploads it as a texture every frame on top of the fragment shader pass,
 * which dominates the frame budget and competes with the matter-js landing
 * sequence for main-thread time. With it off the page falls back to the flat
 * `--acid` background set on `:root`, and the loader drops the shader-paint
 * readiness milestone (see `useLandingSequence`).
 */
export const ENABLE_SHADER_BACKGROUND = readFlag(
  process.env.REACT_APP_SHADER_BACKGROUND,
  false,
);

/**
 * The pixel palm scene (`PalmScene`).
 *
 * Off by default. It is the most expensive thing on the page — a full-viewport
 * raster presented on the 6px lattice every frame — and it already carries
 * three internal throttles (a sub-60fps cap, a skip while only the works
 * section is on screen, and batched frond strokes). Leave it off until it has
 * been profiled on a mid-range machine.
 *
 * With it off, no palm canvas mounts and the landing physics runs with no leaf
 * colliders, which is its behaviour on main today.
 */
export const ENABLE_PALM_SCENE = readFlag(
  process.env.REACT_APP_PALM_SCENE,
  // REVIEW BRANCH ONLY: defaulted on so the palm is visible without setting an
  // env var. On feat/palm-08-palm-scene (and therefore in PR #27) this stays
  // `false` — the scene wants profiling before it is on by default.
  true,
);
