/**
 * The curtain between routes — a blind sweep.
 *
 * Diagonal bands at the palm-frond angle, each released on its own delay,
 * carry an acid field across the outgoing page; the document swaps underneath
 * it; then the same field is taken apart from the opposite corner. Angled
 * rather than orthogonal, so it belongs to the fronds rather than to the grid.
 *
 * It is the same machine as the works-pane wipe, which is the point: one
 * canvas of 12px cells, a 4x4 Bayer threshold on the moving boundary, and a
 * monotonic buffer, so a cell that dithers in never flickers back out and each
 * frame only visits cells that have not resolved yet.
 *
 * The two halves are driven from opposite ends of a route change and there is
 * exactly ONE canvas, mounted outside the router. That is load-bearing: the
 * curtain has to survive the moment the old page unmounts and the new one
 * mounts, and a canvas belonging to either of them cannot. It also means this
 * module, rather than any page, owns the question of whether the curtain is
 * currently up — which is what keeps a route with no transition of its own
 * (the studio, a preview) from being left underneath it forever.
 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Deterministic per-band jitter; the same band is always the same beat late. */
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = p => p * p * (3 - 2 * p);

const CELL = 12;
// Build, pause, take apart. The pause is what makes it a handover rather than
// a wipe: for a beat the reader is looking at neither page.
const BUILD_MS = 640;
const HOLD_MS = 120;
const LIFT_MS = 820;

// Cells per blind, and how far the front is feathered. Five cells is wide
// enough that the stagger reads as separate bands rather than as noise.
const BAND = 5;
const FEATHER = 3;
// How much of the run is spent on the stagger. The exit is looser than the
// entrance, so the page comes back in a less orderly way than it left.
const STAGGER_IN = 0.13;
const STAGGER_OUT = 0.16;

const INK_FALLBACK = '#f1f43b';

/**
 * Coverage, as a function of cell and progress: >= 1 solid, <= 0 untouched,
 * and in between is the dithered edge.
 *
 * `x + y` is the diagonal, so the front runs at 45 degrees. Bands are struck
 * along `x - y` — the perpendicular — so each one is a stripe parallel to the
 * sweep, and the jitter delays whole stripes rather than scattering cells.
 */
const buildField = (w, h) => {
  const range = w + h + FEATHER * 2;
  return (x, y, p) => {
    const late = hash(Math.floor((x - y) / BAND), 3) * STAGGER_IN;
    const lp = clamp01((p - late) / (1 - STAGGER_IN));
    return (ease(lp) * range - (x + y)) / FEATHER;
  };
};

/** The same sweep, measured from the far corner, so the exit runs back. */
const liftField = (w, h) => {
  const range = w + h + FEATHER * 2;
  return (x, y, p) => {
    const late = hash(Math.floor((x - y) / BAND), 11) * STAGGER_OUT;
    const lp = clamp01((p - late) / (1 - STAGGER_OUT));
    return (ease(lp) * range - (w - 1 - x + (h - 1 - y))) / FEATHER;
  };
};

let canvas = null;
let raf = 0;
// Whether the page is currently covered, whether a phase is running, and
// whether a route change has asked for the curtain to come off. The last one
// is a standing request rather than a moment — see liftCurtain.
let raised = false;
let busy = false;
let wantLift = false;

/** Called by the curtain component on mount; pass `null` on unmount. */
export function setCurtainCanvas(el) {
  canvas = el;
  if (!el) {
    cancelAnimationFrame(raf);
    raf = 0;
    raised = false;
    busy = false;
    wantLift = false;
  }
}

const reduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ink = () => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--acid')
    .trim();
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : INK_FALLBACK;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
};

/**
 * One half of the curtain.
 *
 * @param {boolean} remove - take the field apart rather than lay it down.
 * @param {number} duration
 * @returns {Promise<void>} settled when the last cell has resolved.
 */
const phase = (remove, duration) =>
  new Promise(resolve => {
    if (!canvas) {
      resolve();
      return;
    }
    const w = Math.max(1, Math.ceil(window.innerWidth / CELL));
    const h = Math.max(1, Math.ceil(window.innerHeight / CELL));
    // Sizing clears the canvas, so the starting state is written into the
    // buffer and put back in the same task — the cleared frame is never
    // composited, and the curtain does not blink between the two halves.
    canvas.width = w;
    canvas.height = h;
    canvas.style.opacity = '1';
    const ctx = canvas.getContext('2d');
    const [r, g, b] = ink();
    const image = ctx.createImageData(w, h);
    const d = image.data;
    if (remove) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const field = (remove ? liftField : buildField)(w, h);
    const start = performance.now();
    const frame = now => {
      const p = Math.min(1, (now - start) / duration);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const filled = d[i + 3] !== 0;
          // Monotonic: only cells still on the wrong side of the front are
          // considered, so nothing that has resolved can resolve back.
          if (remove ? !filled : filled) continue;
          const s = field(x, y, p);
          if (s <= 0) continue;
          if (s < 1 && s < bayer(x, y)) continue;
          if (remove) {
            d[i + 3] = 0;
          } else {
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      if (p < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      raf = 0;
      resolve();
    };
    raf = requestAnimationFrame(frame);
  });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const lift = async () => {
  // A request made before there is anything to lift STANDS. It is not
  // satisfied and it is not dropped — see liftCurtain.
  if (!raised) return;
  wantLift = false;
  busy = true;
  await wait(HOLD_MS);
  await phase(true, LIFT_MS);
  raised = false;
  busy = false;
  if (canvas) canvas.style.opacity = '0';
};

/**
 * Cover the page. Settles when it is fully covered, which is the moment the
 * document underneath can safely be swapped.
 */
export async function buildCurtain() {
  if (!canvas || reduced()) return;
  busy = true;
  await phase(false, BUILD_MS);
  raised = true;
  busy = false;
  // Deliberately not awaited. This function resolves into the document swap,
  // and the hold at the top of the lift is the window that swap happens in —
  // awaiting here would keep the outgoing page mounted until the curtain had
  // already come off, and the reader would watch the page they just left being
  // revealed again.
  if (wantLift) lift();
}

/**
 * Ask for the curtain to come off.
 *
 * The request is durable rather than immediate, and that is the whole of the
 * subtlety here. A route change is announced the moment navigation starts —
 * before the outgoing page has even begun raising the curtain — so by the time
 * there is something to take off, the asking is long over. The request stands
 * instead, and the build hands over to it on the frame it finishes.
 *
 * Standing indefinitely is correct rather than merely tolerable. Every curtain
 * that goes up is one a navigation put there, and no navigation wants to be
 * left underneath one — including the routes that have no transition of their
 * own and so never ask for this themselves.
 */
export async function liftCurtain() {
  if (!canvas) return;
  wantLift = true;
  if (busy) return;
  await lift();
}
