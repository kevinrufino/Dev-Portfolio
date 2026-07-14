import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { ProjectsData } from './constants.js';

const PROJECT_ACCENTS = ['#ff4a37', '#2f64ff', '#ffdd00', '#b8f2d0', '#ff7cc8', '#f4f0e6'];

const projectCopy = {
  "Max's Lab": 'A browser-built Air Max world made to reward curiosity, not just clicks.',
  Moodie: 'An infinite visual canvas that stays fast while the world keeps growing.',
  'Minecraft Clone': 'A procedural multiplayer world, rendered and simulated entirely in the browser.',
  'Our Force 1 Poster Content Display Page': 'A living editorial archive for a new kind of Nike collection.',
  '.Swoosh 404': 'A product launch disguised as a glitched-out arcade invasion.',
  'EA Sports FC Partner Page': 'An interactive player reveal built for Nike and EA Sports FC.',
};

const firstProjectLink = project => {
  if (project.liveLink) return project.liveLink;
  const linkGroup = project.links?.[0];
  return linkGroup ? Object.values(linkGroup)[0] : '#';
};

const useClock = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date()));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return time;
};

const scrollToId = id => {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};

const PixelFace = () => (
  <svg viewBox='0 0 64 64' role='img' aria-label='Smiling computer icon'>
    <path fill='#f4f0e6' stroke='currentColor' strokeWidth='4' d='M10 4h44v44H38v8h10v4H16v-4h10v-8H10z' />
    <path fill='#fff' stroke='currentColor' strokeWidth='3' d='M16 11h32v28H16z' />
    <path fill='currentColor' d='M22 18h5v6h-5zm15 0h5v6h-5zM24 29h4v3h8v-3h4v6H24z' />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox='0 0 64 52' aria-hidden='true'>
    <path fill='#ffdd00' stroke='currentColor' strokeWidth='4' d='M3 11h22l5-7h18v7h13v38H3z' />
    <path fill='#fff49a' stroke='currentColor' strokeWidth='4' d='M3 15h58v34H3z' />
  </svg>
);

const MailIcon = () => (
  <svg viewBox='0 0 64 52' aria-hidden='true'>
    <path fill='#fff' stroke='currentColor' strokeWidth='4' d='M3 4h58v44H3z' />
    <path fill='none' stroke='currentColor' strokeWidth='4' d='m5 7 27 23L59 7M5 46l20-21m34 21L39 25' />
    <path fill='#ff4a37' d='M26 25h12v8H26z' />
  </svg>
);

const DesktopIcon = ({ label, type, target }) => {
  const Icon = type === 'folder' ? FolderIcon : type === 'mail' ? MailIcon : PixelFace;
  return (
    <button className='desktop-icon' type='button' onClick={() => scrollToId(target)}>
      <span className='desktop-icon__art'><Icon /></span>
      <span>{label}</span>
    </button>
  );
};

const MacWindow = ({ children, title, className = '', draggable = false }) => {
  const windowRef = useRef(null);
  const pointerRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handlePointerDown = event => {
    if (!draggable || window.innerWidth < 760) return;
    pointerRef.current = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      originX: position.x, originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = event => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const rect = windowRef.current?.getBoundingClientRect();
    const maxX = Math.max(24, window.innerWidth - (rect?.width || 600) - 24);
    setPosition({
      x: Math.min(maxX, Math.max(-24, pointer.originX + event.clientX - pointer.startX)),
      y: Math.min(160, Math.max(-80, pointer.originY + event.clientY - pointer.startY)),
    });
  };

  const releasePointer = event => {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  };

  return (
    <section ref={windowRef} className={`mac-window ${draggable ? 'mac-window--draggable' : ''} ${className}`}
      style={{ '--window-x': `${position.x}px`, '--window-y': `${position.y}px` }}>
      <header className='mac-window__bar' onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={releasePointer} onPointerCancel={releasePointer}>
        <span className='mac-window__close' aria-hidden='true' />
        <span className='mac-window__stripes' aria-hidden='true' />
        <span className='mac-window__title'>{title}</span>
        <span className='mac-window__stripes' aria-hidden='true' />
      </header>
      {children}
    </section>
  );
};

