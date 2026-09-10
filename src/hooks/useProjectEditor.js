import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toSlug } from '../utils/helpers.js';
import { deleteAsset, putAsset } from '../utils/studioStore.js';
import {
  blankBlock,
  clone,
  mergeIntoDraft,
  normaliseProject,
  readDraft,
  recordFor,
  seedSite,
} from '../utils/studioDraft.js';

/**
 * A project page, editable on itself.
 *
 * `/studio` edits a project through a column of labelled inputs, which is the
 * right tool for deciding what a case study says and a poor one for deciding
 * how it reads. Type set at 96px on a charcoal ground with an image beside it
 * is a different sentence from the same words in a 13px text field, and the
 * gap between the two is where most of the fiddling goes: a heading that is one
 * word too long, a caption that wraps, a pull quote that turns out to be a
 * paragraph. This hook is the other half — the same record, edited where you
 * can see what it does.
 *
 * ── what it is not ──────────────────────────────────────────────────────────
 *
 * It is not a live edit of the site. The page renders from `projects.json`,
 * which is built into the bundle, and nothing here changes that. Editing swaps
 * the page over to a working copy held in memory; saving folds that copy into
 * the same localStorage draft `/studio` reads; publishing is still an export,
 * an apply and a commit. So the loop is unchanged and the diff is still the
 * review — this is a better window onto the same draft, not a way around it.
 *
 * ── explicit save ───────────────────────────────────────────────────────────
 *
 * Nothing reaches the draft until it is asked to. `/studio` writes through on
 * every keystroke, which is right for a tool you went to on purpose; a page you
 * can arrive at with a query string is not, and a stray click into a heading
 * should not be able to rewrite published copy. Uploaded media is the exception
 * and cannot be otherwise: the bytes go to IndexedDB when they are chosen,
 * because that is the only place they can go.
 *
 * ── merging rather than writing ─────────────────────────────────────────────
 *
 * The draft is read immediately before it is written, and only this project's
 * record is replaced in it. Two pages open on two projects can both save
 * without either losing the other, and `/studio` open in another tab only
 * loses what it was holding for THIS project.
 */

/**
 * The pieces of a record a person would count as "a change".
 *
 * Not the leaves. Counting those had the bar reading "115 unsaved changes" for
 * moving one block above another — true of the data and useless about the
 * work, since what happened was one move. A block is one thing, the metadata
 * table is one thing, the index entry is one thing, and that is the grain the
 * number is reported at.
 */
const unitsOf = record => ({
  display: record.display,
  tagline: record.tagline,
  cover: record.cover,
  coverSrc: record.coverSrc,
  meta: record.meta,
  index: record.index,
  archive: record.archive,
  ...Object.fromEntries(
    (record.blocks || []).map((block, i) => [`block ${i}`, block]),
  ),
});

const countChanges = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let n = 0;
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) n += 1;
  }
  return n;
};

/** `a.b.0.c` addressing, immutably. */
const setIn = (record, path, value) => {
  const next = clone(record);
  let node = next;
  for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
  node[path[path.length - 1]] = value;
  return next;
};

const getIn = (record, path) =>
  path.reduce((node, key) => (node == null ? node : node[key]), record);

const moved = (list, at, delta) => {
  const to = at + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
};

