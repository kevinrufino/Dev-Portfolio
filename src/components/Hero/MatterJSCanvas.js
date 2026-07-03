import { useRef, useEffect } from 'react';

/**
 * Full-page physics playground for the clickable hero name sprites.
 *
 * Performance:
 *  - matter-js is dynamically imported after mount, so the (sizeable) physics
 *    engine is split into its own async chunk and kept off the initial JS
 *    parse/critical path rather than shipped in the main bundle.
 *  - The engine, renderer and runner stay completely idle until the first
 *    sprite is spawned (a name is clicked). Most visitors never click, so the
 *    per-frame clear/redraw of the large full-document canvas — and the canvas
 *    backing-store allocation itself — are deferred until actually needed.
 *  - The simulation is paused whenever the tab is hidden.
 */
const ACID = '#F1F43B';
const ULTRA = '#3e3bf4';
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

const MatterJSCanvas = () => {
  const canvasRef = useRef(null);
  const spriteMapRef = useRef(new Map()); // bodyId → { img, width, height }
  const obstacleMapRef = useRef(new Map()); // obstacleId → body

  useEffect(() => {
    const canvas = canvasRef.current;
    let cancelled = false;
    let teardown = () => {};

    import('matter-js').then(({ default: Matter }) => {
      if (cancelled || !canvas) return;

      const engine = Matter.Engine.create();
      const world = engine.world;
      const fireworks = [];
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      let reduceMotion = motionQuery.matches;
      const handleMotionPreference = () => {
        reduceMotion = motionQuery.matches;
        if (reduceMotion) fireworks.length = 0;
      };
      motionQuery.addEventListener('change', handleMotionPreference);

      const staticOpts = {
        isStatic: true,
        restitution: 0,
        render: { fillStyle: 'transparent', strokeStyle: 'transparent' },
      };

      const sizeCanvasToDocument = () => {
        canvas.width = window.innerWidth;
        canvas.height = document.body.scrollHeight;
        // Keep CSS dimensions in sync with pixel dimensions so there is no
        // accidental scaling that would misplace drawn sprites on screen.
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
      };

      const render = Matter.Render.create({
        canvas,
        engine,
        options: {
          width: window.innerWidth,
          height: window.innerHeight,
          wireframes: false,
          background: 'transparent',
        },
      });
      const runner = Matter.Runner.create();

      // ── Lazy start: nothing runs until the first sprite is spawned ────────
      let started = false;
      const ensureStarted = () => {
        if (started) return;
        started = true;

        // Allocate the full-document canvas only now that we actually render.
        sizeCanvasToDocument();
        render.options.width = canvas.width;
        render.options.height = canvas.height;

        // Narrow platform just below the hero fold for interesting stacking.
        const heroPlatform = Matter.Bodies.rectangle(
          canvas.width * 0.44,
          window.innerHeight + 30,
          canvas.width * 0.05,
          20,
          staticOpts,
        );
        Matter.World.add(world, [heroPlatform]);

        Matter.Render.run(render);
        Matter.Runner.run(runner, engine);
      };

      const spawnWithImage = (img, x, y, w, h) => {
        ensureStarted();
        const body = Matter.Bodies.rectangle(x, y, w, h, {
          restitution: 0,
          friction: 0.5,
          frictionAir: 0.01,
          render: {
            fillStyle: 'transparent',
            strokeStyle: 'transparent',
            lineWidth: 0,
          },
        });
        Matter.World.add(world, body);
        Matter.Body.setVelocity(body, {
          x: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2),
          y: 0,
        });
        spriteMapRef.current.set(body.id, { img, width: w, height: h });
      };

      const handleSpawn = e => {
        const { svgMarkup, rect, prewarmedImg } = e.detail;
        if (!rect) return;

        const w = rect.width;
        const h = rect.height;
        const x = rect.left + w / 2;
        const y = rect.top + window.scrollY + h / 2;

        // Fallback: rasterize the SVG markup that travels with every click.
        const spawnFromMarkup = () => {
          if (!svgMarkup) return;
          const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            spawnWithImage(img, x, y, w, h);
          };
          img.onerror = () => URL.revokeObjectURL(url);
          img.src = url;
        };

        // Fast path: the pre-warmed sprite is already decoded and ready.
        if (
          prewarmedImg &&
          prewarmedImg.complete &&
          prewarmedImg.naturalWidth > 0
        ) {
          spawnWithImage(prewarmedImg, x, y, w, h);
          return;
        }

        // Pre-warm is mid-decode: use it once it loads, else fall back.
        if (prewarmedImg && !prewarmedImg.complete) {
          prewarmedImg.addEventListener(
            'load',
            () => spawnWithImage(prewarmedImg, x, y, w, h),
            { once: true },
          );
          prewarmedImg.addEventListener('error', spawnFromMarkup, {
            once: true,
          });
          return;
        }

        // No usable pre-warm (missing, or reserved-but-not-yet-built, which is
        // complete=true with naturalWidth=0) → rasterize from markup now so the
        // click always spawns immediately.
        spawnFromMarkup();
      };
      window.addEventListener('spawnBox', handleSpawn);

      // Registers an invisible static obstacle (e.g. footer section). Safe to
      // do before the simulation starts — it simply sits in the world.
      const handleRegisterObstacle = e => {
        const { id, x, y, width, height } = e.detail;
        const existing = obstacleMapRef.current.get(id);
        if (existing) Matter.World.remove(world, existing);
        const body = Matter.Bodies.rectangle(x, y, width, height, staticOpts);
        Matter.World.add(world, body);
        obstacleMapRef.current.set(id, body);
      };
      window.addEventListener('registerObstacle', handleRegisterObstacle);

      // Click anywhere below the hero to shake all sprites upward
      const handleDocumentClick = e => {
        if (!started) return;
        if (e.clientY + window.scrollY < window.innerHeight) return;
        const clickPoint = { x: e.clientX, y: e.clientY + window.scrollY };
        const spriteBodies = Array.from(spriteMapRef.current.keys())
          .map(bodyId => Matter.Composite.get(world, bodyId, 'body'))
          .filter(Boolean);
        const hitBodies = Matter.Query.point(spriteBodies, clickPoint);

        if (!reduceMotion && hitBodies.length > 0) {
          fireworks.push({
            x: clickPoint.x,
            y: clickPoint.y,
            start: performance.now(),
            cells: makeFireworkCells(),
          });
          if (fireworks.length > FIREWORK_LIMIT) fireworks.shift();
        }

        for (const bodyId of spriteMapRef.current.keys()) {
          const body = Matter.Composite.get(world, bodyId, 'body');
          if (!body) continue;
          Matter.Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 6,
            y: -(4 + Math.random() * 8),
          });
        }
      };
      document.addEventListener('click', handleDocumentClick);

      // Draw the SVG sprites on top of their physics bodies each frame.
      Matter.Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        for (const [bodyId, { img, width, height }] of spriteMapRef.current) {
          const body = Matter.Composite.get(world, bodyId, 'body');
          if (!body) continue;
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          ctx.drawImage(img, -width / 2, -height / 2, width, height);
          ctx.restore();
        }
        if (fireworks.length > 0) {
          drawFireworks(ctx, fireworks, performance.now());
        }
      });

      const handleResize = () => {
        if (!started) return;
        sizeCanvasToDocument();
        render.options.width = canvas.width;
        render.options.height = canvas.height;
      };
      window.addEventListener('resize', handleResize);

      // Pause the simulation while the tab is hidden, resume when visible.
      const handleVisibility = () => {
        if (!started) return;
        if (document.hidden) {
          Matter.Render.stop(render);
          Matter.Runner.stop(runner);
        } else {
          Matter.Render.run(render);
          Matter.Runner.run(runner, engine);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      teardown = () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('spawnBox', handleSpawn);
        window.removeEventListener('registerObstacle', handleRegisterObstacle);
        motionQuery.removeEventListener('change', handleMotionPreference);
        document.removeEventListener('click', handleDocumentClick);
        document.removeEventListener('visibilitychange', handleVisibility);
        spriteMapRef.current.clear();
        obstacleMapRef.current.clear();
        fireworks.length = 0;
        Matter.Render.stop(render);
        Matter.Runner.stop(runner);
        Matter.Engine.clear(engine);
      };
    });

    return () => {
      cancelled = true;
      teardown();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};

export default MatterJSCanvas;
