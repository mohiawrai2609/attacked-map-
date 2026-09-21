// build-report-manifest.js — rebuild public/reports/manifest.json (v2).
//
// Each baked report embeds `const INCIDENT = {...}` with its title; the DB
// no longer holds hub_ref, so we match report title -> incidents.headline
// (rows with article_body) and write { byIncident: { "<id>": "<ref>" }, refs }.
// Run after adding reports:  node scripts/build-report-manifest.cjs
// Needs VITE_SUPABASE_URL + anon key in .env. Prints unmatched/ambiguous.

// Pull the embedded INCIDENT object's title/entity out of every baked report.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public", "reports");
const out = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".html")) continue;
  const h = fs.readFileSync(dir + "/" + f, "utf8");
  const start = h.indexOf("const INCIDENT = ");
  let I = null;
  if (start >= 0) {
    // Balanced-brace scan from the first "{" so nested objects/strings survive.
    let i = h.indexOf("{", start), depth = 0, inStr = false, esc = false, j = i;
    for (; j < h.length; j++) {
      const c = h[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) break; }
    }
    try { I = JSON.parse(h.slice(i, j + 1)); } catch (e) { I = { _err: e.message.slice(0, 60) }; }
  }
  out.push({ ref: f.replace(/\.html$/, ""), title: I?.title || "", entity: I?.entity || I?.subject || I?.org || "", asOf: I?.asOf || "", err: I?._err || (I ? "" : "no INCIDENT") });
}
const reports = out.filter((o) => o.title);
console.log(out.length, "reports;", reports.length, "with title");

const root = path.join(__dirname, "..");
const env = Object.fromEntries(fs.readFileSync(root + "/.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) { console.error("no supabase env"); process.exit(1); }
const norm = (s) => String(s || "").toLowerCase().replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();

(async () => {

  const res = await fetch(`${URL}/rest/v1/incidents?select=id,headline,industry&article_body=not.is.null&limit=2000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const rows = await res.json();
  if (!Array.isArray(rows)) { console.error(rows); process.exit(1); }
  const byTitle = new Map();
  for (const r of rows) { const k = norm(r.headline); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(r); }
  const map = {}; const unmatched = []; const ambiguous = [];
  for (const rep of reports) {
    const hits = byTitle.get(norm(rep.title)) || [];
    if (hits.length === 1) map[hits[0].id] = rep.ref;
    else if (hits.length > 1) { ambiguous.push({ ref: rep.ref, title: rep.title, ids: hits.map((h) => h.id) }); map[hits[0].id] = rep.ref; }
    else unmatched.push({ ref: rep.ref, title: rep.title });
  }
  const covered = new Set(Object.keys(map).map(Number));
  const rowsWithoutReport = rows.filter((r) => !covered.has(r.id));
  console.log(`reports ${reports.length} · essay rows ${rows.length} · matched ${Object.keys(map).length} · unmatched reports ${unmatched.length} · ambiguous ${ambiguous.length} · essay rows w/o report ${rowsWithoutReport.length}`);
  if (unmatched.length) console.log("UNMATCHED:", JSON.stringify(unmatched.slice(0, 10), null, 1));
  if (ambiguous.length) console.log("AMBIGUOUS:", JSON.stringify(ambiguous.slice(0, 10), null, 1));
  if (rowsWithoutReport.length) console.log("ROWS W/O REPORT:", JSON.stringify(rowsWithoutReport.slice(0, 10)));
  const out = { generated: new Date().toISOString().slice(0, 10), byIncident: map, refs: reports.map((r) => r.ref) };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(out, null, 1));
})();
