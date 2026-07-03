import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProjectsData } from '../../constants.js';
import { toSlug } from '../../utils/helpers.js';
import Reveal from '../Reveal.js';
import { ProjectPortalCanvas } from './ProjectPortalCanvas.js';

const getTitleScale = distance => {
  if (distance === 0) return 1.62;
  if (distance === 1) return 0.82;
  if (distance === 2) return 0.62;
  return 0.36;
};

const getIndexAnchor = (index, total) => {
  const centerIndex = (total - 1) / 2;
  const offset = index - centerIndex;
  if (offset === 0) return 0;

  return offset * 4.55;
};

const getPackedDistance = distance => {
  if (distance === 0) return 0;

  const gaps = [0, 4.9, 2.25, 1.72, 1.48, 1.32, 1.2, 1.1, 1.02, 0.96];
  let packed = 0;

  for (let i = 1; i <= distance; i += 1) {
    packed += gaps[Math.min(i, gaps.length - 1)];
  }

  return packed;
};

const formatResponsiveOffset = value => {
  const narrow = value * 0.76;

  if (value < 0) {
    return `clamp(${value.toFixed(2)}rem, ${value.toFixed(2)}vw, ${narrow.toFixed(2)}rem)`;
  }

  return `clamp(${narrow.toFixed(2)}rem, ${value.toFixed(2)}vw, ${value.toFixed(2)}rem)`;
};

const getTitleOffset = (index, selectedIndex, selectedTitle, total) => {
  const distanceFromSelected = index - selectedIndex;
  if (distanceFromSelected === 0) {
    return formatResponsiveOffset(getIndexAnchor(index, total));
  }

  const directionFromSelected = Math.sign(distanceFromSelected);
  const selectedAnchor = getIndexAnchor(selectedIndex, total);
  const packedDistance = getPackedDistance(Math.abs(distanceFromSelected));
  let clearance = 0;
  if (directionFromSelected !== 0) {
    if (selectedTitle.length > 36) clearance = 2.6;
    else if (selectedTitle.length > 28) clearance = 1.2;
    else if (selectedTitle.length > 22) clearance = 0.85;
  }
  const preferred = selectedAnchor + directionFromSelected * (packedDistance + clearance);

  return formatResponsiveOffset(preferred);
};

export const Projects = ({ setCursor }) => {
  const [selectedIndex, setSelectedIndex] = useState(2);
  const selectedProject = ProjectsData[selectedIndex];

  const selectedMeta = useMemo(
    () => [
      selectedProject.client,
      selectedProject.type,
      selectedProject.year,
    ].filter(Boolean),
    [selectedProject],
  );

  return (
    <section
      className="w-full min-h-screen px-4 py-16 md:px-8 md:py-24"
      id="projects"
    >
      <Reveal className="mx-auto grid w-full max-w-[1800px] min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
        <div className="relative flex min-h-[38vh] min-w-0 items-center justify-center md:min-h-[52vh] lg:min-h-[68vh]">
          <ProjectPortalCanvas project={selectedProject} />
          {selectedProject.assets?.[0] && (
            <img
              className="absolute right-[8%] top-1/2 hidden w-20 -translate-y-1/2 drop-shadow-[8px_8px_0_var(--ultra)] md:block lg:w-32"
              src={selectedProject.assets[0]}
              alt=""
              loading="lazy"
            />
          )}
        </div>

        <div
          className="flex min-w-0 flex-col items-stretch text-right"
          onMouseLeave={() => setCursor('')}
        >
          <p className="mb-4 font-offbitDot text-xs uppercase tracking-[0.28em] text-ultra/80 md:text-sm">
            Selected project
          </p>

          <nav aria-label="Projects">
            <ul className="project-title-list">
              {ProjectsData.map((project, index) => {
                const distance = Math.abs(index - selectedIndex);
                const selected = index === selectedIndex;
                const scale = getTitleScale(distance);

                return (
                  <li
                    className="project-title-item"
                    key={project.title}
                    style={{
                      '--project-y': getTitleOffset(
                        index,
                        selectedIndex,
                        selectedProject.title,
                        ProjectsData.length,
                      ),
                      zIndex: ProjectsData.length - distance,
                    }}
                  >
                    <Link
                      aria-current={selected ? 'page' : undefined}
                      className={[
                        'project-title-link',
                        'focus:outline-none focus-visible:bg-ultra focus-visible:text-acid',
                        selected
                          ? 'project-title-selected'
                          : 'opacity-75 hover:opacity-100',
                      ].join(' ')}
                      onFocus={() => setSelectedIndex(index)}
                      onMouseMove={() => {
                        setSelectedIndex(index);
                        setCursor(project.title);
                      }}
                      style={{
                        '--project-scale': scale,
                        '--project-fit-width':
                          scale > 1 ? `${100 / scale}%` : '100%',
                        opacity: selected ? 1 : Math.max(0.5, 1 - distance * 0.11),
                      }}
                      to={`/projects/${toSlug(project.title)}`}
                    >
                      {project.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 ml-auto max-w-[680px] text-right">
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              {selectedMeta.map(item => (
                <span
                  className="border-2 border-ultra px-2 pt-1 font-offbit101 text-base leading-none md:text-lg"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="min-h-[9.5rem] font-offbit text-lg leading-relaxed line-clamp-5 md:min-h-[10.5rem] md:text-xl">
              {selectedProject.description}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
};
