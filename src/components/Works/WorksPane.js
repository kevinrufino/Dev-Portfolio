import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import { toSlug } from '../../utils/helpers.js';
import useGooFollower from '../../hooks/useGooFollower.js';
import useCursorFx from '../../hooks/useCursorFx.js';
import GooPills from '../common/GooPills.js';
import { WORKS, WORK_CATEGORIES } from './worksData.js';
import { THEMES, WORKS_RANGE } from './themes.js';
import { createWorkGlyph } from './workGlyph.js';
import { createWorkFluid } from './workFluid.js';
import useDitherWipe from './useDitherWipe.js';

// Deliberate gesture before a category swap: a casual flick at either end of a
// list shouldn't change what you're looking at.
const OVERSCROLL_PX = 170;
// Just past the wipe's own duration, so the boundary can't re-fire mid-sweep.
// Only boundary detection is suppressed for this long — scrolling stays live.
const LOCK_MS = 500;
// The pane's whole job is one project at a time, so 30fps is plenty and leaves
// the frame budget to the landing physics and the palm.
const FRAME_MS = 32;
// Matches the nav's follower range exactly. The two groups are the same
// interaction and should start reacting at the same distance.
const TOGGLE_RANGE = 300;
// The glyph is the section's one image and its way in, so it is findable from
// a long way off — and it keeps pointing past its own border, all the way to
// the middle. Half the size of it is still somewhere you are heading toward.
const GLYPH_GRAVITY_PX = 116;
const GLYPH_RELEASE_CORE = 0.5;
// How far the held-press ring grows. Past the glyph's own width, so the last
// of it passes over the far corner rather than stopping inside the frame.
const GLYPH_HOLD_RING_PX = 620;
// The idle option is a long way from the list the pointer usually lives in.
const TOGGLE_GRAVITY_PX = 116;
// The row's own way in sits at the edge of a busy column; a short field is
// enough to catch a hand already travelling along the row.
const ROW_CTA_GRAVITY_PX = 58;

