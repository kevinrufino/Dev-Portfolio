#!/usr/bin/env node
/**
 * Land a studio export in the repo.
 *
 *   npm run studio:apply ~/Downloads/studio-2026-09-07.zip
 *
 * The studio runs in a browser and browsers cannot write into a git
 * repository — which is the right constraint, not one to work around: the site
 * is static, its content belongs in the same history as its code, and a change
 * to a case study should show up in a diff like a change to a component. This
 * is the one step that crosses that line, and it is deliberately a command the
 * author runs rather than something a page does.
 *
 * It writes exactly two things:
 *   src/content/projects.json   — what the site renders
 *   public/projects/<slug>/…    — the assets that JSON names
 *
 * Nothing else is touched, nothing is deleted, and `git status` afterwards is
 * the review.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(root, 'src/content/projects.json');
const ASSETS = path.join(root, 'public/projects');

const bail = message => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const source = process.argv[2];
if (!source) bail('Usage: npm run studio:apply <exported .zip or unpacked folder>');
if (!existsSync(source)) bail(`No such file: ${source}`);

// A folder is accepted too, for anyone who unzipped it first.
let dir = source;
let temp = null;
if (source.toLowerCase().endsWith('.zip')) {
  temp = mkdtempSync(path.join(tmpdir(), 'studio-'));
  try {
    execFileSync('unzip', ['-qo', source, '-d', temp]);
  } catch {
    bail(`Could not unzip ${source}. Unpack it and pass the folder instead.`);
  }
  dir = temp;
}

const json = path.join(dir, 'projects.json');
if (!existsSync(json)) bail(`No projects.json inside ${source}.`);

let parsed;
try {
  parsed = JSON.parse(readFileSync(json, 'utf8'));
} catch (error) {
  bail(`projects.json is not valid JSON: ${error.message}`);
}

const titles = Object.keys(parsed.projects || {});
// Titles only, and worth showing: reordering the index is the one change that
// leaves no trace in any project's own record.
let kept = false;
const order = parsed.order || {};
const lists = ['work', 'personal'].filter(k => Array.isArray(order[k]) && order[k].length);
// Worth calling out for the same reason: a switch that hides the body of every
// project page leaves no trace in any project's own record, and applying a
// bundle should never be the first time you find out it is on.
const notice = parsed.site?.projectNotice;
// And for the third: a project published without a page keeps its row in the
// index but stops resolving as a route, which is not visible anywhere in its
// own record except as one boolean among five.
const pageless = Object.entries(parsed.projects || {})
  .filter(([, data]) => data.index?.liveOnly && !data.removed)
  .map(([title]) => title);
// The previous content, kept beside the file it replaces.
//
// This write is a REPLACEMENT, not a merge — the bundle is the whole of what
// the site renders — so applying an export made from a stale draft silently
// discards whatever was published in between. Nothing here can tell those
// apart, and the file is routinely uncommitted (it is generated), so `git
// checkout` is not always a way back. One copy costs nothing and is.
mkdirSync(path.dirname(CONTENT), { recursive: true });

// A bundle that carries fewer projects than the file it replaces is deleting
// them, because this write is a replacement. That has happened: an export built
// only from the studio's draft contained the six projects that had been edited,
// and applying it dropped four personal projects out of the index and brought
// three retired ones back to life, since their tombstones lived in the file it
// overwrote. The export is fixed, but the file it writes is the site's content
// and a truncated one should never land without someone saying so out loud.
if (existsSync(CONTENT)) {
  try {
    const current = JSON.parse(readFileSync(CONTENT, 'utf8')).projects || {};
    const missing = Object.keys(current).filter(t => !(t in (parsed.projects || {})));
    if (missing.length) {
      console.error(`
  ⚠  This bundle is missing ${missing.length} project(s) that the site has now:

${missing.map(t => `       · ${t}${current[t]?.removed ? '  (retired — applying would un-retire it)' : ''}`).join('\n')}

  Applying it would delete them. If that is what you meant, re-run with --force.
  If it is not, re-export from /studio — an export should carry every project,
  not only the ones you edited.
`);
      if (!process.argv.includes('--force')) process.exit(1);
    }
  } catch {
    // An unreadable current file is not a reason to block a good bundle.
  }
}

if (existsSync(CONTENT)) {
  const previous = readFileSync(CONTENT, 'utf8');
  if (previous.trim() && previous.trim() !== '{\n  "projects": {}\n}') {
    writeFileSync(`${CONTENT}.bak`, previous);
    kept = true;
  }
}
writeFileSync(CONTENT, `${JSON.stringify(parsed, null, 2)}\n`);

let assets = 0;
const from = path.join(dir, 'assets');
if (existsSync(from)) {
  mkdirSync(ASSETS, { recursive: true });
  cpSync(from, ASSETS, { recursive: true });
  const count = execFileSync('find', [from, '-type', 'f'], { encoding: 'utf8' });
  assets = count.trim() ? count.trim().split('\n').length : 0;
}

if (temp) rmSync(temp, { recursive: true, force: true });

console.log(`
  Applied ${titles.length} project(s) and ${assets} asset(s).

    src/content/projects.json
    public/projects/

  ${titles.map(t => `  · ${t}`).join('\n')}
${lists.length ? `\n  Works pane order:\n${lists.map(k => `      ${k}: ${order[k].join(' · ')}`).join('\n')}\n` : ''}${pageless.length ? `\n  No project page — the index links these straight to the live site:\n${pageless.map(t => `      · ${t}`).join('\n')}\n` : ''}${notice?.enabled ? `\n  Project pages are held: every one shows “${notice.text}” instead of its case study.\n` : ''}
${kept ? `  The content this replaced was saved to projects.json.bak\n` : ''}
  Review with \`git status\` and \`git diff\`, then commit. Everything under
  public/ is served from Vercel's CDN once it is deployed — there is nothing
  else to upload.
`);
