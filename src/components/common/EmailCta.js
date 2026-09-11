import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * The address, copied rather than handed to an email client.
 *
 * A `mailto:` is a guess about the reader — that they have a desktop client
 * configured, that they want a blank compose window open right now, that this
 * is the moment they write. Most of the time it is a wrong guess, and the cost
 * of being wrong is an application launching over the page. Copying the address
 * makes no guess at all: it puts the one thing they came for on the clipboard
 * and says so.
 *
 * Saying so is the whole design. A copy that gives no feedback is
 * indistinguishable from a dead control, so the label itself is the receipt —
 * it leaves through the top and the confirmation arrives from below, the same
 * direction the numbers on this site turn.
 *
 * The box is measured and its width animated between the two labels. Left to
 * grow on its own it would snap wider under the press and shove whatever sits
 * beside it; pinned at the wider of the two it would leave the rule under
 * "Email" running off into nothing. Neither is worth the saving.
 */

const EMAIL = 'kevinrufino97@gmail.com';

/** How long the confirmation stands before the label comes back. */
const CONFIRM_MS = 2400;

/* Two sheets, one behind the other, drawn as 1px runs on a 16 grid so it stays
   crisp beside the pixel type rather than resolving into a smooth icon from
   somebody else's set. The back sheet is only the edges that clear the front
   one, so neither needs to be filled — nothing here knows what colour the
   ground behind it is. */
const CopyGlyph = () => (
  <svg
    viewBox='0 0 16 16'
    className='copy-cta__icon'
    shapeRendering='crispEdges'
    fill='currentColor'
    aria-hidden='true'
    focusable='false'
  >
    <path d='M4 2h10v1H4z M4 3h1v2H4z M13 3h1v8h-1z M12 11h2v1h-2z' />
    <path d='M2 5h10v1H2z M2 14h10v1H2z M2 6h1v8H2z M11 6h1v8h-1z' />
  </svg>
);

/**
 * Put text on the clipboard.
 *
 * The async API is not available on an insecure origin and not in every
 * browser, so there is a fallback — and when neither works the caller is told,
 * because a control that silently does nothing is worse than one that hands the
 * reader back to their mail client.
 */
const copyText = async text => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older path */
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  } catch {
    return false;
  }
};

const EmailCta = ({
  label = 'Email',
  copiedLabel = 'Email copied',
  className = '',
  style,
  arrow = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [widths, setWidths] = useState(null);
  const idleRef = useRef(null);
  const doneRef = useRef(null);
  const timer = useRef(0);

  // Both states are laid out at `max-content` in the same grid cell, so each
  // measures its own natural width whatever the box around it is currently set
  // to — which is what makes it safe to drive that box from these numbers.
  useEffect(() => {
    const measure = () => {
      const idle = idleRef.current?.offsetWidth;
      const done = doneRef.current?.offsetWidth;
      if (idle && done) setWidths({ idle, done });
    };
    measure();
    // The type is a webfont and these are display sizes: measuring before it
    // lands sizes the box to the fallback face.
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = useCallback(async () => {
    const ok = await copyText(EMAIL);
    clearTimeout(timer.current);
    if (!ok) {
      // No clipboard — an insecure origin, a browser that refuses, a document
      // that has lost focus. Falling back to `mailto:` would launch the client
      // this control exists to not launch, so it shows the address instead and
      // leaves it there to be read or selected. The reader came for one string;
      // failing to copy it is not a reason to withhold it.
      setFailed(true);
      return;
    }
    setFailed(false);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
  }, []);

  // The address stands in for both labels once copying has failed, and it is
  // wider than either, so the box measured for them is not the box it needs.
  const width =
    widths && !failed ? `${copied ? widths.done : widths.idle}px` : undefined;

  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={`Copy email address, ${EMAIL}`}
      className={`line-cta copy-cta ${copied ? 'is-copied' : ''} ${className}`.trim()}
      style={style}
    >
      <span className='copy-cta__states' style={{ width }}>
        <span className='copy-cta__state copy-cta__state--idle' ref={idleRef}>
          {failed ? <span className='copy-cta__address'>{EMAIL}</span> : label}
          {arrow && !failed && (
            <span aria-hidden='true' className='line-cta__arrow--diagonal'>
              ↗
            </span>
          )}
        </span>
        <span className='copy-cta__state copy-cta__state--done' ref={doneRef}>
          {copiedLabel}
          <CopyGlyph />
        </span>
      </span>
      {/* Announced rather than only shown: the label swapping under the
          pointer is the confirmation for anyone watching it, and this is the
          same sentence for anyone who is not. */}
      <span role='status' aria-live='polite' className='sr-only'>
        {copied ? `${copiedLabel}, ${EMAIL}` : ''}
        {failed ? `Could not copy. The address is ${EMAIL}` : ''}
      </span>
    </button>
  );
};

EmailCta.propTypes = {
  label: PropTypes.string,
  copiedLabel: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  /** The diagonal mark the links beside this one carry. */
  arrow: PropTypes.bool,
};

export default EmailCta;
export { EMAIL };
