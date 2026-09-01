import React, { useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const hash = (x, y) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const isInsideTasteMark = (x, y) => {
  const firstBlock = x > 0.09 && x < 0.39 && y > 0.28 && y < 0.72;
  const secondBlock = x > 0.34 && x < 0.62 && y > 0.43 && y < 0.68;
  const firstNotch = x > 0.27 && x < 0.37 && y > 0.57 && y < 0.78;
  const secondNotch = x > 0.47 && x < 0.51 && y > 0.64 && y < 0.8;
  return (firstBlock || secondBlock) && !firstNotch && !secondNotch;
};

const HalftoneField = ({
  className = '',
  tone = 'yellow',
  variant = 'cover',
  label = 'Interactive halftone taste field',
}) => {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const pointerRef = useRef({
    x: 0.52,
    y: 0.5,
    targetX: 0.52,
    targetY: 0.5,
    active: false,
  });
  const stateRef = useRef({ visible: true, reducedMotion: false });

  const draw = useCallback(
    time => {
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root || !canvas) return;

      const { width, height } = sizeRef.current;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const pointer = pointerRef.current;
      pointer.x += (pointer.targetX - pointer.x) * 0.09;
      pointer.y += (pointer.targetY - pointer.y) * 0.09;

      const pitch = width < 620 ? 30 : 48;
      const columns = Math.ceil(width / pitch) + 1;
      const rows = Math.ceil(height / pitch) + 1;
      const clock = stateRef.current.reducedMotion ? 0 : time * 0.00045;
      const isCover = variant === 'cover';
      const isPixelCover = variant === 'pixel-cover';
      const baseOpacity = variant === 'divider' ? 0.16 : 0.96;
      const color = tone === 'ink' ? '11, 11, 20' : '241, 244, 59';

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = column * pitch + pitch * 0.5;
          const y = row * pitch + pitch * 0.5;
          const normalizedX = x / width;
          const normalizedY = y / height;
          const dx = normalizedX - pointer.x;
          const dy = (normalizedY - pointer.y) * (height / width);
          const distance = Math.sqrt(dx * dx + dy * dy);
          const reach = pointer.active ? 0.22 : 0.13;
          const pointerField = clamp(1 - distance / reach, 0, 1);

          if (isPixelCover) {
            const fade = Math.pow(1 - clamp(normalizedY, 0, 1), 2);
            const radius =
              1.6 + fade * 16 + pointerField * (pointer.active ? 15 : 7);

            context.fillStyle = `rgba(${color}, ${clamp(
              0.92 + pointerField * 0.08,
              0,
              1,
            )})`;
            context.beginPath();
            context.arc(x, y, Math.max(1.6, radius), 0, Math.PI * 2);
            context.fill();
            continue;
          }

          const noise = hash(column, row);
          const wave =
            (Math.sin(column * 0.68 + clock * 2.1) +
              Math.cos(row * 0.9 - clock * 1.7)) *
            0.5;
          const mark = isCover && isInsideTasteMark(normalizedX, normalizedY);
          const fringe = isCover
            ? Math.exp(
                -(
                  Math.pow((normalizedX - 0.33) / 0.28, 2) +
                  Math.pow((normalizedY - 0.53) / 0.56, 2)
                ),
              )
            : 0;

          let radius = 2.7 + noise * 3 + wave * 0.7;
          radius += fringe * 8;
          radius += pointerField * (pointer.active ? 21 : 10);

          if (mark) {
            radius = Math.max(radius, pitch * 0.62 + pointerField * 7);
          }

          const alpha = clamp(
            baseOpacity + (pointerField > 0 ? pointerField * 0.6 : 0),
            0,
            1,
          );
          context.fillStyle = `rgba(${color}, ${alpha})`;
          context.beginPath();
          context.arc(x, y, Math.max(1.8, radius), 0, Math.PI * 2);
          context.fill();
        }
      }
    },
    [tone, variant],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const media = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : {
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
    stateRef.current.reducedMotion = media.matches;

    const render = time => {
      draw(time);
      if (stateRef.current.visible && !stateRef.current.reducedMotion) {
        frameRef.current = window.requestAnimationFrame(render);
      }
    };

    const restart = () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(render);
    };

    const syncSize = () => {
      const { width, height } = root.getBoundingClientRect();
      sizeRef.current = { width, height };
      restart();
    };

    const onMotionChange = event => {
      stateRef.current.reducedMotion = event.matches;
      restart();
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(syncSize);
    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(entries => {
            stateRef.current.visible = entries[0]?.isIntersecting ?? true;
            if (stateRef.current.visible) restart();
            else if (frameRef.current)
              window.cancelAnimationFrame(frameRef.current);
          });

    resizeObserver?.observe(root);
    intersectionObserver?.observe(root);
    if (!resizeObserver) window.addEventListener('resize', syncSize);
    media.addEventListener('change', onMotionChange);
    syncSize();

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', syncSize);
      media.removeEventListener('change', onMotionChange);
    };
  }, [draw]);

  const updatePointer = event => {
    const rect = rootRef.current.getBoundingClientRect();
    pointerRef.current.targetX = clamp(
      (event.clientX - rect.left) / rect.width,
      0,
      1,
    );
    pointerRef.current.targetY = clamp(
      (event.clientY - rect.top) / rect.height,
      0,
      1,
    );
  };

  const onPointerDown = event => {
    rootRef.current.setPointerCapture(event.pointerId);
    pointerRef.current.active = true;
    updatePointer(event);
  };

  const onPointerUp = event => {
    if (rootRef.current.hasPointerCapture(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
    pointerRef.current.active = false;
  };

  const onKeyDown = event => {
    const direction = {
      ArrowLeft: [-0.08, 0],
      ArrowRight: [0.08, 0],
      ArrowUp: [0, -0.08],
      ArrowDown: [0, 0.08],
    }[event.key];

    if (!direction) return;
    event.preventDefault();
    pointerRef.current.targetX = clamp(
      pointerRef.current.targetX + direction[0],
      0,
      1,
    );
    pointerRef.current.targetY = clamp(
      pointerRef.current.targetY + direction[1],
      0,
      1,
    );
    pointerRef.current.active = true;
  };

  return (
    <div
      ref={rootRef}
      className={`halftone-field halftone-field--${variant} ${className}`}
      role='img'
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => {
        pointerRef.current.active = false;
      }}
      onPointerDown={onPointerDown}
      onPointerMove={updatePointer}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        pointerRef.current.active = false;
      }}
    >
      <canvas ref={canvasRef} aria-hidden='true' />
    </div>
  );
};

HalftoneField.propTypes = {
  className: PropTypes.string,
  tone: PropTypes.oneOf(['yellow', 'ink']),
  variant: PropTypes.oneOf(['cover', 'pixel-cover', 'divider', 'artifact']),
  label: PropTypes.string,
};

export default HalftoneField;
