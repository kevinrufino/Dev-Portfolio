import PropTypes from 'prop-types';
import { HeroName } from './Hero/components/HeroName.js';
import PixelWaterFill from './PixelWaterFill.js';

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
 * Presentational only — timing/state lives in `useLandingSequence`, since the
 * physics canvas that consumes the same state renders elsewhere in the tree.
 */
export const HeaderSequence = ({
  pct,
  filling,
  handedOff,
  nameRef,
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
            Loading... {Math.round(pct)}%
          </div>
        </div>
      )}

      {/* Hero fold: empty flow region the document-sized physics canvas fills
          behind the page content. Also the nav's scroll anchor. */}
      <section id='home' className='w-full h-screen' />
    </>
  );
};

HeaderSequence.propTypes = {
  pct: PropTypes.number.isRequired,
  filling: PropTypes.bool.isRequired,
  handedOff: PropTypes.bool.isRequired,
  nameRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]).isRequired,
  secondaryColor: PropTypes.string.isRequired,
};

export default HeaderSequence;
