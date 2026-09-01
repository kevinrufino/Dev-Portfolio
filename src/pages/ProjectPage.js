import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ProjectsData } from '../constants.js';
import HalftoneField from '../components/CaseStudy/HalftoneField.js';
import { toSlug } from '../utils/helpers.js';
import { moodieCaseStudy } from './moodieCaseStudy.js';
import './ProjectPage.css';

const isVideoAsset = source => /\.(mp4|webm)(\?.*)?$/i.test(source || '');

const Kicker = ({ children, inverse = false }) => (
  <div className={`cs-kicker${inverse ? ' cs-kicker--inverse' : ''}`}>
    <span aria-hidden='true' />
    <p>{children}</p>
  </div>
);

Kicker.propTypes = {
  children: PropTypes.node.isRequired,
  inverse: PropTypes.bool,
};

const SmartLink = ({ href, className, children, ariaLabel }) => {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={className}
      target='_blank'
      rel='noreferrer'
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
};

SmartLink.propTypes = {
  href: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  ariaLabel: PropTypes.string,
};

const PillLink = ({ href, children, primary = false }) => (
  <SmartLink
    href={href}
    className={`cs-pill-link${primary ? ' cs-pill-link--primary' : ''}`}
    ariaLabel={`${children}${href.startsWith('/') ? '' : ' (opens in a new tab)'}`}
  >
    <span>{children}</span>
    <i aria-hidden='true' />
  </SmartLink>
);

PillLink.propTypes = {
  href: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  primary: PropTypes.bool,
};

const TopBar = () => (
  <header className='cs-topbar'>
    <Link to='/' className='cs-wordmark' aria-label='Kevin Rufino, home'>
      KEVIN RUFINO
    </Link>
    <nav aria-label='Portfolio navigation'>
      <Link className='is-current' to='/#projects'>
        Work
      </Link>
      <Link to='/#intro'>About</Link>
      <a href="/Kevin Rufino's Resume.pdf" target='_blank' rel='noreferrer'>
        Résumé
      </a>
    </nav>
  </header>
);

const BackLink = () => (
  <Link className='cs-back-link' to='/#projects'>
    <span aria-hidden='true' />
    Back to work
  </Link>
);

const SectionIntro = ({ label, title, body, inverse = false }) => (
  <div
    className={`cs-section-intro${inverse ? ' cs-section-intro--inverse' : ''}`}
  >
    <Kicker inverse={inverse}>{label}</Kicker>
    <h2>{title}</h2>
    {body && <p>{body}</p>}
  </div>
);

SectionIntro.propTypes = {
  label: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string,
  inverse: PropTypes.bool,
};

const ArtifactFrame = ({ source, title, caption, index, children }) => (
  <figure className='cs-artifact'>
    <div className='cs-artifact__well'>
      {children ||
        (isVideoAsset(source) ? (
          <video
            src={source}
            autoPlay
            loop
            muted
            playsInline
            controls
            aria-label={title}
          />
        ) : (
          <img src={source} alt={title} loading='lazy' />
        ))}
    </div>
    <figcaption>
      <span>FIG {String(index).padStart(2, '0')}</span>
      <p>{caption}</p>
    </figcaption>
  </figure>
);

ArtifactFrame.propTypes = {
  source: PropTypes.string,
  title: PropTypes.string.isRequired,
  caption: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  children: PropTypes.node,
};

const PipelineArtifact = () => (
  <div className='cs-pipeline' aria-label='Moodie data pipeline diagram'>
    <div>
      <span>01</span>
      <strong>Collect</strong>
      <p>Saved images</p>
    </div>
    <i aria-hidden='true'>→</i>
    <div>
      <span>02</span>
      <strong>Embed</strong>
      <p>CLIP · 768d</p>
    </div>
    <i aria-hidden='true'>→</i>
    <div>
      <span>03</span>
      <strong>Project</strong>
      <p>UMAP · x/y</p>
    </div>
    <i aria-hidden='true'>→</i>
    <div>
      <span>04</span>
      <strong>Explore</strong>
      <p>Viewport canvas</p>
    </div>
  </div>
);

