import { ProjectsData } from '../constants.js';
import {
  RETIRED_TITLES,
  STORED_STORIES,
} from '../components/Project/projectStories.js';
import { ARCHIVE_TITLES, WORKS, archiveFor } from '../components/Works/worksData.js';
import {
  DEFAULT_PROJECT_NOTICE,
  PROJECT_NOTICE,
} from '../content/siteSettings.js';
import { loadDraft, saveDraft } from './studioStore.js';

/**
 * What a studio draft IS, apart from where it is kept.
 *
 * `studioStore` knows how to persist a draft and how to turn one into a
 * bundle. This module knows what is in it: how a project is seeded from what
 * the site currently publishes, what the export shape of one is, and — the
 * question both editors have to answer on every render — whether a draft
 * record actually differs from what is already live.
 *
 * It is a module of its own because there are two editors now. `/studio` edits
 * the whole list from a rail; a project page in edit mode edits one project in
 * situ. They must agree exactly on the shape of a record, or a page edited in
 * one and exported from the other would publish something neither of them
 * showed.
 */

export const BLOCK_TYPES = [
  {
    type: 'text',
    label: 'Text',
    hint: 'Paragraphs, with an optional pull quote.',
  },
  {
    type: 'assets',
    label: 'Assets',
    hint: 'A 12-column grid of captioned media.',
  },
  {
    type: 'moments',
    label: 'Decisions',
    hint: 'What was chosen against what was passed on.',
  },
  { type: 'impact', label: 'Impact', hint: 'Figures that roll up on reveal.' },
  { type: 'reflection', label: 'Reflection', hint: 'Text, at the end.' },
];

export const RATIOS = ['16 / 10', '4 / 3', '3 / 2', '1 / 1', '9 / 16', 'auto'];

export const SHAPES = ['sphere', 'rings', 'poster'];

// The three that make the line under a title in the works pane, and the link
// the project page's `live` control points at. Labelled rather than keyed:
// they were raw field names, which said nothing about where any of them
// showed up.
export const ARCHIVE_FIELDS = [
  { key: 'client', label: 'Client', hint: 'first' },
  { key: 'role', label: 'Role', hint: 'second' },
  { key: 'year', label: 'Year', hint: 'third' },
  { key: 'liveLink', label: 'Live link', hint: 'the ↗ on the project page' },
];

export const clone = value => JSON.parse(JSON.stringify(value));

export const blankBlock = type => {
  const head = { type, label: '', title: '', note: '', paras: [''], pull: '' };
  if (type === 'assets')
    return { ...head, items: [{ caption: '', span: 6, ratio: '16 / 10' }] };
  if (type === 'moments') {
    return {
      ...head,
      items: [
        {
          kind: 'Decision',
          title: '',
          body: '',
          chose: { k: 'Chose', v: '' },
          passed: { k: 'Passed on', v: '' },
          call: '',
        },
      ],
    };
  }
  if (type === 'impact')
    return { ...head, items: [{ n: 0, suffix: '', k: '', note: '' }] };
  return head;
};

/**
 * Every title the editor knows about. These can be retired but never deleted.
 *
 * Built from what is STORED rather than what is rendered, which is the
 * difference between a list of projects and a list of pages. A project that is
 * both invented in the studio and published without a page — Toolcraft and
 * Warcraft are both — appears in neither `ProjectsData` nor the rendered
 * stories, and so vanished from the studio's own rail entirely. It could not be
 * edited, and the switch that had hidden it could not be switched back.
 */
export const SEED_TITLES = new Set([
  ...ProjectsData.map(p => p.title),
  ...ARCHIVE_TITLES,
  ...Object.keys(STORED_STORIES),
]);