/** Attach one element to several refs, callback or object. */
const joinRefs =
  (...refs) =>
  el => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    }
  };

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
  const navigate = useNavigate();
  const [category, setCategory] = useState('work');
  const [theme, setTheme] = useState('work');
  const [selected, setSelected] = useState(0);
  const [dotTransform, setDotTransform] = useState('translateY(0px)');
  const [catHot, setCatHot] = useState(-1);
  const [rowHot, setRowHot] = useState(-1);
  const [hotDotTransform, setHotDotTransform] = useState('translateY(0px)');
  const [catSliding, setCatSliding] = useState(false);
  const slideTimer = useRef(0);

  const sectionRef = useRef(null);
  const paneRef = useRef(null);
  const listRef = useRef(null);
  const glyphCanvasRef = useRef(null);
  const wakeRef = useRef(null);
  const wipeRef = useRef(null);


  const glyph = useRef(null);
  const fluidRef = useRef(null);
  const {
    groupRef: catNavRef,
    followerRef: catFollowerRef,
    setItemRef: setCatRef,
    rects: catRects,
    measure: measureCats,
  } = useGooFollower(WORK_CATEGORIES.length, TOGGLE_RANGE);
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
  // The chip is drawn in the pane's own colours, so it belongs to whichever
  // palette is on screen rather than arriving from the page outside.
  const chipTone = { bg: palette.ink, ink: palette.bg };

  // The glyph stands in for the selected project, so it says where that
  // project goes — and it is the way there. Holding the press fills the chip;
  // let go early and nothing happens, which is what makes a canvas safe to
  // make clickable at all.
  const glyphFxRef = useCursorFx({
    label: active.hasStory ? 'view case study' : 'view project',
    icon: 'eye',
    name: 'works / glyph',
    tone: chipTone,
    gravity: GLYPH_GRAVITY_PX,
    releaseCore: GLYPH_RELEASE_CORE,
    holdRing: GLYPH_HOLD_RING_PX,
    hold: () => {
      if (active.hasStory) navigate(`/projects/${toSlug(active.title)}`);
      else window.open(active.linkHref, '_blank', 'noreferrer');
    },
  });
  // Only the option you are NOT on pulls: the one you are already using has
  // no reason to ask for the pointer.
  const workTabFx = useCursorFx({
    name: 'works / idle tab',
    gravity: TOGGLE_GRAVITY_PX,
    enabled: category !== 'work',
  });
  const personalTabFx = useCursorFx({
    name: 'works / idle tab',
    gravity: TOGGLE_GRAVITY_PX,
    enabled: category !== 'personal',
  });
  const tabFx = [workTabFx, personalTabFx];
  const rowCtaFx = useCursorFx({
    name: 'works / check it out',
    gravity: ROW_CTA_GRAVITY_PX,
  });

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
    // Found by attribute rather than by index: the list also carries the two
    // travelling dots, and counting past them broke the moment a second one
    // was added.
    const row = list.querySelectorAll('[data-row-wrap]')[selectedRef.current];
    if (!row) return;
    const windowH = list.parentElement.clientHeight;
    const offset = row.offsetTop + row.offsetHeight / 2;
    list.style.transform = `translateY(${Math.round(windowH / 2 - offset)}px)`;
  }, []);

  /** Where a row's dot sits, in list coordinates. Null if the row is gone. */
  const dotOffset = useCallback(index => {
    const list = listRef.current;
    if (!list) return null;
    const row = list.querySelectorAll('[data-row]')[index];
    if (!row) return null;
    const label = row.firstElementChild || row;
    return Math.round(
      label.getBoundingClientRect().top -
        list.getBoundingClientRect().top +
        label.offsetHeight / 2 -
        5,
    );
  }, []);

  /** Ride the accent dot to the selected row's title. */
  const moveDot = useCallback(() => {
    const offset = dotOffset(selectedRef.current);
    if (offset != null) setDotTransform(`translateY(${offset}px)`);
  }, [dotOffset]);

  // The preview dot follows the pointer down the list, a half-strength copy of
  // the real one showing which row a click would land on. It is parked on the
  // selected row when there is nothing to preview, so it grows out of the
  // selection rather than appearing from nowhere.
  useEffect(() => {
    const index = rowHot >= 0 ? rowHot : selected;
    const offset = dotOffset(index);
    if (offset != null) setHotDotTransform(`translateY(${offset}px)`);
  }, [rowHot, selected, category, dotOffset]);

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

      // The wake canvas sits under the dither cover, so anything drawn while
      // the sweep is running is invisible — and then arrives all at once the
      // moment the cover lifts, which reads as a glitch. The fluid is held
      // still and cleared for the length of the sweep instead.
      fluidRef.current?.setEnabled(false);

      const from = theme;
      const index = key === 'personal' ? 0 : WORKS.work.length - 1;
      const target =
        sectionTop() + (key === 'personal' ? 2 : WORKS_RANGE - 2);

      setCategory(key);
      setSelected(index);
      setCatSliding(true);
      clearTimeout(slideTimer.current);
      slideTimer.current = setTimeout(() => setCatSliding(false), 520);
      categoryRef.current = key;
      selectedRef.current = index;

      requestAnimationFrame(() => {
        // Instant: the pane is pinned, so this jump is invisible by design.
        // Easing it would animate the very seam it exists to hide.
        window.scrollTo({ top: target, behavior: 'instant' });
        glyph.current?.setItem(WORKS[key][index]);
        syncList();
        moveDot();
        wipe.run(origin, key, from);
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => {
          lockRef.current = false;
          fluidRef.current?.setEnabled(true);
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
    fluidRef.current = fluid;

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
      fluidRef.current = null;
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

    // While a handover is running the boundary is ignored, but the page is
    // NOT frozen. Swallowing every wheel event for the length of the lock made
    // the toggle feel like it had hung — the transition is decorative, and
    // decoration must never take input away from the reader.
    const onWheel = e => {
      if (lockRef.current) return;
      if (boundary(e.deltaY)) e.preventDefault();
    };
    let touchY = 0;
    const onTouchStart = e => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = e => {
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      if (lockRef.current) return;
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

  // The two labels differ in width, so the active pill has to be re-measured
  // after a swap or it keeps the outgoing label's size.
  useEffect(() => {
    requestAnimationFrame(measureCats);
  }, [category, measureCats]);

  useEffect(
    () => () => {
      clearTimeout(lockTimer.current);
      clearTimeout(slideTimer.current);
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
              <GooPills
                rects={catRects}
                activeIndex={WORK_CATEGORIES.findIndex(c => c.key === category)}
                hotIndex={catHot}
                followerRef={catFollowerRef}
                pillColor={palette.togglePill}
                hoverColor={palette.toggleHover}
                followerColor={palette.toggleFollower}
                sliding={catSliding}
              />
              {WORK_CATEGORIES.map((cat, i) => {
                const on = cat.key === category;
                return (
                  <button
                    key={cat.key}
                    ref={joinRefs(setCatRef(i), tabFx[i])}
                    type='button'
                    aria-pressed={on}
                    onClick={() => handover(cat.key)}
                    onMouseEnter={() => setCatHot(i)}
                    onMouseLeave={() => setCatHot(-1)}
                    className='relative border-0 bg-transparent px-[20px] py-[12px] tracking-[.02em] transition-colors'
                    style={{
                      color: on
                        ? palette.togglePillInk
                        : palette.toggleIdleInk,
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Two columns with room; stacked on a phone, with the glyph on top
              of the list rather than dropped. It was hidden below `lg`, which
              took the one image in the section away from the readers with the
              least on screen. */}
          <div className='grid min-h-0 flex-1 items-center gap-[clamp(24px,4vw,68px)] [grid-template-columns:minmax(0,.85fr)_minmax(0,1.15fr)] max-lg:items-stretch max-lg:gap-[18px] max-lg:[grid-template-columns:minmax(0,1fr)] max-lg:[grid-template-rows:auto_minmax(0,1fr)]'>
            <figure className='m-0 flex min-h-0 min-w-0 flex-col justify-center gap-[clamp(12px,2vh,22px)] max-lg:gap-[10px]'>
              <div
                ref={glyphFxRef}
                className='relative mx-auto block w-full max-w-[min(100%,46vh)] max-lg:max-w-[min(56vw,190px)]'
              >
              <canvas
                ref={glyphCanvasRef}
                role='img'
                aria-label={`Dithered glyph interpretation for ${active.display}`}
                className='block aspect-square w-full'
              />
              </div>
              <figcaption
                data-t-color='caption'
                className='type-label mt-[24px] flex items-center justify-between gap-4 max-lg:mt-0 max-lg:text-[10px]'
                style={{ color: palette.caption }}
              >
                <span>Generative form / glyph study</span>
                <span aria-hidden='true'>{count}</span>
              </figcaption>
            </figure>

            <div className='relative h-full min-w-0 overflow-hidden max-lg:h-[clamp(240px,34vh,320px)]'>
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

                {/* No `data-t-bg` here: the wipe writes the settled colour
                    onto whatever carries that attribute, and on this dot the
                    colour lives on the inner span. It re-renders from the
                    palette anyway. */}
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute left-0 top-0 h-[10px] w-[10px] transition-[transform,opacity] duration-[340ms] ease-[cubic-bezier(.34,1.56,.64,1)] [will-change:transform]'
                  style={{
                    transform: hotDotTransform,
                    opacity: rowHot >= 0 && rowHot !== selected ? 0.5 : 0,
                  }}
                >
                  {/* Re-keyed on every hop so the squash replays. */}
                  <span
                    key={rowHot}
                    className='dot-hop block h-full w-full rounded-full'
                    style={{ background: palette.accent }}
                  />
                </span>

                {items.map((row, i) => {
                  const on = i === selected;
                  const to = `/projects/${toSlug(row.title)}`;
                  return (
                    <div
                      key={row.title}
                      data-row-wrap
                      data-t-border='border'
                      className='flex flex-col border-b'
                      style={{ borderColor: palette.border }}
                    >
                      {/* Selecting, not navigating. Scroll stays the source of
                          truth for what is open, so a click scrolls to this
                          row's slice of the range rather than setting state.

                          The way in rides on the title's own line, pushed to
                          the far edge — at the bottom of the block it read as
                          a footnote to the description rather than as the
                          thing to press. Baseline-aligned, so it sits on the
                          title rather than beside its box. */}
                      <div className='flex items-baseline gap-[18px]'>
                        <button
                          type='button'
                          data-row
                          data-t-color={on ? 'accent' : 'rowIdle'}
                          aria-pressed={on}
                          onClick={() => scrollToProject(i)}
                          onFocus={() => scrollToProject(i)}
                          onMouseEnter={() => setRowHot(i)}
                          onMouseLeave={() =>
                            setRowHot(current => (current === i ? -1 : current))
                          }
                          className='block min-w-0 flex-1 border-0 bg-transparent py-[18px] text-left transition-colors duration-150'
                          style={{ color: on ? palette.accent : palette.rowIdle }}
                        >
                          <span className='block font-offbit101Bold text-[clamp(24px,2.6vw,40px)] leading-[1.02] tracking-[-.01em]'>
                            {row.display}
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

                        {on &&
                          (row.hasStory ? (
                            <Link
                              ref={rowCtaFx}
                              data-t-color='link'
                              to={to}
                              aria-label={`Check out ${row.display}`}
                              className='line-cta type-body shrink-0 text-[14px] font-medium'
                              style={{
                                color: palette.accent,
                                '--line-cta-ink': palette.accent,
                              }}
                            >
                              {/* Copy on a wide screen, the arrow alone on a
                                  narrow one, where the title needs the room. */}
                              <span className='max-lg:hidden'>Check it out</span>
                              <span
                                aria-hidden='true'
                                className='line-cta__arrow'
                              >
                                →
                              </span>
                            </Link>
                          ) : (
                            <a
                              ref={rowCtaFx}
                              data-t-color='link'
                              href={row.linkHref}
                              target='_blank'
                              rel='noreferrer'
                              aria-label={`Check out ${row.display}`}
                              className='line-cta type-body shrink-0 text-[14px] font-medium'
                              style={{
                                color: palette.accent,
                                '--line-cta-ink': palette.accent,
                              }}
                            >
                              <span className='max-lg:hidden'>Check it out</span>
                              <span
                                aria-hidden='true'
                                className='line-cta__arrow--diagonal'
                              >
                                ↗
                              </span>
                            </a>
                          ))}
                      </div>

                      {on && (
                        <p
                          data-t-color='desc'
                          className='type-body m-0 max-w-[44ch] pb-[22px] text-[15px] leading-[1.7] max-lg:text-[14px]'
                          style={{ color: palette.desc }}
                        >
                          {row.description}
                        </p>
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
