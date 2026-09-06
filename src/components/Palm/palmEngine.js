/**
 * The pixel palm.
 *
 * One continuous palm anchored over the intro with its crown cropped, which
 * travels into the footer as the page scrolls and shifts blue -> gold across
 * that journey. It draws into a low-resolution buffer that is then presented on
 * the page's shared 6px lattice, so it is made of the same cells as the section
 * grids and the pixel trail rather than sitting on top of them as smooth
 * canvas art.
 *
 * Framework-free by design: it owns two canvases and a pose, and React has
 * nothing useful to contribute to a per-frame raster. PalmScene.js drives
 * `render` from a throttled loop and feeds it viewport rects.
 *
 * Deterministic: the LCG is seeded, so coconut placement and star timing are
 * identical on every load and a visual regression is reproducible.
 *
 * Three throttles are built in, because this is the most expensive thing on
 * the page: the presenter is capped well below 60fps by its caller, the whole
 * frame is skipped while only the works section is on screen (the palm is
 * clipped out of it anyway), and the frond leaflets are batched into three
 * line-width buckets so a frond costs four stroke() calls rather than ~500.
 */

const GRID = 6;
const GAP = 1;

let seed = 41;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// Frond descriptors: [endX, endY, ctrlX, ctrlY] relative to the crown (300,215)
export const fronds = [
  [-226, 39, -150, -130], [-207, 140, -180, -17], [-150, 198, -173, 42],
  [-65, 187, -107, 38], [40, 193, 66, 43], [162, 152, 162, -7],
  [232, 58, 158, -108], [175, -45, 94, -126], [63, -105,37, -125],
  [-74, -91, -62, -135],
];

