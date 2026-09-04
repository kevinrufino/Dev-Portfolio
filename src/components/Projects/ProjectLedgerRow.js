import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import Reveal from '../Reveal.js';

const ProjectLedgerRow = ({
  project,
  index,
  isHot,
  showMarquee,
  hoverable,
  rowRef,
  onEnter,
  onLeave,
  onFocus,
  onBlur,
}) => {
  const marqueeChunk = Array(8).fill(`${project.display} ✦ `).join('');

  return (
    <Reveal delay={index * 0.04} y={18}>
      <Link
        to={`/projects/${project.slug}`}
        ref={rowRef}
        className={clsx(
          'ledger-row relative block border-b-2 border-ultra focus:outline-none focus-visible:outline-none',
          isHot && 'is-hot',
        )}
        onPointerEnter={hoverable ? onEnter : undefined}
        onPointerLeave={hoverable ? onLeave : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className='ledger-fill absolute inset-0' aria-hidden />

        <div className='relative z-10 grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-3 py-3 md:grid-cols-[4rem_1fr_auto] md:gap-6 md:px-6 md:py-4'>
          <span className='ledger-meta font-offbitDot text-xs tracking-[0.25em] md:text-sm'>
            {project.no}
          </span>

          <h3
            className={clsx(
              'ledger-title font-offbit101Bold text-[10.5vw] uppercase leading-[0.9] md:text-[5vw]',
              showMarquee && 'opacity-0',
            )}
          >
            {project.display}
          </h3>

          <span className='flex flex-col items-end gap-1'>
            <span className='ledger-meta font-offbitDot text-xs tracking-[0.25em] md:text-sm'>
              {project.year}
            </span>
            <span className='ledger-open hidden font-offbitDot text-[10px] tracking-[0.25em] text-acid md:inline'>
              OPEN →
            </span>
          </span>
        </div>

        {showMarquee && (
          <div className='ledger-marquee pointer-events-none absolute inset-0 z-20 flex items-center overflow-hidden'>
            <div className='marquee-track whitespace-nowrap font-offbit101Bold text-[10.5vw] uppercase leading-[0.9] text-acid md:text-[5vw]'>
              <span>{marqueeChunk}</span>
              <span>{marqueeChunk}</span>
            </div>
          </div>
        )}
      </Link>
    </Reveal>
  );
};

const projectShape = PropTypes.shape({
  no: PropTypes.string.isRequired,
  display: PropTypes.string.isRequired,
  year: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
});

ProjectLedgerRow.propTypes = {
  project: projectShape.isRequired,
  index: PropTypes.number.isRequired,
  isHot: PropTypes.bool.isRequired,
  showMarquee: PropTypes.bool.isRequired,
  hoverable: PropTypes.bool.isRequired,
  rowRef: PropTypes.func.isRequired,
  onEnter: PropTypes.func.isRequired,
  onLeave: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  onBlur: PropTypes.func.isRequired,
};

export default ProjectLedgerRow;
