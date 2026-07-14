/**
 * BetaBadge — a small, dismissible "work in progress" notice.
 *
 * Sits in the bottom-right corner (opposite the top-left NavBar) as a
 * brutalist BETA pill in the site's OffBit / acid-on-ultra language. Clicking
 * the pill expands a short note letting visitors know the site is still being
 * built: some information may be wrong and a few bugs are expected.
 *
 * The note auto-opens once on a visitor's first load, then collapses to just
 * the pill on subsequent loads. Dismissing hides it for good. Both bits of
 * state are persisted to localStorage so the notice never nags.
 *
 * @component
 * @param {Object} props
 * @param {(type: string) => void} [props.setCursor] Optional custom-cursor
 *   setter so hovering the badge resets to the default cursor, matching the
 *   rest of the interactive UI.
 * @returns {JSX.Element|null}
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const SEEN_KEY = 'beta-notice-seen';
const DISMISS_KEY = 'beta-notice-dismissed';

const readFlag = key => {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeFlag = key => {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable (private mode / blocked) — fail quietly */
  }
};

const BetaBadge = ({ setCursor }) => {
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISS_KEY));
  // Open by default only until the visitor has seen it once.
  const [open, setOpen] = useState(() => !readFlag(SEEN_KEY));

  // Mark as seen on first mount so the note stays collapsed next time.
  useEffect(() => {
    writeFlag(SEEN_KEY);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    writeFlag(DISMISS_KEY);
  };

  if (dismissed) return null;

  return (
    <div
      className='fixed bottom-3 right-3 md:bottom-4 md:right-4 z-[60] flex flex-col items-end gap-2'
      onMouseEnter={() => setCursor?.('')}
    >
      {open && (
        <div
          role='status'
          className='max-w-[260px] border-2 border-acid bg-ultra text-acid shadow-hard-acid px-3 py-2.5'
        >
          <div className='flex items-start justify-between gap-2'>
            <p className='font-offbit101Bold text-xs tracking-widest uppercase'>
              Work in progress
            </p>
            <button
              type='button'
              aria-label='Dismiss beta notice'
              onClick={handleDismiss}
              className='font-offbit101Bold text-sm leading-none -mt-0.5 hover:text-white'
            >
              ✕
            </button>
          </div>
          <p className='mt-1.5 font-offbit text-[11px] leading-snug'>
            This site is in beta. Some information may be incorrect and you may
            run into a few bugs. Thanks for bearing with me.
          </p>
        </div>
      )}

      <button
        type='button'
        aria-expanded={open}
        aria-label={
          open ? 'Collapse beta notice' : 'This site is in beta — read more'
        }
        onClick={() => setOpen(prev => !prev)}
        className='group flex items-center gap-1.5 border-2 border-acid bg-ultra text-acid shadow-hard-acid px-2.5 py-1 font-offbit101Bold text-xs tracking-widest uppercase transition-transform hover:-translate-y-0.5'
      >
        <span
          aria-hidden='true'
          className='inline-block h-1.5 w-1.5 rounded-full bg-acid'
        />
        Beta
      </button>
    </div>
  );
};

BetaBadge.propTypes = {
  setCursor: PropTypes.func,
};

export default BetaBadge;
