/**
 * The one seam between "go to the works section" and "go back to where I was".
 *
 * Which project the index is showing is not state anyone outside the pane can
 * set: selection there is derived from scroll position, and the offset that
 * lands on a given project depends on the pane's own measurements and on which
 * of the two lists it is showing. So the pane publishes the ability instead,
 * and the navigation helpers ask for it by name.
 *
 * Deliberately tiny, and deliberately optional — with no pane mounted the
 * selector is simply absent and the caller falls back to scrolling to the top
 * of the section, which is what used to happen every time.
 */
let selector = null;

/** Called by the works pane on mount; pass `null` on unmount. */
export function setWorkSelector(fn) {
  selector = fn;
}

/**
 * Put the index on a named project.
 *
 * @param {string} title - the project's title, as the archive spells it.
 * @returns {boolean} whether a pane was there to honour it.
 */
export function selectWork(title) {
  if (!selector || !title) return false;
  try {
    return Boolean(selector(title));
  } catch {
    // Never let a failure to restore a position stop the navigation itself.
    return false;
  }
}
