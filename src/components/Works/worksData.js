import { ProjectsData } from '../../constants.js';
import {
  LIVE_ONLY_TITLES,
  PROJECT_STORIES,
  RETIRED_TITLES,
} from '../Project/projectStories.js';
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
 *
 * The ORDER of each list is the studio's to set; see `asPublished`. Without a
 * published order the lists fall back to archive order, which is what they
 * were before there was anywhere else to say it.
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
  .filter(([title, data]) => data.index && !RETIRED_TITLES.has(title))
  .map(([title, data]) => ({
    title,
    archive: data.archive || {},
    index: data.index,
    display: data.display,
  }));

/**
 * A project's archive record, with anything the studio has published over it.
 *
 * The merge is the point. This used to return the `constants.js` record
 * outright whenever it found one, and only fall back to the studio for a
 * project that existed nowhere else — which meant the studio's client, role,
 * year and link fields were editable, exported, applied, and then read by
 * nobody, for every project the site actually ships. Those three fields are
 * the line under a title in the works pane, so the one piece of a project the
 * studio most obviously ought to own was the one it could not change.
 *
 * The studio seeds those fields FROM this record, so a value it did not touch
 * comes back identical and an empty one is a deliberate clearing. Fields it
 * does not manage at all — the link groups, the archive gif — are carried
 * through from the code record untouched.
 */
export const archiveFor = title => {
  const found = ProjectsData.find(p => p.title === title);
  const studio = studioEntries.find(e => e.title === title);
  if (!found && !studio) return null;
  return { title, ...found, ...(studio?.archive || {}) };
};

const entryFor = title => {
  if (RETIRED_TITLES.has(title)) return null;
  const project = archiveFor(title);
  if (!project) return null;
  const studio = studioEntries.find(e => e.title === title);
  // The same rule as the stories: what the studio does not say, it does not
  // overwrite. Spreading `display` unconditionally set it to undefined for any
  // entry that only carried an index, which quietly dropped the short name the
  // pane lists a project under.
  const meta = studio
    ? {
        ...OVERRIDES[title],
        ...studio.index,
        ...(studio.display ? { display: studio.display } : {}),
      }
    : OVERRIDES[title];
  if (!meta) return null;
  return {
    title,
    display: meta.display || title,
    meta: [project.client, project.role, project.year].filter(Boolean).join(' / '),
    description: meta.summary,
    shape: meta.shape,
    // A loop the studio published for this project. When it is present the
    // glyph samples it instead of generating a shape — see workGlyph.
    glyphSrc: meta.glyphSrc || '',
    linkHref: firstLink(project),
    // A project published without a page. The row is unchanged — it is the
    // same work either way — but the way in is the live site rather than a
    // case study, and `hasStory` already carries that everywhere it matters.
    liveOnly: LIVE_ONLY_TITLES.has(title),
    hasStory: Boolean(PROJECT_STORIES[title]),
    // A project that is listed but not ready to be opened. The row keeps its
    // title, line and summary — it is real work, and saying so is the point —
    // but the way in is replaced by a note rather than pointed at a page that
    // cannot yet stand behind what it claims.
    comingSoon: Boolean(meta.comingSoon),
  };
};

// The order `/studio` published, per list. Titles only: reordering should not
// mean rewriting a record for every project you did not otherwise touch, and a
// single list of names is the one thing in this file that reads as a diff.
const STUDIO_ORDER = STUDIO.order || {};

/**
 * Put a list in the order the studio published it.
 *
 * Anything the published order does not name keeps its archive position and
 * follows the ones it does. That is what makes the two sources safe to hold at
 * once: a project added to `constants.js` later appends to the end of its list
 * rather than vanishing from it, and the published order never has to be
 * exhaustive to be useful.
 *
 * `sort` is stable, which is the whole reason the unnamed ones can be given a
 * single rank and still come out in the order they arrived.
 */
const asPublished = (key, titles) => {
  const published = STUDIO_ORDER[key];
  if (!Array.isArray(published) || published.length === 0) return titles;
  const rank = title => {
    const at = published.indexOf(title);
    return at === -1 ? Infinity : at;
  };
  return [...titles].sort((a, b) => rank(a) - rank(b));
};

const inCategory = key => {
  const seeded = ProjectsData.map(p => p.title).filter(
    t =>
      !RETIRED_TITLES.has(t) &&
      (studioEntries.find(e => e.title === t)?.index || OVERRIDES[t])?.category ===
        key,
  );
  const added = studioEntries
    .map(e => e.title)
    .filter(t => !seeded.includes(t) && STUDIO_PROJECTS[t].index.category === key);
  return asPublished(key, [...seeded, ...added]).map(entryFor).filter(Boolean);
};

export const WORKS = {
  work: inCategory('work'),
  personal: inCategory('personal'),
};

export const WORK_CATEGORIES = [
  { key: 'work', label: 'Work' },
  { key: 'personal', label: 'Personal' },
];