export default function useProjectEditor(title) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const editing = Boolean(title) && params.get('edit') === '1';

  // The draft as it stood when this page was opened. Everything the bar
  // reports — dirty, the change count, what Discard goes back to — is measured
  // against this rather than against the published site, so a project that was
  // already half-edited in `/studio` opens showing those edits and reads as
  // clean until this session adds to them.
  const opened = useMemo(() => {
    if (!title) return null;
    const draft = readDraft();
    return {
      record: clone(recordFor(draft.projects, title)),
      site: clone(draft.site || seedSite()),
    };
  }, [title]);

  // Held as state rather than read off the memo, because saving MOVES it: what
  // Discard returns to, and what the change count is measured against, becomes
  // what was just written. Mutating the memo instead left the bar reporting an
  // unsaved change it had already saved.
  const [baseline, setBaseline] = useState(opened);
  const [record, setRecord] = useState(() => opened && clone(opened.record));
  const [site, setSite] = useState(() => opened && clone(opened.site));
  // Bumped by anything that changes the SHAPE of the page rather than the
  // words in it. Every editable field is uncontrolled once it is focused — the
  // DOM is the truth for a node being typed into, or the caret jumps to the end
  // on every keystroke — so a structural change has to remount them all to
  // pick up their new addresses. See `Editable`.
  const [rev, setRev] = useState(0);
  const [status, setStatus] = useState('');
  const [panel, setPanel] = useState(null);

  // Arriving on a different project — the footer walks to the next one — has
  // to start from that project's own record rather than carry this one's.
  useEffect(() => {
    if (!opened) return;
    setBaseline(opened);
    setRecord(clone(opened.record));
    setSite(clone(opened.site));
    setRev(n => n + 1);
    setStatus('');
  }, [opened]);

  const changes = useMemo(() => {
    if (!editing || !record || !baseline) return 0;
    return (
      countChanges(
        unitsOf(normaliseProject(record)),
        unitsOf(normaliseProject(baseline.record)),
      ) + (JSON.stringify(site) === JSON.stringify(baseline.site) ? 0 : 1)
    );
  }, [editing, record, site, baseline]);
  const dirty = changes > 0;

  // ── writing ───────────────────────────────────────────────────────────────

  const patch = useCallback((path, value) => {
    setRecord(previous => setIn(previous, path, value));
  }, []);

  const patchSite = useCallback((path, value) => {
    setSite(previous => setIn(previous, path, value));
  }, []);

  /** Anything that changes the page's shape: remount the fields after it. */
  const restructure = useCallback(mutate => {
    setRecord(previous => mutate(clone(previous)));
    setRev(n => n + 1);
  }, []);

  const blockOps = useMemo(
    () => ({
      add: (at, type = 'text') =>
        restructure(p => {
          p.blocks.splice(at, 0, blankBlock(type));
          return p;
        }),
      remove: at =>
        restructure(p => {
          p.blocks.splice(at, 1);
          // A page with no blocks at all has nothing to add the next one
          // beside, so it keeps one empty.
          if (!p.blocks.length) p.blocks = [blankBlock('text')];
          return p;
        }),
      move: (at, delta) =>
        restructure(p => ({ ...p, blocks: moved(p.blocks, at, delta) })),
      // The head — eyebrow, heading, note — is what the reader uses to find
      // their way through the page, and it is not type-specific. Keeping it
      // across a change of type means picking the wrong one is a correction
      // rather than a retype.
      setType: (at, type) =>
        restructure(p => {
          const old = p.blocks[at];
          p.blocks[at] = {
            ...blankBlock(type),
            label: old.label,
            title: old.title,
            note: old.note,
          };
          return p;
        }),
    }),
    [restructure],
  );

  /** Items INSIDE a block: assets, decisions, figures. */
  const itemOps = useMemo(
    () => ({
      add: (at, template) =>
        restructure(p => {
          const items = p.blocks[at].items || [];
          items.push(clone(template));
          p.blocks[at].items = items;
          return p;
        }),
      remove: (at, j) =>
        restructure(p => {
          p.blocks[at].items.splice(j, 1);
          return p;
        }),
      move: (at, j, delta) =>
        restructure(p => {
          p.blocks[at].items = moved(p.blocks[at].items, j, delta);
          return p;
        }),
    }),
    [restructure],
  );

  const metaOps = useMemo(
    () => ({
      add: () =>
        restructure(p => {
          p.meta = [...(p.meta || []), { k: '', v: '' }];
          return p;
        }),
      remove: at =>
        restructure(p => {
          p.meta.splice(at, 1);
          return p;
        }),
      move: (at, delta) =>
        restructure(p => ({ ...p, meta: moved(p.meta, at, delta) })),
    }),
    [restructure],
  );

  /** Split a paragraph at the caret, which is what Enter means in prose. */
  const splitPara = useCallback(
    (blockAt, at, before, after) =>
      restructure(p => {
        p.blocks[blockAt].paras.splice(at, 1, before, after);
        return p;
      }),
    [restructure],
  );

  const removePara = useCallback(
    (blockAt, at) =>
      restructure(p => {
        p.blocks[blockAt].paras.splice(at, 1);
        if (!p.blocks[blockAt].paras.length) p.blocks[blockAt].paras = [''];
        return p;
      }),
    [restructure],
  );

  // ── media ─────────────────────────────────────────────────────────────────

  const slug = title ? toSlug(title) : '';

  /**
   * Choose a file for a slot.
   *
   * The picker is created and clicked rather than rendered, so nothing has to
   * hold a hidden input and thread a pending slot through it — the call site
   * says which path it is filling and gets it filled.
   *
   * The bytes land in IndexedDB immediately, under the same
   * `<slug>/<name>.<ext>` path `/studio` uses, so a file chosen here exports
   * from there and vice versa. This is the one thing on the page that is not
   * waiting for Save, and it cannot be otherwise: there is nowhere else to put
   * a 40MB capture.
   */
  const chooseAsset = useCallback(
    (path, name, accept) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const stored = `${slug}/${name}.${ext}`;
        await putAsset(stored, file);
        patch(path, `/projects/${stored}`);
        setStatus(
          `Stored ${stored} (${(file.size / 1048576).toFixed(1)} MB). It is in the bundle whether or not you save.`,
        );
      };
      input.click();
    },
    [slug, patch],
  );

  const clearAsset = useCallback(
    path => {
      const src = getIn(record, path);
      if (src?.startsWith('/projects/')) {
        deleteAsset(src.replace('/projects/', '')).catch(() => {});
      }
      patch(path, '');
    },
    [record, patch],
  );

  // ── leaving ───────────────────────────────────────────────────────────────

  const save = useCallback(() => {
    if (!title || !record) return;
    mergeIntoDraft(title, record, site);
    // The baseline moves with it, so the bar reads clean and Discard now means
    // "back to what I just saved".
    setBaseline({ record: clone(record), site: clone(site) });
    setStatus('Saved to the studio draft. Export it from /studio to publish.');
  }, [title, record, site]);

  const discard = useCallback(() => {
    if (!baseline) return;
    setRecord(clone(baseline.record));
    setSite(clone(baseline.site));
    setRev(n => n + 1);
    setStatus('Back to the draft as it was.');
  }, [baseline]);

  const exit = useCallback(() => {
    if (dirty && !window.confirm('Leave editing? Unsaved changes are lost.')) {
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('edit');
    setParams(next, { replace: true });
  }, [dirty, params, setParams]);

  const openStudio = useCallback(() => {
    if (
      dirty &&
      !window.confirm('Open the studio? Unsaved changes are lost.')
    ) {
      return;
    }
    navigate('/studio');
  }, [dirty, navigate]);

  // The browser's own guard, for the ways out this page does not own.
  useEffect(() => {
    if (!editing || !dirty) return undefined;
    const onLeave = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [editing, dirty]);

  // An editing session is a working view of a page, not a page — it should not
  // be indexed, and the tab should say which one it is.
  useEffect(() => {
    if (!editing) return undefined;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.body.classList.add('is-editing');
    return () => {
      meta.remove();
      document.body.classList.remove('is-editing');
    };
  }, [editing]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(''), 6000);
    return () => clearTimeout(timer);
  }, [status]);

  return {
    editing,
    record: editing ? record : null,
    site,
    rev,
    dirty,
    changes,
    status,
    panel,
    setPanel,
    pathname,
    patch,
    patchSite,
    blockOps,
    itemOps,
    metaOps,
    splitPara,
    removePara,
    chooseAsset,
    clearAsset,
    save,
    discard,
    exit,
    openStudio,
  };
}
