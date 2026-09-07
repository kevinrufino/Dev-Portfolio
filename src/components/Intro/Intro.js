import React from 'react';
import useTypewriter from '../../hooks/useTypewriter.js';
import useCursorFx from '../../hooks/useCursorFx.js';
import { scrollToSection } from '../../utils/navigateToSection.js';

const ROLES = [
  'Front-end Developer',
  'Full Stack Developer',
  'Creative Engineer',
];

// How far out each of the two pulls starts. The role line is a wide target
// and only wants a nudge; the call to action is the one thing on this screen
// the reader is meant to press, so it reaches further.
const ROLE_GRAVITY_PX = 64;
const CTA_GRAVITY_PX = 130;

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
  const roleRef = useCursorFx({
    name: 'intro / role line',
    gravity: ROLE_GRAVITY_PX,
    strength: 0.9,
  });
  const ctaRef = useCursorFx({ name: 'intro / cta', gravity: CTA_GRAVITY_PX });

  return (
    <section
      className='relative sticky top-0 flex min-h-screen w-full items-start bg-paper pb-[clamp(48px,8vh,180px)] pt-[clamp(104px,13vh,180px)] lg:items-center lg:py-[clamp(96px,14vh,180px)]'
      id='intro'
      onMouseEnter={() => {
        setCursor('');
      }}
    >
      <div className='grid-rule grid-rule--paper' aria-hidden='true' />

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
            {/* Inline-block so the gravity field is the width of the words
                rather than the width of the column — a full-width target would
                pull the cursor sideways from halfway across the page. */}
            <span ref={roleRef} className='inline-block'>
              <span>{typed}</span>
              <span className='blink' aria-hidden='true'>
                _
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
