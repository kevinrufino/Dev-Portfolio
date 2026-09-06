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
 * Self-clears after 2.6s of no pointer input, so an idle tab settles to zero
 * work rather than simulating an empty field forever.
 */
const WIDTH = 192;
const PITCH = 3;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const PRESSURE_PASSES = 10;
const IDLE_MS = 2600;
const FIELDS = 9;

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
