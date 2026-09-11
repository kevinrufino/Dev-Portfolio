import PropTypes from 'prop-types';
import { HeroName } from './Hero/components/HeroName.js';
import RollingNumber from './common/RollingNumber.js';
import PixelWaterFill from './PixelWaterFill.js';
import { HERO_SHRINK_PX } from '../utils/heroRunway.js';

/**
 * Landing header: the loader overlay + the hero-fold region the physics fills.
 *
 * While loading, an opaque full-page overlay (above the nav) blocks all
 * interaction and shows the hero name filling with pixel water. The centered
 * name is measured (via `nameRef`) for the 1:1 handoff, so when it hands off
 * the FillPhysicsCanvas draws its bodies at the same viewport rect and the
 * swap is seamless. After handoff the overlay unmounts and the empty
 * `#home` section is where the physics pile visually sits.
 *
 * Once every name row has landed (`filled`), a pixel scroll cue fades in at
 * the bottom of the hero — scrolling is frozen until then, so the cue is the
 * "you can go now" signal. Clicking it triggers the same snap-to-Intro the
 * first wheel/swipe does.
 *
 * Presentational only — timing/state lives in `useLandingSequence`, since the
 * physics canvas that consumes the same state renders elsewhere in the tree.
 */

// 16×16 pixel-art ring with a chunky down arrow, drawn as 1px-tall runs so it
// stays crisp (crispEdges + integer grid) at any render size. The interior is
// backed with an acid disc so the ultra ring/arrow read against both the acid
// background and the ultra name pile.
const PixelScrollCue = () => (
  <svg
    viewBox='0 0 16 16'
    width='56'
    height='56'
    shapeRendering='crispEdges'
    aria-hidden='true'
  >
    <path
      fill='#F1F43B'
      d='M5 1h6v1H5z M3 2h10v1H3z M2 3h12v2H2z M1 5h14v6H1z M2 11h12v2H2z M3 13h10v1H3z M5 14h6v1H5z'
    />
    <path
      fill='#3e3bf4'
      d='M5 0h6v1H5z M3 1h2v1H3z M11 1h2v1h-2z M2 2h1v1H2z M13 2h1v1h-1z M1 3h1v2H1z M14 3h1v2h-1z M0 5h1v6H0z M15 5h1v6h-1z M1 11h1v2H1z M14 11h1v2h-1z M2 13h1v1H2z M13 13h1v1h-1z M3 14h2v1H3z M11 14h2v1h-2z M5 15h6v1H5z M7 4h2v5H7z M5 9h6v1H5z M6 10h4v1H6z M7 11h2v1H7z'
    />
  </svg>
);

export const HeaderSequence = ({
  pct,
  filling,
  handedOff,
  filled,
  onCue,
  nameRef,
  heroRef,
  secondaryColor,
}) => {
  return (
    <>
      {/* True loading gate: full-page, opaque, above the nav — blocks
          interaction until the name hands off to physics. */}
      {!handedOff && (
        <div className='fixed inset-0 z-[999] flex flex-col items-center justify-center p-2 bg-[#F1F43B]'>
          <div className='w-full relative' ref={nameRef}>
            <HeroName
              className='w-full'
              primaryColor='#00000000'
              secondaryColor={secondaryColor}
            />
            <PixelWaterFill pct={pct} />
          </div>
          <div
            className={`text-[#3e3bf4] text-3xl font-bold font-offbit101Bold mb-4 transition-opacity duration-500 ${
              filling ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Loading... <RollingNumber value={pct} suffix='%' />
          </div>
        </div>
      )}

      {/* Hero fold: empty flow region the document-sized physics canvas fills
          behind the page content. Also the nav's scroll anchor.

          A viewport tall PLUS the shrink runway. Scrolling that runway is
          still being in the hero — the pile is pinned to the screen and
          shrinking — so the section has to own that scroll distance. */}
      <section
        id='home'
        ref={heroRef}
        className='relative w-full'
        style={{ height: `calc(100svh + ${HERO_SHRINK_PX}px)` }}
      >
        {/* Stuck to the viewport for the length of the runway, so the cue
            stays where the reader is rather than sliding up out of view
            while the names shrink.

            Above the physics canvas, which is fixed at z-index 1 in this same
            stacking context. Without that the cue was painted UNDER the pile
            it sits on top of — buried by the names exactly as they finished
            landing, which is the moment it appears. The layer is transparent
            and only the button in it paints, so nothing else is lifted with
            it; the cue's own acid disc is what makes it read against the
            ultra names underneath. */}
        <div className='sticky top-0 z-[2] h-[100svh]'>
          <button
            type='button'
            aria-label='Scroll to content'
            onClick={onCue}
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-700 ${
              filled ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <span className='block cue-bob'>
              <PixelScrollCue />
            </span>
          </button>
        </div>
      </section>
    </>
  );
};

HeaderSequence.propTypes = {
  pct: PropTypes.number.isRequired,
  filling: PropTypes.bool.isRequired,
  handedOff: PropTypes.bool.isRequired,
  filled: PropTypes.bool.isRequired,
  onCue: PropTypes.func.isRequired,
  nameRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]).isRequired,
  heroRef: PropTypes.shape({ current: PropTypes.any }),
  secondaryColor: PropTypes.string.isRequired,
};

export default HeaderSequence;
