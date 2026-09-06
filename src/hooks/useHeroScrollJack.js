import { useEffect, useRef, useCallback } from 'react';

/**
 * Scroll-jack for the landing hero.
 *
 * Once the hero has been left behind it is COLLAPSED to zero height rather
 * than merely locked off. The drained hero is a viewport of empty acid, and
 * keeping it in the document meant the top of the page was somewhere the
 * reader could never reach — the scrollbar showed content above them that
 * scrolling would not reveal, which reads as the page being stuck.
 *
 * The collapse and the matching scroll correction happen in the same
 * synchronous block, so the content below does not move on screen: the page
 * loses a viewport of height above the reader at the same instant the reader's
 * scroll position loses a viewport. After that the jack has nothing left to
 * guard and removes itself.
 *
 * Until the fill completes (`ready`), the page can't scroll at all — the
 * loader is a gate, the physics handoff assumes scrollY = 0, and the name
 * rows should finish landing before the user can leave. Once ready:
 *
 * - hero:      the first downward wheel / swipe / key is intercepted and
 *              replaced with a smooth animated scroll to the next viewport
 *              (the Intro). The floor split is scroll-driven, so the pile
 *              drains as the animation rides down.
 * - animating: all scroll input is swallowed until the snap lands.
 * - locked:    the drained hero is empty space, so the fold becomes the top
 *              of the page: upward input at the boundary is blocked, and a
 *              scroll clamp catches anything else (scrollbar drags, Home key,
 *              #home anchor navigation).
 *
 * Reaching the fold by any other means (e.g. dragging the scrollbar) also
 * engages the lock.
 */
const SNAP_MS = 700;
const SWIPE_THRESHOLD_PX = 8;

const easeInOutCubic = t =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function useHeroScrollJack(ready, heroRef) {
  // Lets the scroll cue trigger the same snap the wheel/swipe uses.
  const snapRef = useRef(null);

  // Freeze the page entirely until the loader has handed off AND every name
  // row has landed.
  useEffect(() => {
    if (ready) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;

    const fold = window.innerHeight;
    let state = window.scrollY >= fold ? 'locked' : 'hero';
    let raf = 0;
    let collapsed = false;
    let teardown = () => {};

    // Take the empty hero out of the document and remove the same distance
    // from the scroll position in one go, so nothing on screen moves.
    const collapseHero = () => {
      if (collapsed) return;
      const hero = heroRef?.current;
      if (!hero) return;
      collapsed = true;
      const y = window.scrollY;
      hero.style.height = '0px';
      hero.style.minHeight = '0px';
      hero.style.overflow = 'hidden';
      window.scrollTo({ top: Math.max(0, y - fold), behavior: 'instant' });
      // The hero is gone, so there is no dead space left to guard.
      teardown();
    };

    const snapToIntro = () => {
      state = 'animating';
      const from = window.scrollY;
      const start = performance.now();
      const step = now => {
        const t = Math.min(1, (now - start) / SNAP_MS);
        // Instant per frame: this IS the animation, and letting CSS smooth
        // scrolling ease each step would fight it into a crawl.
        window.scrollTo({
          top: from + (fold - from) * easeInOutCubic(t),
          behavior: 'instant',
        });
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          state = 'locked';
          collapseHero();
        }
      };
      raf = requestAnimationFrame(step);
    };

    const onWheel = e => {
      if (state === 'hero') {
        if (e.deltaY > 0) {
          e.preventDefault();
          snapToIntro();
        }
      } else if (state === 'animating') {
        e.preventDefault();
      } else if (e.deltaY < 0 && window.scrollY <= fold) {
        e.preventDefault();
      }
    };

    let touchStartY = 0;
    const onTouchStart = e => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = e => {
      const dy = touchStartY - e.touches[0].clientY; // > 0 = scrolling down
      if (state === 'hero') {
        if (dy > SWIPE_THRESHOLD_PX) {
          e.preventDefault();
          snapToIntro();
        }
      } else if (state === 'animating') {
        e.preventDefault();
      } else if (dy < 0 && window.scrollY <= fold) {
        e.preventDefault();
      }
    };

    const DOWN_KEYS = ['ArrowDown', 'PageDown', 'End', ' '];
    const UP_KEYS = ['ArrowUp', 'PageUp', 'Home'];
    const onKey = e => {
      // Only hijack page-level scrolling, not focused controls.
      if (e.target !== document.body && e.target !== document.documentElement)
        return;
      if (state === 'hero' && DOWN_KEYS.includes(e.key)) {
        e.preventDefault();
        snapToIntro();
      } else if (
        state === 'animating' &&
        (DOWN_KEYS.includes(e.key) || UP_KEYS.includes(e.key))
      ) {
        e.preventDefault();
      } else if (
        state === 'locked' &&
        UP_KEYS.includes(e.key) &&
        window.scrollY <= fold
      ) {
        e.preventDefault();
      }
    };

    // Safety net for inputs that bypass wheel/touch/key (scrollbar drags,
    // anchor navigation): engage the lock when the fold is passed, and never
    // reveal the drained hero again once locked.
    // Reaching the fold by any other means (a scrollbar drag, an anchor)
    // collapses the hero too, rather than clamping the reader against it.
    const onScroll = () => {
      if (state === 'hero' && window.scrollY >= fold) {
        state = 'locked';
        collapseHero();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Expose the snap for the scroll cue (only fires from the hero state).
    snapRef.current = () => {
      if (state === 'hero') snapToIntro();
    };

    teardown = () => {
      cancelAnimationFrame(raf);
      snapRef.current = null;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
    return teardown;
  }, [ready, heroRef]);

  return useCallback(() => snapRef.current?.(), []);
}
