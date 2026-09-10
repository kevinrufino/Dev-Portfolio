import PropTypes from 'prop-types';
import AssetSlot from './AssetSlot.js';
import RollingNumber from '../common/RollingNumber.js';
import { Editable, EditRail, useEdit } from './edit/EditContext.js';
import { BLOCK_TYPES, RATIOS, blankBlock } from '../../utils/studioDraft.js';

/**
 * The block types a case study is assembled from.
 *
 * Every block shares the same two-column head — a numbered label and a title on
 * the left, the block's own content on the right — so a page made of five
 * different block types still reads as one document. Only what hangs below that
 * head changes per type.
 *
 * Each piece of text is wrapped in `Editable`, which is a no-op — the same tag
 * with the same classes and the same string — on every page that is not being
 * edited. The alternative was a second set of components for the editor, which
 * would have meant a case study could look one way while being written and
 * another way once published, and the whole reason to edit on the page is that
 * those two are the same thing.
 */

/** Where in the working record this block's fields live. */
const at = (i, ...rest) => ['blocks', i, ...rest];

const BlockHead = ({ num, label, title, note, i }) => {
  const edit = useEdit();
  return (
    <div>
      <p className='type-label m-0 mb-4 text-acid'>
        {num} —{' '}
        <Editable as='span' path={at(i, 'label')} placeholder='Eyebrow'>
          {label}
        </Editable>
      </p>
      <Editable
        as='h2'
        path={at(i, 'title')}
        placeholder='Heading'
        className='m-0 font-offbit101Bold text-[clamp(30px,4.2vw,60px)] leading-[.98] tracking-[-.015em] text-white [text-wrap:balance]'
      >
        {title}
      </Editable>
      {/* An empty note is nothing on a published page and a place to write one
          while editing. */}
      {(note || edit) && (
        <Editable
          as='p'
          path={at(i, 'note')}
          placeholder='Small print under the heading'
          className='type-body mt-5 max-w-[38ch] text-sm leading-[1.6] text-[#a8a9a3]'
        >
          {note}
        </Editable>
      )}
    </div>
  );
};

BlockHead.propTypes = {
  num: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  note: PropTypes.string,
  i: PropTypes.number.isRequired,
};

const Paragraphs = ({ paras, pull, i }) => {
  const edit = useEdit();
  const list = edit ? paras || [''] : paras;
  return (
    <div className='min-w-0'>
      {list?.length > 0 && (
        <div className='flex max-w-[62ch] flex-col gap-5'>
          {list.map((text, j) => (
            <Editable
              // The index rather than the text: a paragraph being typed into
              // changes on every keystroke, and keying on its content would
              // remount the field — and drop the caret — on each one.
              key={j}
              as='p'
              path={at(i, 'paras', j)}
              multiline
              placeholder='Write a paragraph. Enter starts a new one.'
              onEnter={(before, after) => edit.splitPara(i, j, before, after)}
              onEmptyBackspace={
                list.length > 1 ? () => edit.removePara(i, j) : undefined
              }
              className='type-body m-0 text-[clamp(16px,1.2vw,18px)] text-[#dcddd7]'
            >
              {text}
            </Editable>
          ))}
        </div>
      )}
      {(pull || edit) && (
        <Editable
          as='p'
          path={at(i, 'pull')}
          placeholder='Pull quote'
          className='m-0 mt-[clamp(28px,4vh,42px)] max-w-[26ch] font-offbit101Bold text-[clamp(24px,2.6vw,38px)] leading-[1.14] text-acid [text-wrap:balance]'
        >
          {pull}
        </Editable>
      )}
    </div>
  );
};

Paragraphs.propTypes = {
  paras: PropTypes.arrayOf(PropTypes.string),
  pull: PropTypes.string,
  i: PropTypes.number.isRequired,
};

/**
 * A slot's own controls: the file in it, and how much of the row it takes.
 *
 * Span and ratio are the two things about a figure that cannot be judged from
 * a form — whether an image wants half the row or all of it is a question about
 * this image, next to these other ones — so they are set here, where the answer
 * is visible, rather than as numbers in the studio.
 */
