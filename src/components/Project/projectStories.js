/**
 * Long-form case-study content for the project pages.
 *
 * `constants.js` stays the source of truth for titles, roles, clients, years,
 * links and media. This module adds only what a case study needs and the
 * archive doesn't carry: a tagline, a metadata table, and an ordered `blocks`
 * array.
 *
 * Keyed by the `title` in `constants.js` rather than by slug, so the existing
 * `/projects/:slug` routes (built from `toSlug(title)`) keep working.
 *
 * Blocks are ordered per project, which is the point: a full case study stacks
 * context → process → decisions → payoff → impact → reflection, while a
 * smaller piece is one paragraph and a gallery. A project with no entry here
 * still renders — the page falls back to its archive description.
 *
 * Block types:
 *   text        paras[], optional pull quote
 *   assets      items[] on a 12-column grid: { caption, span, ratio }
 *   moments     items[]: { kind, title, body, chose, passed, call }
 *   impact      items[]: { n, suffix, k, note } — counts up on reveal
 *   reflection  same shape as text
 *
 * Copy is draft-quality scaffolding carried over from the design, and is meant
 * to be edited in place.
 */
export const PROJECT_STORIES = {
  "Max's Lab": {
    display: "Max's Lab",
    tagline:
      'An explorable 3D world built around Air Max, with hidden details and live events.',
    cover: 'Cover — 8s loop of the world at first load, camera settling',
    meta: [
      { k: 'Timeline', v: '5 months · 2023' },
      {
        k: 'Scope',
        v: 'Lead engineer · 3D world, event system, performance budget',
      },
      {
        k: 'Worked with',
        v: '2 designers, 1 3D artist, 3 engineers, brand + product marketing',
      },
      { k: 'Stack', v: 'React, Three.js, GLSL, WebGL2' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'Air Max Day is an annual moment with a lot of noise around it. The brief was a destination that could hold a month of drops, unlocks, and live moments without becoming a landing page that gets rebuilt every week.',
          'We built a room instead of a page: a single navigable 3D space where each object is a slot the marketing team can fill. New drop, new object. No redeploy, no new route.',
        ],
        pull: 'A page expires. A room gets furniture.',
      },
      {
        type: 'text',
        label: 'Context',
        title: 'Why it matters',
        paras: [
          'Members were arriving from social with no context and bouncing in under twenty seconds. A destination that rewards a second look changes the shape of that session — we needed exploration to be the thing that retains, not copy.',
          'It also gave the team an authoring surface. Anything placed in the room could be scheduled, so a live event became a state change rather than a build.',
        ],
      },
      {
        type: 'assets',
        label: 'Process',
        title: 'Building the room',
        note: 'Component-level captures from the middle of the build.',
        items: [
          {
            caption: 'Navigation prototype — camera rails vs. free orbit',
            span: 7,
            ratio: '16 / 10',
          },
          { caption: 'Hotspot states: idle, near, focused', span: 5, ratio: '16 / 10' },
          {
            caption: 'Draw-call budget instrumentation on a mid-tier Android',
            span: 4,
            ratio: '4 / 3',
          },
          { caption: 'Material study — dithered shadow catcher', span: 4, ratio: '4 / 3' },
          { caption: 'Event scheduler preview in the CMS', span: 4, ratio: '4 / 3' },
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'Key design moments',
        items: [
          {
            kind: 'Tradeoff',
            title: 'Free orbit or camera rails',
            body: 'Free orbit tested as more fun for the first minute and worse for everything after — people got lost behind geometry and never found the drop.',
            chose: {
              k: 'We shipped',
              v: 'Rails with local look-around. Movement is constrained to authored paths; the camera can still pan inside each stop.',
            },
            passed: {
              k: 'We passed on',
              v: 'Full orbit. It made every object a potential dead end and doubled the collision work.',
            },
            call: 'Exploration only reads as exploration if you can always find your way back. Rails cost novelty and bought comprehension.',
          },
          {
            kind: 'Controversial',
            title: 'Hiding the drop behind interaction',
            body: 'Product marketing wanted the release visible on load. We wanted it earned — two taps in, behind a door.',
            chose: {
              k: 'We shipped',
              v: 'Earned placement, with a persistent pill that jumps you straight to the drop if you want the shortcut.',
            },
            passed: {
              k: 'We passed on',
              v: 'A hero card on load. It answered the whole page in one glance.',
            },
            call: 'The compromise held: the shortcut protected conversion, and the room still had a secret in it.',
          },
          {
            kind: 'Decision',
            title: 'A hard 60fps floor on mid-tier Android',
            body: 'Frame rate was treated as a design constraint, not a QA pass. Everything past the budget had to justify itself against something already in the scene.',
            chose: {
              k: 'We shipped',
              v: 'One dynamic light, baked ambient occlusion, instanced props, and a dithered shadow catcher instead of real-time shadows.',
            },
            passed: {
              k: 'We passed on',
              v: 'Real-time shadows and post-processing bloom.',
            },
            call: 'The dither ended up defining the look of the whole thing. The constraint became the style.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Payoff',
        title: 'Final artifacts',
        items: [
          { caption: 'The room at launch', span: 12, ratio: '16 / 9' },
          { caption: 'Live event state — 40k concurrent', span: 6, ratio: '3 / 2' },
          { caption: 'Unlock sequence', span: 6, ratio: '3 / 2' },
        ],
      },
      {
        type: 'impact',
        label: 'Impact',
        title: 'What it moved',
        note: 'Measured over the 30-day campaign window against the prior year’s equivalent page.',
        items: [
          {
            n: 4.7,
            suffix: '×',
            k: 'Session length',
            note: 'vs. the previous Air Max Day page',
          },
          {
            n: 61,
            suffix: '%',
            k: 'Returned within the month',
            note: 'driven by scheduled events',
          },
          {
            n: 60,
            suffix: 'fps',
            k: 'Held on mid-tier Android',
            note: 'p95 across the launch window',
          },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'What I’d do differently',
        paras: [
          'The authoring layer arrived late, so the first two events were hand-placed by engineers. If I ran it again the CMS schema would come before the geometry — the room only pays off if the team can furnish it without us.',
          'I’d also cut a third of the props. The scene was legible at forty objects and busy at sixty, and we found that out after the shadow work.',
        ],
      },
    ],
  },

  '.Swoosh 404': {
    display: '.Swoosh 404',
    tagline:
      'A Space Invaders-inspired WebGL game supporting a physical product release.',
    cover: 'Cover — 6s of gameplay, wave two',
    meta: [
      { k: 'Timeline', v: '6 weeks · 2023' },
      { k: 'Scope', v: 'Engineer · game loop, rendering, leaderboard integration' },
      { k: 'Worked with', v: '1 designer, 1 engineer, sound design contractor' },
      { k: 'Stack', v: 'TypeScript, WebGL, Web Audio' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'A 404 page was the last surface anyone was going to fight over, which made it the right place to put a game. The shoe releasing was named 404 — the joke wrote itself, and the error page became campaign real estate.',
        ],
      },
      {
        type: 'text',
        label: 'Context',
        title: 'Why it matters',
        paras: [
          'It proved a small thing internally: play could ship on the same timeline as a product page. Six weeks, two people, no new platform. That argument opened doors for later work.',
        ],
      },
      {
        type: 'assets',
        label: 'Process',
        title: 'Getting it to feel right',
        note: 'Most of the six weeks went into feel, not features.',
        items: [
          { caption: 'Hit feedback — three tuning passes', span: 6, ratio: '16 / 10' },
          { caption: 'Sprite sheet and palette', span: 6, ratio: '16 / 10' },
          { caption: 'Difficulty curve instrumentation', span: 12, ratio: '21 / 9' },
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'Key design moments',
        items: [
          {
            kind: 'Tradeoff',
            title: 'Keyboard-first or touch-first',
            body: 'Traffic was 80% mobile, but the genre is a keyboard genre. Twin-stick controls on a phone felt terrible in the first build.',
            chose: {
              k: 'We shipped',
              v: 'One-axis drag with auto-fire. Your thumb only decides where, never when.',
            },
            passed: { k: 'We passed on', v: 'A virtual joystick plus a fire button.' },
            call: 'Removing the fire button removed the only thing testers complained about.',
          },
          {
            kind: 'Decision',
            title: 'No score wall',
            body: 'A leaderboard was scoped, then cut two weeks in.',
            chose: {
              k: 'We shipped',
              v: 'A personal best held locally, surfaced only after your second run.',
            },
            passed: {
              k: 'We passed on',
              v: 'A global leaderboard with member accounts.',
            },
            call: 'The auth flow was longer than the game. Cutting it kept the whole thing a two-tap experience.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Payoff',
        title: 'Final artifacts',
        items: [
          { caption: 'Launch build', span: 12, ratio: '16 / 9' },
          { caption: 'Wave transitions', span: 6, ratio: '3 / 2' },
          { caption: 'Game over card', span: 6, ratio: '3 / 2' },
        ],
      },
      {
        type: 'impact',
        label: 'Impact',
        title: 'What it moved',
        items: [
          {
            n: 3.1,
            suffix: 'm',
            k: 'Average time on a 404',
            note: 'previously under 10 seconds',
          },
          {
            n: 22,
            suffix: '%',
            k: 'Clicked through to the release',
            note: 'from the game-over card',
          },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'The best decision was scoping it as a toy, not a product. Nothing in it needed to be maintained, so nothing in it needed to be negotiated.',
        ],
      },
    ],
  },

  'Our Force 1 Poster Content Display Page': {
    display: 'Our Force 1',
    tagline:
      'A collection story told through an authorable page, parallax, and animated 3D posters.',
    cover: 'Cover — poster rotating through three collection panels',
    meta: [
      { k: 'Timeline', v: '4 months · 2023' },
      {
        k: 'Scope',
        v: 'Lead engineer · authoring model, scroll system, 3D poster pipeline',
      },
      { k: 'Worked with', v: '3 designers, 2 engineers, editorial team' },
      { k: 'Stack', v: 'React, Three.js, GSAP, headless CMS' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'The collection had eleven chapters and no fixed length — chapters were still being written while we built. A hand-laid page would have been obsolete before launch.',
          'So the deliverable was a grammar, not a layout: nine section types the editorial team could stack in any order, each with a defined scroll behaviour and a defined failure mode.',
        ],
        pull: 'The deliverable was a grammar, not a layout.',
      },
      {
        type: 'text',
        label: 'Context',
        title: 'Why it matters',
        paras: [
          'It shifted who owns the page. Editorial published three chapters after launch with no engineering involvement, which is the only real test of an authoring system.',
        ],
      },
      {
        type: 'assets',
        label: 'Process',
        title: 'The section grammar',
        note: 'Each type had to survive being placed next to any other type.',
        items: [
          { caption: 'Nine section types, adjacency matrix', span: 12, ratio: '21 / 9' },
          { caption: '3D poster — animation states', span: 6, ratio: '4 / 3' },
          { caption: 'Scroll-linked parallax depth study', span: 6, ratio: '4 / 3' },
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'Key design moments',
        items: [
          {
            kind: 'Controversial',
            title: 'Capping parallax depth',
            body: 'Design wanted more separation between layers. At the depth they wanted, text became unreadable mid-scroll on a trackpad.',
            chose: {
              k: 'We shipped',
              v: 'A depth ceiling per section type, with text layers pinned to zero parallax.',
            },
            passed: { k: 'We passed on', v: 'Per-layer freehand depth in the CMS.' },
            call: 'Type that moves while you read it is a bug wearing a costume. The ceiling was the compromise that let everything else stay loose.',
          },
          {
            kind: 'Tradeoff',
            title: 'Real 3D posters or pre-rendered loops',
            body: 'Eleven chapters × three posters is thirty-three assets. Live 3D meant a real engine on the page; pre-rendering meant a render farm and no interactivity.',
            chose: {
              k: 'We shipped',
              v: 'Live 3D for the hero poster, pre-rendered loops for the rest — one engine instance, thirty-two video textures.',
            },
            passed: { k: 'We passed on', v: 'Live 3D everywhere.' },
            call: 'One interactive poster per chapter was enough to sell the idea. The rest just had to move.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Payoff',
        title: 'Final artifacts',
        items: [
          { caption: 'Chapter opening', span: 7, ratio: '16 / 10' },
          { caption: 'Interactive poster', span: 5, ratio: '16 / 10' },
          { caption: 'Full-page scroll capture', span: 12, ratio: '21 / 9' },
        ],
      },
      {
        type: 'impact',
        label: 'Impact',
        title: 'What it moved',
        items: [
          {
            n: 3,
            suffix: '',
            k: 'Chapters shipped without engineering',
            note: 'after launch, by editorial',
          },
          {
            n: 11,
            suffix: '',
            k: 'Chapters on one system',
            note: 'nine reusable section types',
          },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'The adjacency matrix was the highest-leverage artifact of the project and it was a spreadsheet. Constraints documented early are cheaper than constraints discovered in review.',
        ],
      },
    ],
  },

  'EA Sports FC Partner Page': {
    display: 'EA Sports FC',
    tagline:
      'An interactive player viewer and reusable components for the EA Sports FC launch.',
    cover: 'Cover — player viewer orbit, kit swap',
    meta: [
      { k: 'Timeline', v: '7 weeks · 2023' },
      { k: 'Scope', v: 'Engineer · player viewer, shared component work' },
      { k: 'Worked with', v: '2 designers, 3 engineers, EA partner team' },
      { k: 'Stack', v: 'React, Three.js' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'A co-branded launch with a partner’s asset pipeline, a partner’s review cycle, and a fixed date. The interesting engineering problem was not the viewer — it was making the viewer out of parts that already existed.',
        ],
      },
      {
        type: 'assets',
        label: 'Process',
        title: 'Process assets',
        items: [
          { caption: 'Kit-swap material pipeline', span: 6, ratio: '4 / 3' },
          { caption: 'Viewer controls — reach test', span: 6, ratio: '4 / 3' },
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'One decision worth framing',
        items: [
          {
            kind: 'Tradeoff',
            title: 'Fork the viewer or extend the shared one',
            body: 'The shared 3D viewer did 80% of this. Extending it meant negotiating with two other teams’ roadmaps; forking meant shipping on time and owning a duplicate.',
            chose: {
              k: 'We shipped',
              v: 'Extended the shared viewer behind a feature flag, with the partner-specific material work isolated in an adapter.',
            },
            passed: {
              k: 'We passed on',
              v: 'A fork. Faster that week, a tax every week after.',
            },
            call: 'Two other launches used the adapter within a quarter. The negotiation paid for itself.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Payoff',
        title: 'Final artifacts',
        items: [
          { caption: 'Launch page', span: 12, ratio: '16 / 9' },
          { caption: 'Player viewer', span: 6, ratio: '3 / 2' },
          { caption: 'Component set in use elsewhere', span: 6, ratio: '3 / 2' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'Partner work is mostly interface design between organisations. The adapter boundary was the actual deliverable.',
        ],
      },
    ],
  },

  'TINAJ Collection Listing Page': {
    display: 'TINAJ',
    tagline: 'A customizable 3D product viewer for virtual collectibles.',
    cover: 'Cover — customization loop, three colourways',
    meta: [
      { k: 'Timeline', v: '5 weeks · 2023' },
      { k: 'Scope', v: 'Engineer · viewer, customization state, share images' },
      { k: 'Worked with', v: '1 designer, 2 engineers' },
      { k: 'Stack', v: 'React, Three.js' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'Members owned a virtual product they couldn’t really look at. The viewer existed to make ownership feel like something — turn it over, change it, screenshot it.',
        ],
      },
      {
        type: 'assets',
        label: 'Assets',
        title: 'Selected captures',
        items: [
          { caption: 'Customization panel', span: 6, ratio: '4 / 3' },
          { caption: 'Share-image render', span: 6, ratio: '4 / 3' },
          { caption: 'Viewer in context', span: 12, ratio: '16 / 9' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'Share images did more work than the viewer. The thing people wanted was proof, and proof is a picture.',
        ],
      },
    ],
  },

  'Defenders of Dogewood': {
    display: 'Defenders of Dogewood',
    tagline: 'A browser adventure rebuilt with React and animated 3D assets.',
    cover: 'Cover — adventure screen, character idle loop',
    meta: [
      { k: 'Timeline', v: '3 months · 2022' },
      { k: 'Scope', v: 'Engineer · front-end rebuild, animation system' },
      { k: 'Worked with', v: '1 designer, 1 back-end engineer, community team' },
      { k: 'Stack', v: 'React, Three.js, Web3' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'An existing browser game with a live community and a codebase that could no longer be changed safely. The rebuild had to happen without a content freeze — the community expected weekly updates throughout.',
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'One decision worth framing',
        items: [
          {
            kind: 'Tradeoff',
            title: 'Rewrite behind a flag or ship screen by screen',
            body: 'A parallel rewrite is cleaner and invisible until it lands. Shipping screen by screen is messier and gets feedback every week.',
            chose: {
              k: 'We shipped',
              v: 'Screen by screen, oldest-first, with the two codebases sharing a state adapter.',
            },
            passed: {
              k: 'We passed on',
              v: 'A parallel rewrite with a single cutover.',
            },
            call: 'Live communities punish silence more than they punish seams.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Assets',
        title: 'Selected captures',
        items: [
          { caption: 'Adventure screen', span: 7, ratio: '16 / 10' },
          { caption: 'Character animation set', span: 5, ratio: '16 / 10' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'The state adapter outlived both codebases. Seams you design on purpose are assets.',
        ],
      },
    ],
  },

  Anonymice: {
    display: 'Anonymice',
    tagline:
      'A staking experience connecting collectible characters and their in-game economy.',
    cover: 'Cover — staking flow, confirmation state',
    meta: [
      { k: 'Timeline', v: '6 weeks · 2022' },
      { k: 'Scope', v: 'Engineer · staking flow, contract integration' },
      { k: 'Worked with', v: '1 designer, 1 contract engineer' },
      { k: 'Stack', v: 'React, ethers.js' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'The economy already worked on-chain and read as hostile in a browser. This was interface work on top of something irreversible, which changes how you design every confirmation.',
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'One decision worth framing',
        items: [
          {
            kind: 'Decision',
            title: 'Making the irreversible feel irreversible',
            body: 'Every fast, frictionless pattern we knew was wrong here. A one-tap stake is a one-tap mistake.',
            chose: {
              k: 'We shipped',
              v: 'A plain-language summary of exactly what leaves your wallet, shown before signing, in the largest type on the screen.',
            },
            passed: { k: 'We passed on', v: 'A single confirm button with a tooltip.' },
            call: 'Support volume was the metric. It went to near zero.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Assets',
        title: 'Selected captures',
        items: [
          { caption: 'Staking flow', span: 6, ratio: '4 / 3' },
          { caption: 'Confirmation summary', span: 6, ratio: '4 / 3' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: ['Clarity is the whole product when an action can’t be undone.'],
      },
    ],
  },

  Moodie: {
    display: 'Moodie',
    tagline:
      'An infinite discovery canvas for collecting and exploring visual inspiration.',
    cover: 'Cover — canvas pan and zoom, boards resolving',
    meta: [
      { k: 'Timeline', v: 'Ongoing · 2026' },
      { k: 'Scope', v: 'Everything — design, front-end, infrastructure' },
      { k: 'Worked with', v: 'Solo, with a handful of very patient testers' },
      { k: 'Stack', v: 'React, canvas, IndexedDB' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'My own reference collection had become four thousand screenshots in a folder. Every tool I tried made me file things, and filing is the step where collecting dies.',
          'Moodie has no folders. Everything lands on one infinite canvas, and proximity is the only organising principle.',
        ],
        pull: 'Filing is the step where collecting dies.',
      },
      {
        type: 'text',
        label: 'Context',
        title: 'Why it matters',
        paras: [
          'It is the piece I use to test how far interaction can carry structure. If spatial memory can replace a taxonomy for four thousand items, that is worth knowing.',
        ],
      },
      {
        type: 'assets',
        label: 'Process',
        title: 'Process assets',
        note: 'Mostly performance work disguised as interaction work.',
        items: [
          { caption: 'Tile virtualization at four zoom levels', span: 6, ratio: '4 / 3' },
          { caption: 'Drop → thumbnail → placed, in one gesture', span: 6, ratio: '4 / 3' },
          { caption: 'Zoom curve tuning', span: 12, ratio: '21 / 9' },
        ],
      },
      {
        type: 'moments',
        label: 'Decisions',
        title: 'Key design moments',
        items: [
          {
            kind: 'Controversial',
            title: 'No search',
            body: 'The obvious feature. I have not built it, on purpose, for a year.',
            chose: {
              k: 'I shipped',
              v: 'Zoom-to-find. Getting somewhere is always a movement, never a query.',
            },
            passed: { k: 'I passed on', v: 'Text search over tags and OCR.' },
            call: 'Search would let me stop designing the canvas. Every time I have wanted it, the real problem was that zoom was too slow — and that was fixable.',
          },
          {
            kind: 'Tradeoff',
            title: 'Local-first with no account',
            body: 'No sync means no server, no auth, no privacy policy, and no access from a second machine.',
            chose: { k: 'I shipped', v: 'IndexedDB, with export to a single file.' },
            passed: { k: 'I passed on', v: 'Accounts and hosted sync.' },
            call: 'The export file is the sync story until someone other than me needs it.',
          },
        ],
      },
      {
        type: 'assets',
        label: 'Payoff',
        title: 'Final artifacts',
        items: [
          { caption: 'The canvas at 4,000 items', span: 12, ratio: '16 / 9' },
          { caption: 'Zoomed into a cluster', span: 6, ratio: '3 / 2' },
          { caption: 'Drop-in flow', span: 6, ratio: '3 / 2' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'Where it stands',
        paras: [
          'It holds my whole reference library and I have not opened the old folder in months, which is the only success metric I set.',
          'The next problem is sharing a region without sharing the canvas. That probably requires the account I have been avoiding.',
        ],
      },
    ],
  },

  'Minecraft Clone': {
    display: 'Minecraft Clone',
    tagline:
      'A multiplayer voxel world with procedural terrain and custom physics, built in React.',
    cover: 'Cover — terrain generation, first-person walk',
    meta: [
      { k: 'Timeline', v: '2 months · 2022' },
      { k: 'Scope', v: 'Solo — terrain, physics, netcode' },
      { k: 'Worked with', v: 'Solo' },
      { k: 'Stack', v: 'React, Three.js, WebSockets' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'I wanted to understand chunked meshing and collision from the ground up rather than from a tutorial. Voxels are the cheapest way to be forced to learn both.',
        ],
      },
      {
        type: 'assets',
        label: 'Assets',
        title: 'Selected captures',
        items: [
          { caption: 'Chunk meshing — greedy vs. naive', span: 6, ratio: '4 / 3' },
          { caption: 'Terrain noise passes', span: 6, ratio: '4 / 3' },
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'The physics took four times longer than the rendering, which is the lesson.',
        ],
      },
    ],
  },

  'SNK-Y Bot': {
    display: 'SNK-Y Bot',
    tagline:
      'An experiment in release monitoring, browser automation, and restock notifications.',
    cover: 'Cover — terminal output, restock detected',
    meta: [
      { k: 'Timeline', v: '2019 · college' },
      { k: 'Scope', v: 'Solo — scraping, scheduling, notifications' },
      { k: 'Worked with', v: 'Solo' },
      { k: 'Stack', v: 'Node.js, Puppeteer' },
    ],
    blocks: [
      {
        type: 'text',
        label: 'Context',
        title: 'Why it exists',
        paras: [
          'The first thing I built that ran without me watching it. Half of what I know about scheduling, retries, and failing quietly came out of this project breaking at 3am.',
        ],
      },
      {
        type: 'reflection',
        label: 'Reflection',
        title: 'End note',
        paras: [
          'Kept here as a marker. It is not good code and it is the reason the rest is better.',
        ],
      },
    ],
  },
};
