import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

/**
 * The full-screen inspector a case study's media opens into.
 *
 * A project page is a column of captioned figures, and the figures are the
 * argument — a navigation prototype, a shader study, a launch capture. At
 * column width they are evidence that something existed; at screen width they
 * are evidence of how it behaved. So any figure with real media behind it is
 * clickable, and clicking lifts it over the page.
 *
 * The lift is a FLIP: the overlay lays the media out where it belongs, measures
 * that, and then plays the figure from the thumbnail's own rect up to it. The
 * reader never loses the thing they clicked, which is the whole difference
 * between an inspector and a dialog that happens to contain a video.
 *
 * Two details that only matter for video, and matter a lot:
 *  - the enlarged copy starts at the thumbnail's `currentTime` and the
 *    thumbnail is handed the enlarged copy's time back on close, so a loop the
 *    reader was mid-way through never restarts under them;
 *  - the thumbnail is paused while it is covered, because decoding two copies
 *    of the same 720p loop to show one of them is the cheapest jank on offer.
 */

const LightboxContext = createContext(null);

// Long enough to read as a lift rather than a cut, short enough that a reader
// opening five figures in a row never waits on it.
const FLIP_MS = 420;
const FLIP_EASE = 'cubic-bezier(.22,1,.36,1)';
// The backdrop leads on the way in and trails on the way out, so the figure is
// always the thing being watched.
const VEIL_MS = 260;

const isVideoSrc = src => typeof src === 'string' && /\.(mp4|webm)$/i.test(src);

/**
 * Run `fn` on the frame after this one — or, failing that, very soon.
 *
 * The inverted transform has to be painted once before the transition to it is
 * removed, which is what the animation frame is for. But a hidden or throttled
 * page never serves that frame, and a figure left holding its inverse is a
 * figure the reader cannot see: the timer is what guarantees the release
 * happens whether or not anything is being painted.
 */
