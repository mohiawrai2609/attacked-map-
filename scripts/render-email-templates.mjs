#!/usr/bin/env node
// render-email-templates.mjs — produce SELF-CONTAINED HTML files for every
// customer-facing email, with all images embedded as data URIs, so they can be
// opened, shared or attached anywhere without the repo or the live site.
//
// Two sources:
//   1. supabase_email_templates/*_preview.html  — rendered snapshots of the
//      transactional mails (welcome, partner approved, application received /
//      rejected, admin alert). Verified identical in structure to the live
//      edge-function code (none has changed since the 2026-06-30 initial
//      commit). We only rewrite their `../public/*` image paths to data URIs.
//   2. supabase/functions/daily-digest/index.ts — the free and partner daily
//      briefings are built by pure template functions. We load that file's
//      rendering section under Node (type-stripping is native in Node ≥ 23.6),
//      feed it REAL incidents from the live DB via the anon key, and render
//      both tiers. Nothing is deployed and nothing is sent.
//
// Usage:  node scripts/render-email-templates.mjs [--day YYYY-MM-DD]
// Output: supabase_email_templates/rendered/*.html

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(ROOT, "public");
const TPL = resolve(ROOT, "supabase_email_templates");
const OUT = resolve(TPL, "rendered");
mkdirSync(OUT, { recursive: true });

// ── .env ────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;
if (!SB_URL || !SB_KEY) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env");

