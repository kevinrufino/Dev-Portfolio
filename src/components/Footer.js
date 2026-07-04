import { useRef, useEffect, useState } from 'react';
import Reveal from './Reveal.js';

const footerLinks = [
  {
    href: 'mailto:kevinrufino97@gmail.com',
    label: 'Email',
  },
  {
    href: "./Kevin Rufino's Resume.pdf",
    label: 'Resume',
    isExternal: true,
  },
  {
    href: 'https://www.linkedin.com/in/kevinrufino/',
    label: 'LinkedIn',
    isExternal: true,
  },
  {
    href: 'https://github.com/kevinrufino',
    label: 'Github',
    isExternal: true,
  },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const noise = seed => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const smoothNoise = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const easeX = xf * xf * (3 - 2 * xf);
  const easeY = yf * yf * (3 - 2 * yf);

  const top =
    noise(xi * 12.9898 + yi * 78.233) * (1 - easeX) +
    noise((xi + 1) * 12.9898 + yi * 78.233) * easeX;
  const bottom =
    noise(xi * 12.9898 + (yi + 1) * 78.233) * (1 - easeX) +
    noise((xi + 1) * 12.9898 + (yi + 1) * 78.233) * easeX;

  return top * (1 - easeY) + bottom * easeY;
};

const PixelSmiley = () => (
  <div className='footer-pixel-smiley' aria-hidden='true'>
    <span className='footer-pixel-smiley__eye footer-pixel-smiley__eye--left' />
    <span className='footer-pixel-smiley__eye footer-pixel-smiley__eye--right' />
    <span className='footer-pixel-smiley__mouth footer-pixel-smiley__mouth--left' />
    <span className='footer-pixel-smiley__mouth footer-pixel-smiley__mouth--center' />
    <span className='footer-pixel-smiley__mouth footer-pixel-smiley__mouth--right' />
  </div>
);

