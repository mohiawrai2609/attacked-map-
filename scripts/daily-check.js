#!/usr/bin/env node
// daily-check.js — one command that walks the whole daily chain and tells you
// where it stands: DB updated? → email sent? → map will show it?
//
// It follows the SAME path the production pieces use, so what it prints is what
// actually happened, not a guess:
//   1. DB     — latest sweep + incidents per day (what the pipeline loaded)
//   2. EMAIL  — report_recipients + delivery_log (who the cron already mailed)
//   3. MAP    — replays GlobalAttackMap.jsx's exact PostgREST query as anon
//
// USAGE
//   node scripts/daily-check.js            # read-only status report
//   node scripts/daily-check.js --send     # ALSO fire incident-deliver now
//   node scripts/daily-check.js --send --force   # re-send even if already sent
//
// KEYS
//   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are read from .env (already there).
//   report_recipients / delivery_log are RLS-protected — anon gets []. To see
//   those two sections, set a service key first:
//     PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
//     Git Bash:    export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
//   Without it the script still runs; it just says "needs service key".

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEND  = process.argv.includes("--send");
const FORCE = process.argv.includes("--force");

// ── env ─────────────────────────────────────────────────────────────────────
function readEnvFile() {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env — fall back to process env */ }
  return out;
}
const env = readEnvFile();
const URL_ = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!URL_ || !ANON) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env or environment).");
  process.exit(1);
}

// ── tiny PostgREST helper ───────────────────────────────────────────────────
// `key` decides which rows come back: anon sees only what RLS allows, the
// service key sees everything. That difference is the point of this script.
async function q(path, key = ANON) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

