import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirstNameComponent } from './Hero/components/FirstNameComponent.js';
import { LastNameComponent } from './Hero/components/LastNameComponent.js';

/**
 * Full-page physics canvas for the landing sequence.
 *
 * Every physics object is a 1:1-scale first or last name (the size the word
 * has inside the loaded hero name). The loaded name converts into two bodies
 * at their exact rects and drops to a split floor at the hero fold; more
 * KEVIN + RUFINO rows then stack on top (hero-style, with a -5% overlap)
 * until the header viewport is full.
 *
 * Physics runs in full document coordinates (y = 0 at the top of the page), so
 * when the floor splits open on scroll the pile falls all the way down the page
 * and lands on the footer obstacle. The canvas itself stays fixed and
 * viewport-sized (every body is invisible — only the sprites drawn in
 * afterRender show), and the sprite draw is offset by scrollY to render just
 * the visible slice, avoiding a document-tall backing store.
 */
const ACID = '#F1F43B';
const ULTRA = '#3e3bf4';

// ── Firework burst (ported from the retired MatterJSCanvas) ──────────────────
// Clicking a name sprite in the pile pops a pixel/cell firework at the hit
// point. Bursts are stored in document coordinates (like the bodies) and drawn
// inside the same -scrollY offset transform as the sprites.
const FIREWORK_DURATION = 760;
const FIREWORK_CELL = 9;
const FIREWORK_LIMIT = 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const smoothstep = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
};

const easeOutCubic = value => 1 - Math.pow(1 - value, 3);

const drawFireworkCell = (ctx, x, y, size, shape) => {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const radius = size * 0.36;
  const left = x - size / 2;
  const top = y - size / 2;

  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(left, top, size, size, radius);
    ctx.fill();
    return;
  }

  ctx.fillRect(left, top, size, size);
};

const makeFireworkCells = () => {
  const cells = [];
  const rotation = Math.random() * Math.PI * 2;
  const spokes = 8;

  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = rotation + (Math.PI * 2 * spoke) / spokes;
    for (let step = 1; step <= 6; step += 1) {
      cells.push({
        angle,
        distance: FIREWORK_CELL * (step * 1.65 + (spoke % 2) * 0.35),
        delay: step * 18,
        size: FIREWORK_CELL * (step < 3 ? 1.04 : 0.82),
        color: (spoke + step) % 3 === 0 ? ACID : ULTRA,
        shape: step % 2 === 0 ? 'circle' : 'squircle',
      });
    }
  }

  for (let ring = 2; ring <= 5; ring += 1) {
    const points = ring * 6;
    for (let point = 0; point < points; point += 1) {
      if ((point + ring) % 3 === 0) continue;

      cells.push({
        angle:
          rotation +
          (Math.PI * 2 * point) / points +
          (ring % 2 ? Math.PI / points : 0),
        distance: FIREWORK_CELL * ring * 2.2,
        delay: ring * 24,
        size: FIREWORK_CELL * (ring % 2 ? 0.72 : 0.6),
        color: (point + ring) % 4 === 0 ? ACID : ULTRA,
        shape: (point + ring) % 2 === 0 ? 'circle' : 'squircle',
      });
    }
  }

  cells.push(
    {
      angle: 0,
      distance: 0,
      delay: 0,
      size: FIREWORK_CELL * 1.2,
      color: ACID,
      shape: 'circle',
    },
    {
      angle: 0,
      distance: 0,
      delay: 40,
      size: FIREWORK_CELL * 0.78,
      color: ULTRA,
      shape: 'squircle',
    },
  );

  return cells;
};