const release = (el, fn) => {
  // The starting style has to be COMMITTED before the transition is attached,
  // or the browser resolves both writes in one style pass and jumps straight
  // to the end. Reading a layout property forces that commit; the frames after
  // it are what give the compositor something to interpolate from.
  void el.offsetWidth;
  let spent = false;
  const once = () => {
    if (spent) return;
    spent = true;
    fn();
  };
  requestAnimationFrame(() => requestAnimationFrame(once));
  window.setTimeout(once, 64);
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Everything the overlay needs about the figure that was clicked, read at the
 * moment of the click. The rect is the animation's start; the intrinsic ratio
 * is what the enlarged copy is laid out against, because a thumbnail is
 * `object-cover` and its box says nothing about the shape of the media in it.
 */
const shotFrom = (el, { src, caption }) => {
  const rect = el.getBoundingClientRect();
  const video = el.tagName === 'VIDEO';
  const w = video ? el.videoWidth : el.naturalWidth;
  const h = video ? el.videoHeight : el.naturalHeight;
  return {
    src,
    caption,
    el,
    // What to hand focus back to. Normally that is whatever had it — a
    // keyboard reader's own place in the page — but a pointer press does not
    // always leave focus anywhere, and returning it to the body would drop a
    // reader at the top of the document. The figure's own control is the
    // honest fallback.
    opener:
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : el.closest?.('button') || null,
    rect,
    isVideo: video,
    // Falls back to the thumbnail's own shape while the metadata is still in
    // flight — the overlay re-lays-out once the real ratio arrives.
    ratio: w && h ? w / h : rect.width / rect.height,
    time: video ? el.currentTime : 0,
  };
};

const Lightbox = ({ shot, onClose }) => {
  const boxRef = useRef(null);
  const veilRef = useRef(null);
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const [ratio, setRatio] = useState(shot.ratio);
  const closingRef = useRef(false);

  // The reverse FLIP. Kept in a ref-driven callback rather than in state so
  // that Escape, the backdrop, the button and an unmount all run one path.
  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    // The handoff happens as the return STARTS, not when it lands: the
    // thumbnail is already running by the time the figure settles onto it, so
    // the swap is between two copies of the same moving frame rather than
    // between a moving one and a still one.
    const origin = shot.el;
    if (origin?.tagName === 'VIDEO') {
      const video = videoRef.current;
      if (video) {
        try {
          origin.currentTime = video.currentTime;
        } catch {
          // A stream that will not seek still resumes; it just resumes from
          // wherever it was left, which is the old behaviour, not a break.
        }
      }
      const resumed = origin.play();
      if (resumed?.catch) resumed.catch(() => {});
    }

    const box = boxRef.current;
    const veil = veilRef.current;
    if (veil) veil.style.opacity = '0';

    const finish = () => onClose();

    if (!box || prefersReducedMotion()) {
      window.setTimeout(finish, prefersReducedMotion() ? 0 : VEIL_MS);
      return;
    }

    // Where the thumbnail is now. Scrolling is locked while the overlay is up,
    // so this is the same rect it was opened from — but it is measured again
    // rather than reused, because a resize behind the overlay would have moved
    // it and landing in the wrong place is worse than not animating at all.
    const from = shot.el?.getBoundingClientRect?.() || shot.rect;
    const to = box.getBoundingClientRect();
    const scale = from.width / to.width || 1;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    box.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}, opacity ${FLIP_MS}ms linear`;
    box.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    // The figure fades as it lands so the swap back to the thumbnail — cropped
    // differently, still mid-loop — happens under cover.
    box.style.opacity = '0';
    window.setTimeout(finish, FLIP_MS);
  }, [onClose, shot.el, shot.rect]);

  // The lift itself, before paint: place the figure on the thumbnail, then let
  // it go on the next frame.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const veil = veilRef.current;
    if (!box) return undefined;

    if (veil) {
      veil.style.opacity = '0';
      release(veil, () => {
        veil.style.transition = `opacity ${VEIL_MS}ms linear`;
        veil.style.opacity = '1';
      });
    }

    if (prefersReducedMotion()) {
      box.style.opacity = '1';
      return undefined;
    }

    const from = shot.rect;
    // Measure the figure WITHOUT any inverse it is already holding. A second
    // run of this effect — React's development double-invoke is the one that
    // happens every time — would otherwise measure the transformed box, find
    // it already the size of the thumbnail, and compute a lift of exactly
    // nothing.
    box.style.transition = 'none';
    box.style.transform = 'none';
    const to = box.getBoundingClientRect();
    const scale = from.width / to.width || 1;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    box.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;

    release(box, () => {
      box.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASE}`;
      box.style.transform = 'translate(0,0) scale(1)';
    });
    return undefined;
    // Once per opened figure. `shot.rect` is read at the click and never
    // reassigned, so this depends on it honestly and still runs a single time
    // — re-running it would restart the lift under a reader who is already
    // looking at the enlarged copy.
  }, [shot.rect]);

  // The enlarged copy picks the loop up where the thumbnail left it. Playback
  // on the OTHER side of the handoff — pausing the thumbnail and starting it
  // again — is driven from the click and from `dismiss` rather than from this
  // lifecycle, because an effect that pauses on mount and plays on cleanup
  // ends up interrupting its own play() the moment anything mounts it twice.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shot.isVideo) return;
    // React writes `muted` as a property and not as an attribute, which lands
    // after the element has already asked to autoplay — so the browser judges
    // an unmuted video against its autoplay policy and refuses it, and the
    // inspector opens on a still frame. Setting `defaultMuted` writes the
    // attribute, which is what that check actually reads.
    video.defaultMuted = true;
    video.muted = true;
    try {
      video.currentTime = shot.time;
    } catch {
      // A stream that will not seek yet still plays from the top: a worse
      // handoff than a seamless one, not a broken inspector.
    }
    const played = video.play();
    if (played?.catch) played.catch(() => {});
  }, [shot.isVideo, shot.time]);

  // Escape closes, Tab stays inside. The trap is deliberately small — there is
  // one button and, for video, the native controls — but without it the next
  // Tab lands on the page underneath, which is scroll-locked and unreachable.
  useEffect(() => {
    // The dialog itself takes focus rather than the close button: a screen
    // reader still announces the dialog and its label, Tab still lands on the
    // control, but the page does not open with its one button lit up as though
    // the reader had already reached for it.
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], video[controls], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (shot.opener?.focus) shot.opener.focus({ preventScroll: true });
    };
  }, [dismiss, shot.opener]);

  // The page under the overlay holds still. The scrollbar's width is given
  // back as padding so the layout does not jump sideways as it locks.
  useEffect(() => {
    const { body } = document;
    const raw = window.innerWidth - document.documentElement.clientWidth;
    // A scrollbar, not a measurement gone wrong: an environment that reports
    // no client width at all would otherwise pad the body by a whole viewport.
    const gap = raw > 0 && raw < 40 ? raw : 0;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, []);

  const label = shot.caption || 'Enlarged media';

  return createPortal(
    <div
      className='media-lightbox'
      role='dialog'
      aria-modal='true'
      aria-label={label}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div
        ref={veilRef}
        className='media-lightbox__veil'
        aria-hidden='true'
        onClick={dismiss}
      />

      <div className='media-lightbox__stage' onClick={dismiss}>
        <figure
          ref={boxRef}
          className='media-lightbox__figure'
          style={{ '--media-ratio': ratio }}
          onClick={e => e.stopPropagation()}
        >
          {shot.isVideo ? (
            <video
              ref={videoRef}
              src={shot.src}
              controls
              loop
              muted
              playsInline
              autoPlay
              aria-label={label}
              className='media-lightbox__media'
              onLoadedMetadata={e => {
                const { videoWidth: w, videoHeight: h } = e.currentTarget;
                if (w && h) setRatio(w / h);
              }}
            />
          ) : (
            <img
              src={shot.src}
              alt={label}
              className='media-lightbox__media'
              onLoad={e => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setRatio(w / h);
              }}
            />
          )}
          <figcaption className='media-lightbox__caption type-body'>
            {label}
          </figcaption>
        </figure>
      </div>

      <button
        type='button'
        onClick={dismiss}
        className='media-lightbox__close type-label'
      >
        Close <span aria-hidden='true'>✕</span>
      </button>
      <p className='media-lightbox__hint type-label' aria-hidden='true'>
        Esc to close
      </p>
    </div>,
    document.body,
  );
};

