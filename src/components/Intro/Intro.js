import React from 'react';
import useTypewriter from '../../hooks/useTypewriter.js';

const ROLES = [
  'Front-end Developer',
  'Full Stack Developer',
  'Creative Engineer',
];

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
 * Running copy is DM Sans. OffBit is a display face; below about 20px its
 * counters close up and paragraph text stops being comfortable to read.
 */
// eslint-disable-next-line react/prop-types
export const Intro = ({ setCursor }) => {
  const typed = useTypewriter(ROLES);

  return (
    <section
      className='relative sticky top-0 flex min-h-screen w-full items-center bg-paper py-[clamp(96px,14vh,180px)]'
      id='intro'
      onMouseEnter={() => {
        setCursor('');
      }}
    >
      <div className='grid-rule grid-rule--paper' aria-hidden='true' />

      <div className='relative z-[1] mx-auto w-full max-w-[1440px] px-[clamp(24px,7.4vw,110px)]'>
        {/* Capped at 58% so the palm has a clear band to its right. */}
        <div data-palm-clip className='max-w-[min(620px,58%)]'>
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
            <span>{typed}</span>
            <span className='blink' aria-hidden='true'>
              _
            </span>
          </h2>

          <p className='type-body mb-[clamp(30px,4vh,40px)] max-w-[46ch] text-[clamp(16px,1.25vw,18px)] text-paper-muted'>
            I enjoy fusing my love for art and tech to build fun interactive
            experiences. I currently am working at Nike as a Front-end Creative
            Developer. Check out my work below 👇🏾
          </p>

          <a
            href='#projects'
            className='type-body inline-flex items-center gap-[10px] border-b border-[#b8bcb3] py-[6px] text-[15px] font-medium text-ultra'
          >
            See selected work
            <span aria-hidden='true'>↓</span>
          </a>
        </div>
      </div>
    </section>
  );
};