const DesignMoment = ({ moment }) => (
  <article className={`cs-moment cs-moment--${moment.tone}`}>
    <div className='cs-moment__accent' />
    <div className='cs-moment__content'>
      <header>
        <span>{moment.index}</span>
        <p>{moment.type}</p>
      </header>
      <div className='cs-moment__rule' />
      <div className='cs-moment__tension'>
        <small>The tension</small>
        <h3>{moment.tension}</h3>
      </div>
      <div className='cs-options'>
        <small>Options on the table</small>
        {moment.options.map(option => (
          <div className='cs-option' key={option.label}>
            <span>{option.label}</span>
            <div>
              <strong>{option.title}</strong>
              <p>{option.cost}</p>
            </div>
          </div>
        ))}
      </div>
      <div className='cs-call'>
        <small>The call</small>
        <p>{moment.call}</p>
      </div>
      <div className='cs-why'>
        <small>Why this held up</small>
        <p>{moment.why}</p>
      </div>
    </div>
  </article>
);

DesignMoment.propTypes = {
  moment: PropTypes.shape({
    index: PropTypes.string.isRequired,
    tone: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    tension: PropTypes.string.isRequired,
    call: PropTypes.string.isRequired,
    why: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        cost: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
};

const ProjectFooter = ({ nextProject }) => (
  <footer className='cs-project-footer'>
    <div>
      <small>Next project</small>
      <Link to={`/projects/${toSlug(nextProject.title)}`}>
        {nextProject.title} — {nextProject.type.toLowerCase()}
      </Link>
    </div>
    <PillLink href='/#projects'>All work</PillLink>
  </footer>
);

ProjectFooter.propTypes = {
  nextProject: PropTypes.shape({
    title: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
};

const getProjectLinks = (project, slug) => {
  const links = project.links.map(link => {
    const label = Object.keys(link)[0];
    return { label, href: link[label] };
  });

  if (project.liveLink && !links.some(link => link.href === project.liveLink)) {
    links.unshift({
      label: `View live — ${project.title}`,
      href: project.liveLink,
    });
  }

  if (project.liveLink) {
    links.push({
      label: 'Open site preview',
      href: `/projects/${slug}/preview`,
    });
  }

  return links.slice(0, 2);
};

const MoodieCaseStudy = ({ project, nextProject, slug, reducedMotion }) => {
  const links = getProjectLinks(project, slug);

  return (
    <>
      <section className='cs-hero'>
        <BackLink />
        <div className='cs-project-cover'>
          <HalftoneField variant='cover' tone='yellow' />
          <div className='cs-cover-content'>
            <div className='cs-cover-topline'>
              <Kicker inverse>{moodieCaseStudy.status}</Kicker>
              <p className='cs-drag-chip'>
                <span aria-hidden='true' /> Drag to explore
              </p>
            </div>
            <h1>{moodieCaseStudy.title}</h1>
            <p className='cs-cover-summary'>{moodieCaseStudy.summary}</p>
          </div>
        </div>

        <div className='cs-meta-grid'>
          {moodieCaseStudy.meta.map(item => (
            <div className='cs-meta-item' key={item.label}>
              <small>{item.label}</small>
              <p>
                {item.values.map(value => (
                  <React.Fragment key={value}>
                    {value}
                    <br />
                  </React.Fragment>
                ))}
              </p>
            </div>
          ))}
        </div>

        <div className='cs-link-row'>
          {links.map((link, linkIndex) => (
            <PillLink
              key={link.href}
              href={link.href}
              primary={linkIndex === 0}
            >
              {link.label}
            </PillLink>
          ))}
        </div>
      </section>

      <motion.section
        className='cs-context'
        initial={reducedMotion ? false : { opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.16 }}
      >
        {moodieCaseStudy.context.map(item => (
          <SectionIntro key={item.label} {...item} />
        ))}
      </motion.section>

      <section className='cs-artifacts-section'>
        <SectionIntro {...moodieCaseStudy.artifacts} inverse />
        <ArtifactFrame
          source={project.scrapeGif}
          title='Moodie taste canvas'
          caption={moodieCaseStudy.artifacts.captions[0]}
          index={1}
        />
        <ArtifactFrame
          title='Moodie embedding and layout pipeline'
          caption={moodieCaseStudy.artifacts.captions[1]}
          index={2}
        >
          <PipelineArtifact />
        </ArtifactFrame>
      </section>

      <HalftoneField
        className='cs-halftone-divider'
        tone='ink'
        variant='divider'
        label='Interactive halftone divider. Drag or use arrow keys to reshape it.'
      />

      <section className='cs-moments-section'>
        <SectionIntro {...moodieCaseStudy.momentsIntro} />
        <div className='cs-moments-list'>
          {moodieCaseStudy.moments.map(moment => (
            <DesignMoment key={moment.index} moment={moment} />
          ))}
        </div>
      </section>

      <section className='cs-impact'>
        <Kicker inverse>Impact</Kicker>
        <h2>{moodieCaseStudy.impact.title}</h2>
        <p className='cs-impact__body'>{moodieCaseStudy.impact.body}</p>
        <div className='cs-impact__stats'>
          {moodieCaseStudy.impact.stats.map(stat => (
            <div className='cs-stat' key={stat.label}>
              <strong>{stat.figure}</strong>
              <small>{stat.label}</small>
              <p>{stat.context}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='cs-reflections'>
        <SectionIntro
          label='Reflections'
          title='What I would carry into the next build.'
        />
        <div className='cs-reflection-list'>
          {moodieCaseStudy.reflections.map((reflection, index) => (
            <article className='cs-reflection' key={reflection.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{reflection.title}</h3>
                <p>{reflection.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ProjectFooter nextProject={nextProject} />
    </>
  );
};

MoodieCaseStudy.propTypes = {
  project: PropTypes.object.isRequired,
  nextProject: PropTypes.object.isRequired,
  slug: PropTypes.string.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
};

const ProjectShowcase = ({ project, nextProject, slug }) => {
  const links = getProjectLinks(project, slug);
  const assets = [project.scrapeGif, ...(project.assets || [])].filter(
    (asset, index, list) => asset && list.indexOf(asset) === index,
  );

  return (
    <>
      <section className='cs-showcase-header'>
        <BackLink />
        <Kicker>
          Showcase · {project.client} · {project.year}
        </Kicker>
        <h1>{project.title}</h1>
        <p>{project.description}</p>
        <div className='cs-tag-row' aria-label='Technology used'>
          {project.technology.map(technology => (
            <span key={technology}>{technology}</span>
          ))}
        </div>
        <div className='cs-link-row'>
          {links.map((link, linkIndex) => (
            <PillLink
              key={link.href}
              href={link.href}
              primary={linkIndex === 0}
            >
              {link.label}
            </PillLink>
          ))}
        </div>
      </section>

      <section className='cs-showcase-assets' aria-label='Project artifacts'>
        {assets.map((asset, assetIndex) => (
          <ArtifactFrame
            key={asset}
            source={asset}
            title={`${project.title} project artifact ${assetIndex + 1}`}
            caption={
              assetIndex === 0
                ? `A live capture from ${project.title}.`
                : `A supporting artifact from the ${project.type.toLowerCase()} build.`
            }
            index={assetIndex + 1}
          />
        ))}
      </section>

      <ProjectFooter nextProject={nextProject} />
    </>
  );
};

ProjectShowcase.propTypes = {
  project: PropTypes.object.isRequired,
  nextProject: PropTypes.object.isRequired,
  slug: PropTypes.string.isRequired,
};

const ProjectPage = () => {
  const { slug } = useParams();
  const reducedMotion = useReducedMotion();
  const index = ProjectsData.findIndex(
    project => toSlug(project.title) === slug,
  );
  const project = index >= 0 ? ProjectsData[index] : null;
  const nextProject =
    ProjectsData[index >= 0 ? (index + 1) % ProjectsData.length : 0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (project) document.title = `${project.title} — Kevin Rufino`;
    return () => {
      document.title = 'Kevin Rufino';
    };
  }, [project]);

  if (!project) {
    return (
      <div className='case-study-page cs-not-found'>
        <TopBar />
        <main>
          <Kicker>404 / Project not found</Kicker>
          <h1>This project slipped out of the archive.</h1>
          <PillLink href='/#projects' primary>
            Back to work
          </PillLink>
        </main>
      </div>
    );
  }

  const isMoodie = project.title.toLowerCase() === 'moodie';

  return (
    <div className='case-study-page'>
      <a className='cs-skip-link' href='#case-study-content'>
        Skip to case study
      </a>
      <div className='case-study-shell'>
        <TopBar />
        <main id='case-study-content'>
          {isMoodie ? (
            <MoodieCaseStudy
              project={project}
              nextProject={nextProject}
              slug={slug}
              reducedMotion={reducedMotion}
            />
          ) : (
            <ProjectShowcase
              project={project}
              nextProject={nextProject}
              slug={slug}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default ProjectPage;
