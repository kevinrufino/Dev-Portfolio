/**
 * In-page navigation without hashes.
 *
 * Sections used to be reached by `/#projects`. That put the destination in the
 * URL, which meant a reload dropped the reader back into whichever section
 * they had last jumped to instead of starting the page from the top — and it
 * hard-coded a route into every nav item.
 *
 * Instead the target travels as router state, which is consumed and cleared on
 * arrival. The address bar stays at `/`, reloads start at the beginning, and a
 * section id is the only thing any caller has to know.
 */

/** Section ids the nav can address. `home` is the intro: the hero collapses. */
export const SECTIONS = {
  home: 'intro',
  work: 'projects',
  contact: 'contact',
};

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A section's resting position in the document.
 *
 * A stuck `position: sticky` element reports its STUCK position — both its
 * rect and its offsetTop follow the viewport while it is pinned. Asking one of
 * those for "where is the intro" while the intro is pinned answers "right
 * where you are", so scrolling to it did nothing at all.
 *
 * Pinning is suspended for the duration of the measurement and restored
 * immediately, within the same frame, so nothing is ever painted in the
 * un-stuck state.
 */
export function documentTop(el) {
  if (getComputedStyle(el).position !== 'sticky') {
    return el.getBoundingClientRect().top + window.scrollY;
  }
  const previous = el.style.position;
  el.style.position = 'static';
  const y = el.getBoundingClientRect().top + window.scrollY;
  el.style.position = previous;
  return y;
}

/**
 * Where the footer reveal begins.
 *
 * The footer is fixed, so it has no flow position to measure — it occupies the
 * last footer-height of scrollable range. Anything that needs to know "are we
 * in the contact section" has to ask this rather than the footer's own rect,
 * which reports the same viewport box at every scroll position.
 */
export function revealStart() {
  const footer = document.getElementById('contact');
  const h = footer ? footer.offsetHeight : window.innerHeight;
  return Math.max(0, document.documentElement.scrollHeight - h);
}

/**
 * Scroll to a section on the page we are already on.
 *
 * Two targets are not reachable by scrolling to the element itself: the footer
 * is fixed behind the page and is uncovered by scrolling to the very end, and
 * `home` means the top of the content rather than a hero that may since have
 * collapsed to nothing.
 *
 * @param {string} key - a key of SECTIONS, or a raw element id.
 */
export function scrollToSection(key) {
  const behavior = prefersReducedMotion() ? 'instant' : 'smooth';
  const id = SECTIONS[key] || key;

  if (id === 'contact') {
    window.scrollTo({
      top: document.documentElement.scrollHeight - window.innerHeight,
      behavior,
    });
    return;
  }

  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: Math.max(0, documentTop(el)), behavior });
}

/**
 * Go to a section from anywhere.
 *
 * On the homepage this is a scroll. From a project page it is a navigation
 * carrying the target in state, which App consumes once and then clears.
 *
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {string} pathname - the current pathname.
 * @param {string} key - a key of SECTIONS.
 */
export function goToSection(navigate, pathname, key) {
  if (pathname === '/') {
    scrollToSection(key);
    return;
  }
  navigate('/', { state: { scrollTo: key } });
}
