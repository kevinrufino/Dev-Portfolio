import PropTypes from 'prop-types';

/**
 * Pixelated water fill for the loading name.
 *
 * Replaces the flat progress bar: a body of "water" rises with `pct` while two
 * stepped (pixel) wave crests slosh side-to-side on its surface. The whole
 * thing is clipped by the same `loading-mask` (HeroFillName.svg) as before, so
 * the water only shows inside the letterforms.
 */
const ULTRA = '#3e3bf4';

// Wave tile geometry (SVG user units). One tile is 12 columns of 8px steps.
const TILE_W = 96;
const TILE_H = 12;
const COL_W = 8;
const TILES = 40; // enough tiles that the 300%-wide strip never runs out
const WAVE_PX = 14; // on-screen crest height

// Column heights (y of the water surface per column; 0 = tallest peak).
const FRONT = [8, 4, 2, 0, 2, 4, 8, 10, 12, 10, 10, 8];
const BACK = [4, 8, 10, 12, 10, 8, 4, 2, 0, 0, 2, 4];

const stripPath = heights => {
  let d = '';
  for (let t = 0; t < TILES; t++) {
    const ox = t * TILE_W;
    d += `M${ox} ${TILE_H} `;
    heights.forEach((h, i) => {
      d += `L${ox + i * COL_W} ${h} H${ox + (i + 1) * COL_W} `;
    });
    d += `L${ox + TILE_W} ${TILE_H} Z `;
  }
  return d;
};

const WaveStrip = ({ heights, opacity }) => (
  <svg
    viewBox={`0 0 ${TILES * TILE_W} ${TILE_H}`}
    preserveAspectRatio='none'
    shapeRendering='crispEdges'
    className='block w-full h-full'
    style={{ opacity }}
  >
    <path d={stripPath(heights)} fill={ULTRA} />
  </svg>
);

WaveStrip.propTypes = {
  heights: PropTypes.arrayOf(PropTypes.number).isRequired,
  opacity: PropTypes.number.isRequired,
};

const PixelWaterFill = ({ pct }) => {
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className='absolute inset-0 overflow-hidden loading-mask pointer-events-none'>
      {/* Water body — rises with progress. No CSS transition here: the driver
          already eases `pct` every animation frame, and layering a transition
          on top makes Chrome restart it on every per-frame retarget — on some
          versions (observed on 149) the animated height then never accumulates
          and stays pinned at 0, hiding the water entirely. */}
      <div
        className='absolute bottom-0 left-0 w-full'
        style={{ height: `${clamped}%` }}
      >
        {/* Crests ride on the surface (just above the body) */}
        <div
          className='absolute bottom-full left-0 w-[300%] wave-slosh-back'
          style={{ height: WAVE_PX }}
        >
          <WaveStrip heights={BACK} opacity={0.45} />
        </div>
        <div
          className='absolute bottom-full left-0 w-[300%] wave-slosh'
          style={{ height: WAVE_PX }}
        >
          <WaveStrip heights={FRONT} opacity={1} />
        </div>
        <div className='absolute inset-0' style={{ background: ULTRA }} />
      </div>
    </div>
  );
};

PixelWaterFill.propTypes = {
  pct: PropTypes.number.isRequired,
};

export default PixelWaterFill;
