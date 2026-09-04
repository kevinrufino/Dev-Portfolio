import { ProjectsData } from '../../constants.js';
import { toSlug } from '../../utils/helpers.js';

const DISPLAY_OVERRIDES = {
  'Our Force 1 Poster Content Display Page': 'Our Force 1 Poster',
  'TINAJ Collection Listing Page': 'TINAJ Collection',
  'EA Sports FC Partner Page': 'EA Sports FC',
};

export const PROJECTS = ProjectsData.map((project, index) => ({
  no: String(index + 1).padStart(2, '0'),
  title: project.title,
  display: DISPLAY_OVERRIDES[project.title] || project.title,
  year: project.year,
  type: project.type,
  slug: toSlug(project.title),
  media: project.scrapeGif,
  isVideo: /\.(mp4|webm)$/i.test(project.scrapeGif),
}));

export const PROJECT_COUNT = String(PROJECTS.length).padStart(2, '0');
