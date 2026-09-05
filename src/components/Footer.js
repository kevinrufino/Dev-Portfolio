import { useRef, useEffect, useState } from 'react';
import Reveal from './Reveal.js';

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
 * blue, and the footer is where it lands. The curtain reveal is kept and
 * retinted to match.
 *
 * The section is deliberately much taller than its content (165svh) and is
 * pulled up under the section above it with a negative margin. That overlap is
 * the run-in the palm scene needs to travel from the projects index into the
 * footer without the transition being cut off by a section boundary; the
 * content itself is offset back down so it still reads as a normal footer.
 */
export const Footer = ({ setCursor }) => {
  const footerRef = useRef(null);
  const [isCurtainLifted, setIsCurtainLifted] = useState(false);

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

  return (
    <footer
      ref={footerRef}
      className={`footer-curtain-stage relative h-[165svh] min-h-[780px] w-full overflow-hidden bg-charcoal text-charcoal-ink [margin-top:-60svh] ${
        isCurtainLifted ? 'footer-curtain-stage--lifted' : ''
      }`}
      id='contact'
      onMouseEnter={() => {
        setCursor?.('');
      }}
    >
      <div className='grid-rule grid-rule--charcoal' aria-hidden='true' />

      <div className='footer-curtain' aria-hidden='true'>
        <div className='footer-curtain__texture' />
      </div>

      {/* Pushed back down by the same 60svh the section was pulled up, so the
          content sits where a normal footer would. */}
      <div className='footer-curtain-content relative z-10 mx-auto max-w-[1440px] px-[clamp(24px,7.4vw,110px)] pt-[calc(60svh+clamp(40px,6vh,80px))]'>
        <Reveal>
          <div className='max-w-[46%] min-w-[280px]'>
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
                  className='type-body border-b border-[#50504b] py-[6px] text-[19px] text-[#dedbd0] transition-colors hover:text-charcoal-ink focus-visible:text-charcoal-ink'
                  href={link.href}
                  key={link.label}
                  target={link.isExternal ? '_blank' : undefined}
                  rel={link.isExternal ? 'noreferrer' : undefined}
                >
                  {link.label} ↗
                </a>
              ))}
            </nav>
          </div>
        </Reveal>
      </div>

      {/* Baseline rule + credits, pinned to the bottom of the tall section. */}
      <div
        aria-hidden='true'
        className='absolute bottom-[53px] left-0 right-0 z-10 h-px bg-charcoal-rule'
      />
      <div className='type-label absolute bottom-[17px] left-0 right-0 z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-[clamp(24px,7.4vw,110px)] text-charcoal-muted'>
        <span>Designed and developed by Kevin Rufino</span>
        <a href='#home' className='p-[5px] text-charcoal-muted'>
          Back to top ↑
        </a>
      </div>
    </footer>
  );
};
