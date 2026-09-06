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

import React, { useEffect, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
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
  const snapPastHero = useHeroScrollJack(seq.filled);

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

  // Scroll to the hash target after SPA navigation (e.g. "← INDEX" → /#projects)
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) {
      const id = setTimeout(() => el.scrollIntoView(), 80);
      return () => clearTimeout(id);
    }
  }, [hash]);

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

      {/* Full-page physics canvas — z:0, between shader and content.
          Fills the header on handoff, then drains down the page on scroll. */}
      <FillPhysicsCanvas
        active={seq.filling}
        getSpawnRect={seq.getSpawnRect}
        onHandoff={seq.onHandoff}
        onFilled={seq.onFilled}
      />

      {/* Page content — z:2, on top.
          overflow-x: clip rather than overflow: hidden. `hidden` makes this
          element a scroll container, which silently defeats `position: sticky`
          on every descendant — the sticky element pins to this box instead of
          the viewport and so never moves relative to its section. `clip` gives
          the same horizontal clipping without establishing that container. */}
      <div
        className="text-ultra scroll-smooth relative [overflow-x:clip]"
        style={{ position: 'relative' }}
      >
        {/* Hidden easter egg text */}
        <p style={{ color: themeColors.primary }}>
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
          secondaryColor={themeColors.secondary}
        />

        {/* Introduction section */}
        <Reveal>
          <Intro
            secondaryColor={themeColors.secondary}
            cursor={''}
            setCursor={setCursorType}
          />
        </Reveal>

        {/* Skills marquee */}
        <Reveal delay={0.1}>
          <SkillsMarquee loop={0} />
        </Reveal>

        {/* Projects showcase */}
        <Projects />

        {/* Footer section */}
        <Footer cursor={''} setCursor={setCursorType} />

        {/* Beta / work-in-progress notice — dismissible, bottom-right */}
        <BetaBadge setCursor={setCursorType} />
      </div>
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
        <AnimatedRoutes />
      </AppProviders>
    </BrowserRouter>
  );
};

export default AppRefactored;
