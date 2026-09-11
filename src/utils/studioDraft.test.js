/**
 * The two rules the studio's state depends on and the UI cannot show you:
 * what "published without a page" does to the rest of the site, and what
 * "edited" is measured against.
 */

// One project of each kind: one with a case study, one the studio has
// published without a page, and one it has retired.
jest.mock('../content/projects.json', () => ({
  projects: {
    Alpha: {
      display: 'Alpha',
      tagline: 'A tagline',
      cover: 'Cover — Alpha',
      coverSrc: '',
      meta: [{ k: 'Role', v: 'Lead' }],
      blocks: [
        { type: 'text', label: 'Context', title: 'Why', paras: ['One.'] },
      ],
      index: {
        category: 'work',
        shape: 'sphere',
        glyphSrc: '',
        summary: 'A summary',
        comingSoon: false,
      },
      archive: { client: 'A client', role: 'Lead', year: '2026', liveLink: '' },
    },
    Beta: {
      display: 'Beta',
      blocks: [
        { type: 'text', title: 'Never rendered', paras: ['Held back.'] },
      ],
      index: {
        category: 'work',
        shape: 'rings',
        glyphSrc: '',
        summary: 'Better looked at than read about',
        comingSoon: false,
        liveOnly: true,
      },
      archive: {
        client: '',
        role: '',
        year: '',
        liveLink: 'https://beta.example',
      },
    },
    Gamma: { removed: true },
    // Invented in the studio: no entry in constants.js at all.
    Delta: {
      display: 'Delta',
      blocks: [{ type: 'text', title: 'Context', paras: ['Invented here.'] }],
      index: {
        category: 'work',
        shape: 'sphere',
        glyphSrc: '',
        summary: 'Exists only in the studio',
        comingSoon: false,
      },
      archive: { client: 'D client', role: 'Lead', year: '2026', liveLink: '' },
    },
  },
  order: {},
  site: {},
}));
jest.mock('../constants.js', () => ({
  ProjectsData: [
    { title: 'Alpha', client: 'A client', role: 'Lead', year: '2026' },
    { title: 'Beta', client: 'B client', role: 'Lead', year: '2026' },
    { title: 'Gamma' },
  ],
}));

const load = () => ({
  stories: require('../components/Project/projectStories.js'),
  works: require('../components/Works/worksData.js'),
  draft: require('./studioDraft.js'),
});

describe('a project published without a page', () => {
  test('is listed, links out, and stops resolving', () => {
    const { stories, works } = load();

    expect(stories.LIVE_ONLY_TITLES.has('Beta')).toBe(true);
    // No story, so the router's archive walk drops it and the slug 404s.
    expect(stories.PROJECT_STORIES.Beta).toBeUndefined();
    // The one with a case study is untouched by any of this.
    expect(stories.PROJECT_STORIES.Alpha).toBeDefined();

    const row = works.WORKS.work.find(r => r.title === 'Beta');
    expect(row).toBeDefined();
    expect(row.description).toBe('Better looked at than read about');
    expect(row.liveOnly).toBe(true);
    // Which is what the works pane reads to say "view live project" and to
    // send the press to the site rather than to a page.
    expect(row.hasStory).toBe(false);
    expect(row.linkHref).toBe('https://beta.example');
  });

  test('is still not the same thing as retired', () => {
    const { stories, works } = load();
    expect(stories.RETIRED_TITLES.has('Gamma')).toBe(true);
    expect(stories.LIVE_ONLY_TITLES.has('Gamma')).toBe(false);
    expect(works.WORKS.work.find(r => r.title === 'Gamma')).toBeUndefined();
  });
});

