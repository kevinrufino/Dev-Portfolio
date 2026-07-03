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

// Word geometry within HeroName's 1402×187 viewBox:
// KEVIN = 600 units left-anchored, RUFINO = 780 units right-anchored (22 gap).
const NAME_VB_W = 1402;
const FIRST_VB = { w: 600, h: 187 };
const LAST_VB = { w: 780, h: 187 };
const FIRST_FRAC = FIRST_VB.w / NAME_VB_W;
const LAST_FRAC = LAST_VB.w / NAME_VB_W;

// ── Tunables ─────────────────────────────────────────────────────────────────
const CHECK_MS = 150; // how often to check whether the next row can drop
const OVERLAP_FRAC = 0.05; // row overlap as fraction of name width — matches the hero's mt-[-5%]
const SETTLE_SPEED = 10; // a row is "settled" once both bodies are this slow
const MAX_ROWS = 14; // safety cap on spawned rows
const FILL_LINE = 0.14; // stop once the sleeping pile crosses this fraction of the fold from the top
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
        // the floor instead of dipping into it.
        const overlapPx = rect.width * OVERLAP_FRAC;
        const boxH = wordH - overlapPx;
        const drawTop = boxH / 2 - wordH; // sprite top in body-local coords

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
          Matter.World.add(world, body);
          sprites.push({ body, img, width: w, height: wordH });
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
          ctx.restore();
        });

        // Click anywhere to poke the pile: radial + upward impulse on nearby
        // names. Canvas is pointer-events:none, so listen on the document and
        // translate the click into document coordinates. Never preventDefault,
        // so links and buttons keep working.
        const handleClick = e => {
          const cx = e.clientX;
          const cy = e.clientY + window.scrollY;
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

        // Fill gauge: only truly sleeping bodies count, so a sprite mid-fall
        // can't fake a full container.
        const pileTop = () => {
          let top = Infinity;
          for (const { body } of sprites) {
            if (body.isSleeping) top = Math.min(top, body.bounds.min.y);
          }
          return top;
        };

        // Rows fall into place like the hero's stacked layout: each row is a
        // KEVIN + RUFINO pair (same variant, alternating per row — the loaded
        // name is the filled row 0), spawned side by side above the fold at the
        // exact x-anchors of the loaded name with no initial velocity. The next
        // row only drops once the previous one has settled, so rows never
        // collide mid-air and stack neatly instead of tumbling.
        let spawnTimer;
        let rowIndex = 0;
        let done = false;
        const rowSettled = row =>
          row.every(
            b => b.position.y > 0 && (b.isSleeping || b.speed < SETTLE_SPEED),
          );
        const dropNextRow = () => {
          if (rowIndex >= MAX_ROWS || pileTop() < fold * FILL_LINE) {
            clearInterval(spawnTimer);
            if (!done) {
              done = true;
              onFilledRef.current?.();
            }
            return;
          }
          if (!rowSettled(rows[rows.length - 1])) return;
          rowIndex++;
          const useFilled = rowIndex % 2 === 0; // row 0 (the loaded name) was filled
          rows.push([
            addSprite(
              useFilled ? firstFilled : firstOutline,
              firstX,
              -wordH,
              firstW,
            ),
            addSprite(
              useFilled ? lastFilled : lastOutline,
              lastX,
              -wordH,
              lastW,
            ),
          ]);
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
        // hide the DOM name, then start physics. Row 1 drops as soon as the
        // loaded name (row 0) has settled on the floor.
        Matter.Render.run(render);
        requestAnimationFrame(() => {
          if (cancelled) return;
          onHandoffRef.current?.();
          Matter.Runner.run(runner, engine);
          spawnTimer = setInterval(dropNextRow, CHECK_MS);
        });

        teardown = () => {
          if (spawnTimer) clearInterval(spawnTimer);
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
          Matter.Render.stop(render);
          Matter.Runner.stop(runner);
          Matter.Engine.clear(engine);
          sprites.length = 0;
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
