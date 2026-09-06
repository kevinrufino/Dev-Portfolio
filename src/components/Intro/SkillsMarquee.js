import React from 'react';

/**
 * Horizontally scrolling skills marquee.
 *
 * Uses a CSS animation rather than the deprecated <marquee> element (whose
 * scrolling is being phased out and is disabled under "Reduce Motion" by some
 * engines, notably Safari/WebKit — which is why it stopped moving in those
 * browsers). The track holds two identical segments and translates by -50% for
 * a seamless loop; the duplicate is hidden from assistive tech. By request this
 * one keeps scrolling even under prefers-reduced-motion (see .marquee-skills).
 *
 * Sits on acid: it is the band between the paper intro and the projects index,
 * and giving it the page's own ground makes it read as a rule between the two
 * rather than as a third surface competing with both.
 */
const Segment = ({ ariaHidden = false }) => (
  <div
    className='flex flex-row shrink-0 whitespace-nowrap'
    aria-hidden={ariaHidden || undefined}
  >
    <p className='font-offbit101Bold m-4'>{'skills: '}</p>
    <p className='font-offbit101 m-4'>
      {'html, css, javascript, typescript, react, three.js'}
    </p>
    <p className='font-offbit101Bold m-4'>{'soft skills: '}</p>
    <p className='font-offbit101 m-4'>
      {'nerd 🤓, designer, gamer, music producer, sneaker collector'}
    </p>
  </div>
);

export const SkillsMarquee = () => {
  return (
    <div className='relative z-[2] w-full overflow-hidden border-y-2 border-ultra bg-acid py-3 text-3xl text-ultra'>
      <div className='marquee-skills'>
        <Segment />
        <Segment ariaHidden />
      </div>
    </div>
  );
};
