import React from 'react';
import DodgeText from '../DodgeText.js';

/**
 * Horizontally scrolling skills marquee.
 *
 * Uses a CSS animation rather than the deprecated <marquee> element (whose
 * scrolling is being phased out and is disabled under "Reduce Motion" by some
 * engines, notably Safari/WebKit — which is why it stopped moving in those
 * browsers). The track holds two identical segments and translates by -50% for
 * a seamless loop; the duplicate is hidden from assistive tech. By request this
 * one keeps scrolling even under prefers-reduced-motion (see .marquee-skills).
 */
const Segment = ({ ariaHidden = false }) => (
  <div
    className='flex flex-row shrink-0 whitespace-nowrap'
    aria-hidden={ariaHidden || undefined}
  >
    <DodgeText className='font-offbit101Bold m-4'>{'skills: '}</DodgeText>
    <DodgeText className='font-offbit101 m-4'>
      {'html, css, javascript, typescript, react, three.js'}
    </DodgeText>
    <DodgeText className='font-offbit101Bold m-4'>{'soft skills: '}</DodgeText>
    <DodgeText className='font-offbit101 m-4'>
      {'nerd 🤓, designer, gamer, music producer, sneaker collector'}
    </DodgeText>
  </div>
);

export const SkillsMarquee = () => {
  return (
    <div className='overflow-hidden w-full text-3xl'>
      <div className='marquee-skills'>
        <Segment />
        <Segment ariaHidden />
      </div>
    </div>
  );
};