/** A project that does not exist yet. */
export const blankProject = title => ({
  title,
  display: title,
  tagline: '',
  cover: `Cover — ${title}`,
  coverSrc: '',
  meta: [{ k: '', v: '' }],
  blocks: [blankBlock('text')],
  index: {
    category: 'work',
    shape: 'sphere',
    glyphSrc: '',
    summary: '',
    comingSoon: false,
    liveOnly: false,
  },
  archive: { client: '', role: '', year: '', liveLink: '' },
});

/**
 * Everything the site currently renders for one project, as an editable record.
 *
 * The archive half is read through `archiveFor` rather than straight off
 * `ProjectsData`, so a client, role, year or link a previous export published
 * seeds the next one. Reading the raw constants meant those four fields came
 * back with their pre-studio values every time the editor opened — which made
 * an untouched project look permanently edited, and made re-exporting one quietly
 * revert it.
 */
export const seedProject = title => {
  const archive = archiveFor(title) || {};
  // The stored story, not the rendered one: the studio edits the file, and a
  // project published without a page still has a body in it. Reading the
  // rendered map seeded those as blank and would have exported the blank.
  const story = STORED_STORIES[title];
  const row = [...WORKS.work, ...WORKS.personal].find(r => r.title === title);
  return {
    title,
    display: story?.display || row?.display || title,
    tagline: story?.tagline || archive.description || '',
    cover: story?.cover || `Cover — ${title}`,
    coverSrc: story?.coverSrc || '',
    meta: story?.meta?.length ? story.meta : [{ k: '', v: '' }],
    blocks: story?.blocks?.length ? story.blocks : [blankBlock('text')],
    index: {
      category: WORKS.personal.some(r => r.title === title)
        ? 'personal'
        : 'work',
      shape: row?.shape || 'sphere',
      glyphSrc: row?.glyphSrc || '',
      summary: row?.description || '',
      comingSoon: Boolean(row?.comingSoon),
      liveOnly: Boolean(row?.liveOnly),
    },
    archive: {
      client: archive.client || '',
      role: archive.role || '',
      year: archive.year || '',
      liveLink: archive.liveLink || row?.linkHref || '',
    },
  };
};

/** The record for `title`, edited if it has been, seeded if it has not. */
export const recordFor = (drafts, title) =>
  drafts[title] ||
  (SEED_TITLES.has(title) ? seedProject(title) : blankProject(title));

/** What the site is publishing as site-wide settings right now. */
export const seedSite = () => ({
  projectNotice: { enabled: PROJECT_NOTICE.enabled, text: PROJECT_NOTICE.text },
});

export { DEFAULT_PROJECT_NOTICE };

// ── the export shape ────────────────────────────────────────────────────────

/**
 * One project, exactly as it goes into `projects.json`.
 *
 * Used by the export AND by the comparison below, which is the point: the
 * question "has this been edited" can only be answered against the thing that
 * would actually be published, not against the working copy. A trailing empty
 * paragraph the editor keeps so there is something to type into is not a
 * change to the site.
 */
