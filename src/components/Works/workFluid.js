/**
 * The wake behind the cursor in the works pane.
 *
 * A small incompressible fluid: the pointer injects velocity and dye, the
 * velocity field advects itself, a Jacobi solve removes divergence, and the dye
 * rides the result. Removing divergence is what makes it read as a *wake* — an
 * unprojected field just radiates rings outward from the cursor, while a
 * divergence-free one folds and shears the way a liquid does.
 *
 * It runs at 192 cells across regardless of viewport, and paints at a 3px
 * pitch through a Bayer threshold, so the cost is fixed and the output matches
 * the page's dithered language. Nothing here displaces the artwork: the dye is
 * drawn to its own canvas behind the content at low opacity.
 *
 * A held press is the one other thing that stirs it. Holding anything in the
 * pane sends rings out from the point the press started, one after another,
 * for as long as the button is down — the wake the pointer already leaves,
 * standing still and repeating. They are injected as DYE rather than as
 * velocity: the projection below exists precisely to stop the field radiating
 * rings, so a radial push would be cancelled by the same pass that makes the
 * wake read as liquid. The dye rides the field it lands in instead, which is
 * why the rings fold and shear as they spread instead of staying circles.

 *
 * Self-clears after 2.6s of no pointer input, so an idle tab settles to zero
 * work rather than simulating an empty field forever.
 */
import { heldPress } from '../../utils/cursorFx.js';

const WIDTH = 192;
const PITCH = 3;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PRESSURE_PASSES = 10;
const IDLE_MS = 2600;
const FIELDS = 9;
// A ring every sixth of a second. Close enough that the fronts overlap while
// the first is still crossing the pane, so a held press reads as one
// continuous disturbance rather than as a series of separate rings.
const RIPPLE_EVERY_MS = 165;
// Grid cells per frame. The grid is 192 across, so a ring crosses most of the
// pane in something under two seconds — about the length of a held press.
const RIPPLE_SPEED = 0.92;
// Half-width of the front. Under two cells it falls through the Bayer
// threshold in patches; much over three and it stops reading as a ring.
const RIPPLE_BAND = 2.6;
// Where a ring gives up, as a fraction of the grid's width.
const RIPPLE_REACH = 0.55;
// Ceiling on how much dye a ring can lay down, and how fast it lays it.
//
// Short of 1 on purpose. The renderer draws a light pixel only where the dye
// has a gradient, so what is seen is never the dye itself but the EDGES of it;
// the pointer's own wake goes all the way to 1, and it has to stay legible
// crossing ground the rings have already been over.
const RIPPLE_DYE_MAX = 0.86;
const RIPPLE_DEPOSIT = 0.5;
// A hard cap on rings in flight. At the cadence above a hold never reaches it;
// it exists so that a press held for a minute cannot turn into unbounded work.
const RIPPLE_LIMIT = 16;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/**
 * @param {HTMLElement} section - element the pointer is tracked against.
 * @param {HTMLCanvasElement} canvas - canvas the dye is painted to.
 * @returns {{paint:(t:number)=>void, clear:()=>void, setEnabled:(v:boolean)=>void, destroy:()=>void}}
 */
