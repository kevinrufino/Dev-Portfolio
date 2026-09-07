import { ProjectsData } from '../../constants.js';
import { PROJECT_STORIES } from '../Project/projectStories.js';
import STUDIO from '../../content/projects.json';

/**
 * The projects index, as the works pane groups them.
 *
 * `constants.js` stays the single source of truth for titles, roles, clients,
 * years and links. This module only adds what the pane needs and the archive
 * doesn't carry: which of the two lists a project belongs to, a display title
 * short enough for the pane's type scale, a one-line summary, and which
 * generative form stands in for it in the glyph study.
 *
 * A project absent from OVERRIDES simply doesn't appear in the pane, which is
 * deliberate — the pane is a selected-work edit, not the full archive.
 */
const OVERRIDES = {
  "Max's Lab": {
    category: 'work',
    shape: 'sphere',
    summary:
      'An explorable 3D world built around Air Max, with hidden details and live events.',
  },
  '.Swoosh 404': {
    category: 'work',
    shape: 'rings',
    summary:
      'A Space Invaders-inspired WebGL game supporting a physical product release.',
  },
  'Our Force 1 Poster Content Display Page': {
    category: 'work',
    display: 'Our Force 1',
    shape: 'poster',
    summary:
      'A collection story told through an authorable page, parallax, and animated 3D posters.',
  },
  'EA Sports FC Partner Page': {
    category: 'work',
    display: 'EA Sports FC',
    shape: 'sphere',
    summary:
      'An interactive player viewer and reusable components for the EA Sports FC launch.',
  },
  'TINAJ Collection Listing Page': {
    category: 'work',
    display: 'TINAJ',
    shape: 'rings',
    summary: 'A customizable 3D product viewer for virtual collectibles.',
  },
  'Defenders of Dogewood': {
    category: 'work',
    shape: 'poster',
    summary: 'A browser adventure rebuilt with React and animated 3D assets.',
  },
  Anonymice: {
    category: 'work',
    shape: 'rings',
    summary:
      'A staking experience connecting collectible characters and their in-game economy.',
  },
  Moodie: {
    category: 'personal',
    shape: 'poster',
    summary:
      'An infinite discovery canvas for collecting and exploring visual inspiration.',
  },
  'Minecraft Clone': {
    category: 'personal',
    shape: 'sphere',
    summary:
      'A multiplayer voxel world with procedural terrain and custom physics, built in React.',
  },
  'SNK-Y Bot': {
    category: 'personal',
    shape: 'rings',
    summary:
      'An experiment in release monitoring, browser automation, and restock notifications.',
  },
};

const firstLink = project => {
  if (project.liveLink) return project.liveLink;
  const group = project.links?.[0];
  return group ? Object.values(group)[0] : '#';
};

// What `/studio` published, in the shape this module already speaks: `index`
// says how the pane should list a project, `archive` carries the few facts
// that would otherwise have to be hand-added to constants.js for a project
// that did not exist before.
const STUDIO_PROJECTS = STUDIO.projects || {};

const studioEntries = Object.entries(STUDIO_PROJECTS)
  .filter(([, data]) => data.index)
  .map(([title, data]) => ({
    title,
    archive: data.archive || {},
    index: data.index,
    display: data.display,
  }));

const archiveFor = title => {
  const found = ProjectsData.find(p => p.title === title);
  if (found) return found;
  const studio = studioEntries.find(e => e.title === title);
  return studio ? { title, ...studio.archive } : null;
};

const entryFor = title => {
  const project = archiveFor(title);
  if (!project) return null;
  const studio = studioEntries.find(e => e.title === title);
  const meta = studio
    ? { ...OVERRIDES[title], ...studio.index, display: studio.display }
    : OVERRIDES[title];
  if (!meta) return null;
  return {
    title,
    display: meta.display || title,
    meta: [project.client, project.role, project.year].filter(Boolean).join(' / '),
    description: meta.summary,
    shape: meta.shape,
    linkHref: firstLink(project),
    hasStory: Boolean(PROJECT_STORIES[title]),
  };
};

const inCategory = key => {
  const seeded = ProjectsData.map(p => p.title).filter(
    t => (studioEntries.find(e => e.title === t)?.index || OVERRIDES[t])?.category === key,
  );
  const added = studioEntries
    .map(e => e.title)
    .filter(t => !seeded.includes(t) && STUDIO_PROJECTS[t].index.category === key);
  return [...seeded, ...added].map(entryFor).filter(Boolean);
};

export const WORKS = {
  work: inCategory('work'),
  personal: inCategory('personal'),
};

export const WORK_CATEGORIES = [
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
];
