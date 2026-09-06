/**
 * Refactored App component using new architecture
 *
 * Demonstrates the improved architecture with:
 * - Context providers for global state
 * - Custom hooks for better state management
 * - Separated concerns and responsibilities
 * - Better performance and maintainability
 *
 * @component
 * @returns {JSX.Element} The rendered application
 */

import React, { useEffect, useRef, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppProviders from './context/AppProviders.js';
import { useCursor } from './context/CursorContext.js';
import { useTheme } from './context/ThemeContext.js';
import useLandingSequence from './hooks/useLandingSequence.js';
import useHeroScrollJack from './hooks/useHeroScrollJack.js';
import { Footer } from './components/Footer.js';
import { Intro } from './components/Intro/Intro.js';
import { NavBar } from './components/Nav.js';
import { Projects } from './components/Projects/Projects.js';
import { SkillsMarquee } from './components/Intro/SkillsMarquee.js';
import Cursor from './components/Cursor.js';
import CursorAnnotation from './components/CursorAnnotation.js';
import BetaBadge from './components/BetaBadge.js';
import { HeaderSequence } from './components/HeaderSequence.js';
import PixelTrail from './components/PixelTrail.js';
import { preloadImages } from './services/AssetService.js';
import FillPhysicsCanvas from './components/FillPhysicsCanvas.js';
import ProjectPage from './pages/ProjectPage.js';
import ProjectPreview from './pages/ProjectPreview.js';
import ProjectsLab from './pages/ProjectsLab.js';
import PageTransition from './components/PageTransition.js';
import Reveal from './components/Reveal.js';
import { watchGrids } from './utils/grid.js';
import { scrollToSection } from './utils/navigateToSection.js';
import PalmScene from './components/Palm/PalmScene.js';
import { ENABLE_SHADER_BACKGROUND } from './featureFlags.js';

// Only referenced when the flag is on, so the Three.js chunk is never fetched
// while the background is disabled.
const MikaShaderEffect = React.lazy(
  () => import('./components/ShaderBackground/index.js'),
);

/**
 * Inner App component that uses context hooks
 *
 * This component uses the context hooks and is wrapped by AppProviders
 */
const AppContent = () => {
  // Use context hooks instead of local state
  const { setCursorType } = useCursor();
  const { getThemeColors } = useTheme();
  const seq = useLandingSequence();
  // Freeze scroll until the loader has handed off AND every name row has
  // landed; after that, the first scroll-down (or the scroll cue) snaps past
  // the hero to the Intro and the drained hero is locked off (no scrolling
  // back up into empty space).
  // The hero collapses to nothing once it has been scrolled past, so the jack
  // needs the section itself, not just a signal.
  const heroRef = useRef(null);
  const snapPastHero = useHeroScrollJack(seq.filled, heroRef, seq.drained);

  // Preload critical assets
  useEffect(() => {
    const criticalAssets = [
      // Add critical image paths here
    ];

    if (criticalAssets.length > 0) {
      preloadImages(criticalAssets);
    }
  }, []);

  // Handle cursor reset on app load
  useEffect(() => {
    setCursorType('');
  }, [setCursorType]);

  // Keep every section's 6px background grid phased to the document origin.
  useEffect(() => watchGrids(), []);

  // Arriving from another route with a section in mind.
  //
  // The target travels as router state rather than as a URL hash: the address
  // bar stays at `/`, so a reload starts the page from the top instead of
  // dropping the reader back into whichever section they last jumped to. The
  // state is cleared once consumed, so a later reload cannot replay it either.
  const location = useLocation();
  const navigate = useNavigate();
  const target = location.state?.scrollTo;
  useEffect(() => {
    if (!target) return undefined;
    const id = setTimeout(() => {
      scrollToSection(target);
      navigate(location.pathname, { replace: true, state: null });
    }, 120);
    return () => clearTimeout(id);
  }, [target, navigate, location.pathname]);

  // Get theme colors
  const themeColors = getThemeColors();

  return (
    <>
      {/* Shader Background — fixed, z:-1, lazy-loaded to keep Three.js off the
          critical path. Behind ENABLE_SHADER_BACKGROUND; when off, the page
          sits on the flat --acid background from :root. */}
      {ENABLE_SHADER_BACKGROUND && (
        <Suspense fallback={null}>
          <MikaShaderEffect />
        </Suspense>
      )}

      {/* Page content — rides over the fixed footer, so it needs an opaque
          background of its own and a stacking position above it. The bottom
          margin is the footer's measured height: that is the scroll distance
          which uncovers the footer, and it is what makes the works section
          read as a curtain lifting off it.
          overflow-x: clip rather than overflow: hidden. `hidden` makes this
          element a scroll container, which silently defeats `position: sticky`
          on every descendant — the sticky element pins to this box instead of
          the viewport and so never moves relative to its section. `clip` gives
          the same horizontal clipping without establishing that container. */}
      <div
        className="text-ultra relative z-[1] bg-acid [overflow-x:clip]"
        style={{
          position: 'relative',
          marginBottom: 'var(--footer-reveal-h, 100svh)',
        }}
      >
        {/* Both full-page canvases live INSIDE this wrapper. The wrapper is
            opaque — it has to be, to cover the fixed footer during the reveal
            — so a canvas outside it is simply painted over, and the hero came
            up empty.

            Order matters: the physics canvas comes first so the palm paints
            over the falling names rather than under them. Both are clipped to
            the band beside the intro copy, so neither ever crosses the text —
            the names fall past the palm, down and to the right, through the
            same band the shooting stars use. */}
        <FillPhysicsCanvas
          active={seq.filling}
          getSpawnRect={seq.getSpawnRect}
          onHandoff={seq.onHandoff}
          onFilled={seq.onFilled}
          onDrained={seq.onDrained}
        />
        <PalmScene />

        {/* Hidden easter egg text — acid on acid, found by selecting it.
            Taken out of flow: in flow it reserved a line of height above the
            hero, which showed as a strip of bare acid at the very top of the
            page once the hero collapsed, and meant "home" never scrolled to
            something that looked like the top. */}
        <p
          className='pointer-events-none absolute left-0 top-0 m-0'
          style={{ color: themeColors.primary }}
        >
          {`if you're reading this, you found a secret ;p`}
        </p>

        {/* Global cursor component */}
        <PixelTrail />

        {/* Navigation header */}
        <NavBar setCursor={setCursorType} />

        {/* Landing sequence: blocking pixel-water loader → hero-fold region
            that the FillPhysicsCanvas fills with stacked names. */}
        <HeaderSequence
          pct={seq.pct}
          filling={seq.filling}
          handedOff={seq.handedOff}
          filled={seq.filled}
          onCue={snapPastHero}
          nameRef={seq.nameRef}
          heroRef={heroRef}
          secondaryColor={themeColors.secondary}
        />

        {/* Introduction section.
            Deliberately NOT wrapped in <Reveal>: the section is sticky, and a
            transformed ancestor becomes its containing block — the wrapper is
            exactly the section's height, so sticky would have no travel and
            never engage. */}
        <Intro setCursor={setCursorType} />

        {/* Skills marquee */}
        <Reveal delay={0.1}>
          <SkillsMarquee loop={0} />
        </Reveal>

        {/* Projects showcase */}
        <Projects />

        {/* Beta / work-in-progress notice — dismissible, bottom-right */}
        <BetaBadge setCursor={setCursorType} />
      </div>

      {/* Outside the content wrapper on purpose. The footer is fixed, and a
          fixed element inside that z-indexed wrapper would be trapped in its
          stacking context and paint OVER the page rather than behind it. Out
          here it sits below the content, which is what lets the works section
          uncover it. */}
      <Footer cursor={''} setCursor={setCursorType} />
    </>
  );
};

/**
 * Refactored App component
 *
 * Uses context providers instead of prop drilling
 * Implements proper separation of concerns
 * Better performance with optimized re-renders
 */
/**
 * Routes keyed by pathname inside AnimatePresence so the pixel-wipe
 * transition plays between the index and project dossier views
 */
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <AppContent />
            </PageTransition>
          }
        />
        <Route
          path="/projects/:slug"
          element={
            <PageTransition>
              <ProjectPage />
            </PageTransition>
          }
        />
        <Route
          path="/projects/:slug/preview"
          element={<ProjectPreview />}
        />
        <Route
          path="/lab"
          element={
            <PageTransition>
              <ProjectsLab />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

const AppRefactored = () => {
  return (
    <BrowserRouter>
      <AppProviders>
        {/* One cursor for the whole app, outside <Routes>.
            index.css hides the native cursor under `@media (pointer: fine)`
            for the entire document, so the replacement has to exist on every
            route — mounted per-route it left the project pages with no
            visible cursor at all. Keeping it outside <Routes> also means it
            survives the page transition instead of unmounting mid-navigation. */}
        <Cursor />
        {/* One annotation chip for the whole app, beside the cursor and for
            the same reason: every route can label what is under the pointer,
            and it must survive the page transition rather than unmounting
            mid-navigation. */}
        <CursorAnnotation />
        <AnimatedRoutes />
      </AppProviders>
    </BrowserRouter>
  );
};

export default AppRefactored;
