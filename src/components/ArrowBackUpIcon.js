import { forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import { motion, useAnimate } from 'framer-motion';

/**
 * Animated arrow-back-up icon from Its Hover.
 * https://www.itshover.com/icons/arrow-back-up-icon
 */
const ArrowBackUpIcon = forwardRef(
  (
    { size = 24, color = 'currentColor', strokeWidth = 2, className = '' },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const startAnimation = async () => {
      await animate(
        '.arrow-group',
        { x: [0, -3, 0] },
        { duration: 0.4, ease: 'easeInOut' },
      );
    };

    const stopAnimation = () => {
      animate('.arrow-group', { x: 0 }, { duration: 0.2, ease: 'easeOut' });
    };

    useImperativeHandle(ref, () => ({
      startAnimation,
      stopAnimation,
    }));

    return (
      <motion.div
        ref={scope}
        aria-hidden='true'
        onHoverStart={startAnimation}
        onHoverEnd={stopAnimation}
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
          <motion.g className='arrow-group'>
            <path stroke='none' d='M0 0h24v24H0z' fill='none' />
            <path d='M9 14l-4 -4l4 -4' />
            <path d='M5 10h11a4 4 0 1 1 0 8h-1' />
          </motion.g>
        </svg>
      </motion.div>
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
