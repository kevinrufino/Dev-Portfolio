import PropTypes from 'prop-types';

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
 * scrapes), pass it as `src` and the frame fills.
 */
const AssetSlot = ({ src, caption, ratio = '3 / 2', className = '' }) => {
  const isVideo = typeof src === 'string' && /\.(mp4|webm)$/i.test(src);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#2a2a2e] ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {src ? (
        isVideo ? (
          <video
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
          <img src={src} alt={caption} className='h-full w-full object-cover' />
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
};

export default AssetSlot;
