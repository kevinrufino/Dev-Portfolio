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
const order = parsed.order || {};
const lists = ['work', 'personal'].filter(k => Array.isArray(order[k]) && order[k].length);
mkdirSync(path.dirname(CONTENT), { recursive: true });
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
${lists.length ? `\n  Works pane order:\n${lists.map(k => `      ${k}: ${order[k].join(' · ')}`).join('\n')}\n` : ''}
  Review with \`git status\` and \`git diff\`, then commit. Everything under
  public/ is served from Vercel's CDN once it is deployed — there is nothing
  else to upload.
`);
