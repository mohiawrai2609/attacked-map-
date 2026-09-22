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
  // 1-welcome-email.html is rendered from the function code further down.
  ["3-partner-approved.html",       "welcome_approved_preview.html",      "After design-partner approval"],
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
core += "\nexport { buildForProfile, partitionForProfile, makeLayer, freeDigestHtml, partnerDigestHtml };\n";
const corePath = resolve(OUT, "_digest-core.ts");
writeFileSync(corePath, core);
const { buildForProfile, makeLayer } = await import(pathToFileURL(corePath).href);

// Target day: --day, else the richest recent day so the preview is
// representative (yesterday may hold 0 rows while the sweeper is paused).
// --industry sets the preview reader's industry (default: the one with the
// most incidents on the target day). --layer <file.json> feeds the
// subscriber-only rows ({blast_radius, adaptive_controls, peer_watchlist,
// sources} keyed by incident id) — the anon key cannot read them since the
// Phase 2 lock, so the preview takes them from a fixture.
const argOf = (flag) => (process.argv.indexOf(flag) > -1 ? process.argv[process.argv.indexOf(flag) + 1] : null);
const argDay = argOf("--day");
const argIndustry = argOf("--industry");
const argLayer = argOf("--layer");
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

// Same select the function uses (layer_counts(*) = the public counts embed).
const COLS = "id,headline,summary,entity,sector,industry,country,severity,primary_category,severity_rationale,incident_day,layer_counts(*)";
const weekIncidents = await rest(
  `incidents?select=${COLS}&incident_day=gte.${weekStart}&incident_day=lte.${targetDay}` +
  `&latitude=not.is.null&longitude=not.is.null&order=incident_day.asc,severity.desc.nullslast,id.desc&limit=800`,
);
const dayIncidents = weekIncidents.filter((i) => i.incident_day === targetDay);
console.log(`\n  digest data: day ${targetDay} → ${dayIncidents.length} incidents · week ${weekStart}..${targetDay} → ${weekIncidents.length}`);

