import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { WORKS, WORK_CATEGORIES } from './worksData.js';
import { THEMES, WORKS_RANGE } from './themes.js';
import { createWorkGlyph } from './workGlyph.js';
import { createWorkFluid } from './workFluid.js';
import useDitherWipe from './useDitherWipe.js';

// Deliberate gesture before a category swap: a casual flick at either end of a
// list shouldn't change what you're looking at.
const OVERSCROLL_PX = 170;
const LOCK_MS = 1000;
// The pane's whole job is one project at a time, so 30fps is plenty and leaves
// the frame budget to the landing physics and the palm.
const FRAME_MS = 32;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Selected work, as a pinned index.
 *
 * The section is a viewport tall plus WORKS_RANGE of scroll. The pane inside it
 * is sticky, so that extra scroll doesn't move anything down the page — it
 * drives *selection*: each slice of the range picks one project, the list
 * slides so the selected row sits at the pane's vertical centre, and the glyph
 * study morphs to match. Scroll stays the single source of truth for what is
 * selected; clicking a row scrolls to that row's slice rather than setting
 * state directly.
 *
 * Pushing past either end of a list swaps category, but only after
 * OVERSCROLL_PX of accumulated travel.
 */
const WorksPane = ({ id = 'projects', className = '' }) => {
  const [category, setCategory] = useState('work');
  const [theme, setTheme] = useState('work');
  const [selected, setSelected] = useState(0);
  const [dotTransform, setDotTransform] = useState('translateY(0px)');
  const [catHot, setCatHot] = useState(-1);

  const sectionRef = useRef(null);
  const paneRef = useRef(null);
  const listRef = useRef(null);
  const glyphCanvasRef = useRef(null);
  const wakeRef = useRef(null);
  const wipeRef = useRef(null);
  const catNavRef = useRef(null);

  const glyph = useRef(null);
  const lockRef = useRef(false);
  const lockTimer = useRef(0);
  const overscroll = useRef(0);
  // Mirrors of the two pieces of state the scroll listeners read, so they can
  // stay registered once instead of re-binding on every selection change.
  const categoryRef = useRef(category);
  const selectedRef = useRef(selected);
  categoryRef.current = category;
  selectedRef.current = selected;

  const items = WORKS[category];
  const active = items[Math.min(selected, items.length - 1)];
  const palette = THEMES[theme];

  /** 0->1 across the pinned range; null when the pane isn't pinned. */
  const progress = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return null;
    const r = section.getBoundingClientRect();
    if (r.top > 1 || r.bottom - window.innerHeight < -1) return null;
    return clamp(-r.top / WORKS_RANGE, 0, 1);
  }, []);

  const sectionTop = useCallback(() => {
    const section = sectionRef.current;
    return section ? section.getBoundingClientRect().top + window.scrollY : 0;
  }, []);

  /** Slide the list so the selected row is centred in the pane. */
  const syncList = useCallback(() => {
    const list = listRef.current;
    if (!list || !list.parentElement) return;
    // children[0] is the travelling dot, so rows are offset by one.
    const row = list.children[selectedRef.current + 1];
    if (!row) return;
    const windowH = list.parentElement.clientHeight;
    const offset = row.offsetTop + row.offsetHeight / 2;
    list.style.transform = `translateY(${Math.round(windowH / 2 - offset)}px)`;
  }, []);

  /** Ride the accent dot to the selected row's title. */
  const moveDot = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelectorAll('button')[selectedRef.current];
    if (!row) return;
    const label = row.firstElementChild || row;
    const offset =
      label.getBoundingClientRect().top -
      list.getBoundingClientRect().top +
      label.offsetHeight / 2 -
      5;
    setDotTransform(`translateY(${Math.round(offset)}px)`);
  }, []);

  const onSettled = useCallback((key, after) => {
    setTheme(key);
    requestAnimationFrame(after);
  }, []);

  const wipe = useDitherWipe({
    canvasRef: wipeRef,
    paneRef,
    sectionRef,
    glyphRef: glyphCanvasRef,
    glyph,
    onSettled,
  });

  /**
   * Locked handover. The page stops, the incoming list is scrolled to its own
   * end of the range — invisible, because the pane is pinned — and the dither
   * runs over the top.
   */
  const handover = useCallback(
    key => {
      if (lockRef.current || key === categoryRef.current) return;
      lockRef.current = true;

      const rect = paneRef.current?.getBoundingClientRect();
      const toggle = catNavRef.current?.getBoundingClientRect();
      const origin =
        rect && toggle
          ? {
              x: toggle.left + toggle.width / 2 - rect.left,
              y: toggle.top + toggle.height / 2 - rect.top,
            }
          : { x: rect ? rect.width / 2 : 0, y: 0 };

      const from = theme;
      const index = key === 'personal' ? 0 : WORKS.work.length - 1;
      const target =
        sectionTop() + (key === 'personal' ? 2 : WORKS_RANGE - 2);

      setCategory(key);
      setSelected(index);
      categoryRef.current = key;
      selectedRef.current = index;

      requestAnimationFrame(() => {
        window.scrollTo(0, target);
        glyph.current?.setItem(WORKS[key][index]);
        syncList();
        moveDot();
        wipe.run(origin, key, from);
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => {
          lockRef.current = false;
        }, LOCK_MS);
      });
    },
    [theme, sectionTop, syncList, moveDot, wipe],
  );

  const selectIndex = useCallback(
    index => {
      if (index === selectedRef.current) return;
      selectedRef.current = index;
      setSelected(index);
      glyph.current?.setItem(WORKS[categoryRef.current][index]);
      requestAnimationFrame(() => {
        syncList();
        moveDot();
      });
    },
    [syncList, moveDot],
  );

  /** Clicking a row scrolls to its slice — scroll stays the source of truth. */
  const scrollToProject = index => {
    const list = WORKS[categoryRef.current];
    const p = (index + 0.5) / list.length;
    window.scrollTo({
      top: sectionTop() + p * WORKS_RANGE,
      behavior: 'smooth',
    });
  };

  // ── glyph + fluid, gated on visibility ────────────────────────────────────
  useEffect(() => {
    const canvas = glyphCanvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return undefined;

    glyph.current = createWorkGlyph(canvas);
    glyph.current.setColors(THEMES[theme]);
    glyph.current.setItem(WORKS[categoryRef.current][selectedRef.current]);

    const pane = paneRef.current || section;
    const wake = wakeRef.current;
    const fluid = wake ? createWorkFluid(pane, wake) : null;

    let visible = false;
    let raf = 0;
    let lastPaint = 0;
    const frame = t => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (t - lastPaint > FRAME_MS) {
        fluid?.paint(t);
        glyph.current?.paint(t);
        lastPaint = t;
      }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: 0 });
    io.observe(section);
    document.addEventListener('visibilitychange', sync);

    const ro = new ResizeObserver(() => {
      syncList();
      moveDot();
    });
    ro.observe(listRef.current || section);
    requestAnimationFrame(() => {
      syncList();
      moveDot();
    });

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', sync);
      fluid?.destroy();
      fluid?.clear();
    };
    // Set up once; the glyph is driven imperatively from here on.
    // eslint-disable-next-line
  }, []);

  // ── scroll drives selection; overscroll hands over ────────────────────────
  useEffect(() => {
    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (lockRef.current) return;
        const p = progress();
        if (p === null) return;
        const list = WORKS[categoryRef.current];
        const index = clamp(Math.floor(p * list.length), 0, list.length - 1);
        selectIndex(index);
      });
    };

    const boundary = delta => {
      const p = progress();
      if (p === null || wipe.isRunning()) {
        overscroll.current = 0;
        return false;
      }
      const cat = categoryRef.current;
      if (delta > 0 && p > 0.995 && cat === 'work') {
        overscroll.current += delta;
        if (overscroll.current > OVERSCROLL_PX) {
          overscroll.current = 0;
          handover('personal');
        }
        return true;
      }
      if (delta < 0 && p < 0.005 && cat === 'personal') {
        overscroll.current -= delta;
        if (overscroll.current > OVERSCROLL_PX) {
          overscroll.current = 0;
          handover('work');
        }
        return true;
      }
      overscroll.current = 0;
      return false;
    };

    const onWheel = e => {
      if (lockRef.current) {
        e.preventDefault();
        return;
      }
      if (boundary(e.deltaY)) e.preventDefault();
    };
    let touchY = 0;
    const onTouchStart = e => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = e => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      if (lockRef.current) {
        e.preventDefault();
        return;
      }
      if (boundary(dy)) e.preventDefault();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [progress, selectIndex, handover, wipe]);

  useEffect(
    () => () => {
      clearTimeout(lockTimer.current);
      wipe.cancel();
    },
    [wipe],
  );

  const count = `${String(selected + 1).padStart(2, '0')} / ${String(
    items.length,
  ).padStart(2, '0')}`;

  return (
    <section
      id={id}
      ref={sectionRef}
      data-screen-label='Selected work'
      className={`relative z-[3] w-full ${className}`}
      style={{
        height: `calc(100svh + ${WORKS_RANGE}px)`,
        background: palette.bg,
        color: palette.ink,
      }}
    >
      <div
        ref={paneRef}
        className='sticky top-0 flex h-[100svh] flex-col overflow-hidden [isolation:isolate]'
        style={{ background: palette.bg }}
      >
        <canvas
          ref={wakeRef}
          aria-hidden='true'
          className='pointer-events-none absolute left-0 top-0 z-0 h-auto w-full opacity-[.65] [image-rendering:pixelated]'
        />
        <canvas
          ref={wipeRef}
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0 [image-rendering:pixelated]'
        />

        <div className='relative z-[1] mx-auto flex w-full min-h-0 max-w-[1440px] flex-1 flex-col px-[clamp(24px,7.4vw,110px)] pb-[clamp(28px,5vh,64px)] pt-[clamp(40px,7vh,88px)]'>
          <div className='mb-[clamp(20px,4vh,44px)] flex flex-wrap items-end justify-between gap-[30px]'>
            <div>
              <p
                data-t-color='label'
                className='type-label mb-[22px]'
                style={{ color: palette.label }}
              >
                02 — Selected work
              </p>
              <h2
                data-t-color='ink'
                className='m-0 font-offbit101Bold text-[clamp(40px,5.4vw,80px)] leading-[.92] tracking-[-.01em]'
                style={{ color: palette.ink }}
              >
                Selected work.
              </h2>
            </div>

            <div
              ref={catNavRef}
              role='group'
              aria-label='Project category'
              className='relative flex items-center gap-[2px] font-offbit101Bold text-[22px] leading-none'
            >
              {WORK_CATEGORIES.map((cat, i) => {
                const on = cat.key === category;
                return (
                  <button
                    key={cat.key}
                    type='button'
                    aria-pressed={on}
                    data-t-color={on ? 'togglePillInk' : 'toggleIdleInk'}
                    onClick={() => handover(cat.key)}
                    onMouseEnter={() => setCatHot(i)}
                    onMouseLeave={() => setCatHot(-1)}
                    className='rounded-[9px] border-0 px-[20px] py-[12px] tracking-[.02em] transition-colors'
                    style={{
                      color: on
                        ? palette.togglePillInk
                        : palette.toggleIdleInk,
                      background: on
                        ? palette.togglePill
                        : catHot === i
                          ? palette.toggleHover
                          : 'transparent',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='grid min-h-0 flex-1 items-center gap-[clamp(24px,4vw,68px)] [grid-template-columns:minmax(0,.85fr)_minmax(0,1.15fr)] max-lg:[grid-template-columns:minmax(0,1fr)]'>
            <figure className='m-0 flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(12px,2vh,22px)] max-lg:hidden'>
              <canvas
                ref={glyphCanvasRef}
                role='img'
                aria-label={`Dithered glyph interpretation for ${active.display}`}
                className='mx-auto block aspect-square w-full max-w-[min(100%,46vh)]'
              />
              <figcaption
                data-t-color='caption'
                className='type-label mt-[24px] flex items-center justify-between gap-4'
                style={{ color: palette.caption }}
              >
                <span>Generative form / glyph study</span>
                <span aria-hidden='true'>{count}</span>
              </figcaption>
            </figure>

            <div className='relative h-full min-w-0 overflow-hidden'>
              <div
                ref={listRef}
                role='group'
                aria-label='Select a project'
                className='absolute left-0 right-0 top-0 flex flex-col pl-[24px] transition-transform duration-[460ms] ease-[cubic-bezier(.22,1,.36,1)] [will-change:transform]'
              >
                <span
                  aria-hidden='true'
                  data-t-bg='accent'
                  className='pointer-events-none absolute left-0 top-0 h-[10px] w-[10px] rounded-full transition-transform duration-[360ms] ease-[cubic-bezier(.22,1,.36,1)] [will-change:transform]'
                  style={{
                    background: palette.accent,
                    transform: dotTransform,
                  }}
                />

                {items.map((row, i) => {
                  const on = i === selected;
                  return (
                    <div
                      key={row.title}
                      data-t-border='border'
                      className='flex flex-col border-b'
                      style={{ borderColor: palette.border }}
                    >
                      <button
                        type='button'
                        data-t-color={on ? 'accent' : 'rowIdle'}
                        aria-pressed={on}
                        onClick={() => scrollToProject(i)}
                        onFocus={() => scrollToProject(i)}
                        className='block w-full border-0 bg-none py-[18px] text-left transition-colors duration-150'
                        style={{
                          color: on ? palette.accent : palette.rowIdle,
                        }}
                      >
                        <span className='flex items-baseline justify-between gap-[15px]'>
                          <span className='font-offbit101Bold text-[clamp(24px,2.6vw,40px)] leading-[1.02] tracking-[-.01em]'>
                            {row.display}
                          </span>
                          <span
                            aria-hidden='true'
                            className='type-body text-[19px] transition-opacity duration-150'
                            style={{ opacity: on ? 1 : 0 }}
                          >
                            ↗
                          </span>
                        </span>
                        <span
                          data-t-color={on ? 'metaOn' : 'metaIdle'}
                          className='type-body mt-[9px] block text-[13px] leading-[1.5]'
                          style={{
                            color: on ? palette.metaOn : palette.metaIdle,
                          }}
                        >
                          {row.meta}
                        </span>
                      </button>

                      {on && (
                        <div className='flex flex-col items-start gap-[14px] pb-[22px] pt-[18px]'>
                          <p
                            data-t-color='desc'
                            className='type-body m-0 max-w-[44ch] text-[15px] leading-[1.7]'
                            style={{ color: palette.desc }}
                          >
                            {row.description}
                          </p>
                          <a
                            data-t-color='link'
                            data-t-border='linkBorder'
                            href={row.linkHref}
                            target='_blank'
                            rel='noreferrer'
                            className='type-body border-b pb-[4px] text-[14px] font-medium'
                            style={{
                              color: palette.link,
                              borderColor: palette.linkBorder,
                            }}
                          >
                            View {row.display} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

WorksPane.propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
};

export default WorksPane;
