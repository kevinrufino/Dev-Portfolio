import PropTypes from 'prop-types';
import AssetSlot from './AssetSlot.js';
import useCountUp from './useCountUp.js';

/**
 * The block types a case study is assembled from.
 *
 * Every block shares the same two-column head — a numbered label and a title on
 * the left, the block's own content on the right — so a page made of five
 * different block types still reads as one document. Only what hangs below that
 * head changes per type.
 */

const BlockHead = ({ num, label, title, note }) => (
  <div>
    <p className='type-label m-0 mb-4 text-acid'>
      {num} — {label}
    </p>
    <h2 className='m-0 font-offbit101Bold text-[clamp(30px,4.2vw,60px)] leading-[.98] tracking-[-.015em] text-white [text-wrap:balance]'>
      {title}
    </h2>
    {note && (
      <p className='type-body mt-5 max-w-[38ch] text-sm leading-[1.6] text-[#a8a9a3]'>
        {note}
      </p>
    )}
  </div>
);

BlockHead.propTypes = {
  num: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  note: PropTypes.string,
};

const Paragraphs = ({ paras, pull }) => (
  <div className='min-w-0'>
    {paras?.length > 0 && (
      <div className='flex max-w-[62ch] flex-col gap-5'>
        {paras.map(text => (
          <p
            key={text.slice(0, 40)}
            className='type-body m-0 text-[clamp(16px,1.2vw,18px)] text-[#dcddd7]'
          >
            {text}
          </p>
        ))}
      </div>
    )}
    {pull && (
      <p className='m-0 mt-[clamp(28px,4vh,42px)] max-w-[26ch] font-offbit101Bold text-[clamp(24px,2.6vw,38px)] leading-[1.14] text-acid [text-wrap:balance]'>
        {pull}
      </p>
    )}
  </div>
);

Paragraphs.propTypes = {
  paras: PropTypes.arrayOf(PropTypes.string),
  pull: PropTypes.string,
};

const AssetGrid = ({ items }) => (
  <div className='mt-[clamp(30px,5vh,58px)] grid grid-cols-1 gap-[clamp(12px,1.4vw,20px)] md:grid-cols-12'>
    {items.map(item => (
      <figure
        key={item.caption}
        className='m-0 min-w-0 md:[grid-column:span_var(--span)]'
        style={{ '--span': item.span }}
      >
        <AssetSlot src={item.src} caption={item.caption} ratio={item.ratio} />
        <figcaption className='type-body mt-[10px] text-[13px] leading-[1.5] text-[#a8a9a3]'>
          {item.caption}
        </figcaption>
      </figure>
    ))}
  </div>
);

AssetGrid.propTypes = { items: PropTypes.array.isRequired };

/**
 * A decision, framed as what was chosen against what was passed on.
 *
 * The two columns are deliberately asymmetric — the choice gets an acid rule,
 * the rejected option a grey one — because a case study that presents both
 * neutrally reads as indecision rather than judgement.
 */
const Moment = ({ item }) => (
  <article className='grid grid-cols-1 gap-[clamp(20px,4vw,70px)] border-b border-[#3a3a36] py-[clamp(26px,4vh,44px)] lg:[grid-template-columns:minmax(0,5fr)_minmax(0,7fr)]'>
    <div>
      <p className='type-label m-0 mb-4 inline-block bg-acid px-[10px] py-[6px] text-[10px] tracking-[.28em] text-charcoal'>
        {item.kind}
      </p>
      <h3 className='m-0 font-offbit101Bold text-[clamp(21px,2.1vw,30px)] leading-[1.1] text-white [text-wrap:balance]'>
        {item.title}
      </h3>
    </div>
    <div className='min-w-0'>
      <p className='type-body m-0 mb-[26px] max-w-[58ch] text-base leading-[1.72] text-[#dcddd7]'>
        {item.body}
      </p>
      <div className='mb-6 grid grid-cols-1 gap-[clamp(14px,2vw,26px)] sm:grid-cols-2'>
        <div className='border-t-2 border-acid pt-[14px]'>
          <p className='type-label m-0 mb-[10px] text-[10px] tracking-[.26em] text-acid'>
            {item.chose.k}
          </p>
          <p className='type-body m-0 text-[15px] leading-[1.65] text-[#e8e9e3]'>
            {item.chose.v}
          </p>
        </div>
        <div className='border-t-2 border-[#4a4a45] pt-[14px]'>
          <p className='type-label m-0 mb-[10px] text-[10px] tracking-[.26em] text-[#a8a9a3]'>
            {item.passed.k}
          </p>
          <p className='type-body m-0 text-[15px] leading-[1.65] text-[#a8a9a3]'>
            {item.passed.v}
          </p>
        </div>
      </div>
      <p className='type-body m-0 max-w-[58ch] text-[15px] font-medium leading-[1.7] text-acid'>
        {item.call}
      </p>
    </div>
  </article>
);

Moment.propTypes = { item: PropTypes.object.isRequired };

const ImpactFigure = ({ item }) => {
  const decimals = String(item.n).includes('.') ? 1 : 0;
  const suffix = item.suffix || '';
  const ref = useCountUp(item.n, decimals, suffix);

  return (
    <div className='bg-charcoal px-[clamp(20px,3vw,34px)] pb-[clamp(10px,2vw,20px)] pr-[clamp(20px,3vw,44px)] pt-[clamp(24px,3vw,38px)]'>
      <p
        ref={ref}
        className='m-0 mb-4 font-offbit101Bold text-[clamp(46px,6.4vw,96px)] leading-[.94] tracking-[-.02em] text-acid'
      >
        {item.n.toFixed(decimals)}
        {suffix}
      </p>
      <p className='type-body m-0 mb-[6px] text-base font-medium leading-[1.5] text-white'>
        {item.k}
      </p>
      {item.note && (
        <p className='type-body m-0 text-[13px] leading-[1.55] text-[#a8a9a3]'>
          {item.note}
        </p>
      )}
    </div>
  );
};

ImpactFigure.propTypes = { item: PropTypes.object.isRequired };

const ProjectBlock = ({ block, num, id }) => (
  <section
    id={id}
    data-sec=''
    className='border-b border-[#3a3a36] px-[clamp(24px,6vw,88px)] py-[clamp(48px,8vh,104px)] [scroll-margin-top:128px]'
  >
    <div className='grid grid-cols-1 items-start gap-[clamp(26px,4vw,70px)] lg:[grid-template-columns:minmax(0,5fr)_minmax(0,7fr)]'>
      <BlockHead
        num={num}
        label={block.label}
        title={block.title}
        note={block.note}
      />
      <Paragraphs paras={block.paras} pull={block.pull} />
    </div>

    {block.type === 'assets' && <AssetGrid items={block.items} />}

    {block.type === 'moments' && (
      <div className='mt-[clamp(30px,5vh,58px)] border-t border-[#3a3a36]'>
        {block.items.map(item => (
          <Moment key={item.title} item={item} />
        ))}
      </div>
    )}

    {block.type === 'impact' && (
      <div className='mt-[clamp(30px,5vh,58px)] grid grid-cols-1 gap-px bg-[#3a3a36] sm:grid-cols-2 lg:grid-cols-3'>
        {block.items.map(item => (
          <ImpactFigure key={item.k} item={item} />
        ))}
      </div>
    )}
  </section>
);

ProjectBlock.propTypes = {
  block: PropTypes.object.isRequired,
  num: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
};

export default ProjectBlock;
