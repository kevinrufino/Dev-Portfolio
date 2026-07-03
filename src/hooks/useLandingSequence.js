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
  const nameRef = useRef(null);
  const pctRef = useRef(0); // synchronous source of truth for the eased fill

  // Pre-warm the matter-js chunk while the loader plays.
  useEffect(() => {
    import('matter-js');
  }, []);

  // Water fill = min(time ramp, real readiness), eased toward that target each
  // frame. Hands off once the minimum time has elapsed AND every readiness
  // milestone has landed AND the eased fill has essentially reached 100%.
  useEffect(() => {
    const start = Date.now();
    const milestones = ['fonts', 'window-load', 'shader'];
    const done = new Set();
    let raf = 0;

    const realFrac = () => done.size / milestones.length;

    const tick = () => {
      const elapsed = Date.now() - start;
      const timeRamp = Math.min(1, elapsed / MIN_LOADING_MS);
      const target = Math.min(timeRamp, realFrac()) * 100;
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

  return { pct, filling, handedOff, nameRef, getSpawnRect, onHandoff };
}