// The preview reader's industry: --industry, else the busiest one that day.
let industry = argIndustry;
if (!industry) {
  const byInd = {};
  for (const i of dayIncidents) if (i.industry) byInd[i.industry] = (byInd[i.industry] || 0) + 1;
  industry = Object.entries(byInd).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
// A quiet-day reader: an industry with nothing on the target day but
// something earlier in the week, so the "nothing new" variant renders.
const onDay = new Set(dayIncidents.map((i) => i.industry));
const quietIndustry = [...new Set(weekIncidents.filter((i) => i.industry && (i.severity || 0) >= 3).map((i) => i.industry))].find((x) => !onDay.has(x)) || null;
const layer = argLayer ? makeLayer(JSON.parse(readFileSync(resolve(argLayer), "utf8"))) : undefined;
console.log(`  preview reader: industry "${industry}" · quiet-day reader: "${quietIndustry}" · subscriber rows: ${argLayer ? "from " + argLayer : "none (pass --layer)"}`);

const base = { unsubscribe_token: "PREVIEW", digest_frequency: "daily", watch_industries: null, watch_categories: null, min_severity: 3 };
const profiles = [
  ["2a-daily-brief-FREE.html",        { ...base, email: "reader@example.com", full_name: "Priya Nair", tier: "free", industry },
    "Free daily brief — your industry leads, locked counts line, Hub + map buttons, Premium strip"],
  ["2b-daily-brief-SUBSCRIBER.html",  { ...base, email: "subscriber@example.com", full_name: "Daniel Okafor", tier: "enterprise", industry },
    "Subscriber daily brief — same brief plus rationale, named blast radius, GUARD controls, peers, source"],
  ["2c-daily-brief-FREE-quiet.html",  { ...base, email: "reader@example.com", full_name: "Priya Nair", tier: "free", industry: quietIndustry },
    "Free daily brief on a QUIET day — nothing new in the industry, earlier this week, cross-sector"],
  ["2d-daily-brief-SUBSCRIBER-weekly.html", { ...base, email: "subscriber@example.com", full_name: "Daniel Okafor", tier: "enterprise", industry, digest_frequency: "weekly", min_severity: 4 },
    "Subscriber WEEKLY brief — the 7-day window, minimum severity S4"],
  ["2e-daily-brief-FREE-categories.html", { ...base, email: "reader@example.com", full_name: "Priya Nair", tier: "free", industry, watch_categories: ["CYB", "GEO", "PHY"] },
    "Free daily brief with GUARD categories chosen on Configure alerts — Cyber, Geopolitical, Physical only"],
];
for (const [outName, profile, label] of profiles) {
  if (!profile.industry) { console.log(`- ${outName.padEnd(32)} skipped (no industry available for this variant)`); continue; }
  const b = buildForProfile(profile, dayIncidents, weekIncidents, targetDay, weekStart, layer);
  const embedded = await embedImages(b.html);
  const stamped = embedded.replace("<body", `<!-- subject: ${b.subject} | rendered ${new Date().toISOString()} from daily-digest/index.ts (v17) against live incidents for ${targetDay} -->\n<body`);
  writeFileSync(resolve(OUT, outName), stamped);
  console.log(`✓ ${outName.padEnd(32)} ${(stamped.length / 1024).toFixed(0).padStart(5)} KB  ${label}`);
  console.log(`    subject: ${b.subject}   [in industry ${b.matched} · hidden ${b.hidden} · earlier this week ${b.weekMatched} · elsewhere ${b.elsewhere}]`);
}
// ── 3. welcome email, from the REAL function code, for the same reader ──────
const wSrc = readFileSync(resolve(ROOT, "supabase/functions/welcome-email/index.ts"), "utf8");
const wCut = wSrc.indexOf("Deno.serve(");
if (wCut < 0) throw new Error("Deno.serve( not found — welcome-email layout changed");
let wCore = wSrc.slice(0, wCut)
  .replace(/^import \{ SMTPClient \}[^\n]*\n/m, "const SMTPClient = class {};\n")
  .replace(/Deno\.env\.get\(/g, "((k) => process.env[k])(");
wCore += "\nexport { welcomeHtml, welcomeSubject };\n";
const wCorePath = resolve(OUT, "_welcome-core.ts");
writeFileSync(wCorePath, wCore);
const { welcomeHtml, welcomeSubject } = await import(pathToFileURL(wCorePath).href);
{
  const cols = "id,headline,summary,entity,country,industry,severity,primary_category,incident_day,layer_counts(*)";
  let first = await rest(`incidents?select=${cols}&industry=eq.${encodeURIComponent(industry)}&incident_day=gte.${weekStart}&incident_day=lte.${targetDay}&latitude=not.is.null&order=severity.desc.nullslast,incident_day.desc,id.desc&limit=3`);
  if (!first.length) first = await rest(`incidents?select=${cols}&incident_day=eq.${targetDay}&latitude=not.is.null&order=severity.desc.nullslast,id.desc&limit=3`);
  const profile = { email: "reader@example.com", full_name: "Priya Nair", tier: "free", industry, watch_categories: null, digest_frequency: "daily", min_severity: 3, unsubscribe_token: "PREVIEW" };
  const html = await embedImages(welcomeHtml(profile, first, "https://attackedmap.vercel.app/?unsubscribe=PREVIEW"));
  const subject = welcomeSubject(profile);
  const stamped = html.replace("<body", `<!-- subject: ${subject} | rendered ${new Date().toISOString()} from welcome-email/index.ts (v2) against live incidents for ${industry} -->\n<body`);
  writeFileSync(resolve(OUT, "1-welcome-email.html"), stamped);
  console.log(`✓ ${"1-welcome-email.html".padEnd(32)} ${(stamped.length / 1024).toFixed(0).padStart(5)} KB  After sign-up: welcome personalised to the sign-up industry + first ${industry} brief`);
  console.log(`    subject: ${subject}   [${first.length} incidents shown]`);
}

console.log(`\nAll files in ${OUT}`);
