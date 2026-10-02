import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION_S = 0.55;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll-triggered reveal: rises and fades in the first time it enters the
 * viewport. Renders children in place when the user prefers reduced motion.
 *
 * An IntersectionObserver and a CSS transition — the browser does the
 * animating, so this needs no animation library. The observer disconnects on
 * the first hit, matching the `once` behaviour it had under framer-motion,
 * and the negative margin means "comfortably on screen", not "one pixel in".
 */
const Reveal = ({ children, delay = 0, y = 28, className, style, ...rest }) => {
  const ref = useRef(null);
  // Decided once, on mount: a preference flipped mid-session should not hide
  // something that is already showing.
  const [still] = useState(prefersReducedMotion);
  const [shown, setShown] = useState(still);

  useEffect(() => {
    if (shown) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: '-60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  const motion = still
    ? null
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${y}px)`,
        transition: `opacity ${DURATION_S}s ${EASE} ${delay}s, transform ${DURATION_S}s ${EASE} ${delay}s`,
      };

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...motion, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
};

Reveal.propTypes = {
  children: PropTypes.node.isRequired,
  delay: PropTypes.number,
  y: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default Reveal;
