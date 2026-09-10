import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WORKS } from '../components/Works/worksData.js';
import { toSlug } from '../utils/helpers.js';
import {
  clearDraft,
  deleteAsset,
  download,
  getAsset,
  listAssets,
  putAsset,
  saveDraft,
  zip,
} from '../utils/studioStore.js';
import {
  ARCHIVE_FIELDS,
  BLOCK_TYPES,
  DEFAULT_PROJECT_NOTICE,
  RATIOS,
  SEED_TITLES,
  SHAPES,
  blankBlock,
  blankProject,
  clone,
  isEdited,
  normaliseProject,
  readDraft,
  recordFor,
  seedProject,
  seedSite,
  siteIsEdited,
} from '../utils/studioDraft.js';
import './studio.css';

/**
 * /studio — the case-study editor.
 *
 * Deliberately not linked from anywhere and deliberately not connected to
 * anything. It reads the content the site is currently built from, lets it be
 * rewritten, and ends by handing over a zip: `projects.json` plus the assets it
 * names. `npm run studio:apply <zip>` drops both into the repo, and the commit
 * is the publish.
 *
 * That indirection is the design, not a limitation worked around. A browser
 * page cannot write into a git repository, and it should not be able to: the
 * site is static, its content belongs in the same history as its code, and a
 * change to a case study should be as reviewable as a change to a component.
 *
 * Assets need no CDN of their own. Everything under `public/` is served from
 * Vercel's edge once it is deployed, so an exported file that lands in
 * `public/projects/<slug>/` is already on a CDN by the time the deploy
 * finishes.
 *
 * The editor styles itself out of the site's palette but shares none of its
 * components: this is a tool, and it should look like one.
 */

// The rail's groups, in the order the works pane hands them to a reader: the
// two lists it toggles between, then everything the site is not showing.
const LISTS = [
  { key: 'work', label: 'Work', note: 'nothing in this list' },
  { key: 'personal', label: 'Personal', note: 'nothing in this list' },
  { key: 'unlisted', label: 'Not listed', note: 'nothing retired or unlisted' },
];

// ── small pieces of furniture ───────────────────────────────────────────────

const Field = ({ label, hint, children }) => (
  <label className='studio-field'>
    <span className='studio-field__label'>
      {label}
      {hint && <em>{hint}</em>}
    </span>
    {children}
  </label>
);

const Rows = ({ items, onChange, render, onAdd, addLabel }) => (
  <div className='studio-rows'>
    {items.map((item, i) => (
      <div className='studio-row' key={i}>
        <div className='studio-row__body'>{render(item, i)}</div>
        <div className='studio-row__side'>
          <button
            type='button'
            disabled={i === 0}
            onClick={() => {
              const next = [...items];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              onChange(next);
            }}
          >
            ↑
          </button>
          <button
            type='button'
            disabled={i === items.length - 1}
            onClick={() => {
              const next = [...items];
              [next[i + 1], next[i]] = [next[i], next[i + 1]];
              onChange(next);
            }}
          >
            ↓
          </button>
          <button
            type='button'
            className='studio-row__remove'
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      </div>
    ))}
    <button type='button' className='studio-add' onClick={onAdd}>
      + {addLabel}
    </button>
  </div>
);

// ── the page ────────────────────────────────────────────────────────────────

