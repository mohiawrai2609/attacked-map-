#!/usr/bin/env node
// build.mjs — bake REAL Attacked.ai data into the industry dashboard prototype.
//
// The team owner's v2 mock-up ran on six invented automotive incidents. This
// pulls live rows from the production DB through the public anon key (read-
// only, same key the map uses) for the top industries, plus per-incident
// counts of the subscriber-only child data (blast radius, controls, peers,
// analogues, sources) so the free view can show the SHAPE of what is locked
// without the detail — the same teaser rule GlobalAttackMap.jsx uses.
//
//   node dashboard-industry/build.mjs            → dashboard-industry/index.html
//   node dashboard-industry/build.mjs --industries 8
//   node dashboard-industry/build.mjs --include "Oil & Gas (Integrated & E&P)|Pharmaceuticals" --cards 40
//     --include  industries to bake regardless of size ("|"-separated), on top of the top N
//     --cards    incident cards per industry (default 24)
//
// template.html holds the page; the string __DASHBOARD_DATA__ inside it is
// replaced with the JSON payload, and the logo is inlined so the file stands
// alone.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const env = Object.fromEntries(readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const URL_ = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const N_IND = Number(process.argv[process.argv.indexOf("--industries") + 1]) || 6;
const CARDS = Number(process.argv[process.argv.indexOf("--cards") + 1]) || 24;
const INCLUDE = process.argv.includes("--include") ? process.argv[process.argv.indexOf("--include") + 1].split("|").map((s) => s.trim()).filter(Boolean) : [];

async function rest(path, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, ...extra } });
  if (!r.ok) throw new Error(`PostgREST ${r.status} on ${path.slice(0, 80)}: ${await r.text()}`);
  return r.json();
}
// PostgREST caps a page at 1000 rows; walk the whole table for the light
// columns we aggregate on.
async function restAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await rest(path, { Range: `${from}-${from + 999}` });
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

// ── GUARD taxonomy (mirrors daily-digest/index.ts + the brand's 13 codes) ──
const CATEGORY = {
  CYB: "Cyber Security", DAT: "Data & Privacy", TEC: "Technology", GEO: "Geopolitical",
  PHY: "Physical Security", OPS: "Operational", TPR: "Third-Party Risk", REG: "Regulatory",
  FIN: "Financial", STR: "Strategic", REP: "Reputational", PPL: "People & Human Capital",
  ENV: "Environmental",
};
const SEV = { 5: "Critical", 4: "High", 3: "Medium", 2: "Low", 1: "Minimal" };

// ── 1. corpus-wide aggregates ───────────────────────────────────────────────
console.log("fetching corpus…");
const light = await restAll(`incidents?select=id,industry,country,primary_category,severity,incident_day&incident_day=not.is.null&latitude=not.is.null&longitude=not.is.null&order=id.asc`);
const latestDay = light.map((r) => r.incident_day).sort().at(-1);
const days = [...new Set(light.map((r) => r.incident_day))].sort();
const weekDays = new Set(days.slice(-7));
const byIndustry = {};
for (const r of light) {
  if (!r.industry) continue;
  const b = (byIndustry[r.industry] ||= { total: 0, today: 0, week: 0, critical: 0, cats: {}, countries: new Set() });
  b.total++; if (r.incident_day === latestDay) b.today++; if (weekDays.has(r.incident_day)) b.week++;
  if (r.severity >= 4) b.critical++;
  b.cats[r.primary_category] = (b.cats[r.primary_category] || 0) + 1;
  if (r.country) b.countries.add(r.country);
}
const industries = Object.entries(byIndustry).sort((a, b) => b[1].total - a[1].total);
for (const n of INCLUDE) if (!byIndustry[n]) console.warn(`  --include: no incidents for "${n}"`);
const chosen = [...new Set([...INCLUDE.filter((n) => byIndustry[n]), ...industries.slice(0, N_IND).map(([name]) => name)])];
console.log(`  ${light.length} incidents · ${days.length} days · latest ${latestDay} · ${industries.length} industries`);
console.log(`  personas: ${chosen.join(" | ")}`);

