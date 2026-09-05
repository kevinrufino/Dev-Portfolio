import { useEffect, useRef } from 'react';
import { createPalmScene } from './palmEngine.js';
import { setLeafColliderProvider } from './leafColliders.js';
import { ENABLE_PALM_SCENE } from '../../featureFlags.js';

// The presenter is the page's most expensive pass, so it is capped well below
// 60fps. The palm is ambient — nothing about it needs to track the pointer
// frame-for-frame, and the budget is better spent on the landing physics.
const FRAME_MS = 31;
// How far outside the viewport the intro and footer both have to be before the
// frame is skipped entirely: between them sits the works section, which the
// palm is clipped out of anyway.
const SKIP_MARGIN = 160;

/**
 * Mounts the palm scene over the page.
 *
 * Reads its anchors from the DOM by id rather than by ref, so it does not need
 * the intro, works and footer sections to thread refs up through App — and so
 * it degrades to doing nothing if any of them is absent.
 */
const PalmScene = () => {
  const canvasRef = useRef(null);
  const palmRef = useRef(null);

  useEffect(() => {
    if (!ENABLE_PALM_SCENE) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const rectOf = id => {
      const el = document.getElementById(id);
      return el ? el.getBoundingClientRect() : undefined;
    };

    const palm = createPalmScene({
      displayCanvas: canvas,
      getConfig: () => ({
        wind: true,
        stars: true,
        waves: true,
        coconuts: true,
        snap: true,
        // One effect, chosen: the prototype's picker was authoring scaffolding.
        effect: 'breeze',
        strength: 0.25,
        paused: false,
      }),
      getRects: () => {
        const intro = rectOf('intro');
        // The palm clips clear of the intro's copy column. Read the column's
        // right edge from the DOM so Intro owns its own layout.
        const copy = document
          .getElementById('intro')
          ?.querySelector('[data-palm-clip]');
        return {
          intro,
          copyRight: copy
            ? copy.getBoundingClientRect().right
            : intro
              ? intro.left + intro.width * 0.45
              : 0,
          works: rectOf('projects'),
          footer: rectOf('contact'),
        };
      },
    });
    palmRef.current = palm;
    setLeafColliderProvider(time => palm.leafColliders(time));

    let raf = 0;
    let last = 0;
    const loop = t => {
      raf = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      const intro = rectOf('intro');
      const footer = rectOf('contact');
      if (
        intro &&
        footer &&
        intro.bottom < -SKIP_MARGIN &&
        footer.top > window.innerHeight + SKIP_MARGIN
      ) {
        return;
      }
      palm.render(t);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => palm.resize();
    const onMove = e => palm.setPointer(e.clientX, e.clientY);
    const onLeave = () => palm.setPointer(-1000, -1000);

    // Reaching the very bottom of the page shakes a coconut loose, once per
    // visit to the bottom — `armed` re-arms only after scrolling back up.
    let armed = true;
    const onScroll = () => {
      const remaining =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY;
      if (remaining > SKIP_MARGIN) armed = true;
      if (remaining <= 40 && armed && palm.getProgress() > 0.98) {
        armed = false;
        palm.shake();
        palm.dropCoconut();
      }
    };

    const onClick = e => {
      // Never swallow a click meant for the page's own controls.
      if (e.target.closest('button,a,summary,select,input,textarea')) return;
      const hit = palm.hitTest(e.clientX, e.clientY);
      if (hit.tree || hit.nut) palm.shake();
      if (hit.nut) palm.dropCoconut(hit.nut);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      setLeafColliderProvider(null);
      palmRef.current = null;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onClick);
    };
  }, []);

  if (!ENABLE_PALM_SCENE) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
};

export default PalmScene;