const line  = (c = "─") => console.log(c.repeat(72));
const head  = (n, t) => { console.log(""); line("═"); console.log(`  ${n}. ${t}`); line("═"); };
const pad   = (s, n) => String(s ?? "").padEnd(n);
const todayISO = () => new Date().toISOString().slice(0, 10);

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log(`\nGUARD daily chain · ${URL_.replace("https://", "")} · ${new Date().toISOString()}`);

  // ── 1. DB ────────────────────────────────────────────────────────────────
  // The pipeline's upload creates a sweeps row and a batch of incidents rows.
  // Nothing downstream can happen before this exists.
  head(1, "DATABASE — did today's sweep land?");

  const sweeps = await q("sweeps?select=id,generated_at,uploaded_at&order=id.desc&limit=5");
  const latest = sweeps[0];
  if (!latest) { console.log("  No sweeps at all. Pipeline has never uploaded."); return; }

  console.log(`  Latest sweep : #${latest.id}`);
  console.log(`  Generated at : ${latest.generated_at ?? "—"}`);
  console.log(`  Uploaded at  : ${latest.uploaded_at ?? "—"}`);
  console.log("\n  Recent sweeps: " + sweeps.map(s => `#${s.id}`).join("  "));

  // Incidents are stamped with incident_day. The map buckets by this column and
  // the digest filters on it, so "how many rows per day" IS the daily coverage.
  const since = new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10);
  const recent = await q(`incidents?select=incident_day&incident_day=gte.${since}&limit=10000`);
  const perDay = new Map();
  for (const r of recent) if (r.incident_day) perDay.set(r.incident_day, (perDay.get(r.incident_day) || 0) + 1);

  console.log("\n  Incidents per day (last 9 days):");
  const days = [...perDay.keys()].sort().reverse();
  if (days.length === 0) console.log("    (none)");
  for (const d of days) console.log(`    ${d}   ${String(perDay.get(d)).padStart(4)} incidents${d === todayISO() ? "   ← today" : ""}`);
  if (!perDay.has(todayISO())) console.log(`    ${todayISO()}      0 incidents   ← today, NOT LOADED YET`);

  // ── 2. EMAIL ─────────────────────────────────────────────────────────────
  // The live sender is the `incident-deliver` edge function, poked by pg_cron
  // every 30 minutes. It asks fn_sweep_report for the latest sweep, checks
  // delivery_log to see who already got THAT sweep, and mails only the gaps.
  // So the mail is not "daily at a fixed time" — it fires on the first 30-min
  // tick after a new sweep is uploaded, and never twice for the same sweep.
  head(2, "EMAIL — who got the brief for this sweep?");

  if (!SVC) {
    console.log("  report_recipients / delivery_log are RLS-protected — anon reads return [].");
    console.log("  Set SUPABASE_SERVICE_ROLE_KEY to see this section.");
  } else {
    const rcpts = await q("report_recipients?select=id,label,role,channel,address,active&order=id", SVC);
    console.log("  Recipients:");
    console.log(`    ${pad("ADDRESS", 32)}${pad("CHANNEL", 10)}${pad("ROLE", 8)}ACTIVE`);
    for (const r of rcpts) {
      console.log(`    ${pad(r.address, 32)}${pad(r.channel, 10)}${pad(r.role, 8)}${r.active ? "yes" : "NO"}`);
    }

    const log = await q(`delivery_log?select=recipient,channel,status,created_at&sweep_id=eq.${latest.id}&order=created_at`, SVC);
    console.log(`\n  delivery_log for sweep #${latest.id}:`);
    if (log.length === 0) {
      console.log("    (nothing sent yet — the next 30-min cron tick will send it)");
    } else {
      for (const l of log) console.log(`    ${pad(l.recipient, 32)}${pad(l.status, 10)}${l.created_at}`);
    }

    // A recipient that is active but missing from the log for this sweep is the
    // exact failure worth catching: they were skipped or the send errored.
    const got = new Set(log.filter(l => l.status === "sent").map(l => l.recipient));
    const missing = rcpts.filter(r => r.active && !got.has(r.address)).map(r => r.address);
    console.log(missing.length
      ? `\n  ⚠ Active but NOT sent for #${latest.id}: ${missing.join(", ")}`
      : `\n  ✓ All active recipients received sweep #${latest.id}.`);
  }

  // ── 3. MAP ───────────────────────────────────────────────────────────────
  // This is character-for-character the query loadFromSupabase() runs in
  // GlobalAttackMap.jsx, with the anon key the browser ships. If it 400s or
  // returns 0 rows, every visitor silently falls back to the sweep files baked
  // into public/sweeps/ (which stop at 2026-05-28) — the map looks "stuck".
  head(3, "MAP — what will a visitor's browser actually load?");

  const cols = [
    "id", "headline", "summary", "entity", "sector", "industry",
    "location_name", "country",
    "latitude", "longitude", "event_date", "disclosure_date", "incident_day",
    "primary_category", "primary_subcategory_code", "primary_subcategory_name",
    "severity", "severity_rationale", "confidence",
  ].join(",");
  const mapQuery = `incidents?select=${cols}&incident_day=not.is.null&latitude=not.is.null&longitude=not.is.null&order=incident_day.desc&limit=1000`;

  try {
    const rows = await q(mapQuery, ANON);
    const newest = rows[0]?.incident_day ?? "—";
    console.log(`  Query OK  · ${rows.length} rows in the first page`);
    console.log(`  Newest incident_day the map can see: ${newest}`);
    console.log(newest === todayISO()
      ? "  ✓ Today's incidents are live on the map (hard-refresh to see them)."
      : `  ⚠ Map's newest day is ${newest}, not ${todayISO()} — either today isn't loaded, or a column is stale.`);
  } catch (e) {
    // A 400 here means one column name in the select no longer exists. PostgREST
    // rejects the WHOLE select on a single unknown column — that is precisely how
    // the map has silently dropped to baked sweeps before.
    console.log(`  ✗ Map query FAILED: ${e.message}`);
    console.log("    → A column in the select list no longer exists. PostgREST rejects the");
    console.log("      entire query on one bad name, so the map falls back to public/sweeps/.");
    console.log("      Fix the column list in src/GlobalAttackMap.jsx (loadFromSupabase).");
  }

  // ── 4. optional manual send ──────────────────────────────────────────────
  if (SEND) {
    head(4, "SENDING — calling incident-deliver now");
    const res = await fetch(`${URL_}/functions/v1/incident-deliver`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sweep_id: latest.id, force: FORCE }),
    });
    console.log(`  HTTP ${res.status}`);
    console.log("  " + (await res.text()).replace(/\n/g, "\n  "));
  } else {
    console.log("\n  (add --send to mail this sweep now instead of waiting for the cron)");
  }

  console.log("");
})().catch(e => { console.error("\nFAILED:", e.message); process.exit(1); });