export function createWorkFluid(section, canvas) {
  const ctx = canvas.getContext('2d');

  let w = WIDTH;
  let h = 24;
  let vx, vy, nextX, nextY, dye, nextDye, pressure, nextPressure, divergence;
  let previous = null;
  // Rings in flight, in grid coordinates: where each started and when.
  let ripples = [];
  let lastRipple = 0;
  let lastInput = 0;
  let lastTick = 0;
  let enabled = true;

  function resize() {
    w = WIDTH;
    const viewH = Math.min(window.innerHeight, section.offsetHeight);
    h = Math.max(24, Math.ceil((viewH / window.innerWidth) * w));
    const size = w * h;
    [vx, vy, nextX, nextY, dye, nextDye, pressure, nextPressure, divergence] =
      Array.from({ length: FIELDS }, () => new Float32Array(size));
    canvas.width = Math.ceil(window.innerWidth / PITCH);
    canvas.height = Math.ceil(viewH / PITCH);
    previous = null;
  }

  function clear() {
    for (const field of [
      vx, vy, nextX, nextY, dye, nextDye, pressure, nextPressure, divergence,
    ]) {
      field.fill(0);
    }
    previous = null;
    ripples = [];
    lastRipple = 0;
    lastInput = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Bilinear sample, clamped to the interior so advection can't read OOB. */
  function sample(field, x, y) {
    x = clamp(x, 0, w - 1.001);
    y = clamp(y, 0, h - 1.001);
    const ix = x | 0;
    const iy = y | 0;
    const fx = x - ix;
    const fy = y - iy;
    const i = iy * w + ix;
    return (
      (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) +
      (field[i + w] * (1 - fx) + field[i + w + 1] * fx) * fy
    );
  }

  function onPointer(event) {
    const rect = section.getBoundingClientRect();
    const now = performance.now();

    // Touch drags the page rather than steering a cursor, so it injects
    // nothing — otherwise scrolling would leave a wake behind it.
    if (
      !enabled ||
      event.pointerType === 'touch' ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      previous = null;
      return;
    }

    const x = (event.clientX / window.innerWidth) * w;
    const y = ((event.clientY - Math.max(0, rect.top)) / window.innerWidth) * w;

    if (previous) {
      const dx = x - previous.x;
      const dy = y - previous.y;
      const dt = clamp((now - previous.time) / 16.667, 0.5, 3);
      const speed = Math.hypot(dx, dy) / dt;
      const radius = clamp(speed * 18, 1.5, h * 0.15);
      const steps = Math.min(24, Math.max(1, Math.ceil(Math.hypot(dx, dy))));

      // Below this the pointer is effectively at rest; injecting anyway makes
      // a permanent smudge under a parked cursor.
      if (speed > 0.015) {
        for (let s = 0; s <= steps; s++) {
          const px = previous.x + (dx * s) / steps;
          const py = previous.y + (dy * s) / steps;
          const y0 = Math.max(1, Math.floor(py - radius * 2));
          const y1 = Math.min(h - 1, py + radius * 2);
          const x0 = Math.max(1, Math.floor(px - radius * 2));
          const x1 = Math.min(w - 1, px + radius * 2);
          for (let yy = y0; yy < y1; yy++) {
            for (let xx = x0; xx < x1; xx++) {
              const falloff = Math.pow(
                Math.max(0, 1 - Math.hypot(xx - px, yy - py) / radius),
                3,
              );
              const i = yy * w + xx;
              vx[i] += (clamp(dx / dt, -8, 8) * falloff * 0.7) / (steps + 1);
              vy[i] += (clamp(dy / dt, -8, 8) * falloff * 0.7) / (steps + 1);
              dye[i] = Math.min(1, dye[i] + (falloff * 1.1) / (steps + 1));
            }
          }
        }
        lastInput = now;
      }
    }

    previous = { x, y, time: now };
  }

  /**
   * The rings a held press is sending out.
   *
   * Called before the solve, so a ring's dye is advected by the same step that
   * moves everything else — a front that has just been laid down is already
   * being carried by whatever the field was doing.
   */
  function pumpRipples(now, dt) {
    const press = enabled ? heldPress() : null;
    if (press) {
      const rect = section.getBoundingClientRect();
      if (press.y >= rect.top && press.y <= rect.bottom) {
        if (now - lastRipple > RIPPLE_EVERY_MS) {
          lastRipple = now;
          ripples.push({
            x: (press.x / window.innerWidth) * w,
            y: ((press.y - Math.max(0, rect.top)) / window.innerWidth) * w,
            radius: 0,
          });
        }
        lastInput = now;
      }
    } else {
      // Releasing stops new rings; the ones already out keep travelling.
      lastRipple = 0;
    }
    if (ripples.length > RIPPLE_LIMIT) {
      ripples.splice(0, ripples.length - RIPPLE_LIMIT);
    }
    if (!ripples.length) return;

    const reach = w * RIPPLE_REACH;
    for (const ring of ripples) {
      ring.radius += RIPPLE_SPEED * dt;
      // The front thins as it spreads: the same dye over a longer circumference.
      //
      // `spent` is clamped before the power, and the guard is written as
      // `!(x > 0)` rather than `x <= 0`. Both are about the same frame — the
      // one where a ring's radius passes its reach, before the cull at the
      // bottom of this function has seen it. Unclamped, `1 - spent` goes
      // negative there and a fractional power of a negative is NaN; NaN fails
      // `<= 0`, so the guard let it through, it landed in the dye, and NaN does
      // not decay. From then on every comparison in the renderer read false and
      // fell through to "paint it dark", which is how a single frame's arithmetic
      // turned into a flat slab of dark blue that no amount of waiting cleared
      // and no new input could disturb.
      const spent = Math.min(1, ring.radius / reach);
      const amplitude = Math.pow(1 - spent, 1.6) * 0.95;
      if (!(amplitude > 0)) continue;

      // Only the band itself is walked, never the disc inside it. Solving the
      // row's two spans costs one square root each and turns a ring from
      // quadratic work into linear — which is what makes a dozen of them in
      // flight at once affordable.
      const outer = ring.radius + RIPPLE_BAND;
      const inner = Math.max(0, ring.radius - RIPPLE_BAND);
      const y0 = Math.max(1, Math.ceil(ring.y - outer));
      const y1 = Math.min(h - 1, Math.floor(ring.y + outer));
      for (let yy = y0; yy <= y1; yy++) {
        const dy = yy - ring.y;
        const half = Math.sqrt(Math.max(0, outer * outer - dy * dy));
        const hole = inner > Math.abs(dy)
          ? Math.sqrt(inner * inner - dy * dy)
          : 0;
        // Left span, then right. A row that clears the hole entirely is one
        // span and the second pass is skipped. Written out rather than built
        // as a pair of arrays: this runs a hundred-odd times per ring per
        // frame, and the garbage is the expensive part.
        for (let side = 0; side < 2; side++) {
          if (side === 1 && hole === 0) break;
          const from = side === 0 ? ring.x - half : ring.x + hole;
          const to =
            side === 0 ? (hole > 0 ? ring.x - hole : ring.x + half) : ring.x + half;
          const a = Math.max(1, Math.ceil(from));
          const b = Math.min(w - 1, Math.floor(to));
          for (let xx = a; xx <= b; xx++) {
            const dx = xx - ring.x;
            const offset = Math.abs(Math.hypot(dx, dy) - ring.radius);
            if (offset > RIPPLE_BAND) continue;
            // Raised cosine across the band, so the front has no hard edge to
            // alias against the dither lattice.
            const falloff =
              0.5 + 0.5 * Math.cos((offset / RIPPLE_BAND) * Math.PI);
            const i = yy * w + xx;
            const laid = dye[i] + falloff * amplitude * RIPPLE_DEPOSIT * dt;
            dye[i] = Math.min(Math.max(dye[i], RIPPLE_DYE_MAX), laid);
          }
        }
      }
    }
    ripples = ripples.filter(ring => ring.radius < reach);
  }

  function step(dt) {
    // Advect velocity along itself, with a mild decay so a flick dies out.
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const px = x - vx[i] * dt;
        const py = y - vy[i] * dt;
        nextX[i] = sample(vx, px, py) * Math.pow(0.985, dt);
        nextY[i] = sample(vy, px, py) * Math.pow(0.985, dt);
      }
    }
    [vx, nextX] = [nextX, vx];
    [vy, nextY] = [nextY, vy];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        divergence[i] = -0.5 * (vx[i + 1] - vx[i - 1] + vy[i + w] - vy[i - w]);
        pressure[i] = 0;
      }
    }

    // Jacobi pressure solve. Ten passes is well short of convergence but the
    // residual reads as viscosity here, which suits the material.
    for (let pass = 0; pass < PRESSURE_PASSES; pass++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          nextPressure[i] =
            (divergence[i] +
              pressure[i - 1] +
              pressure[i + 1] +
              pressure[i - w] +
              pressure[i + w]) *
            0.25;
        }
      }
      [pressure, nextPressure] = [nextPressure, pressure];
    }

    // Subtract the pressure gradient, then carry the dye on the result.
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        vx[i] -= 0.5 * (pressure[i + 1] - pressure[i - 1]);
        vy[i] -= 0.5 * (pressure[i + w] - pressure[i - w]);
        nextDye[i] =
          sample(dye, x - vx[i] * dt, y - vy[i] * dt) * Math.pow(0.95, dt);
      }
    }
    [dye, nextDye] = [nextDye, dye];
  }

  function paint(time) {
    const rect = section.getBoundingClientRect();
    // The pane is pinned, so the canvas tracks the section as it scrolls past.
    canvas.style.top = `${Math.max(0, -rect.top)}px`;
    if (!enabled) return;

    const dt = clamp((time - lastTick) / 16.667, 0.5, 2.5);
    lastTick = time;
    pumpRipples(time, dt);
    if (!lastInput) return;
    if (time - lastInput > IDLE_MS) {
      clear();
      return;
    }
    step(dt);

    const image = ctx.createImageData(canvas.width, canvas.height);
    const data = image.data;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const u = (x / canvas.width) * (w - 1.001);
        const v = (y / canvas.height) * (h - 1.001);
        const mask = sample(dye, u, v);
        if (mask < 0.02) continue;

        // Paired light and dark edges along the dye gradient give the wake a
        // refracted, glassy surface instead of a flat blob.
        const normal =
          (sample(dye, u + 1, v) - sample(dye, u - 1, v)) * 0.8 +
          (sample(dye, u, v + 1) - sample(dye, u, v - 1)) * 0.5;
        const strength = Math.min(0.85, Math.abs(normal) * 4 + mask * 0.17);
        const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        if (strength < threshold) continue;

        const i = (y * canvas.width + x) * 4;
        const color = normal > 0 ? [160, 160, 255] : [29, 24, 159];
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 180;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  const onScroll = () => {
    previous = null;
  };

  const observer = new ResizeObserver(resize);
  observer.observe(section);
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  resize();

  return {
    paint,
    clear,
    setEnabled(value) {
      enabled = value;
      if (!value) clear();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
    },
  };
}
