import STUDIO from './projects.json';

/**
 * Settings that belong to the site rather than to any one project.
 *
 * `projects.json` already carries the two halves the studio publishes — the
 * projects and the order they are listed in. This is the third: the handful of
 * switches that are true of the site as a whole, and so have nowhere sensible
 * to live inside a project record.
 *
 * Today there is one. The case studies are seeded with draft copy and
 * placeholder captures, and a page of confidently wrong facts is worse than a
 * page that admits it is not written yet — so the body of every project page
 * can be held back behind a single notice until the real thing is ready. It is
 * a switch rather than a deletion because the content underneath is still in
 * the repo, reviewable, and one export away from being shown again.
 */

export const DEFAULT_PROJECT_NOTICE = 'More coming soon.';

const SITE = STUDIO.site || {};

/**
 * The stand-in for the case-study body.
 *
 * `enabled` hides the chapter bar, the metadata table and every block on every
 * project page, and puts `text` under the cover in their place. The cover and
 * the footer stay: the hero is real, and the way onward should not disappear
 * with the content it sits under.
 */
export const PROJECT_NOTICE = {
  enabled: Boolean(SITE.projectNotice?.enabled),
  text: SITE.projectNotice?.text || DEFAULT_PROJECT_NOTICE,
};

export const SITE_SETTINGS = { projectNotice: PROJECT_NOTICE };