const bez = (t, p0, p1, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
const cubic = (t, a, b, c, d) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createPalmScene({ displayCanvas, getConfig, getRects }) {
  const dc = displayCanvas.getContext('2d');
  const sceneGrid = document.createElement('canvas');
  const fc = sceneGrid.getContext('2d', { willReadFrequently: true });

  let cfg = getConfig();
  let pose = null;
  let gridOffset = 0;
  let animTime = 0;
  let lastFrame = 0;
  let shakeStarted = -Infinity;
  let pointer = { x: -1000, y: -1000 };
  const snapBursts = [];

  // ── wind ──────────────────────────────────────────────────────────────────
  const palmShake = time => {
    const age = (time - shakeStarted) / 1000;
    return age >= 0 && age < 0.85 ? Math.sin(age * 38) * Math.exp(-age * 4.5) * 19 : 0;
  };

  function windTarget(p, time) {
    const t = time * 0.001;
    const wind = (cfg.wind ? Math.sin(t * 0.85) * 19 + Math.sin(t * 1.43 + 0.7) * 7 : 0) +
      (cfg.snap ? palmShake(time) : 0);
    const height = clamp((655 - p.y) / 440, 0, 1);
    let x = p.x + wind * height * height;
    let y = p.y;
    if (p.part === 'leaf') {
      const phase = p.frond * 0.73;
      const reach = p.reach;
      const angle = (cfg.wind
        ? (Math.sin(t * 1.65 + phase) * 0.055 + Math.sin(t * 2.8 + phase) * 0.018) * reach
        : 0) + (cfg.snap ? palmShake(time) * 0.0015 * reach : 0);
      const dx = p.x - 300;
      const dy = p.y - 215;
      x = p.x + wind + dx * (Math.cos(angle) - 1) - dy * Math.sin(angle);
      y = p.y + dx * Math.sin(angle) + dy * (Math.cos(angle) - 1);
      if (cfg.wind) y += Math.sin(t * 4.1 - reach * 7 + phase) * 3.5 * reach * reach;
    }
    return { x, y };
  }

  function pointerOffset(x, y, time, mx, my) {
    if (cfg.effect === 'off') return { x, y };
    const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy);
    const shift = Math.max(0, 1 - d / 85) ** 2 * cfg.strength * 12;
    if (shift < 0.01) return { x, y };
    if (cfg.effect === 'breeze') return { x: x + shift, y: y + Math.sin(time * 0.002 + y * 0.02) * shift * 0.25 };
    if (cfg.effect === 'repel') return { x: x + dx / (d || 1) * shift, y: y + dy / (d || 1) * shift };
    if (cfg.effect === 'attract') return { x: x - dx / (d || 1) * shift, y: y - dy / (d || 1) * shift };
    return { x: x - dy / (d || 1) * shift, y: y + dx / (d || 1) * shift };
  }

  const frondPoint = (x, y, t, index, time, mx, my) => {
    const q = windTarget({ x, y, part: 'leaf', frond: index, reach: t }, time);
    return pointerOffset(q.x, q.y, time, mx, my);
  };

  // ── palette: blue crown → gold, bark darker ───────────────────────────────
  function treePalette() {
    const t = pose ? pose.progress : 0;
    const gold = [[167, 122, 17], [206, 160, 29], [235, 192, 53], [255, 222, 111]];
    const blue = [[45, 91, 168], [64, 132, 213], [105, 182, 241], [177, 223, 255]];
    return blue.map((c, i) => c.map((v, j) => Math.round(v + (gold[i][j] - v) * t)));
  }

  const strokeSamples = (ctx, samples) => {
    ctx.beginPath();
    samples.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  };

  // colors: { bark, light, dark }. Leaflets are batched into three line-width
  // buckets so a frond costs four stroke() calls instead of ~500 — the palm is
  // rasterized onto 6px cells, so the quantization is invisible.
  const BUCKETS = [1.55, 2.0, 2.45];
  function drawSmoothPalm(ctx, time, mx, my, colors) {
    const edge = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      edge.push({ x: cubic(t, 310, 325, 342, 306), y: cubic(t, 655, 500, 335, 213), part: 'trunk' });
    }
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      edge.push({ x: cubic(t, 294, 320, 294, 286), y: cubic(t, 212, 353, 521, 655), part: 'trunk' });
    }
    ctx.fillStyle = colors.bark;
    ctx.beginPath();
    edge.forEach((p, i) => {
      const base = windTarget(p, time);
      const q = pointerOffset(base.x, base.y, time, mx, my);
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fill();
    fronds.forEach(([ex, ey, cx, cy], index) => {
      ctx.strokeStyle = index % 3 === 0 ? colors.light : colors.dark;
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      const spine = [];
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        spine.push(frondPoint(bez(t, 300, 300 + cx, 300 + ex), bez(t, 215, 215 + cy, 215 + ey), t, index, time, mx, my));
      }
      strokeSamples(ctx, spine);
      const groups = [[], [], []];
      for (let t = 0.06; t < 0.98; t += 0.036) {
        const x = bez(t, 300, 300 + cx, 300 + ex);
        const y = bez(t, 215, 215 + cy, 215 + ey);
        const dx = 2 * (1 - t) * cx + 2 * t * (ex - cx);
        const dy = 2 * (1 - t) * cy + 2 * t * (ey - cy);
        const len = Math.hypot(dx, dy);
        const width = Math.sin(t * Math.PI) ** 0.75 * (19 + Math.abs(ex) * 0.045);
        const stroke = 1.4 + Math.sin(t * Math.PI) * 1.2;
        const bucket = stroke < 1.8 ? 0 : stroke < 2.25 ? 1 : 2;
        for (const side of [-1, 1]) {
          const tx = x + dx / len * width * 0.43 - dy / len * width * side;
          const ty = y + dy / len * width * 0.43 + dx / len * width * side + width * 0.5;
          const leaf = [];
          for (let k = 0; k <= 8; k++) {
            const u = k / 8;
            leaf.push(frondPoint(bez(u, x, tx - dx / len * 8, tx), bez(u, y, ty - 6, ty), t, index, time, mx, my));
          }
          groups[bucket].push(leaf);
        }
      }
      groups.forEach((group, i) => {
        if (!group.length) return;
        ctx.lineWidth = BUCKETS[i];
        ctx.beginPath();
        for (const leaf of group) {
          leaf.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        }
        ctx.stroke();
      });
    });
  }

  // Blue crown → gold, with a darker trunk than the fronds.
  function drawGridPalm(ctx, time, mx, my) {
    const palette = treePalette();
    const blend = pose ? pose.progress : 0;
    const bark = [96, 66, 14].map((v, j) => Math.round(palette[1][j] + (v - palette[1][j]) * blend));
    const rgb = c => 'rgb(' + c.join(',') + ')';
    drawSmoothPalm(ctx, time, mx, my, {
      bark: rgb(bark), light: rgb(palette[2]), dark: rgb(palette[0]),
    });
  }

  // ── coconuts ──────────────────────────────────────────────────────────────
  const nuts = Array.from({ length: 4 }, (_, i) => ({
    homeX: 280 + i * 16, homeY: 226 + (i % 2) * 16,
    x: 280 + i * 16, y: 226 + (i % 2) * 16,
    r: 27 + (i % 2) * 4, vx: 0, vy: 0, angle: 0, state: 'attached',
    bounce: 0.08 + random() * 0.05, friction: 0.18 + random() * 0.35,
    grip: 0.68 + random() * 0.25, waveResponse: 0.65 + random() * 0.6,
  }));

  // Chunkier sprite: a 16px source grid keeps the pixels crisp at the larger
  // on-screen size instead of smearing a 12px one.
  const pixelNut = document.createElement('canvas');
  pixelNut.width = 16; pixelNut.height = 16;
  const nc = pixelNut.getContext('2d');
  function drawPixelCoconut(ctx, n) {
    nc.clearRect(0, 0, 16, 16);
    nc.save(); nc.translate(8, 8); nc.rotate(n.angle);
    const palette = ['#4a2c19', '#8f5a33', '#c08a4f', '#e8bd7e'];
    nc.fillStyle = palette[1];
    nc.beginPath(); nc.ellipse(0, 0, 7, 6.4, 0, 0, Math.PI * 2); nc.fill();
    nc.fillStyle = palette[2]; nc.fillRect(-5, -4, 4, 3);
    nc.fillStyle = palette[3]; nc.fillRect(-4, -5, 3, 2);
    nc.fillStyle = palette[0];
    nc.fillRect(1, 1, 3, 3); nc.fillRect(-1, 4, 2, 2);
    nc.restore();
    const frame = nc.getImageData(0, 0, 16, 16);
    for (let i = 3; i < frame.data.length; i += 4) frame.data[i] = frame.data[i] > 110 ? 255 : 0;
    nc.putImageData(frame, 0, 0);
    ctx.save(); ctx.rotate(-n.angle); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixelNut, -n.r, -n.r, n.r * 2, n.r * 2); ctx.restore();
  }

  function stepCoconut(n, dt, ground, left, right) {
    if (n.state === 'attached') return;
    if (n.state === 'falling') {
      n.vy += 420 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.angle += n.vx / n.r * dt;
      if (n.y + n.r >= ground) {
        n.y = ground - n.r;
        n.vy = -Math.abs(n.vy) * n.bounce;
        n.vx = n.vx * n.grip + Math.sin(n.angle * 2.7) * 9;
        if (Math.abs(n.vy) < 45) { n.vy = 0; n.state = 'rolling'; }
      }
    } else {
      const dx = n.vx * dt;
      n.x += dx; n.angle += dx / n.r;
      n.vx *= Math.exp(-n.friction * dt);
      if (Math.abs(n.vx) < 1) n.vx = 0;
    }
    if (n.x - n.r < left) { n.x = left + n.r; n.vx = Math.abs(n.vx) * 0.45; }
    if (n.x + n.r > right) { n.x = right - n.r; n.vx = -Math.abs(n.vx) * 0.45; }
  }

  function surfLayers(time, footer) {
    const reach = Math.min(footer.width * 0.34, 390) + footer.left;
    const t = time * 0.001;
    return Array.from({ length: 3 }, (_, layer) => {
      const phase = ((t + layer * 2.3) % 7) / 7;
      const sine = Math.sin(Math.PI * phase);
      const extent = reach * (1 - layer * 0.14);
      return {
        phase, front: extent * sine ** 0.8,
        velocity: extent * 0.8 * Math.PI / 7 * Math.cos(Math.PI * phase) * Math.max(sine, 0.05) ** -0.2,
        crestHeight: (12 + layer * 8) * (1 - phase * 0.65),
      };
    });
  }

  function washCoconut(n, dt, time, p) {
    if (n.state === 'attached' || n.y + n.r < p.ground - 24) return;
    const screenX = p.ox + n.x * p.scale;
    const wet = surfLayers(time, p.footer).filter(w => screenX - n.r * p.scale < w.front + 22 && screenX > 0);
    if (!wet.length) {
      n.backwash = Math.max(0, (n.backwash || 0) - dt);
      if (n.backwash > 0) n.vx += (-32 / p.scale - n.vx) * (1 - Math.exp(-2 * n.waveResponse * dt));
      return;
    }
    const wave = wet.reduce((a, b) => (Math.abs(a.front - screenX) < Math.abs(b.front - screenX) ? a : b));
    const flow = wave.velocity / p.scale;
    const reach = Math.min(p.footer.width * 0.34, 390) + p.footer.left;
    const shore = clamp(1 - screenX / reach, 0, 1);
    const target = flow > 0 ? Math.max(35, flow * 0.7) : Math.max(-100 / p.scale, flow * (0.65 + shore * 0.4));
    n.backwash = flow < 0 ? 0.85 : 0;
    n.vx += (target - n.vx) * (1 - Math.exp(-3 * n.waveResponse * dt));
    if (n.state === 'rolling' && flow > 35) { n.state = 'falling'; n.vy = -6; }
  }

  function drawFooterSurf(time, footer, progress) {
    if (!cfg.waves || progress < 0.25) return;
    const floor = footer.bottom - 54;
    const alpha = Math.min(1, (progress - 0.25) / 0.55);
    const t = time * 0.001;
    fc.save();
    fc.beginPath(); fc.rect(0, footer.top, footer.right, footer.height - 53); fc.clip();
    for (const [layer, wave] of surfLayers(time, footer).entries()) {
      const { phase, front, crestHeight } = wave;
      const fade = Math.sin(Math.PI * phase) * alpha;
      for (let x = 0; x < front; x += 4) {
        const edge = Math.max(0, 1 - x / front);
        const ripple = Math.sin(x * 0.035 - t * 1.8 + layer) * 3 + Math.sin(x * 0.087 + t) * 1.5;
        const height = Math.max(2, crestHeight * edge + ripple);
        fc.globalAlpha = fade * 0.3; fc.fillStyle = '#8bb2c4';
        fc.fillRect(x, Math.round((floor - height) / 3) * 3, 4, Math.ceil(height / 3) * 3);
        const grain = Math.sin(x * 12.37 + layer * 41.2) * 43758.5453;
        const noise = grain - Math.floor(grain);
        if (noise > 0.25) {
          fc.globalAlpha = fade * (0.5 + noise * 0.5); fc.fillStyle = '#e9f2ed';
          fc.fillRect(x, Math.round((floor - height) / 3) * 3, noise > 0.72 ? 6 : 3, 3);
        }
        if (noise > 0.83) {
          fc.globalAlpha = fade * 0.45;
          fc.fillRect(x - 7, Math.round((floor - height - 5 - edge * 7) / 3) * 3, 3, 2);
        }
      }
      fc.globalAlpha = fade * 0.75; fc.fillStyle = '#f4f6ed';
      for (let i = 0; i < 5; i++) fc.fillRect(Math.round((front - i * 5) / 3) * 3, floor - 3 - (i % 2) * 3, 3, 3);
    }
    fc.restore();
  }

  // ── snap bursts (coconut release) ─────────────────────────────────────────
  const snapSheet = document.createElement('canvas');
  snapSheet.width = 160; snapSheet.height = 32;
  const sc = snapSheet.getContext('2d');
  for (let frame = 0; frame < 5; frame++) {
    const cx = frame * 32 + 16, cy = 16, r = 3 + frame * 2;
    sc.fillStyle = frame < 2 ? '#fff4cc' : '#ddbd79';
    for (let ray = 0; ray < 8; ray++) {
      const angle = ray * Math.PI / 4;
      const x = Math.round(Math.cos(angle) * r / 2) * 2;
      const y = Math.round(Math.sin(angle) * r / 2) * 2;
      sc.fillRect(cx + x - 1, cy + y - 1, frame < 3 ? 3 : 2, frame < 3 ? 3 : 2);
    }
    if (frame < 2) { sc.fillStyle = '#fffdf1'; sc.fillRect(cx - 1, cy - 5, 2, 4); sc.fillRect(cx + 1, cy + 1, 2, 4); }
  }
  function drawSnapBursts(dt) {
    for (let i = snapBursts.length - 1; i >= 0; i--) {
      const burst = snapBursts[i];
      burst.age += dt;
      if (burst.age >= 0.4) { snapBursts.splice(i, 1); continue; }
      const frame = Math.min(4, Math.floor(burst.age / 0.08));
      fc.save(); fc.imageSmoothingEnabled = false; fc.globalAlpha = frame === 4 ? 0.5 : 1;
      fc.drawImage(snapSheet, frame * 32, 0, 32, 32, burst.x - 24, burst.y - 24, 48, 48);
      fc.restore();
    }
  }

  // ── sparse shooting stars, in screen space ────────────────────────────────
  let stars = [], nextStarAt = 0;
  // Denser than it was. One star every three to seven seconds meant most
  // readers crossed the intro and the footer without seeing a single one, and
  // a thing nobody sees is not restraint. Roughly one in the air at any time
  // now, in ones and occasional pairs so the rhythm stays irregular.
  const spawnStar = band => ({
    x: band.left + random() * band.width * 0.55,
    y: band.top + random() * Math.max(60, band.height * 0.42),
    age: 0, life: 1.15 + random() * 0.4, speed: 220 + random() * 90,
  });
  function drawStars(time, dt, band) {
    if (!cfg.stars || !band) { stars = []; return; }
    if (time >= nextStarAt) {
      stars.push(spawnStar(band));
      if (random() < 0.28) stars.push(spawnStar(band));
      nextStarAt = time + 650 + random() * 1350;
    }
    stars = stars.filter(s => s.age < s.life);
    const gold = pose ? pose.progress : 0;
    for (const star of stars) {
      star.age += dt; star.x += star.speed * dt; star.y += star.speed * 0.52 * dt;
      const fade = Math.min(star.age / 0.14, 1, Math.max(0, (star.life - star.age) / 0.35));
      for (let i = 23; i >= 0; i--) {
        fc.globalAlpha = fade * (1 - i / 24) * 0.7;
        fc.fillStyle = i < 3 ? (gold > 0.5 ? '#fff0a3' : '#313fe1') : i % 4 === 0 ? '#8b963b' : gold > 0.5 ? '#e5bc42' : '#94bfdd';
        const size = i < 3 ? 2.8 : 1.6;
        fc.fillRect(Math.round((star.x - i * 4) / 2) * 2, Math.round((star.y - i * 2.08) / 2) * 2, size, size);
      }
    }
    fc.globalAlpha = 1;
  }

  // ── pose: parked over the intro, then a run to the footer ─────────────────
  function transitionPose() {
    const r = getRects();
    if (!r.intro || !r.footer) return null;
    const { intro, footer, works } = r;
    // The palm is sized and placed to fit the band right of the copy column, so
    // no hard clip line cuts its left side — only the section's bottom edge
    // crops it.
    const bandLeft = Math.max((r.copyRight || 0) + 24, intro.left + intro.width * 0.45);
    const fitScale = Math.max(0.55, (intro.right - bandLeft) / 458);
    const startScale = Math.min(Math.min(intro.width * 0.6, 800) / 440, fitScale);
    const mobile = footer.width < 650;
    const endScale = mobile
      ? Math.min(footer.width / 570, (footer.height * 0.43) / 550)
      : Math.min(footer.height * 0.8 / 550, footer.width * 0.48 / 520);
    const endOx = mobile ? (footer.width - 600 * endScale) / 2 : footer.width - 570 * endScale - 14;
    const endOy = footer.height - 54 - 655 * endScale;

    // Quiet through the intro and marquee; the whole move happens from the top
    // of the works section (where the palm is clipped out) into the footer.
    const introTop = intro.top + scrollY;
    const start = works ? works.top + scrollY - innerHeight * 0.6 : introTop + innerHeight;
    const footerTop = footer.top + scrollY;
    const end = Math.max(start + 1, footerTop - Math.max(0, innerHeight - footer.height));
    const raw = clamp((scrollY - start) / (end - start), 0, 1);
    const progress = raw * raw * (3 - 2 * raw);
    const mix = (a, b) => a + (b - a) * progress;

    // Crop against the visible bottom of the intro, so the leaf fan reads even
    // when the section is taller than the viewport.
    const anchorY = Math.min(intro.bottom, innerHeight);
    const startOx = bandLeft - 74 * startScale;
    const startOy = anchorY - 285 * startScale;
    return {
      scale: mix(startScale, endScale),
      ox: mix(startOx, footer.left + endOx),
      oy: mix(startOy, footer.top + endOy),
      ground: 655, progress, footer, bandLeft,
      clip: {
        left: mix(intro.left, footer.left),
        top: mix(intro.top, footer.top),
        right: mix(intro.right, footer.right),
        bottom: mix(intro.bottom, footer.bottom - 53),
      },
    };
  }

  // ── present the low-res buffer as the shared pixel grid ───────────────────
  // Nearest-neighbour upscale of the scene buffer, then the 1px cell gaps are
  // punched out with a cached 6px pattern — three canvas ops per frame instead
  // of a fillRect per cell.
  const quant = document.createElement('canvas');
  const qc = quant.getContext('2d');
  const gapTile = document.createElement('canvas');
  gapTile.width = GRID; gapTile.height = GRID;
  const gt = gapTile.getContext('2d');
  gt.fillStyle = '#000';
  gt.fillRect(0, 0, GRID, GAP);
  gt.fillRect(0, 0, GAP, GRID);
  let gapPattern = null;

  function presentGrid(worksRect) {
    dc.clearRect(0, 0, innerWidth, innerHeight);
    const gw = sceneGrid.width, gh = sceneGrid.height;
    const img = fc.getImageData(0, 0, gw, gh);
    const d = img.data;
    let any = false;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (a < 12) { d[i] = 0; continue; }
      any = true;
      d[i] = Math.ceil(Math.sqrt(a / 255) * 4) / 4 * 255;
    }
    if (!any) return;
    if (quant.width !== gw || quant.height !== gh) { quant.width = gw; quant.height = gh; }
    qc.putImageData(img, 0, 0);

    dc.save();
    dc.beginPath();
    dc.rect(0, 0, innerWidth, innerHeight);
    if (worksRect) dc.rect(0, worksRect.top, innerWidth, worksRect.height);
    dc.clip('evenodd');
    dc.imageSmoothingEnabled = false;
    dc.drawImage(quant, 0, -gridOffset, gw * GRID, gh * GRID);
    if (!gapPattern) gapPattern = dc.createPattern(gapTile, 'repeat');
    if (gapPattern) {
      gapPattern.setTransform(new DOMMatrix([1, 0, 0, 1, 0, -gridOffset]));
      dc.globalCompositeOperation = 'destination-out';
      dc.fillStyle = gapPattern;
      dc.fillRect(0, 0, innerWidth, innerHeight);
      dc.globalCompositeOperation = 'source-over';
    }
    dc.restore();
  }

  // ── frame ─────────────────────────────────────────────────────────────────
  function render(time) {
    cfg = getConfig();
    if (cfg.paused) time = animTime; else animTime = time;
    const dt = cfg.paused || !lastFrame ? 0 : Math.min((time - lastFrame) / 1000, 0.04);
    lastFrame = time;

    pose = transitionPose();
    if (!pose) return;
    const { scale, ox, oy, ground, progress, clip, footer } = pose;
    const mx = (pointer.x - ox) / scale;
    const my = (pointer.y - oy) / scale;
    gridOffset = ((scrollY % GRID) + GRID) % GRID;

    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.clearRect(0, 0, sceneGrid.width, sceneGrid.height);
    fc.setTransform(1 / GRID, 0, 0, 1 / GRID, 0, gridOffset / GRID);

    const r = getRects();
    // Stars share the palm's side of the intro, so nothing streaks behind copy.
    const introBand = r.intro && r.intro.bottom > 0 && r.intro.top < innerHeight
      ? { left: pose.bandLeft, top: r.intro.top, width: Math.max(80, r.intro.right - pose.bandLeft), height: r.intro.height }
      : null;
    const starBand = progress < 0.5
      ? introBand
      : (footer.bottom > 0 && footer.top < innerHeight ? footer : null);
    drawStars(time, dt, starBand);
    drawFooterSurf(time, footer, progress);

    fc.save();
    fc.beginPath();
    fc.rect(clip.left, clip.top, clip.right - clip.left, clip.bottom - clip.top);
    fc.clip();
    fc.translate(ox, oy);
    fc.scale(scale, scale);
    drawGridPalm(fc, time, mx, my);

    for (const n of nuts) {
      if (!cfg.coconuts || progress < 0.35) continue;
      if (n.state === 'attached') {
        const anchor = windTarget({ x: n.homeX, y: n.homeY, part: 'trunk' }, time);
        const q = pointerOffset(anchor.x, anchor.y, time, mx, my);
        n.x = q.x; n.y = q.y;
      } else if (dt && progress > 0.98) {
        if (cfg.waves) washCoconut(n, dt, time, pose);
        stepCoconut(n, dt, ground, (8 - ox) / scale, (footer.right - ox) / scale - 8);
      }
      const display = n.state === 'attached' ? n : pointerOffset(n.x, n.y, time, mx, my);
      fc.save();
      fc.translate(display.x, Math.min(display.y, ground - n.r));
      fc.rotate(n.angle);
      drawPixelCoconut(fc, n);
      fc.restore();
    }
    if (cfg.snap) drawSnapBursts(dt);
    fc.restore();

    presentGrid(r.works && r.works.top < innerHeight && r.works.bottom > 0 ? r.works : null);
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    displayCanvas.width = innerWidth * dpr;
    displayCanvas.height = innerHeight * dpr;
    dc.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneGrid.width = Math.ceil(innerWidth / GRID);
    sceneGrid.height = Math.ceil(innerHeight / GRID) + 1;
  }

  // Static collision circles along each frond, in document coordinates, so the
  // falling names can glance off the leaves.
  function leafColliders(time) {
    if (!pose || pose.progress > 0.08) return [];
    const { ox, oy, scale } = pose;
    const out = [];
    fronds.forEach(([ex, ey, cx, cy], index) => {
      for (const t of [0.42, 0.7, 0.94]) {
        const x = bez(t, 300, 300 + cx, 300 + ex);
        const y = bez(t, 215, 215 + cy, 215 + ey);
        const q = windTarget({ x, y, part: 'leaf', frond: index, reach: t }, time);
        out.push({ x: ox + q.x * scale, y: oy + q.y * scale + scrollY, r: 15 * scale });
      }
    });
    return out;
  }

  function hitTest(clientX, clientY) {
    if (!pose) return { tree: false, nut: null };
    const { ox, oy, scale } = pose;
    const x = (clientX - ox) / scale;
    const y = (clientY - oy) / scale;
    const nut = cfg.coconuts ? nuts.find(n => Math.hypot(n.x - x, n.y - y) < n.r + 12) : null;
    let tree = false;
    for (const [index, [ex, ey, cx, cy]] of fronds.entries()) {
      for (let t = 0; t <= 1.001; t += 0.08) {
        const q = windTarget({
          x: bez(t, 300, 300 + cx, 300 + ex),
          y: bez(t, 215, 215 + cy, 215 + ey),
          part: 'leaf', frond: index, reach: t,
        }, animTime);
        if (Math.hypot(q.x - x, q.y - y) < 26) { tree = true; break; }
      }
      if (tree) break;
    }
    if (!tree && x > 270 && x < 355 && y > 205 && y < 660) tree = true;
    return { tree, nut };
  }

  // ── what the cursor can reach ─────────────────────────────────────────────
  // The scene is a canvas, so nothing in it can carry a hover of its own. It
  // publishes the geometry of the parts that answer the pointer instead, in
  // client coordinates, and the cursor registry does the rest.

  /** Every coconut as a client-space circle, with whether it is still on the tree. */
  function nutCircles() {
    if (!pose || !cfg.coconuts || pose.progress < 0.35) return [];
    const { ox, oy, scale } = pose;
    return nuts.map(n => ({
      x: ox + n.x * scale,
      y: oy + n.y * scale,
      r: (n.r + 8) * scale,
      attached: n.state === 'attached',
    }));
  }

  /**
   * The surf, as a client-space box.
   *
   * The wave itself is a moving front; this is the band it runs in, which is
   * what a reader is actually pointing at when they point at the water.
   */
  function waterBand() {
    if (!pose || !cfg.waves || pose.progress < 0.25) return null;
    const { footer } = getRects();
    if (!footer) return null;
    const floor = footer.bottom - 54;
    const reach = Math.min(footer.width * 0.34, 390) + footer.left;
    return { left: 0, top: floor - 58, right: reach, bottom: footer.bottom - 38 };
  }

  function shake() { shakeStarted = animTime; }

  /** The pixel snap sprite, on demand — every coconut click gets one. */
  function burstAt(clientX, clientY) {
    if (!pose) return;
    // Bursts are drawn inside the scene transform, so a client position has
    // to come back out of it first.
    const { ox, oy, scale } = pose;
    snapBursts.push({ x: (clientX - ox) / scale, y: (clientY - oy) / scale, age: 0 });
  }

  function dropCoconut(n = nuts.find(x => x.state === 'attached')) {
    if (!n || !cfg.coconuts || !pose || pose.progress < 0.98) return 0;
    if (n.state === 'attached') {
      snapBursts.push({ x: n.x, y: n.y - 9, age: 0 });
      n.state = 'falling';
      n.vx = (random() < 0.22 ? 1 : -1) * (85 + random() * 135);
      n.vy = -random() * 35;
      n.angle = random() * Math.PI * 2;
    } else n.vx -= 55;
    return nuts.filter(x => x.state === 'attached').length;
  }

  const resetCoconuts = () => {
    for (const n of nuts)
      Object.assign(n, { x: n.homeX, y: n.homeY, vx: 0, vy: 0, angle: 0, state: 'attached', backwash: 0 });
  };

  const setPointer = (x, y) => { pointer = { x, y }; };
  const getProgress = () => (pose ? pose.progress : 0);

  resize();
  return {
    render, resize, leafColliders, hitTest, shake, dropCoconut, resetCoconuts,
    setPointer, getProgress, nutCircles, waterBand, burstAt,
  };
}