const AssetControls = ({ i, j, item, count }) => {
  const edit = useEdit();
  if (!edit) return null;
  const path = at(i, 'items', j);
  return (
    <EditRail
      actions={[
        {
          label: item.src ? 'replace' : 'upload',
          run: () => edit.chooseAsset([...path, 'src'], `${i}-${j}`),
        },
        ...(item.src
          ? [{ label: 'clear', run: () => edit.clearAsset([...path, 'src']) }]
          : []),
        {
          label: '−',
          title: 'Narrower',
          disabled: item.span <= 1,
          run: () => edit.patch([...path, 'span'], Math.max(1, item.span - 1)),
        },
        {
          label: `${item.span}/12`,
          title: 'Columns of twelve',
          run: () => edit.patch([...path, 'span'], item.span >= 12 ? 4 : 12),
        },
        {
          label: '+',
          title: 'Wider',
          disabled: item.span >= 12,
          run: () => edit.patch([...path, 'span'], Math.min(12, item.span + 1)),
        },
        {
          label: item.ratio,
          title: 'Aspect ratio',
          run: () => {
            const next =
              RATIOS[(RATIOS.indexOf(item.ratio) + 1) % RATIOS.length];
            edit.patch([...path, 'ratio'], next);
          },
        },
        {
          label: '↑',
          disabled: j === 0,
          run: () => edit.itemOps.move(i, j, -1),
        },
        {
          label: '↓',
          disabled: j === count - 1,
          run: () => edit.itemOps.move(i, j, 1),
        },
        { label: '✕', danger: true, run: () => edit.itemOps.remove(i, j) },
      ]}
    />
  );
};

AssetControls.propTypes = {
  i: PropTypes.number.isRequired,
  j: PropTypes.number.isRequired,
  item: PropTypes.object.isRequired,
  count: PropTypes.number.isRequired,
};

const AssetGrid = ({ items, i }) => {
  const edit = useEdit();
  return (
    <>
      <div className='mt-[clamp(30px,5vh,58px)] grid grid-cols-1 gap-[clamp(12px,1.4vw,20px)] md:grid-cols-12'>
        {items.map((item, j) => (
          <figure
            key={edit ? j : item.caption}
            className={`m-0 min-w-0 md:[grid-column:span_var(--span)] ${edit ? 'pedit-host' : ''}`.trim()}
            style={{ '--span': item.span }}
          >
            <div className={edit ? 'pedit-slot' : undefined}>
              <AssetControls i={i} j={j} item={item} count={items.length} />
              <AssetSlot
                src={item.src}
                caption={item.caption}
                ratio={item.ratio}
              />
            </div>
            <Editable
              as='figcaption'
              path={at(i, 'items', j, 'caption')}
              placeholder='Caption'
              className='type-body mt-[10px] text-[13px] leading-[1.5] text-[#a8a9a3]'
            >
              {item.caption}
            </Editable>
          </figure>
        ))}
      </div>
      {edit && (
        <button
          type='button'
          className='pedit-add mt-3'
          onClick={() =>
            edit.itemOps.add(i, { caption: '', span: 6, ratio: '16 / 10' })
          }
        >
          + figure
        </button>
      )}
    </>
  );
};

AssetGrid.propTypes = {
  items: PropTypes.array.isRequired,
  i: PropTypes.number.isRequired,
};

/**
 * A decision, framed as what was chosen against what was passed on.
 *
 * The two columns are deliberately asymmetric — the choice gets an acid rule,
 * the rejected option a grey one — because a case study that presents both
 * neutrally reads as indecision rather than judgement.
 */
