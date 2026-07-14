import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import ChannelZapper from '../components/ProjectsLab/ChannelZapper.js';
import LedgerIndex from '../components/ProjectsLab/LedgerIndex.js';
import CartridgePit from '../components/ProjectsLab/CartridgePit.js';
import '../components/ProjectsLab/lab.css';

const RENDITIONS = [
  {
    id: 'signal',
    no: '01',
    name: 'SIGNAL',
    hint: 'A broadcast TV. Scroll on the screen, hit 1–9, or work the dial — every project is a channel.',
    Comp: ChannelZapper,
  },
  {
    id: 'ledger',
    no: '02',
    name: 'THE LEDGER',
    hint: 'A file index set in giant type. Run the pointer down the rows and the preview chases it — on touch, rows light up as they cross the scroll line.',
    Comp: LedgerIndex,
  },
  {
    id: 'pit',
    no: '03',
    name: 'THE PIT',
    hint: 'Ten cartridges in a storage crate. Grab and throw them. Tap one to open its file.',
    Comp: CartridgePit,
  },
];

/**
 * /lab — a private showroom for candidate projects-section designs. Each
 * rendition is fully self-contained; only the active one is mounted so the
 * inactive ones don't keep videos or physics alive.
 */
const ProjectsLab = () => {
  const [active, setActive] = useState(0);
  const { Comp, hint } = RENDITIONS[active];

  useEffect(() => {
    document.title = 'Projects Lab — Kevin Rufino';
    return () => {
      document.title = 'Kevin Rufino';
    };
  }, []);

  return (
    <div className="grain min-h-[100svh] text-ultra px-3 md:px-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-4 pb-4 md:pt-6">
        <div>
          <Link
            to="/#projects"
            className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase hover:underline underline-offset-4 decoration-2"
          >
            ← BACK TO SITE
          </Link>
          <h1 className="font-offbit101Bold uppercase leading-[0.9] text-4xl md:text-6xl pt-1">
            Projects Lab
          </h1>
          <p className="font-offbitDot text-[10px] md:text-xs tracking-[0.3em] uppercase opacity-80 pt-1">
            03 RENDITIONS ✦ THUMBNAIL + TITLE ONLY ✦ PICK A FIGHTER
          </p>
        </div>

        <nav className="flex gap-2" aria-label="Renditions">
          {RENDITIONS.map((r, i) => (
            <button
              key={r.id}
              className={clsx(
                'font-offbit101Bold text-sm md:text-lg border-2 border-ultra px-3 py-2 transition-all',
                i === active
                  ? 'bg-ultra text-acid shadow-none translate-x-0 translate-y-0'
                  : 'bg-acid shadow-hard-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard',
              )}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
            >
              <span className="font-offbitDot text-[9px] md:text-[10px] tracking-[0.25em] block text-left">
                {r.no}
              </span>
              {r.name}
            </button>
          ))}
        </nav>
      </header>

      <p className="font-offbit text-base md:text-lg border-y-2 border-ultra py-2 mb-4">
        {hint}
      </p>

      <main key={RENDITIONS[active].id}>
        <Comp />
      </main>
    </div>
  );
};

export default ProjectsLab;
