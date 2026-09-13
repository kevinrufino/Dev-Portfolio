#!/usr/bin/env node
/**
 * Audit every hard-coded type size against the scale in tokens.json.
 *
 *   node scripts/design-system/audit-type.mjs
 *
 * Reports three buckets:
 *
 *   EXACT      size, leading and tracking all match a token. Replacing the
 *              arbitrary value with `text-<token>` changes no pixel, so these
 *              can be swapped mechanically and verified with style-snapshot.
 *   SIZE MATCH the size matches but the call site never stated a leading, so
 *              adopting the token would also adopt its line-height. That is a
 *              visual change, small but real — a human decides.
 *   DRIFT      no token matches. Usually a near-duplicate of one that exists:
 *              44->88px at 5.4vw, 44->88px at 5.2vw and 44->82px at 5.4vw are
 *              three different display sizes that were meant to be one.
 *
 * Nothing is written. This reports; the decisions are not mechanical.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const T = JSON.parse(fs.readFileSync('src/styles/tokens.json','utf8')).type;
const norm = s => String(s).replace(/\s+/g,'').replace(/^0\./,'.').replace(/^-0\./,'-.');
const tokenCss = Object.fromEntries(Object.entries(T).map(([n,t])=>[n,{
  size: norm(t.min===t.max?`${t.max}px`:`clamp(${t.min}px,${t.fluid},${t.max}px)`),
  lh: norm(t.lineHeight), tr: t.tracking===0||t.tracking==='0'?null:norm(t.tracking),
}]));
const files = execSync("grep -rl 'text-\\[' src --include='*.js'",{encoding:'utf8'}).trim().split('\n');
const rows=[];
for (const f of files) {
  const src = fs.readFileSync(f,'utf8');
  src.split('\n').forEach((line,i)=>{
    const m = line.match(/text-\[(clamp\([^\]]*\)|[\d.]+px)\](?:\s+leading-\[([\d.]+)\])?(?:\s+tracking-\[(-?[\d.]+em)\])?/);
    if(!m) return;
    const cand = {size:norm(m[1]), lh:m[2]?norm(m[2]):null, tr:m[3]?norm(m[3]):null};
    const hit = Object.entries(tokenCss).find(([,t])=>
      t.size===cand.size && (cand.lh===null || t.lh===cand.lh) && (t.tr||null)===(cand.tr||null));
    rows.push({f:f.replace('src/',''), line:i+1, raw:m[0], token:hit?hit[0]:null,
      lhGiven: cand.lh!==null, why: hit?(cand.lh===null?'size+tracking match, leading not stated':'exact'):null});
  });
}
const exact = rows.filter(r=>r.token && r.why==='exact');
const partial = rows.filter(r=>r.token && r.why!=='exact');
const none = rows.filter(r=>!r.token);
console.log(`\nEXACT MATCH — safe to replace (${exact.length})`);
for(const r of exact) console.log(`  ${r.f}:${r.line}  ${r.raw}  ->  text-${r.token}`);
console.log(`\nSIZE MATCH, leading unstated (${partial.length})`);
for(const r of partial) console.log(`  ${r.f}:${r.line}  ${r.raw}  ~  text-${r.token}`);
console.log(`\nNO TOKEN — drift, needs a human decision (${none.length})`);
for(const r of none) console.log(`  ${r.f}:${r.line}  ${r.raw}`);