const Moment = ({ item, i, j, count }) => {
  const edit = useEdit();
  const path = (...rest) => at(i, 'items', j, ...rest);
  return (
    <article
      className={`grid grid-cols-1 gap-[clamp(20px,4vw,70px)] border-b border-[#3a3a36] py-[clamp(26px,4vh,44px)] lg:[grid-template-columns:minmax(0,5fr)_minmax(0,7fr)] ${edit ? 'pedit-host' : ''}`.trim()}
    >
      <div>
        <Editable
          as='p'
          path={path('kind')}
          placeholder='Chip'
          className='type-label m-0 mb-4 inline-block bg-acid px-[10px] py-[6px] text-[10px] tracking-[.28em] text-charcoal'
        >
          {item.kind}
        </Editable>
        <Editable
          as='h3'
          path={path('title')}
          placeholder='What was decided'
          className='m-0 font-offbit101Bold text-[clamp(21px,2.1vw,30px)] leading-[1.1] text-white [text-wrap:balance]'
        >
          {item.title}
        </Editable>
        {edit && (
          <EditRail
            className='pedit-rail--inline'
            actions={[
              {
                label: '↑',
                disabled: j === 0,
                run: () => edit.itemOps.move(i, j, -1),
              },
              {
                label: '↓',
                disabled: j === count - 1,
                run: () => edit.itemOps.move(i, j, 1),
              },
              {
                label: '✕',
                danger: true,
                run: () => edit.itemOps.remove(i, j),
              },
            ]}
          />
        )}
      </div>
      <div className='min-w-0'>
        <Editable
          as='p'
          path={path('body')}
          placeholder='What the tension was'
          className='type-body m-0 mb-[26px] max-w-[58ch] text-base leading-[1.72] text-[#dcddd7]'
        >
          {item.body}
        </Editable>
        <div className='mb-6 grid grid-cols-1 gap-[clamp(14px,2vw,26px)] sm:grid-cols-2'>
          <div className='border-t-2 border-acid pt-[14px]'>
            <Editable
              as='p'
              path={path('chose', 'k')}
              className='type-label m-0 mb-[10px] text-[10px] tracking-[.26em] text-acid'
            >
              {item.chose.k}
            </Editable>
            <Editable
              as='p'
              path={path('chose', 'v')}
              placeholder='What was chosen'
              className='type-body m-0 text-[15px] leading-[1.65] text-[#e8e9e3]'
            >
              {item.chose.v}
            </Editable>
          </div>
          <div className='border-t-2 border-[#4a4a45] pt-[14px]'>
            <Editable
              as='p'
              path={path('passed', 'k')}
              className='type-label m-0 mb-[10px] text-[10px] tracking-[.26em] text-[#a8a9a3]'
            >
              {item.passed.k}
            </Editable>
            <Editable
              as='p'
              path={path('passed', 'v')}
              placeholder='What was passed on'
              className='type-body m-0 text-[15px] leading-[1.65] text-[#a8a9a3]'
            >
              {item.passed.v}
            </Editable>
          </div>
        </div>
        <Editable
          as='p'
          path={path('call')}
          placeholder='So what'
          className='type-body m-0 max-w-[58ch] text-[15px] font-medium leading-[1.7] text-acid'
        >
          {item.call}
        </Editable>
      </div>
    </article>
  );
};

Moment.propTypes = {
  item: PropTypes.object.isRequired,
  i: PropTypes.number.isRequired,
  j: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
};

const ImpactFigure = ({ item, i, j, count }) => {
  const edit = useEdit();
  const decimals = String(item.n).includes('.') ? 1 : 0;
  const suffix = item.suffix || '';
  const path = (...rest) => at(i, 'items', j, ...rest);

  return (
    <div
      className={`bg-charcoal px-[clamp(20px,3vw,34px)] pb-[clamp(10px,2vw,20px)] pr-[clamp(20px,3vw,44px)] pt-[clamp(24px,3vw,38px)] ${edit ? 'pedit-host' : ''}`.trim()}
    >
      <p className='m-0 mb-4 font-offbit101Bold text-[clamp(46px,6.4vw,96px)] leading-[.94] tracking-[-.02em] text-acid'>
        {edit ? (
          // A number you cannot type into is not editable, and an odometer is
          // exactly that. While editing it is the figure itself, at the same
          // size it will roll at.
          <>
            <Editable as='span' path={path('n')} numeric placeholder='0'>
              {item.n}
            </Editable>
            <Editable as='span' path={path('suffix')} placeholder='%'>
              {suffix}
            </Editable>
          </>
        ) : (
          /* The same roll the loader turns. The figure counts from zero when
             it first reaches the reader, and the digits arrive from below as
             they change rather than being rewritten in place. */
          <RollingNumber
            value={item.n}
            decimals={decimals}
            suffix={suffix}
            countOnView
          />
        )}
      </p>
      <Editable
        as='p'
        path={path('k')}
        placeholder='What it measures'
        className='type-body m-0 mb-[6px] text-base font-medium leading-[1.5] text-white'
      >
        {item.k}
      </Editable>
      {(item.note || edit) && (
        <Editable
          as='p'
          path={path('note')}
          placeholder='Where it comes from'
          className='type-body m-0 text-[13px] leading-[1.55] text-[#a8a9a3]'
        >
          {item.note}
        </Editable>
      )}
      {edit && (
        <EditRail
          className='pedit-rail--inline'
          actions={[
            {
              label: '↑',
              disabled: j === 0,
              run: () => edit.itemOps.move(i, j, -1),
            },
            {
              label: '↓',
              disabled: j === count - 1,
              run: () => edit.itemOps.move(i, j, 1),
            },
            { label: '✕', danger: true, run: () => edit.itemOps.remove(i, j) },
          ]}
        />
      )}
    </div>
  );
};

