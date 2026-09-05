/**
 * The one seam between the palm scene and the landing physics.
 *
 * The falling names glance off the palm's fronds, which means the physics
 * canvas needs collider positions that only the palm knows how to compute.
 * The two components are siblings in the tree and neither owns the other, so
 * rather than lifting a ref through App and threading it down two branches,
 * the palm registers a provider here and the physics reads it.
 *
 * The registry is deliberately tiny and one-way: physics never calls back into
 * the palm, and if the palm is disabled (or its flag is off) the provider is
 * simply absent and the physics runs with no leaf colliders at all.
 */
let provider = null;

/** Called by the palm scene on mount; pass `null` on unmount. */
export function setLeafColliderProvider(fn) {
  provider = fn;
}

/**
 * @param {number} time - the palm's animation clock.
 * @returns {{x:number,y:number,r:number}[]} colliders in document coordinates,
 *   or an empty array when no palm is mounted.
 */
export function getLeafColliders(time) {
  if (!provider) return [];
  try {
    return provider(time) || [];
  } catch {
    // A collider read must never take the landing sequence down with it.
    return [];
  }
}
