import PropTypes from 'prop-types';
import {
  ARCHIVE_FIELDS,
  DEFAULT_PROJECT_NOTICE,
  SHAPES,
} from '../../../utils/studioDraft.js';

/**
 * The one piece of chrome an editing session gets.
 *
 * Everything else about editing happens in the page itself — that is the point
 * of editing on the page — so this is only what has nowhere in the page to be:
 * whether there are unsaved changes, the two buttons that resolve them, and
 * the fields that describe the project without appearing on it.
 *
 * Those fields are in drawers rather than on the page for the same reason. A
 * project's list, its glyph, its one-line summary and its client/role/year are
 * how it looks in the works index, and the works index is somewhere else. The
 * site settings are in the last drawer, marked as what they are: a switch there
 * changes every project page at once, and finding that out afterwards would be
 * a bad surprise on a bar that otherwise only ever affects one project.
 */

const PANELS = [
  { key: 'index', label: 'Index entry' },
  { key: 'site', label: 'Site' },
];

const Row = ({ label, hint, children }) => (
  <label className='pedit-field'>
    <span>
      {label}
      {hint && <em>{hint}</em>}
    </span>
    {children}
  </label>
);

Row.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  children: PropTypes.node,
};

const EditBar = ({ edit, title, slug }) => {
  const {
    record,
    site,
    changes,
    dirty,
    aheadOfPublished,
    status,
    panel,
    setPanel,
  } = edit;
  const notice = site?.projectNotice || {};
  const set = (key, value) => edit.patch(['index', key], value);

  return (
    <div className='pedit-bar' contentEditable={false}>
      <div className='pedit-bar__line'>
        <span className='pedit-bar__tag'>Editing</span>
        <strong>{record.display || title}</strong>
        <code>/projects/{slug}</code>
        <span className='pedit-bar__count' data-dirty={dirty ? '' : undefined}>
          {dirty
            ? `${changes} unsaved change${changes === 1 ? '' : 's'}`
            : 'no unsaved changes'}
        </span>

        {PANELS.map(p => (
          <button
            key={p.key}
            type='button'
            aria-pressed={panel === p.key}
            className={panel === p.key ? 'is-on' : undefined}
            onClick={() => setPanel(panel === p.key ? null : p.key)}
          >
            {p.label}
          </button>
        ))}

        <button
          type='button'
          className='pedit-primary'
          disabled={!dirty}
          onClick={edit.save}
        >
          Save to studio
        </button>
        <button type='button' disabled={!dirty} onClick={edit.discard}>
          Discard
        </button>
        <button type='button' onClick={edit.openStudio}>
          Studio ↗
        </button>
        <button type='button' onClick={edit.exit}>
          Done
        </button>
      </div>

      {/* The editor loads a saved draft in preference to what is published,
          which is the point of a draft and was also invisible. A draft made
          before the case studies were rewritten opened a page with one empty
          block against the four that were live, under a bar reading "no
          unsaved changes" — true of the session, wildly untrue of the page.
          So when the two disagree, the bar says so and offers the way back. */}
      {aheadOfPublished &&
        (edit.showingPublished ? (
          <p className='pedit-bar__stale'>
            <strong>Showing what the site publishes.</strong> The saved draft
            for this project is still in this browser — press Save to replace
            it.
          </p>
        ) : (
          <p className='pedit-bar__stale'>
            <strong>This is a saved draft, not what the site publishes.</strong>{' '}
            It was loaded from this browser and differs from the live page — an
            old draft looks exactly like a page with less on it.
            <button type='button' onClick={edit.resetToPublished}>
              Reset to published
            </button>
          </p>
        ))}

      {/* Said once, on the bar, rather than left to be worked out: this page
          is rendering a working copy, and saving moves it one step along a
          pipeline that still ends in a commit. */}
      <p className='pedit-bar__note'>
        {status ||
          'This page is showing your working copy. Save puts it in the studio draft; publishing is still export → npm run studio:apply → commit.'}
      </p>

      {panel === 'index' && (
        <div className='pedit-panel'>
          <p className='pedit-panel__head'>
            How this project appears in the works index — none of it is on this
            page.
          </p>
          <div className='pedit-panel__grid'>
            <Row label='List'>
              <select
                value={record.index.category}
                onChange={e => set('category', e.target.value)}
              >
                <option value='work'>Work</option>
                <option value='personal'>Personal</option>
              </select>
            </Row>
            <Row label='Glyph shape' hint='used when there is no loop'>
              <select
                value={record.index.shape}
                onChange={e => set('shape', e.target.value)}
              >
                {SHAPES.map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Row>
            <Row label='Glyph loop' hint='two-tone video'>
              <span className='pedit-file'>
                <code>{record.index.glyphSrc || 'generating the shape'}</code>
                <button
                  type='button'
                  onClick={() =>
                    edit.chooseAsset(
                      ['index', 'glyphSrc'],
                      'glyph',
                      'video/mp4,video/webm,video/quicktime',
                    )
                  }
                >
                  upload
                </button>
                {record.index.glyphSrc && (
                  <button
                    type='button'
                    onClick={() => edit.clearAsset(['index', 'glyphSrc'])}
                  >
                    clear
                  </button>
                )}
              </span>
            </Row>
          </div>

          <Row label='One-line summary' hint='shown in the works pane'>
            <textarea
              rows='2'
              value={record.index.summary}
              onChange={e => set('summary', e.target.value)}
            />
          </Row>

          <div className='pedit-panel__grid'>
            {ARCHIVE_FIELDS.map(({ key, label, hint }) => (
              <Row key={key} label={label} hint={hint}>
                <input
                  value={record.archive[key]}
                  onChange={e => edit.patch(['archive', key], e.target.value)}
                />
              </Row>
            ))}
          </div>

          <label className='pedit-check'>
            <input
              type='checkbox'
              checked={Boolean(record.index.comingSoon)}
              onChange={e => set('comingSoon', e.target.checked)}
            />
            <span>
              Coming soon
              <em>the index reads “Coming soon” instead of linking here</em>
            </span>
          </label>

          {/* Toggled here as well as in the studio because it is a decision
              about this project, and this is where you are standing when you
              decide a page is not the right shape for it. */}
          <label className='pedit-check'>
            <input
              type='checkbox'
              checked={Boolean(record.index.liveOnly)}
              onChange={e => set('liveOnly', e.target.checked)}
            />
            <span>
              No project page
              <em>
                the index links straight to the live site and this page stops
                resolving once the bundle is applied
              </em>
            </span>
          </label>
          {record.index.liveOnly && (
            <p className='pedit-warn'>
              {record.archive.liveLink
                ? `The index will send readers to ${record.archive.liveLink}. What you write below stays in the draft, unpublished.`
                : 'There is no live link set above, so the index row would have nowhere to go.'}
            </p>
          )}
        </div>
      )}

      {panel === 'site' && (
        <div className='pedit-panel'>
          <p className='pedit-panel__head'>
            These apply to every project at once — including ones you have not
            opened, and ones added later.
          </p>
          <label className='pedit-check'>
            <input
              type='checkbox'
              checked={Boolean(notice.enabled)}
              onChange={e =>
                edit.patchSite(['projectNotice', 'enabled'], e.target.checked)
              }
            />
            <span>
              Hold every project page
              <em>
                hides the chapter bar, the metadata table and every block, on
                every project page
              </em>
            </span>
          </label>
          <Row label='Notice' hint='shown under the cover instead'>
            <input
              value={notice.text || ''}
              placeholder={DEFAULT_PROJECT_NOTICE}
              onChange={e =>
                edit.patchSite(['projectNotice', 'text'], e.target.value)
              }
            />
          </Row>
          {notice.enabled && (
            <p className='pedit-warn'>
              The hold is on, so what you are editing below is not what a reader
              sees on any project page. Editing ignores it; publishing does not.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

EditBar.propTypes = {
  edit: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
};

export default EditBar;
