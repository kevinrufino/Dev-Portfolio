import PropTypes from 'prop-types';
import ProjectThumbnail from './ProjectThumbnail.js';

const ProjectLedgerPreview = ({ project, mode, previewRef }) => {
  const isFloating = mode === 'floating';
  const cardClassName = isFloating
    ? 'ledger-preview border-[3px] border-ultra bg-acid p-1 shadow-hard'
    : 'ledger-dock-card border-[3px] border-ultra bg-acid p-1 shadow-hard-sm';
  const thumbnailClassName = isFloating
    ? 'block h-[190px] w-[300px] border-2 border-ultra object-cover'
    : 'block h-[30vw] max-h-[150px] w-full border-2 border-ultra object-cover';

  const card = (
    <div className={cardClassName}>
      <ProjectThumbnail project={project} className={thumbnailClassName} />
      <div
        className={
          isFloating
            ? 'flex justify-between px-1 pb-0.5 pt-1.5 font-offbitDot text-[10px] tracking-[0.25em]'
            : 'flex justify-between px-0.5 pt-1 font-offbitDot text-[9px] tracking-[0.25em]'
        }
      >
        <span>FILE {project.no}</span>
        <span>{project.year}</span>
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <div
        ref={previewRef}
        className='pointer-events-none fixed left-0 top-0 z-[60] will-change-transform'
      >
        {card}
      </div>
    );
  }

  return (
    <div className='ledger-dock pointer-events-none fixed z-[60]'>{card}</div>
  );
};

ProjectLedgerPreview.propTypes = {
  project: PropTypes.shape({
    no: PropTypes.string.isRequired,
    year: PropTypes.string.isRequired,
    media: PropTypes.string.isRequired,
    isVideo: PropTypes.bool.isRequired,
  }).isRequired,
  mode: PropTypes.oneOf(['floating', 'docked']).isRequired,
  previewRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

export default ProjectLedgerPreview;
