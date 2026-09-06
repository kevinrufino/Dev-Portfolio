import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { goToSection } from '../utils/navigateToSection.js';
import { ProjectsData } from '../constants.js';
import { toSlug } from '../utils/helpers.js';
import { PROJECT_STORIES } from '../components/Project/projectStories.js';
import ProjectBlock from '../components/Project/ProjectBlocks.js';
import AssetSlot from '../components/Project/AssetSlot.js';

const COVER_CELL = 12;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const REVEAL_MS = 1100;
const REVEAL_DELAY_MS = 300;
// Where the "reading line" sits: the section crossing it owns the chapter bar.
// 0.3 rather than 0.5 because a heading feels current as soon as it is near the
// top of the viewport, not once it reaches the middle.
const READING_LINE = 0.3;
// Height of the sticky chapter bar, so a jumped-to section clears it.
const RAIL_H = 128;

const firstLink = project => {
  if (project.liveLink) return project.liveLink;
  const group = project.links?.[0];
  return group ? Object.values(group)[0] : null;
};

/**
 * A project case study.
 *
 * Charcoal, full-bleed, and long — the opposite of the index it comes from.
 * The page is assembled from an ordered `blocks` array per project, so a
 * flagship project can run context → process → decisions → payoff → impact →
 * reflection while a smaller one is a paragraph and a gallery, without either
 * needing its own template.
 *
 * Three scroll-driven affordances share one listener: the progress rule, the
 * cover's slow push-in, and the chapter bar's active state.
 */
const ProjectPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);

  const progressRef = useRef(null);
  const coverScaleRef = useRef(null);
  const ditherRef = useRef(null);
  const railRef = useRef(null);
  const rootRef = useRef(null);

  const index = ProjectsData.findIndex(p => toSlug(p.title) === slug);
  const project = index !== -1 ? ProjectsData[index] : null;
  const next = ProjectsData[(index + 1) % ProjectsData.length];
  const story = project ? PROJECT_STORIES[project.title] : null;
  const nextStory = next ? PROJECT_STORIES[next.title] : null;

  const blocks = useMemo(() => story?.blocks ?? [], [story]);

  useEffect(() => {
    if (!project) return;
    const display = story?.display || project.title;
    document.title = `${display} — Kevin Rufino`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [project, story]);

  // The cat belongs to the homepage. It is spawned by a global script, so it
  // is hidden here rather than removed — removing it would mean it never came
  // back when the reader returns to the index.
  useEffect(() => {
    const cat = document.getElementById('oneko');
    if (!cat) return undefined;
    const previous = cat.style.display;
    cat.style.display = 'none';
    return () => {
      cat.style.display = previous;
    };
  }, []);

  // Progress rule + cover push-in. One rAF-coalesced scroll listener for both:
  // they read the same scroll position and write only transforms and a width,
  // so there is no reason to pay for two.
  useEffect(() => {
    let raf = 0;
    const write = () => {
      raf = 0;
      const bar = progressRef.current;
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      if (bar) {
        const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
        bar.style.width = `${pct}%`;
      }
      const cover = coverScaleRef.current;
      if (cover) {
        const p = Math.min(
          1,
          window.scrollY / Math.max(1, window.innerHeight),
        );
        cover.style.transform = `scale(${1 + p * 0.09}) translate3d(0, ${p * 4}%, 0)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(write);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    write();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [project]);

  // Chapter bar: track the section owning the reading line, and scroll the bar
  // itself so the active chapter stays visible when it overflows on narrow
  // viewports — an indicator you have to scroll to see is not an indicator.
  useEffect(() => {
    if (!blocks.length) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const sections = [...(rootRef.current?.querySelectorAll('[data-sec]') || [])];
      if (!sections.length) return;
      const line = window.innerHeight * READING_LINE;
      let idx = 0;
      sections.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) idx = i;
      });
      setActive(current => (current === idx ? current : idx));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [blocks.length]);

  useEffect(() => {
    const bar = railRef.current;
    const link = bar?.querySelectorAll('a')[active];
    if (!bar || !link) return;
    bar.scrollTo({
      left: Math.max(0, link.offsetLeft - bar.clientWidth * READING_LINE),
      behavior: 'smooth',
    });
  }, [active]);

  // An ordered-dither curtain peels off the cover on load. Painted at one cell
  // per 12px rather than per pixel, so the whole reveal is a few thousand
  // writes into one reused ImageData.
  useEffect(() => {
    const canvas = ditherRef.current;
    if (!canvas) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      canvas.style.opacity = '0';
      return undefined;
    }

    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.ceil(box.width / COVER_CELL));
    const h = Math.max(1, Math.ceil(box.height / COVER_CELL));
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;

    // The gradient term makes the curtain retreat from the bottom-left, so it
    // uncovers the title before it uncovers the top of the image.
    const fill = p => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const local = p * 1.7 - ((1 - y / h) * 0.5 + (x / w) * 0.2);
          const keep = local < (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          d[i] = 0x20;
          d[i + 1] = 0x20;
          d[i + 2] = 0x20;
          d[i + 3] = keep ? 255 : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    fill(0);
    let raf = 0;
    const start = performance.now() + REVEAL_DELAY_MS;
    const frame = now => {
      const p = Math.min(1, Math.max(0, now - start) / REVEAL_MS);
      fill(p * p * (3 - 2 * p));
      if (p < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      canvas.style.opacity = '0';
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [project]);

  if (!project) {
    return (
      <main className='flex min-h-screen flex-col items-center justify-center gap-6 bg-charcoal px-6 text-charcoal-ink'>
        <h1 className='m-0 font-offbit101Bold text-[clamp(36px,6vw,72px)]'>
          No such project.
        </h1>
        <Link to='/' className='type-body text-acid underline'>
          ← selected work
        </Link>
      </main>
    );
  }

  const display = story?.display || project.title;
  const live = firstLink(project);
  const total = ProjectsData.length;

  return (
    <div ref={rootRef} className='relative bg-charcoal [overflow-x:clip]'>
      <div
        ref={progressRef}
        aria-hidden='true'
        className='fixed left-0 top-0 z-[60] h-[2px] w-0 bg-acid [will-change:width]'
      />

      <nav
        aria-label='Project navigation'
        className='pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-4 px-[clamp(16px,4vw,40px)] py-[14px] mix-blend-difference'
      >
        <button
          type='button'
          onClick={() => goToSection(navigate, '/projects', 'work')}
          className='pointer-events-auto border-0 bg-transparent px-[10px] py-2 font-offbit101Bold text-xl text-white'
        >
          ← selected work
        </button>
        {live && (
          <a
            href={live}
            target='_blank'
            rel='noreferrer'
            className='pointer-events-auto px-[10px] py-2 font-offbit101Bold text-xl text-white'
          >
            live ↗
          </a>
        )}
      </nav>

      <header className='relative h-[100svh] min-h-[560px] overflow-hidden bg-[#101014]'>
        <div ref={coverScaleRef} className='absolute inset-0 [will-change:transform]'>
          <AssetSlot
            src={project.scrapeGif}
            caption={story?.cover || `${display} — cover`}
            ratio='auto'
            className='h-full'
          />
        </div>
        <canvas
          ref={ditherRef}
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 h-full w-full [image-rendering:pixelated]'
        />
        <div
          aria-hidden='true'
          className='absolute inset-0'
          style={{
            background:
              'linear-gradient(to top,rgba(16,16,20,.94) 0%,rgba(16,16,20,.72) 34%,rgba(16,16,20,.12) 72%,rgba(16,16,20,.28) 100%)',
          }}
        />
        <div className='absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-8 px-[clamp(24px,6vw,88px)] pb-[clamp(34px,6vh,64px)]'>
          <div className='min-w-0'>
            <p className='type-label m-0 mb-[18px] text-acid'>
              {project.client === 'Passion Project'
                ? 'Personal project'
                : 'Selected work'}
            </p>
            <h1 className='m-0 mb-5 font-offbit101Bold text-[clamp(52px,10vw,168px)] leading-[.86] tracking-[-.02em] text-white [text-wrap:balance]'>
              {display}
            </h1>
            <p className='type-body m-0 max-w-[46ch] text-[clamp(17px,1.5vw,21px)] leading-[1.6] text-[#dcddd7]'>
              {story?.tagline || project.description}
            </p>
          </div>
          <p className='type-label m-0 whitespace-nowrap text-[#c8c9c3]'>
            {String(index + 1).padStart(2, '0')} /{' '}
            {String(total).padStart(2, '0')}
          </p>
        </div>
      </header>

      {/* The top padding keeps the chapter links clear of the fixed nav, which
          floats over this bar once it sticks. The bar's charcoal ground runs up
          behind the nav so the two read as one header rather than as two things
          fighting over the same line. */}
      {blocks.length > 0 && (
        <div
          ref={railRef}
          data-chapters=''
          className='sticky top-0 z-40 overflow-x-auto overflow-y-hidden border-b border-[#3a3a36] bg-charcoal pt-[76px]'
        >
          <div className='flex min-w-max items-stretch px-[clamp(24px,6vw,88px)]'>
            {blocks.map((b, i) => (
              <a
                key={b.title}
                href={`#sec-${i}`}
                className='mr-[22px] flex items-center gap-[9px] whitespace-nowrap border-b-2 py-[14px] pr-[22px] transition-colors duration-200'
                style={{
                  borderColor: i === active ? '#F1F43B' : 'transparent',
                }}
              >
                <span
                  className='type-label text-[11px] tracking-[.24em]'
                  style={{ color: i === active ? '#F1F43B' : '#6e6f69' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className='type-label text-[11px] tracking-[.24em]'
                  style={{ color: i === active ? '#F1F43B' : '#a8a9a3' }}
                >
                  {b.title}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {story?.meta && (
        <section
          aria-label='Project metadata'
          className='border-b border-[#3a3a36] bg-charcoal'
        >
          <div className='grid gap-px bg-[#3a3a36] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]'>
            {story.meta.map(m => (
              <div
                key={m.k}
                className='bg-charcoal px-[clamp(20px,2.6vw,34px)] py-[clamp(24px,3.4vw,42px)]'
              >
                <p className='type-label m-0 mb-[14px] text-acid'>{m.k}</p>
                <p className='type-body m-0 text-base leading-[1.6] text-[#e2e3dd]'>
                  {m.v}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <main className='bg-charcoal text-[#e2e3dd]'>
        {blocks.map((block, i) => (
          <ProjectBlock
            key={block.title}
            block={block}
            num={String(i + 1).padStart(2, '0')}
            id={`sec-${i}`}
          />
        ))}
      </main>

      <footer className='relative overflow-hidden bg-acid text-charcoal'>
        <div className='relative z-[1] px-[clamp(24px,6vw,88px)] pb-[clamp(28px,4vh,44px)] pt-[clamp(56px,10vh,120px)]'>
          <p className='type-label m-0 mb-6 text-[#4c4d16]'>Next project</p>
          <Link
            to={`/projects/${toSlug(next.title)}`}
            className='m-0 mb-5 inline-block font-offbit101Bold text-[clamp(38px,7vw,110px)] leading-[.9] tracking-[-.02em] text-charcoal'
          >
            {nextStory?.display || next.title} →
          </Link>
          <p className='type-body m-0 max-w-[44ch] text-[17px] leading-[1.65] text-[#3a3b10]'>
            {nextStory?.tagline || next.description}
          </p>
          <nav
            aria-label='Elsewhere'
            className='mt-[clamp(38px,5vh,58px)] flex flex-wrap gap-x-[34px] gap-y-[14px]'
          >
            <button
              type='button'
              onClick={() => goToSection(navigate, '/projects', 'work')}
              className='type-body border-0 border-b border-[#adaf3d] bg-transparent py-[6px] text-lg text-charcoal'
            >
              All work
            </button>
            <a
              href='mailto:kevinrufino97@gmail.com'
              className='type-body border-b border-[#adaf3d] py-[6px] text-lg text-charcoal'
            >
              Email ↗
            </a>
            <a
              href='https://www.linkedin.com/in/kevinrufino/'
              target='_blank'
              rel='noreferrer'
              className='type-body border-b border-[#adaf3d] py-[6px] text-lg text-charcoal'
            >
              LinkedIn ↗
            </a>
          </nav>
        </div>
        <div
          aria-hidden='true'
          className='mx-[clamp(24px,6vw,88px)] h-px bg-[#adaf3d]'
        />
        <div className='type-label flex items-center justify-between gap-4 px-[clamp(24px,6vw,88px)] py-[18px] tracking-[.2em] text-[#4c4d16]'>
          <span>Designed and developed by Kevin Rufino</span>
          <button
            type='button'
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className='p-[5px] text-[#4c4d16]'
          >
            Back to top ↑
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ProjectPage;
