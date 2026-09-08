import { useRef } from 'react';
import PropTypes from 'prop-types';
import useCursorFx from '../../hooks/useCursorFx.js';
import { useLightbox, isVideoSrc } from './MediaLightbox.js';

/**
 * A figure in a case study.
 *
 * The design leaves every asset as a captioned drop target, because the case
 * studies are written before their captures exist. That is preserved here
 * rather than papered over: a slot with no `src` renders a labelled frame that
 * reads as deliberately empty — a dashed rule and the caption — instead of a
 * broken image or a grey rectangle that looks like a loading bug.
 *
 * Where a project does have real media in the archive (the optimized mp4
 * scrapes), pass it as `src` and the frame fills. A filled frame is also
 * `zoomable` by default: it opens into the page's inspector, because a capture
 * cropped into a column is proof the thing existed and a capture at screen
 * width is proof of how it behaved. An empty slot is not — there is nothing
 * behind it to inspect.
 */
const AssetSlot = ({
  src,
  caption,
  ratio = '3 / 2',
  className = '',
  zoomable = true,
  markCorner = 'br',
}) => {
  const isVideo = isVideoSrc(src);
  const mediaRef = useRef(null);
  const lightbox = useLightbox();
  // Outside a provider — a preview route, a test — the frame is simply not
  // zoomable rather than a button that does nothing when pressed.
  const canZoom = Boolean(src) && zoomable && Boolean(lightbox);
  // The page hides the native cursor on fine pointers, so `cursor: zoom-in`
  // would say nothing to most readers. The site's own chip says it instead —
  // the same annotation the rest of the page uses for a thing worth pressing.
  // It goes quiet while the inspector is up: the registry hit-tests boxes, not
  // paint order, so an unguarded field keeps offering to open a figure that is
  // already open and covering it.
  const zoomFx = useCursorFx({
    label: 'Inspect',
    icon: 'eye',
    name: 'project / figure',
    enabled: canZoom && !lightbox?.isOpen,
  });

  const media = isVideo ? (
    <video
      ref={mediaRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload='metadata'
      aria-label={caption}
      className='h-full w-full object-cover'
    />
  ) : (
    <img
      ref={mediaRef}
      src={src}
      alt={caption}
      className='h-full w-full object-cover'
    />
  );

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#2a2a2e] ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        canZoom ? (
          <button
            type='button'
            ref={zoomFx}
            onClick={() => lightbox.open(mediaRef.current, { src, caption })}
            aria-label={`Open ${caption} full screen`}
            className='media-zoom absolute inset-0 h-full w-full'
          >
            {media}
            <span
              className={`media-zoom__mark media-zoom__mark--${markCorner} type-label`}
              aria-hidden='true'
            >
              <span>Inspect</span>
              <span>⤢</span>
            </span>
          </button>
        ) : (
          media
        )
      ) : (
        <div className='absolute inset-[10px] flex items-end border border-dashed border-[#4a4a45] p-[14px]'>
          <p className='type-label m-0 text-[#6e6f69]'>{caption}</p>
        </div>
      )}
    </div>
  );
};

AssetSlot.propTypes = {
  src: PropTypes.string,
  caption: PropTypes.string.isRequired,
  ratio: PropTypes.string,
  className: PropTypes.string,
  zoomable: PropTypes.bool,
  /** Which corner the hover mark sits in — 'br' by default, 'tr' where the
      frame's bottom edge is already carrying the page's own furniture. */
  markCorner: PropTypes.oneOf(['br', 'tr']),
};

export default AssetSlot;
