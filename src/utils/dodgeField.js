/**
 * Dodge field — the shared channel between the falling names and the page text.
 *
 * FillPhysicsCanvas publishes the axis-aligned bounds of every live name
 * sprite (in document coordinates) once per rendered frame; text blocks
 * register themselves as targets and are asked, in the same frame, to move
 * their lines clear of anything they intersect.
 *
 * Everything here is deliberately instantaneous: a character jumps exactly far
 * enough to stop overlapping and jumps straight back the frame contact ends.
 * There is no easing, spring or decay anywhere in this file, by design.
 *
 * The flush is split into a read pass and a write pass so a page full of
 * dodging characters still costs one layout per frame.
 */

// Document-space AABBs of the falling names: { left, top, right, bottom }.
let fallingRects = [];

// Registered text blocks. Each target is { measure(), apply(active) }: measure()
// refreshes the target's cached character boxes (the read pass), apply()
// resolves them against the names and writes the transforms (the write pass).
const targets = new Set();

/**
 * Register a text block with the field.
 * @param {{measure: Function, apply: Function}} target
 * @returns {Function} unregister
 */
export const registerDodgeTarget = target => {
  targets.add(target);
  return () => {
    targets.delete(target);
    target.apply(false); // drop back to rest on unmount
  };
};

/**
 * Whether any name currently overlaps a box at all. Callers use it to reject a
 * whole line in one test rather than resolving each of its characters.
 * @param {{left:number, top:number, right:number, bottom:number}|null} box
 */
export const intersectsAny = box => {
  if (!box) return false;
  for (let i = 0; i < fallingRects.length; i++) {
    const name = fallingRects[i];
    if (name.right <= box.left || name.left >= box.right) continue;
    if (name.bottom <= box.top || name.top >= box.bottom) continue;
    return true;
  }
  return false;
};

/**
 * Resolve a single character box against the current falling names.
 *
 * Each intersecting name contributes a minimum translation vector — the
 * shortest move that separates the two boxes. `preferAxis` keeps a line
 * committed to the axis it first dodged on for as long as contact lasts, so a
 * name sweeping through shoves a character one way instead of flipping it
 * between sideways and downward halfway through the pass.
 *
 * The result is written into a single shared object: this runs for every line
 * on the page on every frame of the drain, and the caller reads it before the
 * next call, so there is nothing to gain from allocating a new one each time.
 *
 * @param {{left:number, top:number, right:number, bottom:number}} box
 * @param {'x'|'y'|null} preferAxis
 * @returns {{x:number, y:number, axis:('x'|'y'|null)}} shared, read it now
 */
const push = { x: 0, y: 0, axis: null };
export const resolveBox = (box, preferAxis) => {
  let left = 0; // largest push demanded towards -x
  let right = 0;
  let up = 0;
  let down = 0;
  let axis = null;

  for (let i = 0; i < fallingRects.length; i++) {
    const name = fallingRects[i];
    const overlapX =
      Math.min(box.right, name.right) - Math.max(box.left, name.left);
    if (overlapX <= 0) continue;
    const overlapY =
      Math.min(box.bottom, name.bottom) - Math.max(box.top, name.top);
    if (overlapY <= 0) continue;

    // The four ways out, as positive distances.
    const outLeft = box.right - name.left;
    const outRight = name.right - box.left;
    const outUp = box.bottom - name.top;
    const outDown = name.bottom - box.top;

    const bestX = Math.min(outLeft, outRight);
    const bestY = Math.min(outUp, outDown);
    // Stay on the axis this line is already dodging on unless the other one is
    // clearly cheaper, so the escape direction doesn't churn mid-contact.
    let useX = bestX < bestY;
    if (preferAxis === 'x') useX = bestX <= bestY * 2.5;
    else if (preferAxis === 'y') useX = bestX * 2.5 < bestY;

    if (useX) {
      axis = 'x';
      if (outLeft < outRight) left = Math.max(left, outLeft);
      else right = Math.max(right, outRight);
    } else {
      axis = axis === 'x' ? 'x' : 'y';
      if (outUp < outDown) up = Math.max(up, outUp);
      else down = Math.max(down, outDown);
    }
  }

  push.x = right - left;
  push.y = down - up;
  push.axis = axis;
  return push;
};

// How far above/below the names a block has to be before it is skipped for the
// frame. Generous enough to cover a section's reveal offset.
const NEAR_BAND = 200;

// Cached bounds are only re-read when a name comes near, so a block that moves
// while nothing is near it (content loading in above it) would keep stale
// bounds forever. Every REVALIDATE_EVERY frames the band test lets everyone
// through and the caches refresh themselves.
const REVALIDATE_EVERY = 30;
let frame = 0;
let revalidate = false;

/**
 * True when a block sits far enough from every name that it cannot be touched
 * this frame — the cheap arithmetic that keeps a settled pile in the hero from
 * costing a rect read on every block on the page, every frame.
 *
 * Only the vertical span is tested: the names travel down the page, while the
 * one thing that moves horizontally under its own steam (the skills marquee)
 * stays on a fixed row.
 * @param {{top:number, bottom:number}|null} bounds last known rest bounds
 */
export const isOutOfBand = bounds => {
  if (!bounds) return false; // never measured — read it and find out
  if (revalidate) return false; // periodic refresh, so cached bounds can't rot
  for (let i = 0; i < fallingRects.length; i++) {
    const name = fallingRects[i];
    if (name.bottom < bounds.top - NEAR_BAND) continue;
    if (name.top > bounds.bottom + NEAR_BAND) continue;
    return false;
  }
  return true;
};

/**
 * Publish the current falling-name bounds and push every registered block.
 * Called once per physics frame; also called with an empty list when the
 * simulation stops, which snaps every line back to rest.
 * @param {Array<{left:number, top:number, right:number, bottom:number}>} rects
 */
export const publishFallingRects = rects => {
  const wasIdle = fallingRects.length === 0;
  fallingRects = rects;
  if (wasIdle && rects.length === 0) return; // nothing moving, nothing to undo
  if (targets.size === 0) return;

  frame += 1;
  revalidate = frame % REVALIDATE_EVERY === 0;

  for (const target of targets) target.measure();
  for (const target of targets) target.apply(true);
};
