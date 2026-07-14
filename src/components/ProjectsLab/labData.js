import PropTypes from 'prop-types';
import { ProjectsData } from '../../constants.js';
import { toSlug } from '../../utils/helpers.js';

// Short display names for the giant-type treatments — the full CMS-style
// titles blow out any layout set at poster scale.
const DISPLAY_OVERRIDES = {
  'Our Force 1 Poster Content Display Page': 'Our Force 1 Poster',
  'TINAJ Collection Listing Page': 'TINAJ Collection',
  'EA Sports FC Partner Page': 'EA Sports FC',
};

export const LAB_PROJECTS = ProjectsData.map((p, i) => ({
  no: String(i + 1).padStart(2, '0'),
  title: p.title,
  display: DISPLAY_OVERRIDES[p.title] || p.title,
  year: p.year,
  type: p.type,
  slug: toSlug(p.title),
  media: p.scrapeGif,
  isVideo: /\.(mp4|webm)$/i.test(p.scrapeGif),
}));

/**
 * Thumbnail media for a lab project: <video> for the optimized mp4 scrapes,
 * <img> otherwise. Alt is intentionally empty — every rendition pairs the
 * thumb with the visible title.
 */
export const Thumb = ({ project, className, autoPlay = true, videoRef }) => {
  if (project.isVideo) {
    return (
      <video
        ref={videoRef}
        className={className}
        src={project.media}
        muted
        loop
        playsInline
        autoPlay={autoPlay}
        preload={autoPlay ? 'auto' : 'metadata'}
        draggable={false}
      />
    );
  }
  return (
    <img className={className} src={project.media} alt="" draggable={false} />
  );
};

Thumb.propTypes = {
  project: PropTypes.shape({
    media: PropTypes.string.isRequired,
    isVideo: PropTypes.bool.isRequired,
  }).isRequired,
  className: PropTypes.string,
  autoPlay: PropTypes.bool,
  videoRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};
