import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { ProjectsData } from '../constants.js';
import { toSlug } from '../utils/helpers.js';

const ProjectPreview = () => {
  const { slug } = useParams();
  const project = ProjectsData.find(p => toSlug(p.title) === slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!project || !project.liveLink) {
    return (
      <div className="w-full h-screen bg-acid text-ultra flex flex-col items-center justify-center gap-4">
        <h1 className="font-offbit101Bold text-4xl">Preview not available</h1>
        <Link to={`/projects/${slug}`} className="font-offbit101Bold underline">
          ← Back to project
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-ultra flex flex-col">
      {/* Minimal top bar */}
      <div className="bg-acid text-ultra px-4 md:px-8 py-3 md:py-4 flex items-center justify-between border-b-2 border-ultra">
        <Link
          to={`/projects/${slug}`}
          className="font-offbit101Bold text-base md:text-lg hover:underline"
        >
          ← Back
        </Link>
        <p className="font-offbitDot text-xs md:text-sm tracking-[0.25em] uppercase">
          {project.title} — Live Preview
        </p>
      </div>

      {/* Full-height iframe */}
      <iframe
        src={project.liveLink}
        title={`${project.title} - Live Preview`}
        className="flex-1 w-full border-none"
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; xr-spatial-tracking"
      />
    </div>
  );
};

ProjectPreview.propTypes = {
  // No props needed
};

export default ProjectPreview;
