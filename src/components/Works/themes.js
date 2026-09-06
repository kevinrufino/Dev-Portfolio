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
    bg: '#3e3bf4',
    ink: '#ffffff',
    label: '#F1F43B',
    accent: '#F1F43B',
    rowIdle: '#c0beff',
    metaIdle: '#cccaff',
    metaOn: 'rgba(241,244,59,.82)',
    border: 'rgba(255,255,255,.19)',
    desc: '#dfdeff',
    link: '#ffffff',
    linkBorder: 'rgba(255,255,255,.56)',
    caption: '#c9cdf6',
    glyphInk: '#f1f43b',
    glyphBg: '#111125',
    togglePill: '#F1F43B',
    togglePillInk: '#3e3bf4',
    toggleIdleInk: '#ffffff',
    // Opaque, not translucent — and these are exactly what the old
    // rgba(241,244,59,.4)/.62 resolved to over this ground. The goo filter
    // re-hardens alpha after blurring, so a semi-transparent source came out
    // of it thinner than an opaque one and the toggle's hover read visibly
    // smaller than the nav's, which uses flat fills. Same colour, same shape.
    toggleHover: '#8685aa',
    toggleFollower: '#adad81',
  },
  personal: {
    bg: '#F1F43B',
    ink: '#3e3bf4',
    label: '#3e3bf4',
    accent: '#6f6cf2',
    rowIdle: '#3e3bf4',
    metaIdle: '#5b58c8',
    metaOn: '#4f4cd4',
    border: 'rgba(62,59,244,.24)',
    desc: '#4f4cd4',
    link: '#3e3bf4',
    linkBorder: 'rgba(62,59,244,.5)',
    caption: '#5b58c8',
    glyphInk: '#3e3bf4',
    glyphBg: '#f7f8f5',
    togglePill: '#3e3bf4',
    togglePillInk: '#F1F43B',
    toggleIdleInk: '#3e3bf4',
    toggleHover: '#b0b17e',
    toggleFollower: '#8989a6',
  },
};

/** Scroll budget the pane is pinned for, in px — one slice per project of the
 *  longest list, so the section's height never changes with the category. */
export const WORKS_RANGE = 1050;
