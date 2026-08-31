import LedgerIndex from '../ProjectsLab/LedgerIndex.js';
import '../ProjectsLab/lab.css';

/**
 * Homepage projects showcase.
 *
 * THE LEDGER was selected from the projects lab: an edge-to-edge file index
 * that keeps project discovery quick while preserving the portfolio's pixel
 * archive language.
 */
export const Projects = () => (
  <LedgerIndex
    id="projects"
    className="w-full scroll-mt-6 pt-16 pb-6 md:scroll-mt-8 md:pt-24 md:pb-10"
  />
);
