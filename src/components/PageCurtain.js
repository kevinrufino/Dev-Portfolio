import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { liftCurtain, setCurtainCanvas } from '../utils/pageCurtain.js';

/**
 * The one canvas the route curtain is drawn on.
 *
 * Mounted outside the router on purpose. The curtain spans the moment one page
 * unmounts and the next mounts, so it cannot belong to either of them — a
 * canvas inside the route tree goes away in the middle of the handover and the
 * incoming page flashes before its own curtain has painted.
 *
 * It also owns the taking-off. The building half is requested by the page that
 * is leaving, which only pages wrapped in a transition can do; the lift is
 * requested here, on any change of route at all, so a route with no transition
 * of its own can never be left underneath a curtain nobody removes.
 */
const PageCurtain = () => {
  const canvasRef = useRef(null);
  const { pathname } = useLocation();
  // The first render is an arrival, not a handover: the page has its own
  // loading sequence and there is nothing over it to take off.
  const settled = useRef(false);

  useEffect(() => {
    setCurtainCanvas(canvasRef.current);
    return () => setCurtainCanvas(null);
  }, []);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    liftCurtain();
  }, [pathname]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        // Over everything, including the cursor's own layer: while the curtain
        // is up there is nothing underneath worth pointing at.
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: 0,
        imageRendering: 'pixelated',
      }}
    />
  );
};

export default PageCurtain;
