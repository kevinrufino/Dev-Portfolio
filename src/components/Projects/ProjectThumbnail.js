import PropTypes from 'prop-types';

/**
 * Responsive project media used by the Ledger preview and the lab renditions.
 * The visible project title supplies the accessible name, so the media stays
 * decorative and out of the accessibility tree.
 */
const ProjectThumbnail = ({
  project,
  className,
  autoPlay = true,
  videoRef,
}) => {
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
        aria-hidden='true'
      />
    );
  }

  return (
    <img
      className={className}
      src={project.media}
      alt=''
      draggable={false}
      aria-hidden='true'
    />
  );
};

ProjectThumbnail.propTypes = {
  project: PropTypes.shape({
    media: PropTypes.string.isRequired,
    isVideo: PropTypes.bool.isRequired,
  }).isRequired,
  className: PropTypes.string,
  autoPlay: PropTypes.bool,
  videoRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

export default ProjectThumbnail;
