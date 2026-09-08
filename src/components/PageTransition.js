import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { usePresence } from 'framer-motion';
import { buildCurtain } from '../utils/pageCurtain.js';

/**
 * Holds a route on screen until the curtain has covered it.
 *
 * The blind sweep is drawn on a canvas that lives outside the router — see
 * PageCurtain — so there is nothing here to animate and nothing for
 * AnimatePresence to time itself against. `usePresence` is the way out: this
 * declares itself still present after the route has changed, runs the sweep,
 * and only then says it is safe to remove. Inside an `AnimatePresence
 * mode="wait"` that is exactly the handover the transition wants — cover, swap
 * underneath, uncover — with the swap happening on the frame the page is
 * completely hidden.
 *
 * The other half is deliberately not here. Taking the curtain off belongs to
 * whatever the reader arrives at, and some of what they can arrive at is not
 * wrapped in this.
 *
 * Must be rendered as a route element inside an AnimatePresence, or the exit
 * phase never runs and pages simply cut.
 */
const PageTransition = ({ children }) => {
  const [isPresent, safeToRemove] = usePresence();
  // Read through a ref: framer hands over a fresh callback on every render,
  // and re-running the sweep because of an unrelated re-render would restart
  // it halfway up.
  const release = useRef(safeToRemove);
  release.current = safeToRemove;

  useEffect(() => {
    if (isPresent) return undefined;
    let live = true;
    buildCurtain().then(() => {
      if (live) release.current?.();
    });
    return () => {
      live = false;
    };
  }, [isPresent]);

  return children;
};

PageTransition.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PageTransition;