const MenuBar = ({ time }) => (
  <nav className='menu-bar' aria-label='Portfolio navigation'>
    <button className='menu-bar__brand' type='button' onClick={() => scrollToId('home')} aria-label='Back to top'>K</button>
    <button type='button' onClick={() => scrollToId('work')}>Work</button>
    <button type='button' onClick={() => scrollToId('about')}>About</button>
    <a href='mailto:kevinrufino97@gmail.com'>Contact</a>
    <span className='menu-bar__status'>NYC&nbsp;&nbsp; {time}</span>
  </nav>
);

const BootScreen = ({ done }) => (
  <div className={`boot-screen ${done ? 'boot-screen--done' : ''}`} aria-hidden={done}>
    <div className='boot-screen__icon'><PixelFace /></div>
    <p>Starting Kevin OS…</p>
    <div className='boot-screen__progress'><span /></div>
  </div>
);

const Hero = () => {
  const time = useClock();
  return (
    <header className='hero' id='home'>
      <MenuBar time={time} />
      <div className='hero__desktop'>
        <div className='desktop-icons' aria-label='Desktop shortcuts'>
          <DesktopIcon label='SELECTED WORK' type='folder' target='work' />
          <DesktopIcon label='ABOUT KEVIN' type='computer' target='about' />
          <DesktopIcon label='SAY HELLO' type='mail' target='contact' />
        </div>
        <MacWindow title='HELLO.TXT' className='hero-window' draggable>
          <div className='hero-window__body'>
            <p className='eyebrow'>Creative developer · New York</p>
            <h1><span>Kevin</span><span>Rufino</span></h1>
            <div className='hero-window__footer'>
              <p>I make playful digital worlds where design and engineering share the controls.</p>
              <button type='button' onClick={() => scrollToId('work')}>Open the work <span aria-hidden='true'>↓</span></button>
            </div>
          </div>
        </MacWindow>
        <p className='drag-note' aria-hidden='true'>Grab the title bar<br />and make a mess ↗</p>
        <div className='hero__stamp' aria-hidden='true'>DESIGN<br />× CODE<br />× PLAY</div>
      </div>
    </header>
  );
};

const Media = ({ project, eager = false }) => {
  const src = project.scrapeGif;
  const isVideo = typeof src === 'string' && /\.(mp4|webm)$/i.test(src);
  if (isVideo) return <video src={src} autoPlay loop muted playsInline preload={eager ? 'auto' : 'metadata'} aria-label={`${project.title} project preview`} />;
  return <img src={src} alt={`${project.title} project preview`} loading={eager ? 'eager' : 'lazy'} />;
};

