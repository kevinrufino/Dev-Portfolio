import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Drives the landing loader → physics-fill sequence.
 *
 * The pixel-water loader fills the hero name off real page-readiness signals
 * (fonts + window load + first shader paint), eased so it rises smoothly
 * instead of stepping on each milestone, with a minimum on-screen duration so
 * it never flashes past. When the fill reaches 100% it hands off to the
 * physics canvas: the DOM name hides the same frame the canvas draws its 1:1
 * bodies, so the swap is seamless.
 *
 * State is owned here (rather than in a component) so App can pass it to both
 * the loader overlay and the document-sized FillPhysicsCanvas, which live in
 * different parts of the tree.
 */
const MIN_LOADING_MS = 2200; // ≥2s so the water fill always reads
const READINESS_CAP_MS = 8000; // hard stop if a signal never fires (e.g. no WebGL)
const EASE = 0.18; // per-frame approach toward the target fill

export default function useLandingSequence() {
  const [pct, setPct] = useState(0);
  const [filling, setFilling] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [filled, setFilled] = useState(false);
  const nameRef = useRef(null);
  const pctRef = useRef(0); // synchronous source of truth for the eased fill

  // The whole sequence assumes it plays from the top of the page (the floor
  // sits at the first fold, the handoff rect is measured at scrollY 0). On a
  // refresh, Chrome restores the previous scroll position — which put the
  // loader over the middle of the page and dropped the names off-screen.
  // Take over restoration and start at the top.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Pre-warm the matter-js chunk while the loader plays.
  useEffect(() => {
    import('matter-js');
  }, []);

  // Water fill = time ramp (85%) + real readiness (15%), eased toward that
  // target each frame. Hands off once the minimum time has elapsed AND every
  // readiness milestone has landed AND the eased fill has reached ~100%.
  useEffect(() => {
    const start = Date.now();
    const milestones = ['fonts', 'window-load', 'shader'];
    const done = new Set();
    let raf = 0;

    const realFrac = () => done.size / milestones.length;

    const tick = () => {
      const elapsed = Date.now() - start;
      const timeRamp = Math.min(1, elapsed / MIN_LOADING_MS);
      // Time drives most of the rise (0→85%) so the water visibly climbs even
      // while readiness signals are still pending; real readiness contributes
      // the last 15%, so the fill can only complete once the page is ready.
      // (Gating the whole rise on readiness made the water sit still on cold
      // loads, then snap to full at the end.)
      const target = timeRamp * 85 + realFrac() * 15;
      // Tracked in a ref so the handoff test below is synchronous — a
      // functional setState updater isn't guaranteed to run before this frame
      // continues.
      pctRef.current += (target - pctRef.current) * EASE;
      setPct(pctRef.current);

      if (realFrac() >= 1 && elapsed >= MIN_LOADING_MS && pctRef.current > 99) {
        pctRef.current = 100;
        setPct(100);
        setFilling(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    document.fonts.ready.then(() => done.add('fonts'));

    const onLoad = () => done.add('window-load');
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    const onShader = () => done.add('shader');
    if (window.__shaderReady) onShader();
    else window.addEventListener('shader:ready', onShader, { once: true });

    // Safety: never hang if a milestone signal is missed.
    const cap = setTimeout(
      () => milestones.forEach(m => done.add(m)),
      READINESS_CAP_MS,
    );

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(cap);
      window.removeEventListener('load', onLoad);
      window.removeEventListener('shader:ready', onShader);
    };
  }, []);

  const getSpawnRect = useCallback(
    () => nameRef.current?.getBoundingClientRect(),
    [],
  );

  // Same frame the canvas draws the 1:1 bodies: hide the DOM name (direct
  // style write — synchronous, no React re-render between) and unmount the
  // now-unneeded loader overlay.
  const onHandoff = useCallback(() => {
    if (nameRef.current) nameRef.current.style.visibility = 'hidden';
    setHandedOff(true);
  }, []);

  // The canvas reports when every row has landed — this unfreezes scrolling
  // and fades in the scroll cue.
  const onFilled = useCallback(() => setFilled(true), []);

  return {
    pct,
    filling,
    handedOff,
    filled,
    nameRef,
    getSpawnRect,
    onHandoff,
    onFilled,
  };
}