describe('a project the studio invented', () => {
  test('is reachable, not just listed', () => {
    const { works } = load();
    // Delta exists only in projects.json — there is no archive record for it.
    // The works pane has always listed such a project; the router built its
    // list straight off ProjectsData, so pressing the row 404'd. Anything that
    // needs "all the projects" asks for ARCHIVE_TITLES instead.
    expect(works.WORKS.work.some(r => r.title === 'Delta')).toBe(true);
    expect(works.ARCHIVE_TITLES).toContain('Delta');
    // …and the archive titles still lead with the archive, in its own order.
    expect(works.ARCHIVE_TITLES.slice(0, 3)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

describe('a draft that has fallen behind the site', () => {
  test('is recognisable as different from what is published', () => {
    const { draft } = load();
    // What a draft saved before a rewrite looks like: the shape the page used
    // to have, which is indistinguishable from a page with less on it.
    const stale = {
      ...draft.seedProject('Alpha'),
      tagline: '',
      blocks: [{ type: 'text', label: '', title: '', note: '', paras: [''], pull: '' }],
    };
    expect(draft.matchesPublished(stale, 'Alpha')).toBe(false);
    expect(draft.matchesPublished(draft.seedProject('Alpha'), 'Alpha')).toBe(true);
  });

  test('publishedRecord ignores whatever the draft says', () => {
    const { draft } = load();
    const published = draft.publishedRecord('Alpha');
    expect(published.blocks).toHaveLength(1);
    expect(published.blocks[0].title).toBe('Why');
    expect(published.tagline).toBe('A tagline');
  });

  test('a project the studio invented never matches published', () => {
    const { draft } = load();
    // There is nothing live to match, so the editor must always treat it as
    // unpublished rather than claiming parity with a page that does not exist.
    expect(draft.matchesPublished(draft.blankProject('Delta'), 'Delta')).toBe(false);
  });
});

describe('what the export puts in the bundle', () => {
  const titles = ['Alpha', 'Beta', 'Gamma', 'Delta'];

  test('carries every project, not only the edited ones', () => {
    const { draft } = load();
    // `studio:apply` REPLACES projects.json. An export built only from the
    // draft deleted everything untouched — which is how four personal projects
    // vanished and three retired ones came back.
    const out = draft.exportProjects({}, titles);
    expect(Object.keys(out).sort()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
  });

  test('keeps a retired project retired', () => {
    const { draft } = load();
    const out = draft.exportProjects({}, titles);
    // Its tombstone is the only thing that keeps it off the site. Rebuilding it
    // from a seed would resurrect the body retirement was hiding.
    expect(out.Gamma).toEqual({ removed: true });
  });

  test('keeps the body of a project published without a page', () => {
    const { draft } = load();
    const out = draft.exportProjects({}, titles);
    // Beta is liveOnly. It renders no page, but it still HAS a story, and an
    // export that blanked it would erase it from the file on the next apply.
    expect(out.Beta.blocks).toHaveLength(1);
    expect(out.Beta.index.liveOnly).toBe(true);
  });

  test('a drafted project wins over what is published', () => {
    const { draft } = load();
    const edited = { ...draft.seedProject('Alpha'), tagline: 'Rewritten' };
    const out = draft.exportProjects({ Alpha: edited }, titles);
    expect(out.Alpha.tagline).toBe('Rewritten');
    // …and the untouched ones are still there beside it.
    expect(out.Beta).toBeDefined();
    expect(out.Gamma).toEqual({ removed: true });
  });

  test('an export with no draft reproduces what is published', () => {
    const { draft } = load();
    const out = draft.exportProjects({}, titles);
    for (const title of ['Alpha', 'Beta']) {
      expect(draft.matchesPublished(out[title], title)).toBe(true);
    }
  });
});

describe('the edited badge', () => {
  test('is off for a draft the site has caught up with', () => {
    const { draft } = load();
    // Exactly what a previous export published, which is what a draft looks
    // like once its bundle has been applied and committed.
    const drafts = { Alpha: draft.seedProject('Alpha') };
    expect(draft.isEdited(drafts, 'Alpha')).toBe(false);
  });

  test('is on the moment the draft says something else', () => {
    const { draft } = load();
    const edited = { ...draft.seedProject('Alpha'), tagline: 'A new tagline' };
    expect(draft.isEdited({ Alpha: edited }, 'Alpha')).toBe(true);
  });

  test('ignores the empty rows the editor keeps to type into', () => {
    const { draft } = load();
    const seeded = draft.seedProject('Alpha');
    // A trailing blank paragraph and a blank metadata row are dropped by the
    // export, so neither is a change to the site.
    seeded.meta = [...seeded.meta, { k: '', v: '' }];
    seeded.blocks[0].paras = [...seeded.blocks[0].paras, ''];
    expect(draft.isEdited({ Alpha: seeded }, 'Alpha')).toBe(false);
  });

  test('reads a retired project as retired rather than edited', () => {
    const { draft } = load();
    const drafts = { Alpha: { ...draft.seedProject('Alpha'), removed: true } };
    expect(draft.isEdited(drafts, 'Alpha')).toBe(false);
  });

  test('is on for a project that exists only in the draft', () => {
    const { draft } = load();
    expect(
      draft.isEdited({ Delta: draft.blankProject('Delta') }, 'Delta'),
    ).toBe(true);
  });
});
