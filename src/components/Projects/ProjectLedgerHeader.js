import PropTypes from 'prop-types';

const ProjectLedgerHeader = ({ count, headingId }) => (
  <div className='flex items-baseline justify-between border-b-2 border-ultra px-3 pb-2 md:px-6'>
    <h2
      id={headingId}
      className='font-offbitDot text-[10px] uppercase tracking-[0.3em] md:text-xs'
    >
      FILE INDEX — {count} ENTRIES
    </h2>
    <p className='text-right font-offbitDot text-[10px] uppercase tracking-[0.18em] opacity-90 md:text-xs md:tracking-[0.3em]'>
      <span className='md:hidden'>KR ✦ 2019–2026</span>
      <span className='hidden md:inline'>KR ARCHIVE ✦ 2019–2026</span>
    </p>
  </div>
);

ProjectLedgerHeader.propTypes = {
  count: PropTypes.string.isRequired,
  headingId: PropTypes.string,
};

export default ProjectLedgerHeader;
