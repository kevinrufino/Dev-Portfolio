import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { GOO_PAD } from '../../hooks/useGooFollower.js';

/**
 * The gooey layer behind a pill group.
 *
 * Renders three things into one SVG-filtered stacking context: a pill under
 * the selected item, a pill under the hovered item, and the pointer-following
 * blob. The filter blurs them together and then re-hardens the alpha, so
 * shapes that come near each other bulge and merge instead of overlapping.
 *
 * The layer is inset by GOO_PAD on every side and every coordinate is offset
 * by the same amount, because the blur needs room outside the group's box or
 * it gets clipped and the merge reads as a hard edge.
 *
 * Nothing here is interactive or readable — it sits behind the real buttons,
 * which keep their own text. Running type through a blur filter would soften
 * it, which is why the text is deliberately not inside this element.
 */
const GooPills = ({
  rects,
  activeIndex,
  hotIndex,
  followerRef,
  activeHeight = 36,
  pillColor,
  hoverColor,
  followerColor,
  sliding = false,
}) => {
  // One id per instance: two goo groups on the same page must not share a
  // filter, or the second one's blur references the first one's source.
  const filterId = useMemo(
    () => `goo-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const active = rects[activeIndex];

  return (
    <>
      <svg
        aria-hidden='true'
        width='0'
        height='0'
        style={{ position: 'absolute' }}
      >
        <defs>
          <filter
            id={filterId}
            x='-25%'
            y='-25%'
            width='150%'
            height='150%'
            colorInterpolationFilters='sRGB'
          >
            <feGaussianBlur in='SourceGraphic' stdDeviation='7' result='b' />
            <feColorMatrix
              in='b'
              type='matrix'
              values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7'
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: -GOO_PAD,
          pointerEvents: 'none',
          filter: `url(#${filterId})`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(active ? active.x : 0) + GOO_PAD}px`,
            top: `${(active ? active.y + (active.h - activeHeight) / 2 : 0) + GOO_PAD}px`,
            width: `${active ? active.w : 0}px`,
            height: `${activeHeight}px`,
            borderRadius: '9px',
            background: pillColor,
            opacity: active ? 1 : 0,
            transformOrigin: '50% 50%',
            // Squashes while travelling, which reads as the pill being pulled
            // rather than teleporting.
            transform: sliding ? 'scaleY(0.86)' : 'scaleY(1)',
            transition:
              'left 520ms cubic-bezier(.5,0,.18,1),width 520ms cubic-bezier(.5,0,.18,1),top 520ms cubic-bezier(.5,0,.18,1),transform 260ms ease,opacity 200ms ease',
          }}
        />

        {rects.map((r, i) => {
          const hover = i !== activeIndex && i === hotIndex;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${r.x + GOO_PAD + 5}px`,
                top: `${r.y + GOO_PAD + 5}px`,
                width: `${Math.max(0, r.w - 10)}px`,
                height: `${Math.max(0, r.h - 10)}px`,
                borderRadius: '6px',
                background: hoverColor,
                transformOrigin: '50% 50%',
                opacity: hover ? 1 : 0,
                transform: hover ? 'scaleY(0.9)' : 'scale(0.66)',
                transition:
                  'opacity 200ms cubic-bezier(.22,.8,.2,1),transform 340ms cubic-bezier(.22,1.02,.28,1)',
              }}
            />
          );
        })}

        <div
          ref={followerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '24px',
            height: '24px',
            borderRadius: '7px',
            background: followerColor,
            transform: 'translate3d(-9999px,-9999px,0)',
            opacity: 0,
            willChange: 'transform,opacity',
          }}
        />
      </div>
    </>
  );
};

GooPills.propTypes = {
  rects: PropTypes.array.isRequired,
  activeIndex: PropTypes.number.isRequired,
  hotIndex: PropTypes.number,
  followerRef: PropTypes.object.isRequired,
  activeHeight: PropTypes.number,
  pillColor: PropTypes.string.isRequired,
  hoverColor: PropTypes.string.isRequired,
  followerColor: PropTypes.string.isRequired,
  sliding: PropTypes.bool,
};

export default GooPills;