export const Footer = ({ setCursor }) => {
  const footerRef = useRef(null);
  const obstacleRef = useRef(null);
  const [isCurtainLifted, setIsCurtainLifted] = useState(false);

  useEffect(() => {
    const dispatch = () => {
      if (!obstacleRef.current) return;
      const rect = obstacleRef.current.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent('registerObstacle', {
          detail: {
            id: 'footer-contact',
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY + rect.height / 2,
            width: rect.width,
            height: rect.height,
          },
        }),
      );
    };
    const frame = requestAnimationFrame(dispatch);
    window.addEventListener('resize', dispatch);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', dispatch);
    };
  }, []);

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setIsCurtainLifted(true);
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setIsCurtainLifted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0]?.isIntersecting) return;
        setIsCurtainLifted(true);
        observer.disconnect();
      },
      { threshold: 0.35, rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    let frame = 0;
    const updateSmileyOffset = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const progress = clamp(
        (viewportHeight - rect.top) / viewportHeight,
        0,
        1,
      );
      const offset = 34 + progress * 106;

      node.style.setProperty('--footer-smiley-progress', progress.toFixed(3));
      node.style.setProperty('--footer-smiley-offset', `${offset.toFixed(1)}%`);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(updateSmileyOffset);
    };

    // Only read layout on scroll while the footer is actually near the
    // viewport. Up at the top of a long page there's no reason to run a
    // getBoundingClientRect on every scroll frame for the whole session.
    let tracking = false;
    const startTracking = () => {
      if (tracking) return;
      tracking = true;
      updateSmileyOffset();
      window.addEventListener('scroll', requestUpdate, { passive: true });
    };
    const stopTracking = () => {
      if (!tracking) return;
      tracking = false;
      window.removeEventListener('scroll', requestUpdate);
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    // Resize is rare — keep it always so the offset stays correct even if the
    // viewport changes while the footer is parked off-screen.
    window.addEventListener('resize', requestUpdate);

    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting) startTracking();
          else stopTracking();
        },
        { rootMargin: '25% 0px 25% 0px' },
      );
      observer.observe(node);
    } else {
      startTracking();
    }

    // Seed a sensible offset before the first intersection callback.
    updateSmileyOffset();

    return () => {
      observer?.disconnect();
      stopTracking();
      window.removeEventListener('resize', requestUpdate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    let pointerFrame = 0;
    let gridX = 0;
    let gridY = 0;

    const updateGridLight = () => {
      pointerFrame = 0;
      const fieldX = gridX / 86;
      const fieldY = gridY / 86;
      const wave =
        Math.sin(fieldX * 1.7 + fieldY * 0.55) * 0.5 +
        Math.cos(fieldY * 1.45 - fieldX * 0.35) * 0.5;
      const grain = smoothNoise(fieldX, fieldY);
      const lobeOne = smoothNoise(fieldX + 7.2, fieldY - 3.4);
      const lobeTwo = smoothNoise(fieldX - 2.6, fieldY + 6.1);
      const lobeThree = smoothNoise(fieldX + 3.8, fieldY + 2.5);

      node.style.setProperty('--footer-grid-x', `${gridX.toFixed(1)}px`);
      node.style.setProperty('--footer-grid-y', `${gridY.toFixed(1)}px`);
      node.style.setProperty(
        '--footer-grid-line-alpha',
        clamp(0.42 + grain * 0.12 + wave * 0.04, 0.34, 0.56).toFixed(3),
      );
      node.style.setProperty(
        '--footer-grid-mask-alpha',
        clamp(0.58 + grain * 0.16 + wave * 0.05, 0.48, 0.74).toFixed(3),
      );
      node.style.setProperty(
        '--footer-grid-lobe-1-x',
        `${(gridX + Math.sin(fieldY * 1.8) * 78).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-1-y',
        `${(gridY + Math.cos(fieldX * 1.4) * 58).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-2-x',
        `${(gridX + Math.cos(fieldY * 1.2 + 1.4) * 96).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-2-y',
        `${(gridY + Math.sin(fieldX * 1.5 - 0.6) * 72).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-3-x',
        `${(gridX + Math.sin((fieldX + fieldY) * 0.9) * 54).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-3-y',
        `${(gridY + Math.cos((fieldX - fieldY) * 1.1) * 92).toFixed(1)}px`,
      );
      node.style.setProperty(
        '--footer-grid-lobe-1-alpha',
        clamp(0.2 + lobeOne * 0.32, 0.18, 0.48).toFixed(3),
      );
      node.style.setProperty(
        '--footer-grid-lobe-2-alpha',
        clamp(0.16 + lobeTwo * 0.28, 0.14, 0.4).toFixed(3),
      );
      node.style.setProperty(
        '--footer-grid-lobe-3-alpha',
        clamp(0.12 + lobeThree * 0.24, 0.1, 0.32).toFixed(3),
      );
    };

    const requestGridLight = event => {
      const rect = node.getBoundingClientRect();
      gridX = event.clientX - rect.left;
      gridY = event.clientY - rect.top;
      node.style.setProperty('--footer-grid-opacity', '1');

      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(updateGridLight);
    };

    const hideGridLight = () => {
      node.style.setProperty('--footer-grid-opacity', '0');
    };

    node.addEventListener('pointerenter', requestGridLight);
    node.addEventListener('pointermove', requestGridLight);
    node.addEventListener('pointerleave', hideGridLight);

    return () => {
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      node.removeEventListener('pointerenter', requestGridLight);
      node.removeEventListener('pointermove', requestGridLight);
      node.removeEventListener('pointerleave', hideGridLight);
    };
  }, []);

  const contactLinkClass =
    'w-max hover:bg-acid hover:text-ultra transition-colors px-1 -mx-1 focus-visible:bg-acid focus-visible:text-ultra';

  return (
    <footer
      ref={footerRef}
      className={`footer-curtain-stage relative mt-24 overflow-hidden bg-ultra text-acid ${
        isCurtainLifted ? 'footer-curtain-stage--lifted' : ''
      }`}
      id='contact'
      onMouseEnter={() => {
        setCursor?.('');
      }}
    >
      <div className='footer-curtain' aria-hidden='true'>
        <div className='footer-curtain__texture' />
      </div>

      <PixelSmiley />

      <div className='footer-curtain-content relative z-10 max-w-4xl m-auto flex min-h-[100svh] flex-col justify-center font-offbit101Bold px-4 md:px-0 py-14 md:py-20'>
        <Reveal>
          <div className='flex items-center max-w-xl'>
            <p className='font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase m-2 self-start mt-4 opacity-80'>
              {'04 — Contact'}
            </p>
          </div>
          <div className='flex max-w-xl items-start'>
            <p className='text-4xl md:text-7xl m-2 leading-[0.95]'>
              {'Lets Connect'}
            </p>
            <img
              src='/smile.svg'
              alt='smile'
              className='footer-contact-smile p-2 mt-1 md:mt-2'
            />
          </div>
        </Reveal>
        <div
          className='flex flex-col md:flex-row md:text-3xl m-2 md:m-4 w-max max-w-full'
          ref={obstacleRef}
        >
          <img
            src='/pixel-selfie.png'
            alt="it's a me"
            width={240}
            className='m-2 h-[200px] w-[200px] md:h-[240px] md:w-[240px] object-cover border-2 border-acid shadow-hard-acid'
          />
          <div className='m-2'>
            <p>{'Kevin Rufino'}</p>
            <p>{'Brooklyn, NY'}</p>
            <br />
            <div className='flex flex-col'>
              {footerLinks.map(link => (
                <a
                  className={contactLinkClass}
                  href={link.href}
                  key={link.label}
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noreferrer' : undefined}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className='text-xs md:text-2xl font-offbitDot text-center self-center m-2 pb-8 md:pb-12'>
          {'* Designed and Developed by Kevin Rufino *'}
        </p>
      </div>
    </footer>
  );
};