export const normaliseProject = data => {
  const { title: _title, removed, ...rest } = data;
  // A retired project publishes nothing but the fact that it is retired;
  // carrying its old body along would put content in the repo that the site
  // has been told not to render.
  if (removed) return { removed: true };
  return {
    ...rest,
    meta: (rest.meta || []).filter(m => m.k || m.v),
    blocks: (rest.blocks || []).map(block => ({
      ...block,
      paras: (block.paras || []).filter(Boolean),
    })),
  };
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Every project the bundle has to carry, in the shape `projects.json` holds.
 *
 * The export used to write only the projects that had a draft entry, and
 * `studio:apply` REPLACES the file rather than merging into it. So a bundle
 * exported after editing six projects contained six projects, and applying it
 * deleted the other seven: four personal projects vanished from the index, and
 * three retired ones came back to life, because their tombstones lived in the
 * file that had just been overwritten.
 *
 * That got worse rather than better when the draft started pruning entries that
 * matched what was published — the pruning is right, but it left the export with
 * even less to write.
 *
 * So the bundle is assembled from every title, not from the draft: the draft's
 * version where there is one, and what the site currently publishes where there
 * is not. A retired project without a draft entry emits its tombstone rather
 * than being reconstructed as a live one, since the seed it would rebuild from
 * is exactly the body retirement was hiding.
 */
export const exportProjects = (drafts, titles) => {
  const out = {};
  for (const title of titles) {
    if (drafts[title]) {
      out[title] = normaliseProject(drafts[title]);
    } else if (RETIRED_TITLES.has(title)) {
      out[title] = { removed: true };
    } else {
      out[title] = normaliseProject(publishedRecord(title));
    }
  }
  return out;
};

/** The record the site publishes right now, ignoring any draft over it. */
export const publishedRecord = title =>
  SEED_TITLES.has(title) ? seedProject(title) : blankProject(title);

/**
 * Does this record say what the site is already publishing?
 *
 * Compared through `normaliseProject`, so the empty paragraph an editor keeps
 * around to type into does not count as a difference from a page that has none.
 */
export const matchesPublished = (record, title) =>
  SEED_TITLES.has(title) &&
  same(normaliseProject(record), normaliseProject(publishedRecord(title)));

/**
 * Does this draft record differ from what the site is already publishing?
 *
 * The reason the studio needs this at all: a draft is not cleared by exporting
 * it. Applying a bundle and committing it makes the draft and the site agree,
 * but the draft is still there — so every project it touched went on reading
 * "edited" forever, and the one label that was supposed to mean "this has not
 * shipped yet" came to mean "you opened this once".
 *
 * Comparing against the seed answers it without anyone having to remember to
 * clear anything: once the bundle is applied and the site rebuilt, the seed IS
 * the draft, and the badge goes out on its own.
 */
export const isEdited = (drafts, title) => {
  const edited = drafts[title];
  if (!edited) return false;
  if (edited.removed) return false; // retired reads as retired, not as edited
  if (!SEED_TITLES.has(title)) return true; // invented here, so it has never shipped
  return !matchesPublished(edited, title);
};

/** The same question for the settings that belong to the site as a whole. */
export const siteIsEdited = site => !same(site, seedSite());

/**
 * Load the draft, and drop anything in it the site has caught up with.
 *
 * The pruning is what makes the state honest rather than merely displayed
 * honestly: after an apply, a record identical to the seed is not a pending
 * edit, so it is not kept as one. It also keeps localStorage from growing a
 * copy of the whole site every time a bundle is published.
 */
export const readDraft = () => {
  const saved = loadDraft() || {};
  const projects = saved.projects || {};
  const kept = {};
  for (const [title, data] of Object.entries(projects)) {
    if (data.removed || isEdited(projects, title)) kept[title] = data;
  }
  const draft = {
    projects: kept,
    order: saved.order || {},
    // Seeded from what the site is publishing right now, for the same reason
    // the lists are: opening an editor should show the site as it stands, not
    // an empty default that silently switches something off on export.
    site: saved.site || seedSite(),
  };
  // Written back, not only returned. Pruning in memory alone would leave the
  // stale copy in storage to be pruned again on every load, and would put it
  // back into the next export the first time anything else was saved.
  if (Object.keys(kept).length !== Object.keys(projects).length) {
    saveDraft(draft);
  }
  return draft;
};

/**
 * Merge one project (and optionally the site settings) into the stored draft.
 *
 * This is how a project page in edit mode reaches the studio: it does not hold
 * the whole draft, only the one record it is editing, so it has to write into
 * whatever is there rather than over it. Reading immediately before writing
 * also means an edit made on a page does not clobber one made in `/studio` in
 * another tab, unless it is to the same project.
 */
export const mergeIntoDraft = (title, record, site) => {
  const current = readDraft();
  const next = {
    ...current,
    projects: { ...current.projects, [title]: record },
    site: site || current.site,
  };
  saveDraft(next);
  return next;
};
