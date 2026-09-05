import { ProjectsData } from '../../constants.js';

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

const toEntry = project => {
  const meta = OVERRIDES[project.title];
  return {
    title: project.title,
    display: meta.display || project.title,
    // "Nike .Swoosh / Lead Engineer / 2023"
    meta: [project.client, project.role, project.year].filter(Boolean).join(' / '),
    description: meta.summary,
    shape: meta.shape,
    linkHref: firstLink(project),
  };
};

const inCategory = key =>
  ProjectsData.filter(p => OVERRIDES[p.title]?.category === key).map(toEntry);

export const WORKS = {
  work: inCategory('work'),
  personal: inCategory('personal'),
};

export const WORK_CATEGORIES = [
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
];
