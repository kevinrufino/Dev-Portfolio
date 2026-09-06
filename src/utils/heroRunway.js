/**
 * The elongated hero.
 *
 * The hero is a viewport tall PLUS a runway. Scrolling through that runway
 * does not leave the hero: the pile of names is pinned to the screen and
 * shrinks in place, from full size down to `HERO_MIN_SCALE`, while the page
 * moves behind it. Only once the runway is spent does the pile let go and the
 * intro come up — and it falls at the size the reader shrank it to.
 *
 * Three places have to agree on these numbers: the hero's own height, the
 * scroll-jack that decides when the reader may leave, and the physics canvas
 * that does the shrinking.
 */

/** Scroll distance inside the hero, in px, before anything falls. */
export const HERO_SHRINK_PX = 500;

/**
 * What the pile shrinks to across that runway. Uniform, so the names keep
 * their proportions — they leave the page smaller, not thinner.
 */
export const HERO_MIN_SCALE = 0.5;
