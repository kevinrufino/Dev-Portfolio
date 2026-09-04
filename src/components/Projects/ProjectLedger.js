import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { clamp } from '../../utils/helpers.js';
import ProjectLedgerHeader from './ProjectLedgerHeader.js';
import ProjectLedgerPreview from './ProjectLedgerPreview.js';
import ProjectLedgerRow from './ProjectLedgerRow.js';
import { PROJECT_COUNT, PROJECTS } from './projectData.js';
import './project-ledger.css';

const SNAP = 28;
const CHASE = 0.2;
const FOCUS_LINE = 0.42;

/**
 * Typographic projects index selected from the portfolio lab.
 * Pointer devices get a snapped floating preview; touch/no-hover devices use
 * scroll focus with a viewport-docked preview. Both share one hot-row state.
 */
const ProjectLedger = ({ id, className }) => {
  const [hot, setHot] = useState(-1);
  const [hoverable, setHoverable] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const previewRef = useRef(null);
  const rowRefs = useRef([]);
  const target = useRef({ x: 0, y: 0 });
  const position = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('touch')) {
      setHoverable(false);
      return undefined;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    setHoverable(mediaQuery.matches);
    const onChange = event => setHoverable(event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const snapPoint = useCallback(element => {
    const width = element.offsetWidth || 320;
    const height = element.offsetHeight || 240;
    let x = clamp(
      position.current.x + SNAP,
      12,
      window.innerWidth - width - 12,
    );
    let y = clamp(
      position.current.y - height - 24,
      12,
      window.innerHeight - height - 12,
    );
    x = Math.round(x / SNAP) * SNAP;
    y = Math.round(y / SNAP) * SNAP;
    return { x, y };
  }, []);

  useLayoutEffect(() => {
    if (hot < 0 || !hoverable) return;
    const element = previewRef.current;
    if (!element || position.current) return;
    position.current = { ...target.current };
    const point = snapPoint(element);
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
  }, [hot, hoverable, snapPoint]);

  useEffect(() => {
    if (hot < 0 || !hoverable) {
      position.current = null;
      return undefined;
    }

    const element = previewRef.current;
    if (!element) return undefined;
    let frame = 0;
    let written = null;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!position.current) position.current = { ...target.current };
      position.current.x += (target.current.x - position.current.x) * CHASE;
      position.current.y += (target.current.y - position.current.y) * CHASE;
      const point = snapPoint(element);
      if (!written || written.x !== point.x || written.y !== point.y) {
        written = point;
        element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      }
    };
    const onMove = event => {
      target.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [hot, hoverable, snapPoint]);

  useEffect(() => {
    if (hoverable) return undefined;
    let frame = 0;
    const pick = () => {
      frame = 0;
      const focusLine = window.innerHeight * FOCUS_LINE;
      let next = -1;
      rowRefs.current.forEach((element, index) => {
        if (!element) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.top <= focusLine && bounds.bottom > focusLine) next = index;
      });
      setHot(current => (current === next ? current : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [hoverable]);

  const enterRow = (index, event) => {
    if (event?.clientX > 0) {
      target.current = { x: event.clientX, y: event.clientY };
    }
    setHot(index);
  };

  const focusRow = (index, event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    target.current = {
      x: window.innerWidth - 420,
      y: bounds.top + bounds.height / 2,
    };
    setHot(index);
  };

  const hotProject = hot >= 0 ? PROJECTS[hot] : null;

  return (
    <section
      id={id}
      className={clsx(id === 'projects' && 'ledger-home', className)}
      aria-labelledby={id ? `${id}-heading` : undefined}
      aria-label={id ? undefined : 'Projects as a file index'}
    >
      <ProjectLedgerHeader
        count={PROJECT_COUNT}
        headingId={id ? `${id}-heading` : undefined}
      />

      {PROJECTS.map((project, index) => {
        const isHot = hot === index;
        return (
          <ProjectLedgerRow
            key={project.slug}
            project={project}
            index={index}
            isHot={isHot}
            showMarquee={isHot && !prefersReducedMotion}
            hoverable={hoverable}
            rowRef={element => {
              rowRefs.current[index] = element;
            }}
            onEnter={event => enterRow(index, event)}
            onLeave={() => setHot(-1)}
            onFocus={event => focusRow(index, event)}
            onBlur={() => setHot(-1)}
          />
        );
      })}

      <div className='flex items-baseline justify-between px-3 pt-2 md:px-6'>
        <p className='font-offbitDot text-[10px] uppercase tracking-[0.3em] opacity-90 md:text-xs'>
          END OF INDEX — {PROJECT_COUNT}/{PROJECT_COUNT} FILES ACCOUNTED FOR
        </p>
        <p className='font-offbitDot text-[10px] tracking-[0.3em] md:text-xs'>
          :]
        </p>
      </div>

      {hotProject && (
        <ProjectLedgerPreview
          key={`${hoverable ? 'floating' : 'docked'}-${hotProject.slug}`}
          project={hotProject}
          mode={hoverable ? 'floating' : 'docked'}
          previewRef={hoverable ? previewRef : undefined}
        />
      )}
    </section>
  );
};

ProjectLedger.propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
};

export default ProjectLedger;
