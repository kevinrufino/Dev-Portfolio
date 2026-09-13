/**
 * MikaShaderEffect
 *
 * Adapted shader effect that creates an interactive abstract background
 * without requiring an image texture. Uses procedural generation for
 * dynamic visual effects driven by mouse movement.
 *
 * Effects (all driven by a CPU-painted canvas control map):
 *  - Animated scanlines
 *  - Cursor-radius pixelation (variable resolution)
 *  - Horizontal UV glitch shift
 *  - Chromatic aberration (RGB split)
 *  - Blue colour-grade tint inside cursor zone
 *  - Red highlight on glitch cells
 *  - Cell-grid stroke outline
 *  - Simplex-noise-warped cursor boundary
 *  - Spring-physics per-cell animation
 *
 * Dependencies:
 *   @react-three/fiber   ^8.15.12
 *   @react-three/drei    ^9.88.17
 *   three                ^0.159.0
 *   simplex-noise        ^4.0.1
 *
 * Usage:
 *   <MikaShaderEffect />
 *
 *   Wrap in a sized container. The canvas fills 100% width/height.
 */

import React, {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import PropTypes from 'prop-types';
import { colour } from '../../styles/tokens';

// ─────────────────────────────────────────────
// GLSL — fullscreen compositor (all the effects)
// ─────────────────────────────────────────────
const compositorVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** `#RRGGBB` -> a GLSL `vec3(...)` literal in 0-1 range. */
const glslRGB = (hex) =>
  `vec3(${[1, 3, 5]
    .map(i => `${parseInt(hex.slice(i, i + 2), 16)}.0/255.0`)
    .join(', ')})`;

const compositorFrag = /* glsl */ `
  precision highp float;

  uniform sampler2D uCanvasMap;     // CPU control map (r=pixelate, g=shift, b=stroke, a=resolution)
  uniform float     uTime;
  uniform float     uShiftSize;     // 1 / numXCells

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 p  = gl_FragCoord.xy;

    // ── Sample control map ──────────────────────────────────────────
    vec4  gc = texture2D(uCanvasMap, uv);
    float gr = gc.r;
    float gg = gc.g;
    float gb = gc.b;
    float ga = ceil(gc.a * 10.0) / 10.0;

    // ── Base color (yellow background) ───────────────────────────────
    vec3 yellowColor = ${glslRGB(colour.acid)};

    // ── Scanlines ───────────────────────────────────────────────────
    float scanLine = (1.0 + sin(p.y * 5.0 + uTime)) * 0.5;
    scanLine = 0.5 + 0.5 * (1.0 - pow(scanLine, 3.0));

    // ── Horizontal glitch shift ──────────────────────────────────────
    uv.x += uShiftSize * gg;

    // ── Pixelation ──────────────────────────────────────────────────
    float divide = (0.25 + 0.75 * ga) * 512.0;
    uv.x = gr > 0.0 ? ceil(uv.x * divide) / divide : uv.x;
    uv.y = gr > 0.0 ? ceil(uv.y * divide) / divide : uv.y;

    // ── Chromatic aberration ─────────────────────────────────────────
    float rDiff = +gr * 0.002;
    float bDiff = -gr * 0.002;
    float r = yellowColor.r + rDiff;
    float g = yellowColor.g;
    float b = yellowColor.b + bDiff;
    vec4 renderColor = vec4(r, g, b, 1.0);

    // ── Colour grade ─────────────────────────────────────────────────
    renderColor.rgb *= gr > 0.0 ? 0.95 : 1.0;  // Keep colors bright outside cursor zone
    renderColor.rgb += gr > 0.0 ? vec3(255.0/255.0, 0.0/255.0, 255.0/255.0) * 0.3 : vec3(0.0);  // Magenta tint
    // renderColor.rgb += gg > 0.0 ? vec3(1.0, 0.0, 0.0) * gg : vec3(0.0);

    // ── Scanline multiply (cursor zone only) ─────────────────────────
    renderColor.rgb *= gr > 0.0 ? scanLine : 1.0;
    // Add blue tint to scanlines
    if (gr > 0.0) {
      renderColor.rgb += vec3(0.0, 0.3, 0.6) * (1.0 - scanLine);  // Blue scanlines
    }

    // ── Grid stroke ──────────────────────────────────────────────────
    renderColor.rgb += vec3(0.1) * gb;  // Reduced from 0.25 to 0.1

    gl_FragColor = renderColor;
  }
`;

// ─────────────────────────────────────────────
// Spring helper  (matches original: x += v*dt, v = (v - (x-target)*ω²*dt) / (1+ω*dt)²)
// ─────────────────────────────────────────────
class Spring {
  constructor(initial, omega) {
    this.x = initial;
    this.v = 0;
    this.omega = omega;
  }
  update(target, dt) {
    const n = this.v - (this.x - target) * this.omega * this.omega * dt;
    const d = 1 + this.omega * dt;
    this.v = n / (d * d);
    this.x += this.v * dt;
  }
  reset() {
    this.x = 0;
    this.v = 0;
  }
}

// ─────────────────────────────────────────────
// Pointer spring (2D)
// ─────────────────────────────────────────────
class PointerSpring {
  constructor(x, y, omega) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.omega = omega;
  }
  update(tx, ty, dt) {
    const ω = this.omega,
      d = 1 + ω * dt;
    this.vx = (this.vx - (this.x - tx) * ω * ω * dt) / (d * d);
    this.vy = (this.vy - (this.y - ty) * ω * ω * dt) / (d * d);
    this.x += this.vx;
    this.y += this.vy;
  }
}

