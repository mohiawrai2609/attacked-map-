// verify-report-responsive.mjs — check that every baked briefing carries the
// current report responsive layer (see scripts/apply-report-responsive.mjs).
//
//   node scripts/verify-report-responsive.mjs [--dir <reports dir>] [--orig <untouched copy>]
//
// For every ATK-*.html in the reports dir:
//   - exactly one <style id="attacked-resp">, equal to REPORT_RESPONSIVE_CSS in
//     src/lib/reportLock.js (in the file's own line endings), directly before
//     the only </head>;
//   - with --orig: the file is byte-identical to its untouched original plus
//     that one block (nothing else was changed).
// index.html must carry a viewport meta (with --orig: the only change).
// Prints a JSON summary; exit code 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : null; };
const DIR = path.resolve(arg("dir") || path.join(ROOT, "public/reports"));
const ORIG = arg("orig") ? path.resolve(arg("orig")) : null;

const { REPORT_RESPONSIVE_CSS: CSS } = await import(pathToFileURL(path.join(ROOT, "src/lib/reportLock.js")).href + "?t=" + Date.now());
const blockFor = (eol) => `<style id="attacked-resp">${CSS.split("\n").join(eol)}</style>${eol}`;
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';

const files = fs.readdirSync(DIR).filter((f) => /^ATK-.*\.html$/.test(f)).sort();
const bad = [];
let ok = 0, missingOrig = 0;
for (const f of files) {
  const cur = fs.readFileSync(path.join(DIR, f), "utf8");
  const eol = cur.includes("\r\n") ? "\r\n" : "\n";
  const block = blockFor(eol);
  const n = (cur.match(/<style id="attacked-resp">/g) || []).length;
  const heads = cur.split("</head>").length - 1;
  if (n !== 1) { bad.push(`${f}: ${n} attacked-resp blocks`); continue; }
  if (heads !== 1) { bad.push(`${f}: ${heads} </head>`); continue; }
  if (!cur.includes(block + "</head>")) { bad.push(`${f}: block is stale or not right before </head>`); continue; }
  if (ORIG) {
    const op = path.join(ORIG, f);
    if (!fs.existsSync(op)) { missingOrig++; bad.push(`${f}: no original in --orig`); continue; }
    const o = fs.readFileSync(op, "utf8");
    const i = o.indexOf("</head>");
    if (o.slice(0, i) + block + o.slice(i) !== cur) { bad.push(`${f}: differs from original + block`); continue; }
  }
  ok++;
}

let index = "absent";
const ip = path.join(DIR, "index.html");
if (fs.existsSync(ip)) {
  const cur = fs.readFileSync(ip, "utf8");
  index = cur.includes(VIEWPORT) ? "ok" : "no viewport meta";
  if (index === "ok" && ORIG && fs.existsSync(path.join(ORIG, "index.html"))) {
    const o = fs.readFileSync(path.join(ORIG, "index.html"), "utf8");
    if (cur.replace(VIEWPORT, "") !== o) index = "differs from original + viewport meta";
  }
  if (index !== "ok") bad.push(`index.html: ${index}`);
}

console.log(JSON.stringify({ dir: DIR, orig: ORIG, reports: files.length, ok, badCount: bad.length, bad: bad.slice(0, 20), missingOrig, index, cssChars: CSS.length }));
if (bad.length || !files.length) process.exit(1);