ImpactFigure.propTypes = {
  item: PropTypes.object.isRequired,
  i: PropTypes.number.isRequired,
  j: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
};

/** Type, order and existence — the three things about a block that are not text. */
const BlockRail = ({ i, block, count }) => {
  const edit = useEdit();
  if (!edit) return null;
  return (
    <div className='pedit-rail pedit-rail--block' contentEditable={false}>
      <select
        value={block.type}
        aria-label='Block type'
        onChange={e => edit.blockOps.setType(i, e.target.value)}
      >
        {BLOCK_TYPES.map(t => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        type='button'
        disabled={i === 0}
        title='Move up'
        onClick={() => edit.blockOps.move(i, -1)}
      >
        ↑
      </button>
      <button
        type='button'
        disabled={i === count - 1}
        title='Move down'
        onClick={() => edit.blockOps.move(i, 1)}
      >
        ↓
      </button>
      <button
        type='button'
        title='Add a block below'
        onClick={() => edit.blockOps.add(i + 1)}
      >
        + below
      </button>
      <button
        type='button'
        className='is-danger'
        title='Delete this block'
        onClick={() => edit.blockOps.remove(i)}
      >
        ✕
      </button>
    </div>
  );
};

BlockRail.propTypes = {
  i: PropTypes.number.isRequired,
  block: PropTypes.object.isRequired,
  count: PropTypes.number.isRequired,
};

const ProjectBlock = ({ block, num, id, i = 0, count = 1 }) => {
  const edit = useEdit();
  const items = block.items || [];
  return (
    <section
      id={id}
      data-sec=''
      className={`border-b border-[#3a3a36] px-[clamp(24px,6vw,88px)] py-[clamp(48px,8vh,104px)] [scroll-margin-top:128px] ${edit ? 'pedit-host' : ''}`.trim()}
    >
      <BlockRail i={i} block={block} count={count} />

      <div className='grid grid-cols-1 items-start gap-[clamp(26px,4vw,70px)] lg:[grid-template-columns:minmax(0,5fr)_minmax(0,7fr)]'>
        <BlockHead
          num={num}
          label={block.label}
          title={block.title}
          note={block.note}
          i={i}
        />
        <Paragraphs paras={block.paras} pull={block.pull} i={i} />
      </div>

      {block.type === 'assets' && <AssetGrid items={items} i={i} />}

      {block.type === 'moments' && (
        <div className='mt-[clamp(30px,5vh,58px)] border-t border-[#3a3a36]'>
          {items.map((item, j) => (
            <Moment
              key={edit ? j : item.title}
              item={item}
              i={i}
              j={j}
              count={items.length}
            />
          ))}
          {edit && (
            <button
              type='button'
              className='pedit-add mt-3'
              onClick={() =>
                edit.itemOps.add(i, blankBlock('moments').items[0])
              }
            >
              + decision
            </button>
          )}
        </div>
      )}

      {block.type === 'impact' && (
        <>
          <div className='mt-[clamp(30px,5vh,58px)] grid grid-cols-1 gap-px bg-[#3a3a36] sm:grid-cols-2 lg:grid-cols-3'>
            {items.map((item, j) => (
              <ImpactFigure
                key={edit ? j : item.k}
                item={item}
                i={i}
                j={j}
                count={items.length}
              />
            ))}
          </div>
          {edit && (
            <button
              type='button'
              className='pedit-add mt-3'
              onClick={() =>
                edit.itemOps.add(i, { n: 0, suffix: '', k: '', note: '' })
              }
            >
              + figure
            </button>
          )}
        </>
      )}
    </section>
  );
};

ProjectBlock.propTypes = {
  block: PropTypes.object.isRequired,
  num: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  i: PropTypes.number,
  count: PropTypes.number,
};

export default ProjectBlock;