Lightbox.propTypes = {
  shot: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

/**
 * One inspector per page, opened from anywhere under it.
 *
 * The overlay is a page-level thing — it locks the page's scroll and covers the
 * page's chrome — so it is mounted once at the top rather than once per figure,
 * and the figures ask for it through the context.
 */
export const MediaLightboxProvider = ({ children }) => {
  const [shot, setShot] = useState(null);

  const value = useMemo(
    () => ({
      open: (el, media) => {
        if (!el || !media?.src) return;
        const next = shotFrom(el, media);
        // Decoding two copies of the same 720p loop to show one of them is the
        // cheapest jank on offer, so the covered one stops here — at the
        // click, where the intent is unambiguous, rather than in the overlay's
        // lifecycle where a remount would undo it.
        if (el.tagName === 'VIDEO') el.pause();
        setShot(next);
      },
      isOpen: shot !== null,
    }),
    [shot],
  );

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {shot && <Lightbox shot={shot} onClose={() => setShot(null)} />}
    </LightboxContext.Provider>
  );
};

MediaLightboxProvider.propTypes = { children: PropTypes.node };

/**
 * Null outside a provider, so a figure rendered somewhere without one — a
 * preview route, a test — is simply not zoomable instead of throwing.
 */
export const useLightbox = () => useContext(LightboxContext);

export { isVideoSrc };