// ── image embedding ─────────────────────────────────────────────────────────
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".webp": "image/webp" };
const dataUriCache = new Map();
function localDataUri(relPath) {
  const p = resolve(PUBLIC, relPath);
  if (dataUriCache.has(p)) return dataUriCache.get(p);
  if (!existsSync(p)) { console.warn(`  ! missing image ${relPath}`); return null; }
  const uri = `data:${MIME[extname(p).toLowerCase()] || "application/octet-stream"};base64,${readFileSync(p).toString("base64")}`;
  dataUriCache.set(p, uri);
  return uri;
}
async function remoteDataUri(url) {
  if (dataUriCache.has(url)) return dataUriCache.get(url);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const uri = `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    dataUriCache.set(url, uri);
    return uri;
  } catch (e) { console.warn(`  ! could not fetch ${url}: ${e.message}`); return null; }
}

// Rewrite every <img src> to a data URI. Local `../public/x` and absolute
// `https://attackedmap.vercel.app/x` both map to public/x; anything else is
// fetched. The regex is built here in JS, never via a shell.
async function embedImages(html) {
  const srcRe = /(<img\b[^>]*\bsrc=")([^"]+)(")/gi;
  const jobs = [];
  html.replace(srcRe, (_m, _a, src) => { jobs.push(src); return _m; });
  const map = new Map();
  for (const src of new Set(jobs)) {
    let uri = null;
    const local = src.match(/^\.\.\/public\/(.+)$/) || src.match(/^https?:\/\/attackedmap\.vercel\.app\/(.+)$/);
    if (local) uri = localDataUri(local[1]);
    else if (/^https?:\/\//.test(src)) uri = await remoteDataUri(src);
    if (uri) map.set(src, uri);
  }
  return html.replace(srcRe, (m, a, src, c) => map.has(src) ? `${a}${map.get(src)}${c}` : m);
}

// ── 1. transactional previews ───────────────────────────────────────────────
const PREVIEWS = [
  ["1-welcome-email.html",            "welcome_email_preview.html",         "After sign-up: welcome + first daily brief (free tier)"],
  ["3-partner-approved.html",         "welcome_approved_preview.html",      "After design-partner approval"],
  ["4-application-received.html",     "application_received_preview.html",  "Applicant: we received your partner application"],
  ["5-application-rejected.html",     "application_rejected_preview.html",  "Applicant: application not approved"],
  ["6-admin-new-application.html",    "admin_alert_preview.html",           "Admin: a new partner application arrived"],
  ["7-signin-code.html",              "otp_code.html",                      "Auth: the 6-digit sign-in / signup code"],
];
for (const [outName, srcName, label] of PREVIEWS) {
  const html = readFileSync(resolve(TPL, srcName), "utf8");
  const embedded = await embedImages(html);
  writeFileSync(resolve(OUT, outName), embedded);
  console.log(`✓ ${outName.padEnd(32)} ${(embedded.length / 1024).toFixed(0).padStart(5)} KB  ${label}`);
}

// ── 2. daily digest, both tiers, from the REAL function code ────────────────
const fnSrc = readFileSync(resolve(ROOT, "supabase/functions/daily-digest/index.ts"), "utf8");
const cut = fnSrc.indexOf("Deno.serve(");
if (cut < 0) throw new Error("Deno.serve( not found — daily-digest layout changed");
let core = fnSrc.slice(0, cut)
  .replace(/^import \{ SMTPClient \}[^\n]*\n/m, "const SMTPClient = class {};\n")
  .replace(/Deno\.env\.get\(/g, "((k) => process.env[k])(");
core += "\nexport { buildForProfile, freeDigestHtml, partnerDigestHtml };\n";
const corePath = resolve(OUT, "_digest-core.ts");
writeFileSync(corePath, core);
const { buildForProfile } = await import(pathToFileURL(corePath).href);

// Target day: --day, else the richest recent day so the preview is
// representative (yesterday may hold 0 rows while the sweeper is paused).
const argDay = process.argv.indexOf("--day") > -1 ? process.argv[process.argv.indexOf("--day") + 1] : null;
const hdr = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
async function rest(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: hdr });
  if (!r.ok) throw new Error(`PostgREST ${r.status}: ${await r.text()}`);
  return r.json();
}
let targetDay = argDay;
if (!targetDay) {
  const recent = await rest(`incidents?select=incident_day&incident_day=not.is.null&order=incident_day.desc&limit=400`);
  const counts = {};
  for (const r of recent) counts[r.incident_day] = (counts[r.incident_day] || 0) + 1;
  targetDay = Object.entries(counts).sort((a, b) => b[1] - a[1] || (b[0] > a[0] ? 1 : -1))[0][0];
}
const d = new Date(`${targetDay}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 6);
const weekStart = d.toISOString().slice(0, 10);

// Same select the (fixed) function uses.
const COLS = "id,headline,summary,entity,sector,industry,country,severity,primary_category,severity_rationale,incident_day";
const weekIncidents = await rest(
  `incidents?select=${COLS}&incident_day=gte.${weekStart}&incident_day=lte.${targetDay}` +
  `&latitude=not.is.null&longitude=not.is.null&order=incident_day.asc,severity.desc.nullslast,id.desc&limit=800`,
);
const dayIncidents = weekIncidents.filter((i) => i.incident_day === targetDay);
console.log(`\n  digest data: day ${targetDay} → ${dayIncidents.length} incidents · week ${weekStart}..${targetDay} → ${weekIncidents.length}`);

const profiles = [
  ["2a-daily-brief-FREE.html",     { email: "reader@example.com",  tier: "free",    unsubscribe_token: "PREVIEW", digest_frequency: "daily", watch_industries: null, watch_categories: null },
    "Free tier daily brief — headline-only cards, partner-only lockout, upsell block"],
  ["2b-daily-brief-PARTNER.html",  { email: "partner@example.com", tier: "partner", unsubscribe_token: "PREVIEW", digest_frequency: "daily", watch_industries: null, watch_categories: null },
    "Design-partner daily brief — full summaries, gold rationale callout, open-on-map"],
];
for (const [outName, profile, label] of profiles) {
  const b = buildForProfile(profile, dayIncidents, weekIncidents, targetDay, weekStart);
  const embedded = await embedImages(b.html);
  const stamped = embedded.replace("<body", `<!-- subject: ${b.subject} | rendered ${new Date().toISOString()} from daily-digest/index.ts against live incidents for ${targetDay} -->\n<body`);
  writeFileSync(resolve(OUT, outName), stamped);
  console.log(`✓ ${outName.padEnd(32)} ${(stamped.length / 1024).toFixed(0).padStart(5)} KB  ${label}`);
  console.log(`    subject: ${b.subject}`);
}
console.log(`\nAll files in ${OUT}`);