// ─────────────────────────────────────────────
// Inner scene (needs access to R3F context)
// ─────────────────────────────────────────────
function Scene({ isMobile }) {
  const { size } = useThree();
  const noise2D = useMemo(() => createNoise2D(), []);

  // Use isMobile for performance optimizations
  const cellSize = isMobile ? 75 : 40;

  // Refs that survive re-renders without causing them
  const stateRef = useRef(null);

  // ── Build / rebuild everything on resize ──────────────────────────
  const build = useCallback(() => {
    const W = size.width;
    const H = size.height;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const cW = Math.floor(W * dpr);
    const cH = Math.floor(H * dpr);

    const CELL = cellSize * dpr;
    const HALF = CELL * 0.5;
    const nX = Math.ceil(cW / CELL);
    const nY = Math.ceil(cH / CELL);
    const radius = 0.08 * cW;

    // Build cell grid
    const cells = [];
    for (let xi = 0; xi <= nX; xi++) {
      for (let yi = 0; yi <= nY; yi++) {
        cells.push({
          x: xi * CELL - HALF,
          y: yi * CELL - HALF,
          spring: new Spring(0, 45),
          active: false,
        });
      }
    }

    // Canvas 2D control map
    const canvas = stateRef.current?.canvas || document.createElement('canvas');
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d', { alpha: true });

    // Canvas texture
    const canvasTexture =
      stateRef.current?.canvasTexture || new THREE.CanvasTexture(canvas);
    canvasTexture.image = canvas;
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;
    canvasTexture.generateMipmaps = false;

    stateRef.current = {
      ...stateRef.current,
      W,
      H,
      dpr,
      cW,
      cH,
      CELL,
      HALF,
      nX,
      nY,
      radius,
      cells,
      canvas,
      ctx,
      canvasTexture,
      nd: 0.015 * dpr,
      shiftSize: 1 / nX,
    };
  }, [size, cellSize]);

  useEffect(() => {
    build();
  }, [build]);

  // ── Pointer tracking ───────────────────────────────────────────────
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = e => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const pSpring = useRef(new PointerSpring(0, 0, 15));

  // Cap the heavy control-map repaint + GPU texture upload to ~30fps while the
  // fullscreen quad keeps compositing at the display's native rate. paintAcc
  // accumulates delta time; hadActive remembers whether the last painted frame
  // drew any cells, so once the effect settles to empty we stop re-uploading.
  const PAINT_INTERVAL = 1 / 30;
  const paintAccRef = useRef(0);
  const hadActiveRef = useRef(false);
  const readyFiredRef = useRef(false);

  // ── Compositor uniforms ────────────────────────────────────────────
  const compUniforms = useMemo(
    () => ({
      uCanvasMap: { value: null },
      uTime: { value: 0 },
      uShiftSize: { value: 1 / 20 },
    }),
    [],
  );

  // ── Compositor mesh ────────────────────────────────────────────────
  const compScene = useMemo(() => new THREE.Scene(), []);
  const compCamera = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    c.position.set(0, 0, 10);
    return c;
  }, []);

  useEffect(() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: compUniforms,
      vertexShader: compositorVert,
      fragmentShader: compositorFrag,
      transparent: true,
    });
    compScene.add(new THREE.Mesh(geo, mat));
  }, [compScene, compUniforms]);

  // ── Per-frame update ───────────────────────────────────────────────
  useFrame(({ gl, size: sz }, dt) => {
    const s = stateRef.current;
    if (!s) return;

    // Skip all per-frame work while the tab is hidden — no point painting the
    // control map or re-uploading the texture when nothing is visible.
    if (document.hidden) return;

    // The fullscreen quad is cheap — composite it every frame so the
    // background stays smooth even while the control map is throttled.
    const renderQuad = () => {
      gl.setRenderTarget(null);
      gl.render(compScene, compCamera);
      // Announce once, after the first frame is actually painted to the canvas,
      // so the loading screen can wait for the heavy 3D background to be ready.
      if (!readyFiredRef.current) {
        readyFiredRef.current = true;
        window.__shaderReady = true;
        window.dispatchEvent(new Event('shader:ready'));
      }
    };

    // Throttle the expensive CPU paint + texture upload to ~30fps.
    paintAccRef.current += dt;
    if (paintAccRef.current < PAINT_INTERVAL) {
      renderQuad();
      return;
    }
    const stepDt = Math.max(Math.min(paintAccRef.current, 1 / 30), 1 / 60);
    paintAccRef.current = 0;

    const t = performance.now() * 0.001;

    // Update pointer spring
    const marginPx = sz.width < 960 ? 10 : 60;
    const dpr = s.dpr;
    const pTgt = {
      x: pointerRef.current.x * dpr - marginPx * dpr,
      y: pointerRef.current.y * dpr,
    };
    pSpring.current.update(pTgt.x, pTgt.y, stepDt);
    const px = pSpring.current.x;
    const py = pSpring.current.y;

    // Paint control map
    const { ctx, cells, cW, cH, nd, radius, CELL, HALF } = s;

    ctx.clearRect(0, 0, cW, cH);

    // Update and draw cells
    let activeCount = 0;
    for (const cell of cells) {
      const dx = cell.x - px;
      const dy = cell.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = noise2D(dx * nd, dy * nd + t * 0.5);
      const warpedRadius = radius + noise * radius * 1.2;
      const active = dist < warpedRadius;

      // Spring physics
      cell.spring.update(active ? 1 : 0, stepDt);
      const value = cell.spring.x;

      // Draw to control map
      if (value > 0.01) {
        activeCount++;
        const x = cell.x + HALF;
        const y = cell.y + HALF;

        // Active cells (high value) - magenta
        if (value > 0.5) {
          // Red channel: pixelation
          ctx.fillStyle = `rgba(255,0,255,${value})`;
          ctx.fillRect(x, y, CELL, CELL);

          // Green channel: horizontal shift
          if (Math.random() < value * 0.1) {
            ctx.fillStyle = `rgba(255,0,255,${Math.random() * value})`;
            ctx.fillRect(x, y, CELL, CELL);
          }

          // Blue channel: grid stroke
          ctx.strokeStyle = `rgba(255,0,255,${value * 0.5})`;
        }
        // Trailing cells (low value) - cyan
        else {
          // Red channel: pixelation
          ctx.fillStyle = `rgba(0,255,255,${value})`;
          ctx.fillRect(x, y, CELL, CELL);

          // Green channel: horizontal shift
          if (Math.random() < value * 0.1) {
            ctx.fillStyle = `rgba(0,255,255,${Math.random() * value})`;
            ctx.fillRect(x, y, CELL, CELL);
          }

          // Blue channel: grid stroke
          ctx.strokeStyle = `rgba(0,255,255,${value * 0.5})`;
        }

        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, CELL, CELL);

        // Alpha channel: resolution
        ctx.fillStyle = `rgba(255,255,255,${value * 0.8})`;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }

    // Only re-upload the texture when something is painted, or once more to
    // flush the final clear after the cells settle back to empty. After that we
    // stop uploading entirely until activity resumes.
    if (activeCount > 0 || hadActiveRef.current) {
      s.canvasTexture.needsUpdate = true;
    }
    hadActiveRef.current = activeCount > 0;

    // Update uniforms
    compUniforms.uTime.value += stepDt;
    compUniforms.uCanvasMap.value = s.canvasTexture;
    compUniforms.uShiftSize.value = s.shiftSize;

    renderQuad();
  }, 1);

  return null;
}

// ─────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────
export default function MikaShaderEffect({ style = {} }) {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          ),
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Honour the OS "reduce motion" setting — render a static frame instead of
  // running the continuous animation loop.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Cap DPR: the effect is deliberately low-fi/pixelated, so a 1.5x ceiling on
  // desktop roughly halves the per-frame canvas paint + texture-upload cost
  // versus a full 2x retina buffer, with no meaningful visual loss.
  const dprCap = isMobile ? 1 : 1.5;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: -1,
        ...style,
      }}
    >
      <Canvas
        gl={{
          alpha: false,
          antialias: !isMobile,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
        }}
        style={{ display: 'block', width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 10] }}
        dpr={Math.min(window.devicePixelRatio, dprCap)}
        frameloop={isMobile || reducedMotion ? 'demand' : 'always'}
      >
        {/* <color attach='background' args={[colour.acid]} /> */}
        <Scene isMobile={isMobile} />
      </Canvas>
    </div>
  );
}

MikaShaderEffect.propTypes = {
  style: PropTypes.object,
};

Scene.propTypes = {
  isMobile: PropTypes.bool.isRequired,
};