const ProjectBrowser = ({ projects }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProject = projects[activeIndex];
  return (
    <MacWindow title='SELECTED_WORK' className='project-browser'>
      <div className='project-browser__toolbar'><span>{projects.length} objects</span><span>2019–NOW</span></div>
      <div className='project-browser__layout'>
        <ul className='project-list' aria-label='Select a project'>
          {projects.map((project, index) => (
            <li key={project.title}>
              <button className={activeIndex === index ? 'is-active' : ''} type='button'
                onClick={() => setActiveIndex(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{project.title}</strong><small>{project.year}</small>
              </button>
            </li>
          ))}
        </ul>
        <article className='project-preview' style={{ '--project-accent': PROJECT_ACCENTS[activeIndex] }}>
          <div className='project-preview__media' key={activeProject.title}><Media project={activeProject} eager /></div>
          <div className='project-preview__info'>
            <p className='eyebrow'>{activeProject.client} / {activeProject.role}</p>
            <h3>{activeProject.title}</h3>
            <p>{projectCopy[activeProject.title] || activeProject.description}</p>
            <div className='project-preview__meta'>
              <span>{activeProject.type}</span>
              <a href={firstProjectLink(activeProject)} target='_blank' rel='noreferrer'>Launch project ↗</a>
            </div>
          </div>
        </article>
      </div>
    </MacWindow>
  );
};

const Work = ({ projects }) => (
  <section className='work' id='work'>
    <div className='section-heading'>
      <p>Selected work / 2019—2026</p>
      <h2>Good ideas.<br /><i>Fully built.</i></h2>
      <span>Interactive systems, brand worlds,<br />games & useful experiments.</span>
    </div>
    <ProjectBrowser projects={projects} />
  </section>
);

const Manifesto = () => (
  <section className='manifesto' id='about'>
    <div className='manifesto__poster' aria-hidden='true'><span>PLAY</span><span>IS A</span><span>SERIOUS</span><span>TOOL.</span></div>
    <MacWindow title='ABOUT_KEVIN.TXT' className='about-window'>
      <div className='about-window__grid'>
        <div className='portrait-frame'>
          <img src='/pixel-selfie.png' alt='Pixel portrait of Kevin Rufino' />
          <span>IMG_KEVIN_97.PCT</span>
        </div>
        <div className='about-window__copy'>
          <p className='eyebrow'>About this human</p>
          <h2>Engineer by training.<br />Designer by instinct.<br />Tinkerer by default.</h2>
          <p>I’m Kevin, a creative developer focused on expressive front-end systems and 3D experiences. At Nike, I’ve helped turn launches into worlds people can explore—not just pages they can scroll.</p>
          <p>My favorite projects sit in the overlap: technically ambitious, visually loud, and simple enough to feel like a toy.</p>
          <ul aria-label='Capabilities'>
            <li>Creative development</li><li>React / Next.js</li><li>Three.js / WebGL</li><li>Interaction design</li>
          </ul>
        </div>
      </div>
    </MacWindow>
  </section>
);

const Contact = () => (
  <footer className='contact' id='contact'>
    <p className='eyebrow'>Available for ambitious collaborations</p>
    <a className='contact__email' href='mailto:kevinrufino97@gmail.com'>LET’S MAKE<br />SOMETHING <i>WEIRD.</i></a>
    <div className='contact__bottom'>
      <span>Kevin Rufino © 2026</span>
      <div>
        <a href="/Kevin Rufino's Resume.pdf" target='_blank' rel='noreferrer'>Résumé ↗</a>
        <a href='https://www.linkedin.com/in/kevinrufino/' target='_blank' rel='noreferrer'>LinkedIn ↗</a>
        <a href='https://github.com/kevinrufino' target='_blank' rel='noreferrer'>GitHub ↗</a>
      </div>
      <button type='button' onClick={() => scrollToId('home')}>Top ↑</button>
    </div>
  </footer>
);

const ScrollCrank = () => {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => { frame = 0; setRotation(window.scrollY * 0.28); };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  const nextSection = () => {
    const ids = ['home', 'work', 'about', 'contact'];
    const current = ids.findIndex(id => {
      const rect = document.getElementById(id)?.getBoundingClientRect();
      return rect && rect.top <= 120 && rect.bottom > 120;
    });
    scrollToId(ids[Math.min(ids.length - 1, current + 1)] || 'work');
  };

  return (
    <button className='scroll-crank' style={{ '--crank-turn': `${rotation}deg` }} type='button'
      onClick={nextSection} aria-label='Scroll to next section'>
      <span className='scroll-crank__label'>SCROLL</span><span className='scroll-crank__dial'><i /></span>
    </button>
  );
};

function App() {
  const [booted, setBooted] = useState(false);
  const projects = useMemo(() => ProjectsData.slice(0, 6), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setBooted(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      <BootScreen done={booted} />
      <main>
        <Hero />
        <div className='ticker' aria-hidden='true'><div>CREATIVE DEVELOPMENT ✦ THREE.JS ✦ INTERACTION DESIGN ✦ WORLDS FOR THE WEB ✦ CREATIVE DEVELOPMENT ✦ THREE.JS ✦ INTERACTION DESIGN ✦ WORLDS FOR THE WEB ✦</div></div>
        <Work projects={projects} />
        <Manifesto />
      </main>
      <Contact />
      <ScrollCrank />
    </>
  );
}

export default App;
