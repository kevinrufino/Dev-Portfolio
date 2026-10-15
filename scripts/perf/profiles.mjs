/**
 * Device profiles — the machines we pretend to be.
 *
 * ## The finding that shapes this file
 *
 * CDP's `Emulation.setCPUThrottlingRate` is INERT in headed Chrome on this Mac
 * and ACTIVE in headless. Measured, same page, same build:
 *
 *     headed   1x CPU ->  121 fps    headless 1x CPU ->  60 fps
 *     headed   4x CPU ->  121 fps    headless 4x CPU ->  23 fps, 198/200 janky
 *     headed   6x CPU ->  121 fps
 *
 * Identical across 1x/4x/6x is not a fast page, it is an ignored instruction.
 * So the two configurations measure different things and neither one is a
 * phone:
 *
 *   headless + throttle  -> PESSIMISTIC. Software raster, no GPU, and the
 *                           throttle actually bites. This is the profile that
 *                           RESPONDS TO LOAD, so it is the one that can catch a
 *                           regression. It gates.
 *   headed, unthrottled  -> OPTIMISTIC. Real GPU, real compositor, 120Hz
 *                           ProMotion panel. Best case, useful as a ceiling and
 *                           for anything GPU-dependent. It does not gate.
 *
 * Absolute fps from either one is not an iPhone number and must never be quoted
 * as one. What transfers between machines is the RATIO: this build against the
 * previous build, measured the same way.
 */

export const PROFILES = {
  /** The gate. Slowest thing we can reproduce on demand. */
  'mobile-slow': {
    label: 'mobile · 6x CPU (gate)',
    headless: true,
    cpu: 6,
    viewport: { width: 390, height: 844 },
    dpr: 3,
    mobile: true,
    gating: true,
  },
  /** A mid phone. Also gates — a regression usually shows here first. */
  'mobile-mid': {
    label: 'mobile · 4x CPU (gate)',
    headless: true,
    cpu: 4,
    viewport: { width: 390, height: 844 },
    dpr: 3,
    mobile: true,
    gating: true,
  },
  /** Desktop under load. Catches regressions in the cursor machinery, which
   *  only runs on a fine pointer and therefore never appears in a mobile run. */
  'desktop-slow': {
    label: 'desktop · 4x CPU (gate)',
    headless: true,
    cpu: 4,
    viewport: { width: 1440, height: 900 },
    dpr: 2,
    mobile: false,
    gating: true,
  },
  /** Unthrottled headless. Isolates "is the page heavy" from "is the CPU slow". */
  'desktop-fast': {
    label: 'desktop · no throttle',
    headless: true,
    cpu: 1,
    viewport: { width: 1440, height: 900 },
    dpr: 2,
    mobile: false,
    gating: true,
  },
  /** Real GPU reference. Never gates — the throttle is ignored here, so it
   *  cannot fail and a pass from it would mean nothing. */
  'reference-gpu': {
    label: 'headed · real GPU (reference only)',
    headless: false,
    cpu: 1,
    viewport: { width: 1440, height: 900 },
    dpr: 2,
    mobile: false,
    gating: false,
  },
};

export const DEFAULT_PROFILES = ['mobile-slow', 'mobile-mid', 'desktop-slow', 'desktop-fast'];