const Studio = () => {
  // One draft, two halves: the projects you have edited, and the order the
  // works pane should list them in. The order is not a property of any project
  // — it is the relationship between them — so it sits beside them rather than
  // being scattered across ten records as a rank each.
  // `readDraft` also drops anything the site has since caught up with, so a
  // bundle that has been applied and committed stops being a pending edit
  // without anyone having to remember to clear it.
  const [draft, setDraft] = useState(readDraft);
  const drafts = draft.projects;
  const commit = useCallback(mutate => {
    setDraft(previous => {
      const next = mutate(previous);
      saveDraft(next);
      return next;
    });
  }, []);
  // The seed plus anything the draft has added. A project invented here is a
  // first-class row from the moment it is named, so the rest of the editor
  // does not have to know whether it came from the repo or from this session.
  const titles = useMemo(
    () => [...new Set([...SEED_TITLES, ...Object.keys(drafts)])].sort(),
    [drafts],
  );

  const [current, setCurrent] = useState(() => [...SEED_TITLES].sort()[0]);
  // Which of the two things this editor edits is in the column: the site, or
  // one project. They are not two cards in one scroll — see the rail.
  const [view, setView] = useState('project');
  const [assetKeys, setAssetKeys] = useState([]);
  const [status, setStatus] = useState('');
  const fileInput = useRef(null);
  const pendingSlot = useRef(null);

  const project = recordFor(drafts, current);
  const retired = Boolean(drafts[current]?.removed);
  // Exactly how the works pane will join them, shown back so the three fields
  // above read as one line rather than three unrelated boxes.
  const metaLine = [
    project.archive.client,
    project.archive.role,
    project.archive.year,
  ]
    .filter(Boolean)
    .join(' / ');
  const slug = toSlug(current);

  // Deleting the project you were looking at has to leave you somewhere.
  useEffect(() => {
    if (!titles.includes(current)) setCurrent(titles[0]);
  }, [titles, current]);

  useEffect(() => {
    document.title = 'Studio — Kevin Rufino';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
      document.title = 'Kevin Rufino';
    };
  }, []);

  useEffect(() => {
    listAssets()
      .then(setAssetKeys)
      .catch(() => setAssetKeys([]));
  }, []);

  const update = useCallback(
    mutate => {
      commit(previous => {
        const base = recordFor(previous.projects, current);
        return {
          ...previous,
          projects: { ...previous.projects, [current]: mutate(clone(base)) },
        };
      });
    },
    [current, commit],
  );

  const setBlocks = blocks => update(p => ({ ...p, blocks }));

  // Site settings are not a project's to hold, so they are edited straight on
  // the draft rather than through `update`, which is scoped to whichever
  // project is open.
  const notice = draft.site.projectNotice;
  const siteEdited = siteIsEdited(draft.site);
  const setNotice = patch =>
    commit(previous => ({
      ...previous,
      site: {
        ...previous.site,
        projectNotice: { ...previous.site.projectNotice, ...patch },
      },
    }));
  const resetSite = () => {
    commit(previous => ({ ...previous, site: seedSite() }));
    setStatus('Site settings are back to what is published.');
  };

  // ── the two lists, and where each project sits in them ────────────────────

  // Which list a project is in RIGHT NOW: what the draft says if it says
  // anything, and what the site is currently doing if it does not. A retired
  // project is in neither, and neither is one the works pane never listed.
  const listOf = useCallback(
    title => {
      const edited = drafts[title];
      if (edited?.removed) return 'unlisted';
      if (edited?.index?.category) return edited.index.category;
      if (WORKS.work.some(row => row.title === title)) return 'work';
      if (WORKS.personal.some(row => row.title === title)) return 'personal';
      return 'unlisted';
    },
    [drafts],
  );

  // The rail, grouped and ordered exactly as the works pane will render it.
  //
  // With no order of its own each list falls back to the site's current one,
  // so opening the studio shows what the site shows rather than an arbitrary
  // arrangement you then have to fix. A title the order does not name sorts
  // last — which is where a project lands when you move it between lists, and
  // where a newly invented one starts.
  const grouped = useMemo(() => {
    const groups = { work: [], personal: [], unlisted: [] };
    for (const title of titles) groups[listOf(title)].push(title);
    for (const key of ['work', 'personal']) {
      const published = draft.order[key]?.length
        ? draft.order[key]
        : WORKS[key].map(row => row.title);
      const rank = title => {
        const at = published.indexOf(title);
        return at === -1 ? Infinity : at;
      };
      groups[key].sort((a, b) => rank(a) - rank(b));
    }
    return groups;
  }, [titles, listOf, draft.order]);

  // Swapping with a neighbour writes the WHOLE list back as the new order, so
  // what is stored is always a complete, self-consistent arrangement rather
  // than a patch against one the next edit might invalidate.
  const move = (key, at, delta) => {
    const list = grouped[key];
    const to = at + delta;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[at], next[to]] = [next[to], next[at]];
    commit(previous => ({
      ...previous,
      order: { ...previous.order, [key]: next },
    }));
  };

  // ── the list itself ───────────────────────────────────────────────────────

  const addProject = () => {
    const name = (window.prompt('Title of the new project') || '').trim();
    if (!name) return;
    if (titles.includes(name)) {
      setCurrent(name);
      setView('project');
      setStatus(`${name} is already in the list.`);
      return;
    }
    commit(previous => ({
      ...previous,
      projects: { ...previous.projects, [name]: blankProject(name) },
    }));
    setCurrent(name);
    setView('project');
    setStatus(
      `Added ${name}. It reaches the site on the next export and apply.`,
    );
  };

  // Two different things share one button. A project invented here can simply
  // be dropped, because nothing outside this browser has heard of it. One that
  // ships in the repo cannot: the editor has no way to edit the code it comes
  // from, so it publishes a tombstone instead and the index and the router
  // both honour it. Either way it is reversible until the export.
  const removeProject = title => {
    const seeded = SEED_TITLES.has(title);
    const ask = seeded
      ? `Retire “${title}”? It stops being listed and its page stops resolving. The source stays in the repo.`
      : `Delete “${title}”? It only exists in this draft.`;
    if (!window.confirm(ask)) return;
    commit(previous => {
      const projects = { ...previous.projects };
      if (seeded) {
        projects[title] = {
          ...(previous.projects[title] || seedProject(title)),
          removed: true,
        };
      } else {
        delete projects[title];
      }
      return { ...previous, projects };
    });
    setStatus(seeded ? `${title} retired.` : `${title} deleted.`);
  };

  const restoreProject = title => {
    commit(previous => {
      const projects = { ...previous.projects };
      if (projects[title]) {
        const { removed: _gone, ...rest } = projects[title];
        projects[title] = rest;
      }
      return { ...previous, projects };
    });
    setStatus(`${title} is back in the list.`);
  };
  const setBlock = (i, mutate) =>
    update(p => {
      p.blocks[i] = mutate(p.blocks[i]);
      return p;
    });

  // ── assets ────────────────────────────────────────────────────────────────

  const pickFile = slot => {
    pendingSlot.current = slot;
    if (fileInput.current) fileInput.current.accept = slot.accept || '';
    fileInput.current?.click();
  };

  const onFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const slot = pendingSlot.current;
    if (!file || !slot) return;
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${slug}/${slot.name}.${ext}`;
    await putAsset(path, file);
    setAssetKeys(await listAssets());
    slot.apply(`/projects/${path}`);
    setStatus(`Stored ${path} (${(file.size / 1048576).toFixed(1)} MB)`);
  };

  const dropAsset = async src => {
    const path = src.replace('/projects/', '');
    await deleteAsset(path);
    setAssetKeys(await listAssets());
  };

  // ── export ────────────────────────────────────────────────────────────────

  const exportBundle = async () => {
    setStatus('Building the bundle…');
    // The same normalisation the "edited" badge compares against — see
    // `studioDraft`. If the export and the comparison ever drifted apart, a
    // project would go on reading as edited after publishing exactly what it
    // said it would.
    const projects = {};
    for (const [title, data] of Object.entries(drafts)) {
      projects[title] = normaliseProject(data);
    }
    // The order goes out in full rather than as a delta. It is only titles, it
    // is the one part of this file a human will read top to bottom, and a
    // complete list cannot disagree with itself.
    const order = { work: grouped.work, personal: grouped.personal };
    // The third half of the file: what is true of the site rather than of any
    // one project. It goes out whole for the same reason the order does.
    const site = draft.site;
    const files = [
      {
        name: 'projects.json',
        bytes: new TextEncoder().encode(
          `${JSON.stringify({ projects, order, site }, null, 2)}\n`,
        ),
      },
    ];
    for (const key of await listAssets()) {
      const blob = await getAsset(key);
      if (!blob) continue;
      files.push({
        name: `assets/${key}`,
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    download(zip(files), `studio-${new Date().toISOString().slice(0, 10)}.zip`);
    setStatus(
      `Exported ${Object.keys(projects).length} project(s) and ${files.length - 1} asset(s). ` +
        'Run: npm run studio:apply ~/Downloads/<the zip>',
    );
  };

  // ── blocks ────────────────────────────────────────────────────────────────

  const renderBlockBody = (block, i) => {
    if (block.type === 'assets') {
      return (
        <Rows
          items={block.items}
          addLabel='asset'
          onAdd={() =>
            setBlock(i, b => ({
              ...b,
              items: [...b.items, { caption: '', span: 6, ratio: '16 / 10' }],
            }))
          }
          onChange={items => setBlock(i, b => ({ ...b, items }))}
          render={(item, j) => (
            <>
              <Field label='Caption'>
                <input
                  value={item.caption}
                  onChange={e =>
                    setBlock(i, b => {
                      b.items[j].caption = e.target.value;
                      return b;
                    })
                  }
                />
              </Field>
              <div className='studio-inline'>
                <Field label='Span' hint='of 12'>
                  <input
                    type='number'
                    min='1'
                    max='12'
                    value={item.span}
                    onChange={e =>
                      setBlock(i, b => {
                        b.items[j].span = Number(e.target.value);
                        return b;
                      })
                    }
                  />
                </Field>
                <Field label='Ratio'>
                  <select
                    value={item.ratio}
                    onChange={e =>
                      setBlock(i, b => {
                        b.items[j].ratio = e.target.value;
                        return b;
                      })
                    }
                  >
                    {RATIOS.map(r => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label='File'>
                  <div className='studio-asset'>
                    <code>{item.src || 'empty slot'}</code>
                    <button
                      type='button'
                      onClick={() =>
                        pickFile({
                          name: `${i}-${j}`,
                          apply: src =>
                            setBlock(i, b => {
                              b.items[j].src = src;
                              return b;
                            }),
                        })
                      }
                    >
                      upload
                    </button>
                    {item.src && (
                      <button
                        type='button'
                        onClick={() => {
                          dropAsset(item.src);
                          setBlock(i, b => {
                            delete b.items[j].src;
                            return b;
                          });
                        }}
                      >
                        clear
                      </button>
                    )}
                  </div>
                </Field>
              </div>
            </>
          )}
        />
      );
    }

    if (block.type === 'moments') {
      return (
        <Rows
          items={block.items}
          addLabel='decision'
          onAdd={() =>
            setBlock(i, b => ({
              ...b,
              items: [
                ...b.items,
                {
                  kind: 'Decision',
                  title: '',
                  body: '',
                  chose: { k: 'Chose', v: '' },
                  passed: { k: 'Passed on', v: '' },
                  call: '',
                },
              ],
            }))
          }
          onChange={items => setBlock(i, b => ({ ...b, items }))}
          render={(item, j) => {
            const set = (path, value) =>
              setBlock(i, b => {
                const target =
                  path.length === 1 ? b.items[j] : b.items[j][path[0]];
                target[path[path.length - 1]] = value;
                return b;
              });
            return (
              <>
                <div className='studio-inline'>
                  <Field label='Chip'>
                    <input
                      value={item.kind}
                      onChange={e => set(['kind'], e.target.value)}
                    />
                  </Field>
                  <Field label='Title'>
                    <input
                      value={item.title}
                      onChange={e => set(['title'], e.target.value)}
                    />
                  </Field>
                </div>
                <Field label='Body'>
                  <textarea
                    rows='3'
                    value={item.body}
                    onChange={e => set(['body'], e.target.value)}
                  />
                </Field>
                <div className='studio-inline'>
                  <Field label='Chose'>
                    <input
                      value={item.chose.v}
                      onChange={e => set(['chose', 'v'], e.target.value)}
                    />
                  </Field>
                  <Field label='Passed on'>
                    <input
                      value={item.passed.v}
                      onChange={e => set(['passed', 'v'], e.target.value)}
                    />
                  </Field>
                </div>
                <Field label='So what'>
                  <input
                    value={item.call}
                    onChange={e => set(['call'], e.target.value)}
                  />
                </Field>
              </>
            );
          }}
        />
      );
    }

    if (block.type === 'impact') {
      return (
        <Rows
          items={block.items}
          addLabel='figure'
          onAdd={() =>
            setBlock(i, b => ({
              ...b,
              items: [...b.items, { n: 0, suffix: '', k: '', note: '' }],
            }))
          }
          onChange={items => setBlock(i, b => ({ ...b, items }))}
          render={(item, j) => {
            const set = (key, value) =>
              setBlock(i, b => {
                b.items[j][key] = value;
                return b;
              });
            return (
              <div className='studio-inline'>
                <Field label='Number'>
                  <input
                    type='number'
                    step='0.1'
                    value={item.n}
                    onChange={e => set('n', Number(e.target.value))}
                  />
                </Field>
                <Field label='Suffix'>
                  <input
                    value={item.suffix}
                    onChange={e => set('suffix', e.target.value)}
                  />
                </Field>
                <Field label='Label'>
                  <input
                    value={item.k}
                    onChange={e => set('k', e.target.value)}
                  />
                </Field>
                <Field label='Note'>
                  <input
                    value={item.note}
                    onChange={e => set('note', e.target.value)}
                  />
                </Field>
              </div>
            );
          }}
        />
      );
    }

    return (
      <>
        <Field label='Paragraphs' hint='one per line break'>
          <textarea
            rows='6'
            value={(block.paras || []).join('\n\n')}
            onChange={e =>
              setBlock(i, b => ({
                ...b,
                paras: e.target.value.split(/\n{2,}/),
              }))
            }
          />
        </Field>
        <Field label='Pull quote'>
          <input
            value={block.pull || ''}
            onChange={e => setBlock(i, b => ({ ...b, pull: e.target.value }))}
          />
        </Field>
      </>
    );
  };

  return (
    <div className='studio'>
      <input ref={fileInput} type='file' hidden onChange={onFile} />

      <header className='studio-head'>
        <h1>Studio</h1>
        <p>
          Everything here stays in this browser until you export. The bundle is
          a <code>projects.json</code> and the assets it names; apply it with{' '}
          <code>npm run studio:apply &lt;zip&gt;</code> and commit. A project
          page can also be edited on itself — open it with <code>?edit=1</code>{' '}
          — which writes back into this same draft.
        </p>
        <div className='studio-head__actions'>
          <button
            type='button'
            className='studio-primary'
            onClick={exportBundle}
          >
            Export bundle
          </button>
          <button
            type='button'
            onClick={() => {
              if (!window.confirm('Discard every local edit?')) return;
              clearDraft();
              setDraft({ projects: {}, order: {}, site: seedSite() });
              setStatus(
                'Draft cleared. The site’s current content is showing again.',
              );
            }}
          >
            Discard draft
          </button>
          <span className='studio-status'>{status}</span>
        </div>
      </header>

      <div className='studio-body'>
        <nav className='studio-list'>
          {/* Grouped and ordered the way the works pane will render it, so the
              rail is a preview of the index rather than a filing cabinet.
              Unlisted comes last and is not orderable: nothing in it appears
              on the site, and it exists so a retired project stays reachable
              to restore. */}
          {/* Above the lists, and not in any of them, because it is not a
              project. What is true of the whole site was sitting at the top of
              the project column, in the same stack of cards as this project's
              tagline and this project's blocks — so a switch that holds back
              every page on the site read as a property of whichever one
              happened to be open. Selecting it here swaps the column entirely:
              you are editing the site, or you are editing a project, and never
              both at once in the same scroll. */}
          <div className='studio-group'>
            <p className='studio-group__label'>Site</p>
            <div
              className={`studio-listrow ${view === 'site' ? 'is-on' : ''}`.trim()}
            >
              <button
                type='button'
                className='studio-listrow__pick'
                onClick={() => setView('site')}
              >
                <span>Every project page</span>
                {siteEdited && <em>edited</em>}
              </button>
            </div>
          </div>

          {LISTS.map(({ key, label, note }) => (
            <div className='studio-group' key={key}>
              <p className='studio-group__label'>
                {label}
                <em>{grouped[key].length}</em>
              </p>
              {grouped[key].length === 0 && (
                <p className='studio-group__empty'>{note}</p>
              )}
              {grouped[key].map((title, at) => {
                const gone = Boolean(drafts[title]?.removed);
                return (
                  <div
                    key={title}
                    className={`studio-listrow ${
                      title === current && view === 'project' ? 'is-on' : ''
                    } ${gone ? 'is-gone' : ''}`.trim()}
                  >
                    <button
                      type='button'
                      className='studio-listrow__pick'
                      onClick={() => {
                        setCurrent(title);
                        setView('project');
                      }}
                    >
                      <span>{drafts[title]?.display || title}</span>
                      {gone && <em>retired</em>}
                      {/* Against what the site is publishing, not against
                          whether a record exists. A draft is not cleared by
                          exporting it, so "has an entry" went on being true
                          forever and this badge came to mean "you opened
                          this". Compared this way it clears itself the moment
                          the bundle is applied and the site rebuilt. */}
                      {!gone && isEdited(drafts, title) && <em>edited</em>}
                    </button>
                    {key !== 'unlisted' && (
                      <span className='studio-listrow__move'>
                        <button
                          type='button'
                          disabled={at === 0}
                          aria-label={`Move ${title} up`}
                          onClick={() => move(key, at, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type='button'
                          disabled={at === grouped[key].length - 1}
                          aria-label={`Move ${title} down`}
                          onClick={() => move(key, at, 1)}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <button type='button' className='studio-add' onClick={addProject}>
            + New project
          </button>
          <p className='studio-note'>
            {assetKeys.length} asset{assetKeys.length === 1 ? '' : 's'} held
            locally
          </p>
        </nav>

        <main className='studio-main'>
          {view === 'site' ? (
            /* Everything true of the site rather than of any one project. There
             is one switch in here today; the card exists so the next one has
             somewhere to go that is not the top of a project's own column. */
            <section className='studio-card'>
              <div className='studio-card__head'>
                <h2>Every project page</h2>
                {siteEdited && (
                  <button type='button' onClick={resetSite}>
                    Reset to published
                  </button>
                )}
              </div>
              <p className='studio-hint'>
                These apply to every project at once — including ones you have
                not opened, and ones added later.
              </p>
              <label className='studio-check'>
                <input
                  type='checkbox'
                  checked={Boolean(notice.enabled)}
                  onChange={e => setNotice({ enabled: e.target.checked })}
                />
                <span>
                  Hold every project page
                  <em>
                    hides the chapter bar, the metadata table and every block,
                    on every project page
                  </em>
                </span>
              </label>
              <Field label='Notice' hint='shown under the cover instead'>
                <input
                  value={notice.text}
                  placeholder={DEFAULT_PROJECT_NOTICE}
                  onChange={e => setNotice({ text: e.target.value })}
                />
              </Field>
              <p className='studio-hint'>
                {notice.enabled
                  ? `Every project page shows “${notice.text || DEFAULT_PROJECT_NOTICE}” in place of its case study.`
                  : 'Project pages are showing their case studies in full.'}
              </p>
            </section>
          ) : (
            <>
              <section className='studio-card'>
                <div className='studio-card__head'>
                  <h2>{current}</h2>
                  {/* The other half of this editor. Everything typed here is
                      already in the draft the page reads, so this is a change
                      of window rather than a handover — and the two questions
                      they answer are different ones: what a case study says,
                      and how it reads at the size it is set. */}
                  {!retired && !project.index.liveOnly && (
                    <a
                      className='studio-elsewhere'
                      href={`/projects/${slug}?edit=1`}
                      target='_blank'
                      rel='noreferrer'
                    >
                      Edit on the page ↗
                    </a>
                  )}
                  {retired ? (
                    <button
                      type='button'
                      onClick={() => restoreProject(current)}
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='studio-danger'
                      onClick={() => removeProject(current)}
                    >
                      {SEED_TITLES.has(current) ? 'Retire' : 'Delete'}
                    </button>
                  )}
                </div>
                {retired && (
                  <p className='studio-retired'>
                    Retired. It will be dropped from the works pane and its page
                    will stop resolving once this bundle is applied.
                  </p>
                )}
                <div className='studio-inline'>
                  <Field label='Display name'>
                    <input
                      value={project.display}
                      onChange={e =>
                        update(p => ({ ...p, display: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label='Slug' hint='from the title'>
                    <input value={slug} readOnly />
                  </Field>
                </div>
                <Field label='Tagline'>
                  <textarea
                    rows='2'
                    value={project.tagline}
                    onChange={e =>
                      update(p => ({ ...p, tagline: e.target.value }))
                    }
                  />
                </Field>
                <div className='studio-inline'>
                  <Field label='Cover caption'>
                    <input
                      value={project.cover}
                      onChange={e =>
                        update(p => ({ ...p, cover: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label='Cover file'>
                    <div className='studio-asset'>
                      <code>{project.coverSrc || 'archive default'}</code>
                      <button
                        type='button'
                        onClick={() =>
                          pickFile({
                            name: 'cover',
                            apply: src =>
                              update(p => ({ ...p, coverSrc: src })),
                          })
                        }
                      >
                        upload
                      </button>
                    </div>
                  </Field>
                </div>
              </section>

              <section className='studio-card'>
                <h3>Index entry</h3>
                <div className='studio-inline'>
                  <Field label='List'>
                    <select
                      value={project.index.category}
                      onChange={e =>
                        update(p => ({
                          ...p,
                          index: { ...p.index, category: e.target.value },
                        }))
                      }
                    >
                      <option value='work'>Work</option>
                      <option value='personal'>Personal</option>
                    </select>
                  </Field>
                  <Field label='Glyph shape' hint='used when there is no loop'>
                    <select
                      value={project.index.shape}
                      onChange={e =>
                        update(p => ({
                          ...p,
                          index: { ...p.index, shape: e.target.value },
                        }))
                      }
                    >
                      {SHAPES.map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                {/* The glyph is rendered as an 88x88 field of dithered type, and
                a loop dropped here is sampled into that field rather than
                played on top of it. Two-tone reads best: the field is
                thresholded, so a clip with real midtones comes out mushy. */}
                <Field
                  label='Glyph loop'
                  hint='two-tone video, rasterised into the glyph'
                >
                  <div className='studio-asset'>
                    <code>
                      {project.index.glyphSrc || 'none — generating the shape'}
                    </code>
                    <button
                      type='button'
                      onClick={() =>
                        pickFile({
                          name: 'glyph',
                          accept: 'video/mp4,video/webm,video/quicktime',
                          apply: src =>
                            update(p => ({
                              ...p,
                              index: { ...p.index, glyphSrc: src },
                            })),
                        })
                      }
                    >
                      upload
                    </button>
                    {project.index.glyphSrc && (
                      <button
                        type='button'
                        onClick={() => {
                          dropAsset(project.index.glyphSrc);
                          update(p => ({
                            ...p,
                            index: { ...p.index, glyphSrc: '' },
                          }));
                        }}
                      >
                        clear
                      </button>
                    )}
                  </div>
                </Field>
                <Field label='One-line summary' hint='shown in the works pane'>
                  <textarea
                    rows='2'
                    value={project.index.summary}
                    onChange={e =>
                      update(p => ({
                        ...p,
                        index: { ...p.index, summary: e.target.value },
                      }))
                    }
                  />
                </Field>
                {/* Listed, but not openable. The row keeps its title, line and
                summary — the work is real — and the way in is replaced by a
                note rather than pointed at a page that cannot yet stand
                behind what it claims. */}
                <label className='studio-check'>
                  <input
                    type='checkbox'
                    checked={Boolean(project.index.comingSoon)}
                    onChange={e =>
                      update(p => ({
                        ...p,
                        index: { ...p.index, comingSoon: e.target.checked },
                      }))
                    }
                  />
                  <span>
                    Coming soon
                    <em>
                      the works pane reads “Coming soon” instead of linking to
                      the project page
                    </em>
                  </span>
                </label>
                {/* Not every piece of work wants a case study. Some of it is a
                    live thing that is better looked at than read about, and
                    writing three chapters in order to have somewhere to put a
                    link is the wrong shape. The row is unchanged either way —
                    it is the same work — only where it goes changes. */}
                <label className='studio-check'>
                  <input
                    type='checkbox'
                    checked={Boolean(project.index.liveOnly)}
                    onChange={e =>
                      update(p => ({
                        ...p,
                        index: { ...p.index, liveOnly: e.target.checked },
                      }))
                    }
                  />
                  <span>
                    No project page
                    <em>
                      the works pane links straight to the live site, the
                      annotation reads “view live project”, and the page stops
                      resolving
                    </em>
                  </span>
                </label>
                {project.index.liveOnly && !project.archive.liveLink && (
                  <p className='studio-hint studio-hint--warn'>
                    There is no live link set below, so this row would have
                    nowhere to go. Add one before exporting.
                  </p>
                )}
                <div className='studio-inline'>
                  {ARCHIVE_FIELDS.map(({ key, label, hint }) => (
                    <Field key={key} label={label} hint={hint}>
                      <input
                        value={project.archive[key]}
                        onChange={e =>
                          update(p => ({
                            ...p,
                            archive: { ...p.archive, [key]: e.target.value },
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
                <p className='studio-hint'>
                  Client, role and year are the line under the title in the
                  works pane, joined with slashes —{' '}
                  {metaLine || 'nothing set yet'}
                </p>
              </section>

              <section className='studio-card'>
                <h3>Metadata table</h3>
                <Rows
                  items={project.meta}
                  addLabel='row'
                  onAdd={() =>
                    update(p => ({ ...p, meta: [...p.meta, { k: '', v: '' }] }))
                  }
                  onChange={meta => update(p => ({ ...p, meta }))}
                  render={(row, i) => (
                    <div className='studio-inline'>
                      <Field label='Key'>
                        <input
                          value={row.k}
                          onChange={e =>
                            update(p => {
                              p.meta[i].k = e.target.value;
                              return p;
                            })
                          }
                        />
                      </Field>
                      <Field label='Value'>
                        <input
                          value={row.v}
                          onChange={e =>
                            update(p => {
                              p.meta[i].v = e.target.value;
                              return p;
                            })
                          }
                        />
                      </Field>
                    </div>
                  )}
                />
              </section>

              <section className='studio-card'>
                <h3>Blocks</h3>
                <Rows
                  items={project.blocks}
                  addLabel='block'
                  onAdd={() =>
                    setBlocks([...project.blocks, blankBlock('text')])
                  }
                  onChange={setBlocks}
                  render={(block, i) => (
                    <div className='studio-block'>
                      <div className='studio-inline'>
                        <Field label='Type'>
                          <select
                            value={block.type}
                            onChange={e =>
                              setBlocks(
                                project.blocks.map((b, j) =>
                                  j === i
                                    ? {
                                        ...blankBlock(e.target.value),
                                        label: b.label,
                                        title: b.title,
                                        note: b.note,
                                      }
                                    : b,
                                ),
                              )
                            }
                          >
                            {BLOCK_TYPES.map(t => (
                              <option key={t.type} value={t.type}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label='Eyebrow' hint='Context, Process…'>
                          <input
                            value={block.label}
                            onChange={e =>
                              setBlock(i, b => ({
                                ...b,
                                label: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label='Heading'>
                          <input
                            value={block.title}
                            onChange={e =>
                              setBlock(i, b => ({
                                ...b,
                                title: e.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <Field label='Note' hint='small print under the heading'>
                        <input
                          value={block.note || ''}
                          onChange={e =>
                            setBlock(i, b => ({ ...b, note: e.target.value }))
                          }
                        />
                      </Field>
                      <p className='studio-hint'>
                        {BLOCK_TYPES.find(t => t.type === block.type)?.hint}
                      </p>
                      {renderBlockBody(block, i)}
                    </div>
                  )}
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Studio;
