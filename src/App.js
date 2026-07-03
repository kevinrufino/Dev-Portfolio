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
import { useLoading } from './context/LoadingContext.js';
import LoadingScreen from './components/LoadingScreen.js';
import { Footer } from './components/Footer.js';
import { Intro } from './components/Intro/Intro.js';
import { NavBar } from './components/Nav.js';
import { Projects } from './components/Projects/Projects.js';
import { SkillsMarquee } from './components/Intro/SkillsMarquee.js';
import Cursor from './components/Cursor.js';
import PixelTrail from './components/PixelTrail.js';
import { Hero } from './components/Hero/Hero.js';
import { preloadImages } from './services/AssetService.js';
import MatterJSCanvas from './components/Hero/MatterJSCanvas.js';
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
  const { setProgress, getProgressPercentage, isComplete, setLoadingComplete } =
    useLoading();

  // Preload critical assets
  useEffect(() => {
    const criticalAssets = [
      // Add critical image paths here
    ];

    if (criticalAssets.length > 0) {
      preloadImages(criticalAssets);
    }
  }, []);

  // Drive the loading screen off real readiness signals rather than a timer:
  //   1. fonts          — document.fonts.ready
  //   2. page resources — the window 'load' event (bundle, CSS, initial images)
  //   3. shader         — the Three.js background paints its first frame
  //                       (its 211KB chunk is the heaviest thing on the page)
  // The bar advances as each milestone lands. A minimum keeps it from flashing
  // on fast loads; a max cap guarantees it can never hang if a signal is missed
  // (e.g. WebGL unavailable). Below-the-fold project videos are intentionally
  // excluded — they lazy-load on scroll and shouldn't gate first paint.
  useEffect(() => {
    const MIN_MS = 600;
    const MAX_MS = 8000;
    const start = Date.now();
    const milestones = ['fonts', 'window-load', 'shader'];
    const done = new Set();
    let finished = false;

    const reflect = () => {
      // Map fraction-complete onto the 0..7 internal progress scale.
      setProgress(Math.round((done.size / milestones.length) * 7));
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      const remaining = Math.max(0, MIN_MS - (Date.now() - start));
      setTimeout(() => {
        setProgress(7);
        setTimeout(() => setLoadingComplete(), 300);
      }, remaining);
    };

    const mark = name => {
      if (finished || done.has(name)) return;
      done.add(name);
      reflect();
      if (done.size >= milestones.length) finish();
    };

    document.fonts.ready.then(() => mark('fonts'));

    const onLoad = () => mark('window-load');
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    const onShader = () => mark('shader');
    if (window.__shaderReady) onShader();
    else window.addEventListener('shader:ready', onShader, { once: true });

    const cap = setTimeout(finish, MAX_MS);

    return () => {
      clearTimeout(cap);
      window.removeEventListener('load', onLoad);
      window.removeEventListener('shader:ready', onShader);
    };
  }, [setProgress, setLoadingComplete]);

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

      {/* Matter.js physics canvas — z:0, between shader and content */}
      <MatterJSCanvas />

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
        <PixelTrail />
        <Cursor cursor={cursorType} />

        {/* Navigation header */}
        <NavBar setCursor={setCursorType} />

        {!isComplete() && (
          <LoadingScreen
            progress={getProgressPercentage()}
            total={100}
            secondaryColor={themeColors.secondary}
            setCursor={setCursorType}
          />
        )}

        {/* Hero section */}
        <Hero
          primaryColor={themeColors.primary}
          secondaryColor={themeColors.secondary}
          setCursor={setCursorType}
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
