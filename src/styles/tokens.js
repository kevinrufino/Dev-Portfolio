/**
 * Design tokens for JavaScript.
 *
 * The stylesheets read the generated custom properties in `tokens.css`; canvas
 * code, inline styles and physics materials cannot, so they read this instead.
 * Both come from the same `tokens.json`, which is exported from Figma — so a
 * colour changed in the design file reaches a `fillStyle` on a canvas, which it
 * previously could not.
 *
 *   import { colour } from '../styles/tokens.js';
 *   ctx.fillStyle = colour.acid;
 *
 * Values are plain strings, resolved at build time by webpack's JSON import.
 * Reading `colour.acid` in a per-frame loop is a property access on a frozen
 * object and costs nothing worth hoisting — but hoist it anyway if the line is
 * inside a pixel loop, the same as any other repeated lookup.
 */
import tokens from './tokens.json';

/** Every colour in the system, keyed as it is named in Figma. */
export const colour = Object.freeze({ ...tokens.colour });

/** Spacing scale in px, including the 6px lattice everything aligns to. */
export const space = Object.freeze({ ...tokens.space });

/** Durations in ms and easing curves. */
export const motion = Object.freeze({ ...tokens.motion });

export default Object.freeze({ colour, space, motion });
