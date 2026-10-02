import { forwardRef, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Animated arrow-back-up icon from Its Hover.
 * https://www.itshover.com/icons/arrow-back-up-icon
 *
 * The nudge is the Web Animations API on the arrow's group — one keyframed
 * translate, which is all framer-motion's `useAnimate` was doing here.
 */

/** The arrow's current horizontal offset, so a stop eases from where it is. */
const currentX = el => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  return new DOMMatrixReadOnly(t).m41;
};
const ArrowBackUpIcon = forwardRef(
  (
    { size = 24, color = 'currentColor', strokeWidth = 2, className = '' },
    ref,
  ) => {
    const groupRef = useRef(null);
    const runningRef = useRef(null);

    const play = (keyframes, options) => {
      const g = groupRef.current;
      if (!g?.animate) return;
      runningRef.current?.cancel();
      runningRef.current = g.animate(keyframes, options);
    };

    const startAnimation = () => {
      play(
        [
          { transform: 'translateX(0px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(0px)' },
        ],
        { duration: 400, easing: 'ease-in-out' },
      );
    };

    const stopAnimation = () => {
      const g = groupRef.current;
      if (!g) return;
      const from = currentX(g);
      play(
        [
          { transform: `translateX(${from}px)` },
          { transform: 'translateX(0px)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
    };

    // Hover, as framer-motion's onHoverStart defined it: a mouse, not a tap.
    const onPointerEnter = e => {
      if (e.pointerType === 'mouse') startAnimation();
    };
    const onPointerLeave = e => {
      if (e.pointerType === 'mouse') stopAnimation();
    };

    useImperativeHandle(ref, () => ({
      startAnimation,
      stopAnimation,
    }));

    return (
      <div
        aria-hidden='true'
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className={`inline-flex cursor-pointer items-center justify-center ${className}`}
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width={size}
          height={size}
          viewBox='0 0 24 24'
          fill='none'
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeLinejoin='round'
          focusable='false'
        >
          <g ref={groupRef} className='arrow-group'>
            <path stroke='none' d='M0 0h24v24H0z' fill='none' />
            <path d='M9 14l-4 -4l4 -4' />
            <path d='M5 10h11a4 4 0 1 1 0 8h-1' />
          </g>
        </svg>
      </div>
    );
  },
);

ArrowBackUpIcon.displayName = 'ArrowBackUpIcon';

ArrowBackUpIcon.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  color: PropTypes.string,
  strokeWidth: PropTypes.number,
  className: PropTypes.string,
};

export default ArrowBackUpIcon;
