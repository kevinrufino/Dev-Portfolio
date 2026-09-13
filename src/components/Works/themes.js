import { colour } from '../../styles/tokens';
/**
 * The two palettes the works pane swaps between.
 *
 * They are near-inversions of each other: `work` is white on ultra with acid
 * accents, `personal` is ultra on acid. That inversion is the reason the wipe
 * in WorksPane flips each element on its *farthest* corner rather than its
 * centre — one palette's ink is the other's ground, so an element caught
 * half-swept would render ultra-on-ultra and vanish mid-sweep.
 *
 * Keys are referenced by name from `data-t-color` / `data-t-bg` /
 * `data-t-border` attributes during the wipe, so renaming one means renaming
 * its attribute too.
 */
export const THEMES = {
  work: {
    bg: colour.ultra,
    ink: colour.white,
    label: colour.acid,
    accent: colour.acid,
    rowIdle: colour['on-ultra-row'],
    metaIdle: colour['on-ultra-meta'],
    metaOn: 'rgba(241,244,59,.82)',
    border: 'rgba(255,255,255,.19)',
    desc: colour['on-ultra-body'],
    link: colour.white,
    linkBorder: 'rgba(255,255,255,.56)',
    caption: colour['on-ultra-caption'],
    glyphInk: colour.acid,
    glyphBg: colour['on-ultra-glyph-bg'],
    togglePill: colour.acid,
    togglePillInk: colour.ultra,
    toggleIdleInk: colour.white,
    // Opaque, not translucent: the goo filter re-hardens alpha after
    // blurring, so a semi-transparent source came out of it thinner than an
    // opaque one and the toggle's hover read visibly smaller than the nav's,
    // which uses flat fills.
    //
    // The first opaque pair were the literal composite of the old translucent
    // acid over this ground, which turned out to be a dull grey-mauve. These
    // are a light bloom of the ground's own hue instead — the same move the
    // nav makes with its pale blue tint over white.
    toggleHover: colour['on-ultra-hover'],
    toggleFollower: colour['on-ultra-follower'],
  },
  personal: {
    bg: colour.acid,
    ink: colour.ultra,
    label: colour.ultra,
    accent: colour['on-acid-accent'],
    rowIdle: colour.ultra,
    metaIdle: colour['on-acid-meta'],
    metaOn: colour['on-acid-strong'],
    border: 'rgba(62,59,244,.24)',
    desc: colour['on-acid-strong'],
    link: colour.ultra,
    linkBorder: 'rgba(62,59,244,.5)',
    caption: colour['on-acid-meta'],
    glyphInk: colour.ultra,
    glyphBg: colour.paper,
    togglePill: colour.ultra,
    togglePillInk: colour.acid,
    toggleIdleInk: colour.ultra,
    // On acid the bloom has to go the other way: a deeper note of the same
    // yellow, since nothing lighter reads against it.
    toggleHover: colour['on-acid-hover'],
    toggleFollower: colour['on-acid-follower'],
  },
};

/** Scroll budget the pane is pinned for, in px — one slice per project of the
 *  longest list, so the section's height never changes with the category. */
export const WORKS_RANGE = 1050;
