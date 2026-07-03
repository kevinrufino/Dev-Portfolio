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
import { Footer } from './components/Footer.js';
import { Intro } from './components/Intro/Intro.js';
import { NavBar } from './components/Nav.js';
import { Projects } from './components/Projects/Projects.js';
import { SkillsMarquee } from './components/Intro/SkillsMarquee.js';
import Cursor from './components/Cursor.js';
import { HeaderSequence } from './components/HeaderSequence.js';
import { preloadImages } from './services/AssetService.js';
import FillPhysicsCanvas from './components/FillPhysicsCanvas.js';
import ProjectPage from './pages/ProjectPage.js';
import ProjectPreview from './pages/ProjectPreview.js';
import PageTransition from './components/PageTransition.js';
import Reveal from './components/Reveal.js';

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
  const { setCursorType, type: cursorType } = useCursor();
  const { getThemeColors } = useTheme();
  const seq = useLandingSequence();

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
      {/* Shader Background — fixed, z:-1, lazy-loaded to keep Three.js off the critical path */}
      <Suspense fallback={null}>
        <MikaShaderEffect />
      </Suspense>

      {/* Full-page physics canvas — z:0, between shader and content.
          Fills the header on handoff, then drains down the page on scroll. */}
      <FillPhysicsCanvas
        active={seq.filling}
        getSpawnRect={seq.getSpawnRect}
        onHandoff={seq.onHandoff}
      />

      {/* Page content — z:2, on top */}
      <div
        className="text-ultra scroll-smooth relative overflow-hidden grain"
        style={{ position: 'relative' }}
      >
        {/* Hidden easter egg text */}
        <p style={{ color: themeColors.primary }}>
          {`if you're reading this, you found a secret ;p`}
        </p>

        {/* Global cursor component */}
        <Cursor cursor={cursorType} />

        {/* Navigation header */}
        <NavBar setCursor={setCursorType} />

        {/* Landing sequence: blocking pixel-water loader → hero-fold region
            that the FillPhysicsCanvas fills with stacked names. */}
        <HeaderSequence
          pct={seq.pct}
          filling={seq.filling}
          handedOff={seq.handedOff}
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
        <Projects cursor={''} setCursor={setCursorType} />

        {/* Footer section */}
        <Footer cursor={''} setCursor={setCursorType} />
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
      </Routes>
    </AnimatePresence>
  );
};

const AppRefactored = () => {
  return (
    <BrowserRouter>
      <AppProviders>
        <AnimatedRoutes />
      </AppProviders>
    </BrowserRouter>
  );
};

export default AppRefactored;
