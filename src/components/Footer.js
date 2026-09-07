import { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Reveal from './Reveal.js';
import PixelTrail from './PixelTrail.js';
import { goToSection } from '../utils/navigateToSection.js';

const footerLinks = [
  { href: 'mailto:kevinrufino97@gmail.com', label: 'Email' },
  { href: "./Kevin Rufino's Resume.pdf", label: 'Resume', isExternal: true },
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

/**
 * Section 03 — contact.
 *
 * Charcoal rather than ultra: the page has spent three sections in acid and
 * blue, and this is where it lands.
 *
 * The footer does not scroll. It is fixed to the bottom of the viewport behind
 * the page, and the content above — the works section, which is opaque — rides
 * up over it and off, so the footer is uncovered rather than arriving. The
 * page content carries a bottom margin the height of this footer, which is the
 * scroll distance that performs the reveal.
 *
 * That makes the works section itself the curtain, which is why there is no
 * curtain element in here any more: two curtains would fight, and only one of
 * them can be the thing the reader is actually looking at.
 *
 * The measured height is published as `--footer-reveal-h` for the content
 * above to reserve. Measured rather than assumed because the contact block
 * rewraps at every breakpoint.
 */
export const Footer = ({ setCursor }) => {
  const footerRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Publish the footer's height so the content above can reserve exactly that
  // much scroll for the reveal — too little and the footer is never fully
  // uncovered, too much and the page ends on dead space.
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;

    const publish = () => {
      document.documentElement.style.setProperty(
        '--footer-reveal-h',
        `${Math.round(node.offsetHeight)}px`,
      );
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      document.documentElement.style.removeProperty('--footer-reveal-h');
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className='fixed inset-x-0 bottom-0 z-0 flex h-[100svh] min-h-[560px] w-full flex-col justify-start overflow-hidden bg-charcoal pt-[clamp(84px,11vh,150px)] text-charcoal-ink lg:justify-center lg:pt-0'
      id='contact'
      onMouseEnter={() => {
        setCursor?.('');
      }}
    >
      <div className='grid-rule grid-rule--charcoal' aria-hidden='true' />

      {/* The footer's own copy of the trail. It is fixed with a z-index, so
          it is a stacking context nothing outside can paint into — the trail
          has to be in here to end up between the charcoal and the type. */}
      <PixelTrail />

      <div className='relative z-10 mx-auto w-full max-w-[1440px] px-[clamp(24px,7.4vw,110px)]'>
        <Reveal>
          {/* Half the width where there is width; all of it on a phone, where
              the palm takes the bottom of the screen instead of the side. */}
          <div className='min-w-[280px] max-w-none lg:max-w-[46%]'>
            <p className='type-label mb-[26px] text-charcoal-muted'>
              03 — Contact
            </p>
            <h2 className='mb-[clamp(26px,3.4vh,36px)] font-offbit101Bold text-[clamp(44px,5.4vw,82px)] leading-[.92] tracking-[-.01em] text-charcoal-ink'>
              {'Let’s connect.'}
            </h2>
            <p className='type-body mb-[clamp(30px,4vh,42px)] text-[15px] leading-[1.8] text-charcoal-muted'>
              <strong className='font-medium text-charcoal-ink'>
                Kevin Rufino
              </strong>
              <br />
              Brooklyn, NY
            </p>

            <nav
              aria-label='Contact links'
              className='grid w-max grid-cols-2 gap-x-[38px] gap-y-[14px]'
            >
              {footerLinks.map(link => (
                <a
                  className='line-cta type-body text-[19px] text-[#dedbd0] transition-colors hover:text-charcoal-ink focus-visible:text-charcoal-ink'
                  style={{ '--line-cta-ink': 'var(--acid)' }}
                  href={link.href}
                  key={link.label}
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noreferrer' : undefined}
                >
                  {link.label}
                  <span aria-hidden='true' className='line-cta__arrow--diagonal'>
                    ↗
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </Reveal>
      </div>

      {/* Baseline rule + credits, pinned to the bottom of the tall section. */}
      <div
        aria-hidden='true'
        className='absolute bottom-[86px] left-0 right-0 z-10 mx-[clamp(24px,7.4vw,110px)] h-px bg-charcoal-rule sm:bottom-[62px]'
      />
      <div className='type-label absolute bottom-[18px] left-0 right-0 z-10 mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[clamp(24px,7.4vw,110px)] text-charcoal-muted'>
        <span>Designed and developed by Kevin Rufino</span>
        {/* The last hash on the page. `#home` put the destination in the URL,
            so a reload dropped the reader back at whatever they had last
            jumped to — and it hard-coded a route into a control that only ever
            means "the top of this page". */}
        <button
          type='button'
          onClick={() => goToSection(navigate, pathname, 'home')}
          className='line-cta font-[inherit] text-[inherit] text-charcoal-muted'
          style={{ '--line-cta-ink': 'var(--acid)' }}
        >
          Back to top
          <span aria-hidden='true' className='line-cta__arrow--up'>
            ↑
          </span>
        </button>
      </div>
    </footer>
  );
};