const drawFireworks = (ctx, fireworks, now) => {
  for (let i = fireworks.length - 1; i >= 0; i -= 1) {
    const burst = fireworks[i];
    const age = now - burst.start;
    if (age > FIREWORK_DURATION) {
      fireworks.splice(i, 1);
      continue;
    }

    const progress = clamp(age / FIREWORK_DURATION, 0, 1);
    const baseAlpha =
      clamp(progress / 0.14, 0, 1) * (1 - smoothstep(0.64, 1, progress));

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.globalCompositeOperation = 'source-over';

    for (const cell of burst.cells) {
      const localAge = age - cell.delay;
      if (localAge < 0) continue;

      const localProgress = clamp(
        localAge / (FIREWORK_DURATION - cell.delay),
        0,
        1,
      );
      const travel = cell.distance * easeOutCubic(localProgress);
      const x =
        Math.round((Math.cos(cell.angle) * travel) / FIREWORK_CELL) *
        FIREWORK_CELL;
      const y =
        Math.round((Math.sin(cell.angle) * travel) / FIREWORK_CELL) *
        FIREWORK_CELL;
      const size = cell.size * (1 - localProgress * 0.22);
      const alpha =
        baseAlpha *
        clamp(localAge / 90, 0, 1) *
        (1 - smoothstep(0.72, 1, localProgress));

      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = cell.color;
      drawFireworkCell(ctx, x, y, size, cell.shape);
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
};

// Word geometry within HeroName's 1402×187 viewBox:
// KEVIN = 600 units left-anchored, RUFINO = 780 units right-anchored (22 gap).
const NAME_VB_W = 1402;
const FIRST_VB = { w: 600, h: 187 };
const LAST_VB = { w: 780, h: 187 };
const FIRST_FRAC = FIRST_VB.w / NAME_VB_W;
const LAST_FRAC = LAST_VB.w / NAME_VB_W;

// ── Tunables ─────────────────────────────────────────────────────────────────
const CHECK_MS = 150; // how often to poll row-0 landing / all-rows settled
const OVERLAP_FRAC_DESKTOP = 0.05; // row overlap as fraction of name width — matches the hero's mt-[-5%]
const OVERLAP_FRAC_MOBILE = 0.01; // shallower interlock on thin viewports → fewer rows to fill the fold
const MOBILE_MAX_W = 768; // viewports narrower than this use the mobile overlap
const SETTLE_SPEED = 10; // a row is "settled" once both bodies are this slow
const ROW_CAP = 40; // sanity cap on the computed row count
const GRAVITY_FILL = 1.8; // heavier gravity while the stack drops, so the fill reads fast
const FILL_TIMEOUT_MS = 7000; // report "filled" even if a body never quite settles
const FLOOR_T = 16; // floor bar thickness (collision only — invisible)
const SCROLL_RANGE = 1.2; // fold-heights of scroll to fully open the floor
const IMPULSE_RADIUS_FRAC = 0.28; // click impulse reach, as a fraction of viewport width
const IMPULSE_UP = 12; // upward kick strength on click
const IMPULSE_PUSH = 8; // radial push strength on click

// Rasterize a name-word colorway to a decoded Image for canvas drawing.
const svgToImage = (element, vb) => {
  const markup = renderToStaticMarkup(element).replace(
    '<svg',
    `<svg width="${vb.w}" height="${vb.h}"`,
  );
  const url = URL.createObjectURL(
    new Blob([markup], { type: 'image/svg+xml' }),
  );
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
};

const FillPhysicsCanvas = ({ active, getSpawnRect, onHandoff, onFilled }) => {
  const canvasRef = useRef(null);
  const onHandoffRef = useRef(onHandoff);
  const onFilledRef = useRef(onFilled);
  onHandoffRef.current = onHandoff;
  onFilledRef.current = onFilled;

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    let cancelled = false;
    let teardown = () => {};

    // Colorways follow NameInstance's convention:
    // Component(primaryColor=outline, secondaryColor=fill)
    // filled = solid ultra (the loader's end state); unfilled = the outline variant.
    Promise.all([
      import('matter-js'),
      svgToImage(
        <FirstNameComponent primaryColor={ULTRA} secondaryColor={ULTRA} />,
        FIRST_VB,
      ),
      svgToImage(
        <FirstNameComponent primaryColor={ULTRA} secondaryColor={ACID} />,
        FIRST_VB,
      ),
      svgToImage(
        <LastNameComponent primaryColor={ULTRA} secondaryColor={ULTRA} />,
        LAST_VB,
      ),
      svgToImage(
        <LastNameComponent primaryColor={ULTRA} secondaryColor={ACID} />,
        LAST_VB,
      ),
    ]).then(
      ([
        { default: Matter },
        firstFilled,
        firstOutline,
        lastFilled,
        lastOutline,
      ]) => {
        if (cancelled || !canvas) return;

        let W = window.innerWidth;
        let fold = window.innerHeight; // the hero fold — where the floor sits
        let docH = Math.max(document.body.scrollHeight, fold);

        const engine = Matter.Engine.create({ enableSleeping: true });
        // Heavier gravity while the stack drops in, so the fill animation is
        // quick; reset to normal once every row has landed.
        engine.gravity.y = GRAVITY_FILL;
        const world = engine.world;
        // The canvas stays viewport-sized and fixed; every physics body is
        // invisible (only the sprites drawn in afterRender show), so instead of
        // allocating a document-tall canvas we render the viewport slice and
        // offset the sprite draw by scrollY. Physics still runs in full
        // document coordinates.
        const render = Matter.Render.create({
          canvas,
          engine,
          options: {
            width: W,
            height: fold,
            wireframes: false,
            background: 'transparent',
            showSleeping: false,
          },
        });
        const runner = Matter.Runner.create();

        const invisible = {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
        };
        const staticOpts = { isStatic: true, render: invisible };

        // Split floor at the fold: two invisible halves meeting at the center.
        // Scroll slides them outward to open a center gap.
        const floorY = fold - FLOOR_T / 2;
        const floorOpts = {
          isStatic: true,
          friction: 0.05, // slippery so the pile slides off as it retracts
          render: invisible,
        };
        const leftFloor = Matter.Bodies.rectangle(
          W / 4,
          floorY,
          W / 2,
          FLOOR_T,
          floorOpts,
        );
        const rightFloor = Matter.Bodies.rectangle(
          (3 * W) / 4,
          floorY,
          W / 2,
          FLOOR_T,
          floorOpts,
        );

        // Tall walls (they always cover the fall, even as the document grows) +
        // a catch floor at the document bottom so nothing escapes if it misses
        // the footer obstacle. `bottomFloor` is repositioned as docH changes.
        const wallH = 40000;
        const leftWall = Matter.Bodies.rectangle(-30, 0, 60, wallH, staticOpts);
        const rightWall = Matter.Bodies.rectangle(
          W + 30,
          0,
          60,
          wallH,
          staticOpts,
        );
        const bottomFloor = Matter.Bodies.rectangle(
          W / 2,
          docH + 30,
          W * 2,
          60,
          staticOpts,
        );
        Matter.World.add(world, [
          leftFloor,
          rightFloor,
          leftWall,
          rightWall,
          bottomFloor,
        ]);

        // Keep the catch floor at the real document bottom as content lazy-loads
        // in and the page grows (images/videos below the fold change its height).
        const docObserver = new ResizeObserver(() => {
          const h = Math.max(document.body.scrollHeight, fold);
          if (h === docH) return;
          docH = h;
          Matter.Body.setPosition(bottomFloor, { x: W / 2, y: docH + 30 });
        });
        docObserver.observe(document.body);

        // Footer (and any other section) can register a static obstacle for the
        // falling pile to land on, in document coordinates.
        const obstacleMap = new Map();
        const handleRegisterObstacle = e => {
          const { id, x, y, width, height } = e.detail;
          const existing = obstacleMap.get(id);
          if (existing) Matter.World.remove(world, existing);
          const body = Matter.Bodies.rectangle(x, y, width, height, staticOpts);
          Matter.World.add(world, body);
          obstacleMap.set(id, body);
        };
        window.addEventListener('registerObstacle', handleRegisterObstacle);

        const sprites = []; // { body, img, width, height }

        // Firework bursts (in document coords) fired when a name sprite is
        // clicked. Suppressed under reduced-motion, matching the retired canvas.
        const fireworks = [];
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let reduceMotion = motionQuery.matches;
        const handleMotionPreference = () => {
          reduceMotion = motionQuery.matches;
          if (reduceMotion) fireworks.length = 0;
        };
        motionQuery.addEventListener('change', handleMotionPreference);

        // 1:1 geometry of the loaded name. getSpawnRect returns a viewport
        // rect; convert to document space (at handoff scrollY≈0, but be safe).
        const vrect = getSpawnRect?.();
        const rect = vrect
          ? {
              left: vrect.left,
              right: vrect.right,
              top: vrect.top + window.scrollY,
              width: vrect.width,
              height: vrect.height,
            }
          : {
              left: 0,
              right: W,
              top: fold * 0.35,
              width: W,
              height: W * (187 / NAME_VB_W),
            };
        const firstW = rect.width * FIRST_FRAC;
        const lastW = rect.width * LAST_FRAC;
        const wordH = rect.height;

        // Hero-style row overlap: collision boxes are shorter than the drawn
        // sprites, so stacked rows visually interlock by `overlapPx` (like the
        // hero's mt-[-5%]) while the physics stays box-on-box. Sprites are
        // drawn bottom-aligned to their box so the bottom row sits exactly on
        // the floor instead of dipping into it. Thin viewports interlock less
        // so it takes fewer of the (narrower, shorter) rows to fill the fold.
        const overlapFrac =
          W < MOBILE_MAX_W ? OVERLAP_FRAC_MOBILE : OVERLAP_FRAC_DESKTOP;
        const overlapPx = rect.width * overlapFrac;
        const boxH = wordH - overlapPx;
        const drawTop = boxH / 2 - wordH; // sprite top in body-local coords

        // Rows needed for the stack to fill exactly one viewport: each row
        // adds one collision-box height to the pile.
        const totalRows = Math.min(ROW_CAP, Math.max(1, Math.ceil(fold / boxH)));

        // Word x-anchors, identical for every row (matches the hero's NameRow
        // layout: first name left-anchored, last name right-anchored).
        const firstX = rect.left + firstW / 2;
        const lastX = rect.right - lastW / 2;

        // Low friction matters for the drain: with grippy planks the stack
        // cantilevers on tiny floor ledges and jams in a solver equilibrium
        // instead of sliding through the opening gap. Rows still stack neatly
        // on landing because they fall with zero horizontal velocity.
        const addSprite = (img, x, y, w) => {
          const body = Matter.Bodies.rectangle(x, y, w, boxH, {
            restitution: 0.05,
            friction: 0.15,
            frictionAir: 0.012,
            render: invisible,
          });
          // Tetris mode while the stack drops in: rotation locked so the
          // boosted-gravity cascade can't knock rows into a tumble — they
          // stack flat every time. Real inertia is restored once filled, so
          // the scroll drain and click impulses still tumble naturally.
          const baseInertia = body.inertia;
          Matter.Body.setInertia(body, Infinity);
          Matter.World.add(world, body);
          sprites.push({ body, img, width: w, height: wordH, baseInertia });
          return body;
        };

        // The loaded name becomes physical: KEVIN (left-anchored) and RUFINO
        // (right-anchored) as row 0, placed so each drawn sprite covers the DOM
        // name's exact rect (sprite bottom = box bottom = rect bottom).
        const handoffY = rect.top + wordH - boxH / 2;
        const rows = [
          [
            addSprite(firstFilled, firstX, handoffY, firstW),
            addSprite(lastFilled, lastX, handoffY, lastW),
          ],
        ];

        // ── Scroll-driven floor split ────────────────────────────────────────
        // Sleeping bodies ignore gravity, so a sleeping pile levitates when the
        // floor slides out from under it. While the floor is open at all,
        // disable sleeping outright and keep waking the pile on a watchdog — a
        // single wake per scroll event proved unreliable (the pile froze
        // mid-air over an open gap). Sleeping is only needed while the floor is
        // closed, for the fill gauge.
        let lastShift = 0;
        const wakeAll = () => {
          for (const { body } of sprites) Matter.Sleeping.set(body, false);
        };
        const updateFloor = () => {
          const p = Math.min(
            1,
            Math.max(0, window.scrollY / (fold * SCROLL_RANGE)),
          );
          const shift = p * (W / 2);
          engine.enableSleeping = p === 0;
          if (shift !== lastShift) {
            lastShift = shift;
            Matter.Body.setPosition(leftFloor, { x: W / 4 - shift, y: floorY });
            Matter.Body.setPosition(rightFloor, {
              x: (3 * W) / 4 + shift,
              y: floorY,
            });
          }
          if (p > 0) wakeAll();
        };
        updateFloor();
        window.addEventListener('scroll', updateFloor, { passive: true });
        const wakeTimer = setInterval(() => {
          if (lastShift > 0) {
            engine.enableSleeping = false;
            wakeAll();
          }
        }, 400);

        // Draw the name sprites each frame, bottom-aligned to the (shorter)
        // collision box. Bodies live in document coordinates; the canvas is a
        // fixed viewport slice, so shift everything up by scrollY.
        Matter.Events.on(render, 'afterRender', () => {
          const ctx = render.context;
          const offset = window.scrollY;
          ctx.save();
          ctx.translate(0, -offset);
          for (const { body, img, width, height } of sprites) {
            ctx.save();
            ctx.translate(body.position.x, body.position.y);
            ctx.rotate(body.angle);
            ctx.drawImage(img, -width / 2, drawTop, width, height);
            ctx.restore();
          }
          // Bursts live in document coords too, so they ride the same offset.
          if (fireworks.length > 0) {
            drawFireworks(ctx, fireworks, performance.now());
          }
          ctx.restore();
        });

        // Click anywhere to poke the pile: radial + upward impulse on nearby
        // names. Canvas is pointer-events:none, so listen on the document and
        // translate the click into document coordinates. Never preventDefault,
        // so links and buttons keep working.
        const handleClick = e => {
          const cx = e.clientX;
          const cy = e.clientY + window.scrollY;

          // Pop a firework only when the click lands on an actual name sprite.
          if (!reduceMotion) {
            const hit = Matter.Query.point(
              sprites.map(s => s.body),
              { x: cx, y: cy },
            );
            if (hit.length > 0) {
              fireworks.push({
                x: cx,
                y: cy,
                start: performance.now(),
                cells: makeFireworkCells(),
              });
              if (fireworks.length > FIREWORK_LIMIT) fireworks.shift();
            }
          }

          const radius = W * IMPULSE_RADIUS_FRAC;
          for (const { body } of sprites) {
            const dx = body.position.x - cx;
            const dy = body.position.y - cy;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist > radius) continue;
            const f = 1 - dist / radius;
            Matter.Sleeping.set(body, false);
            Matter.Body.setVelocity(body, {
              x: body.velocity.x + (dx / dist) * f * IMPULSE_PUSH,
              y: body.velocity.y - f * IMPULSE_UP,
            });
            Matter.Body.setAngularVelocity(
              body,
              body.angularVelocity + (Math.random() - 0.5) * 0.2 * f,
            );
          }
        };
        document.addEventListener('click', handleClick);

        // Fast fill: once the loaded name (row 0) has landed, spawn every
        // remaining row at once as a pre-stacked column above the viewport —
        // they cascade down in order (boosted gravity) and the whole fill
        // reads in about a second instead of row-by-row. Rows alternate
        // variant like the hero (row 0, the loaded name, counts as filled).
        // "Filled" is reported once every body has settled, with a timeout in
        // case something never quite stops jittering.
        let spawnTimer;
        let fillTimeout;
        let done = false;
        const rowSettled = row =>
          row.every(
            b => b.position.y > 0 && (b.isSleeping || b.speed < SETTLE_SPEED),
          );
        const finishFill = () => {
          if (done) return;
          done = true;
          clearInterval(spawnTimer);
          clearTimeout(fillTimeout);
          engine.gravity.y = 1; // back to normal for the scroll drain
          for (const s of sprites) Matter.Body.setInertia(s.body, s.baseInertia);
          onFilledRef.current?.();
        };
        const spawnRemainingRows = () => {
          for (let i = 1; i < totalRows; i++) {
            const useFilled = i % 2 === 0;
            // Stack the queued rows upward with a small air gap so the
            // solver never starts them overlapped.
            const y = -wordH - (i - 1) * (boxH + 4);
            rows.push([
              addSprite(
                useFilled ? firstFilled : firstOutline,
                firstX,
                y,
                firstW,
              ),
              addSprite(useFilled ? lastFilled : lastOutline, lastX, y, lastW),
            ]);
          }
          fillTimeout = setTimeout(finishFill, FILL_TIMEOUT_MS);
        };
        let cascadeSpawned = false;
        const checkFill = () => {
          if (!cascadeSpawned) {
            if (!rowSettled(rows[0])) return;
            cascadeSpawned = true;
            spawnRemainingRows();
            return;
          }
          if (rows.every(rowSettled)) finishFill();
        };

        // Pause the simulation while the tab is hidden.
        const handleVisibility = () => {
          if (document.hidden) {
            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
          } else {
            Matter.Render.run(render);
            Matter.Runner.run(runner, engine);
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Keep the fixed viewport canvas sized to the window; reposition the
        // fold-anchored floor and the side walls for the new width. Existing
        // piled bodies keep their document positions.
        const handleResize = () => {
          W = window.innerWidth;
          fold = window.innerHeight;
          docH = Math.max(document.body.scrollHeight, fold);
          render.options.width = W;
          render.options.height = fold;
          render.canvas.width = W;
          render.canvas.height = fold;
          Matter.Body.setPosition(leftWall, { x: -30, y: 0 });
          Matter.Body.setPosition(rightWall, { x: W + 30, y: 0 });
          Matter.Body.setPosition(bottomFloor, { x: W / 2, y: docH + 30 });
          lastShift = -1; // force floor reposition on the next scroll tick
          updateFloor();
        };
        window.addEventListener('resize', handleResize);

        // Handoff: draw the stationary 1:1 bodies first, then let the caller
        // hide the DOM name, then start physics. The cascade spawns as soon
        // as the loaded name (row 0) has settled on the floor.
        Matter.Render.run(render);
        requestAnimationFrame(() => {
          if (cancelled) return;
          onHandoffRef.current?.();
          Matter.Runner.run(runner, engine);
          spawnTimer = setInterval(checkFill, CHECK_MS);
        });

        teardown = () => {
          if (spawnTimer) clearInterval(spawnTimer);
          if (fillTimeout) clearTimeout(fillTimeout);
          clearInterval(wakeTimer);
          docObserver.disconnect();
          window.removeEventListener('scroll', updateFloor);
          window.removeEventListener('resize', handleResize);
          window.removeEventListener(
            'registerObstacle',
            handleRegisterObstacle,
          );
          document.removeEventListener('click', handleClick);
          document.removeEventListener('visibilitychange', handleVisibility);
          motionQuery.removeEventListener('change', handleMotionPreference);
          Matter.Render.stop(render);
          Matter.Runner.stop(runner);
          Matter.Engine.clear(engine);
          sprites.length = 0;
          fireworks.length = 0;
          obstacleMap.clear();
        };
      },
    );

    return () => {
      cancelled = true;
      teardown();
    };
  }, [active, getSpawnRect]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

FillPhysicsCanvas.propTypes = {
  active: PropTypes.bool.isRequired,
  getSpawnRect: PropTypes.func,
  onHandoff: PropTypes.func,
  onFilled: PropTypes.func,
};

export default FillPhysicsCanvas;
