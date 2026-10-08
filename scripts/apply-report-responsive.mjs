// apply-report-responsive.mjs — put the report responsive layer into the
// baked briefings (public/reports/ATK-*.html).
//
// public/reports/ is gitignored, so the layer must be (re)applied to every
// copy of the 310 baked files before it is served: after a re-bake, before
// `vite build` (which copies public/ into dist/), and before any other copy
// of the files is uploaded to wherever the reports are served from.
//
// The CSS has ONE source: REPORT_RESPONSIVE_CSS in src/lib/reportLock.js. The
// CMS renderer (src/lib/reportTemplate.js) and the Hub / dashboard frames
// (prepareReportFrame) read the same constant, so the three never drift.
//
//   node scripts/apply-report-responsive.mjs            dry run: what would change
//   node scripts/apply-report-responsive.mjs --write    write the files
//   node scripts/apply-report-responsive.mjs --dir <reports dir> [--write]
//
// What it does, idempotently (re-running changes nothing):
//   - every ATK-*.html: one <style id="attacked-resp">…</style> right before
//     </head> (after the shell's own stylesheet, so it wins on equal
//     specificity). An existing block is replaced, never stacked.
//   - index.html (the list of all reports): adds the missing
//     <meta name="viewport"> so phones do not render it at 980px.
// Exit code 1 when a file could not be handled (no single </head>).
// Check the result with scripts/verify-report-responsive.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
const DIR = path.resolve(arg("dir") || path.join(ROOT, "public/reports"));
const WRITE = process.argv.includes("--write");

const { REPORT_RESPONSIVE_CSS: CSS } = await import(pathToFileURL(path.join(ROOT, "src/lib/reportLock.js")).href);

const BLOCK_RE = /<style id="attacked-resp">[\s\S]*?<\/style>\r?\n?/g;
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const blockFor = (eol) => `<style id="attacked-resp">${CSS.split("\n").join(eol)}</style>${eol}`;

if (!fs.existsSync(DIR)) { console.error(`no such directory: ${DIR}`); process.exit(1); }
const files = fs.readdirSync(DIR).filter((f) => /^ATK-.*\.html$/.test(f)).sort();
let changed = 0, unchanged = 0;
const skipped = [];
for (const f of files) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const stripped = src.replace(BLOCK_RE, "");
  const i = stripped.indexOf("</head>");
  if (i < 0 || stripped.indexOf("</head>", i + 1) >= 0) { skipped.push(f); continue; }
  const out = stripped.slice(0, i) + blockFor(eol) + stripped.slice(i);
  if (out === src) { unchanged++; continue; }
  if (WRITE) fs.writeFileSync(p, out);
  changed++;
}

// index.html: viewport meta only (its own styles already fit a phone)
let index = "absent";
const ip = path.join(DIR, "index.html");
if (fs.existsSync(ip)) {
  const src = fs.readFileSync(ip, "utf8");
  if (/<meta\s+name=["']?viewport/i.test(src)) index = "ok";
  else {
    const m = src.match(/<meta charset=["']?utf-8["']?\s*\/?>/i);
    const out = m ? src.replace(m[0], m[0] + VIEWPORT) : src.replace(/<head>|<!doctype html>/i, (t) => t + VIEWPORT);
    if (out === src) { index = "skipped"; skipped.push("index.html"); }
    else { if (WRITE) fs.writeFileSync(ip, out); index = WRITE ? "viewport added" : "viewport would be added"; }
  }
}

console.log(JSON.stringify({ dir: DIR, reports: files.length, changed, unchanged, skipped, index, wrote: WRITE }));
if (skipped.length) process.exit(1);
