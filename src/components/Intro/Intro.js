import React from 'react';
import PixelTrail from '../PixelTrail.js';
import useTypewriter from '../../hooks/useTypewriter.js';
import useCursorFx from '../../hooks/useCursorFx.js';
import { scrollToSection } from '../../utils/navigateToSection.js';

const ROLES = [
  'Front-end Developer',
  'Full Stack Developer',
  'Creative Engineer',
];

// The longest of them, reserved as width. The line types and deletes itself,
// so its box was pulsing between the width of one caret and the width of a
// sentence — and the gravity field on it pulsed with it, which made the field
// feel like it was switching on and off at random.
const LONGEST_ROLE = ROLES.reduce((a, b) => (a.length >= b.length ? a : b));

// How far out each of the two fields starts, per side.
//
// Neither is even. The role line reaches twice as far above and to either
// side as it does below, because below it is the paragraph — a reader on
// their way down there is going somewhere else. And the call to action
// reaches twice as far to its right, into the empty half of the column,
// where there is nothing else to find and a hand arriving from the palm
// side has the furthest to come.
const ROLE_GRAVITY = { top: 128, right: 128, bottom: 64, left: 128 };
const CTA_GRAVITY = { top: 130, right: 260, bottom: 130, left: 130 };

/**
 * Section 01 — the introduction.
 *
 * Sits on the paper ground rather than the acid hero: after a full viewport of
 * saturated yellow the eye needs somewhere to rest, and the pixel grid reads
 * more clearly against a near-white than against acid.
 *
 * The section is sticky, and the copy column is capped well short of the full
 * width. Both are load-bearing rather than decorative — the column's right
 * edge is the boundary the palm scene clips against, so the band to its right
 * is deliberately kept empty.
 *
 * Two things here pull the cursor: the line that keeps retyping itself, and
 * the way out of the section. Both let go the moment the pointer is actually
 * over them, so the pull only ever covers the last few pixels of the journey
 * and never the thing itself.
 *
 * Running copy is DM Sans. OffBit is a display face; below about 20px its
 * counters close up and paragraph text stops being comfortable to read.
 */
// eslint-disable-next-line react/prop-types
export const Intro = ({ setCursor }) => {
  const typed = useTypewriter(ROLES);
  // Full strength, like everything else. The 0.9 it carried was a holdover
  // from when the aim was blended by distance, and all it does now is point
  // the arrow ten percent wide of the thing it is pointing at.
  const roleRef = useCursorFx({
    name: 'intro / role line',
    gravity: ROLE_GRAVITY,
  });
  const ctaRef = useCursorFx({ name: 'intro / cta', gravity: CTA_GRAVITY });

  return (
    <section
      className='relative sticky top-0 flex min-h-screen w-full items-start bg-paper pb-[clamp(48px,8vh,180px)] pt-[clamp(104px,13vh,180px)] lg:items-center lg:py-[clamp(96px,14vh,180px)]'
      id='intro'
      onMouseEnter={() => {
        setCursor('');
      }}
    >
      <div className='grid-rule grid-rule--paper' aria-hidden='true' />

      {/* The intro's own copy of the trail, on the same terms as the footer's.
          The section is sticky, which makes it a stacking context, so a
          negative index here lands between the paper ground and the copy —
          the trail is on the paper rather than over the words. A single
          page-wide surface cannot be in that gap and above the marquee at the
          same time, which is why there is more than one of these. */}
      <PixelTrail
        className='portfolio-pixel-trail--under'
        clipTo='#intro'
        zone='intro'
      />

      <div className='relative z-[1] mx-auto w-full max-w-[1440px] px-[clamp(24px,7.4vw,110px)]'>
        {/* Capped at 58% so the palm has a clear band to its right — but only
            where there is width to spare. On a phone the copy takes the full
            column and hugs the top, and the palm takes the bottom of the
            screen instead of a gutter. */}
        <div data-palm-clip className='max-w-none lg:max-w-[min(620px,58%)]'>
          <p className='type-label mb-[clamp(28px,4vh,44px)] text-paper-muted'>
            01 — Introduction
          </p>

          {/* The hand is kept on the same line as the last word. Left to wrap
              it dropped onto a line of its own and collided with the descenders
              above it, because the display leading is tighter than 1. */}
          <h1 className='mb-[18px] font-offbit101Bold text-[clamp(44px,5.2vw,88px)] leading-[.95] tracking-[-.01em] text-ultra'>
            {'Hey, I’m '}
            <span className='whitespace-nowrap'>
              Kevin
              <span
                role='img'
                aria-label='waving hand'
                className='wave ml-[.18em] inline-block'
              >
                👋🏾
              </span>
            </span>
          </h1>

          <h2 className='mb-[clamp(26px,3.6vh,38px)] min-h-[1.1em] font-offbit101Bold text-[clamp(28px,3.4vw,46px)] leading-[1.05] text-ultra'>
            {/* Inline-block so the field is the width of the words rather than
                the width of the column — a full-width target would aim the
                cursor from halfway across the page — and a fixed width, so it
                is the same words every time rather than however many of them
                happen to be typed. */}
            <span ref={roleRef} className='relative inline-block'>
              <span aria-hidden='true' className='invisible'>
                {LONGEST_ROLE}_
              </span>
              <span className='absolute inset-y-0 left-0 whitespace-nowrap'>
                {typed}
                <span className='blink' aria-hidden='true'>
                  _
                </span>
              </span>
            </span>
          </h2>

          <p className='type-body mb-[clamp(26px,4vh,40px)] max-w-[46ch] text-[clamp(15px,1.25vw,18px)] leading-[1.65] text-paper-muted'>
            I enjoy fusing my love for art and tech to build fun interactive
            experiences. I currently am working at Nike as a Front-end Creative
            Developer. Check out my work below 👇🏾
          </p>

          <button
            ref={ctaRef}
            type='button'
            onClick={() => scrollToSection('work')}
            className='pixel-cta type-body text-[15px] font-medium'
          >
            {/* Four dither layers; see .pixel-cta__dither. */}
            <span className='pixel-cta__dither' aria-hidden='true'>
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>See selected work</span>
            <span aria-hidden='true'>↓</span>
          </button>
        </div>
      </div>
    </section>
  );
};