// ── 2. per-industry incident cards with child counts (the teaser) ──────────
const COLS = "id,headline,summary,entity,sector,industry,country,location_name,severity,severity_rationale,confidence,primary_category,primary_subcategory_code,primary_subcategory_name,secondary_mappings,incident_day,event_date,article_body,sources(count),blast_radius(count),peer_watchlist(count),adaptive_controls(count),historical_analogues(count)";
const cnt = (x) => Array.isArray(x) && x[0] ? Number(x[0].count) : 0;
const shape = (r) => ({
  id: r.id, headline: r.headline, summary: r.summary || "", entity: r.entity, country: r.country,
  place: r.location_name, industry: r.industry, sector: r.sector, severity: r.severity, sevLabel: SEV[r.severity] || "—",
  rationale: r.severity_rationale || "", confidence: r.confidence,
  cat: r.primary_category, catName: CATEGORY[r.primary_category] || r.primary_category,
  subcat: r.primary_subcategory_name, subcode: r.primary_subcategory_code,
  secondary: Array.isArray(r.secondary_mappings) ? r.secondary_mappings.slice(0, 4).map((s) => ({ cat: s.category, name: s.subcategory_name })) : [],
  day: r.incident_day, date: r.event_date,
  body: r.article_body ? r.article_body.slice(0, 2400) : null,
  n: { sources: cnt(r.sources), blast: cnt(r.blast_radius), peers: cnt(r.peer_watchlist), controls: cnt(r.adaptive_controls), analogues: cnt(r.historical_analogues) },
});

const personas = {};
for (const name of chosen) {
  const enc = encodeURIComponent(name);
  const rows = await rest(`incidents?select=${COLS}&industry=eq.${enc}&incident_day=not.is.null&latitude=not.is.null&order=incident_day.desc,severity.desc,id.desc&limit=${CARDS}`);
  const agg = byIndustry[name];
  personas[name] = {
    name, total: agg.total, today: agg.today, week: agg.week, critical: agg.critical, countries: agg.countries.size,
    cats: Object.entries(agg.cats).sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, name: CATEGORY[code] || code, n })),
    briefings: 0,
    incidents: rows.map(shape),
  };
  // The newest cards are sweeper-era rows without long-form text; the analyst
  // essays live on older rows. Fetch the latest six essays separately so the
  // "long-form briefings" panel and the Hub always have real reads.
  const briefRows = await rest(`incidents?select=${COLS}&industry=eq.${enc}&article_body=not.is.null&latitude=not.is.null&order=incident_day.desc,severity.desc&limit=6`);
  personas[name].briefs = briefRows.map(shape);
  // exact count of long-form briefings in this industry
  const r = await fetch(`${URL_}/rest/v1/incidents?select=id&industry=eq.${enc}&article_body=not.is.null`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  personas[name].briefings = Number((r.headers.get("content-range") || "0-0/0").split("/")[1]) || 0;
  console.log(`  ${name.padEnd(36)} ${String(agg.total).padStart(4)} total · ${rows.length} cards · ${personas[name].briefings} briefings`);
}

// ── 3. latest cross-sector feed + hub edition ──────────────────────────────
// Not just the latest day: while the sweeper is paused a single day can hold
// two rows. Take the most recent high-severity incidents across every industry.
const todayRows = await rest(`incidents?select=${COLS}&latitude=not.is.null&severity=gte.3&order=incident_day.desc,severity.desc,id.desc&limit=20`);
// Hub edition: the most recent long-form briefings across ALL industries.
const hubRows = await rest(`incidents?select=${COLS}&article_body=not.is.null&latitude=not.is.null&order=incident_day.desc,severity.desc&limit=60`);

// Incidents with a baked full report (public/reports/manifest.json v2) — the
// prototype labels them; the report itself opens in the app.
let reportIds = [];
try { const m = JSON.parse(readFileSync(resolve(ROOT, "public/reports/manifest.json"), "utf8")); reportIds = Object.keys(m.byIncident || {}).map(Number); } catch { /* no manifest — no labels */ }

const data = {
  builtAt: new Date().toISOString(), reportIds,
  latestDay, days: days.length,
  totals: { incidents: light.length, countries: new Set(light.map((r) => r.country).filter(Boolean)).size, industries: industries.length, briefings: 0 },
  categories: Object.entries(CATEGORY).map(([code, name]) => ({ code, name })),
  industries: industries.map(([name, b]) => ({ name, total: b.total })),
  personas, today: todayRows.map(shape), hub: hubRows.map(shape),
};
// exact long-form total
{
  const r = await fetch(`${URL_}/rest/v1/incidents?select=id&article_body=not.is.null`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } });
  data.totals.briefings = Number((r.headers.get("content-range") || "0-0/0").split("/")[1]) || 0;
}

// ── 4. inject ──────────────────────────────────────────────────────────────
const logo = readFileSync(resolve(ROOT, "public/attacked-ai-logo.svg"), "utf8");
const logoUri = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;
const tpl = readFileSync(resolve(HERE, "template.html"), "utf8");
if (!tpl.includes("__DASHBOARD_DATA__")) throw new Error("template.html lacks __DASHBOARD_DATA__");
const json = JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
const html = tpl.replace("__DASHBOARD_DATA__", json).replaceAll("__LOGO__", logoUri);
writeFileSync(resolve(HERE, "data.json"), JSON.stringify(data, null, 1));
writeFileSync(resolve(HERE, "index.html"), html);
console.log(`\nwrote dashboard-industry/index.html (${(html.length / 1024).toFixed(0)} KB) · data.json`);
