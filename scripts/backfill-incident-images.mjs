#!/usr/bin/env node
// backfill-incident-images.mjs — give every incident a stored picture.
//
// Two ways to run it:
//
//   node scripts/backfill-incident-images.mjs --direct [--workers 4] [--limit 12] [--ids 2443,2455]
//     Does the whole job from this machine: prompt → generate → crop the
//     watermark strip → upload to Storage → write image_url. Needs the secret
//     key in api/.env (SUPABASE_SECRET_KEY, read once, never printed). This is
//     how the 2,290 existing incidents were backfilled on 2026-09-23.
//
//   node scripts/backfill-incident-images.mjs [--workers 4] [--limit 12]
//     Drives the deployed incident-images edge function instead (same logic,
//     runs on Supabase). Use once the function is deployed.
//
// Both modes partition ids across workers (id % workers = k) so no row is done
// twice, print progress per batch, and are safe to stop and restart: a row is
// only touched while image_url is null. --once stops after one batch per worker.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readEnv = (file) => { try { return Object.fromEntries(readFileSync(resolve(ROOT, file), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })); } catch { return {}; } };
const env = readEnv(".env");
const SB_URL = env.VITE_SUPABASE_URL;
if (!SB_URL) throw new Error("VITE_SUPABASE_URL missing from .env");

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const DIRECT = process.argv.includes("--direct");
const ONCE = process.argv.includes("--once");
const WORKERS = Math.max(1, Math.min(16, Number(arg("--workers", 4))));
const LIMIT = Math.max(1, Math.min(20, Number(arg("--limit", 12))));
const IDS = (arg("--ids", "") || "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
// --redo-before <ISO|now>: instead of rows WITHOUT a picture, redo generated
// pictures written before that moment (used on 2026-09-23 to replace the
// first batch, which the generator had stretched). Each row is overwritten
// one at a time; rows redone after the cutoff drop out of the set.
const REDO_RAW = arg("--redo-before", null);
const REDO_BEFORE = REDO_RAW === "now" ? new Date().toISOString() : REDO_RAW;
const FILTER = REDO_BEFORE
  ? `image_source=eq.generated&image_updated_at=lt.${encodeURIComponent(REDO_BEFORE)}`
  : "image_url=is.null&headline=not.is.null";

const t0 = Date.now();
let total = 0, failures = 0;
const elapsed = () => `${Math.round((Date.now() - t0) / 1000)}s`;

// ── Direct pipeline (mirrors supabase/functions/incident-images/index.ts —
//    keep the two prompt builders identical) ────────────────────────────────
const BUCKET = "incident-media", FOLDER = "incidents";
const GENERATOR = "https://image.pollinations.ai/prompt/";
// The free generator renders a SQUARE and stretches it to any other aspect
// (a circle asked for at 16:9 comes back as an ellipse), so we ask for a
// square and cut the 3:2 picture out of its middle ourselves. That crop also
// removes the watermark, which sits in the bottom strip of the square.
const GEN_WIDTH = 1024, GEN_HEIGHT = 1024, OUT_ASPECT = 3 / 2, JPEG_QUALITY = 86;
const CREDIT = "Illustration generated from the incident record";
const CATEGORY_SCENE = {
  CYB: "a darkened security operations centre, rows of monitors showing network maps and red alert dashboards, blue and amber light",
  DAT: "a data centre corridor of server racks and storage arrays, cold blue light, a technician's silhouette at the far end",
  TEC: "a control room with engineers at consoles, large wall screens showing system status, shallow depth of field",
  GEO: "an aerial view of the facility and the terrain around it, security barriers and vehicles at the perimeter",
  PHY: "the industrial site from ground level, emergency vehicles and cordon tape, smoke in the distance, overcast sky",
  OPS: "the plant floor or logistics yard mid-operation, heavy machinery, workers in high-visibility gear seen from behind",
  TPR: "a supplier's loading dock with stacked shipping containers and pallets, a clipboard of documents in the foreground",
  REG: "the stone facade of a government regulatory building, press microphones and cameras waiting at the entrance",
  FIN: "a financial district skyline at dusk with trading screens reflected in the glass of a tower lobby",
  STR: "an executive boardroom with a long table, a wall screen of strategy charts and a city view",
  REP: "a crowd of press photographers and television cameras outside a corporate headquarters entrance",
  PPL: "the entrance of an office or plant with workers gathering, banners and hard hats, early morning light",
  ENV: "the landscape around the site with a visible plume or spill and environmental response crews at a distance",
};
function firstSentence(s) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^(.{40,260}?[.!?])(\s|$)/);
  return (m ? m[1] : t.slice(0, 220)).trim();
}
export function buildPrompt(i) {
  const scene = CATEGORY_SCENE[i.primary_category] || "the site of the incident seen from outside, documentary framing";
  const place = [i.location_name, i.country].filter(Boolean).join(", ");
  const ctx = firstSentence(i.summary);
  return [
    `Editorial news photograph. ${String(i.headline || "").trim().replace(/\.$/, "")}.`,
    i.entity ? `Subject: ${i.entity}${i.industry ? ` (${i.industry})` : ""}.` : (i.industry ? `Industry: ${i.industry}.` : ""),
    place ? `Location: ${place}.` : "",
    ctx ? `Context: ${ctx}` : "",
    `Scene: ${scene}.`,
    "Photorealistic press photography, natural light, 35mm lens, cinematic composition, high detail, muted colour grade.",
    "No text, no captions, no watermark, no logos, no readable signage, no recognisable faces.",
  ].filter(Boolean).join(" ");
}
const generatorUrl = (prompt, seed) => `${GENERATOR}${encodeURIComponent(prompt)}?width=${GEN_WIDTH}&height=${GEN_HEIGHT}&model=flux&nologo=true&seed=${seed}`;

let SECRET = null, Jimp = null;
function secret() {
  if (SECRET) return SECRET;
  const a = readEnv("api/.env");
  SECRET = a.SUPABASE_SECRET_KEY || a.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
  if (!SECRET) throw new Error("--direct needs SUPABASE_SECRET_KEY in api/.env (or SUPABASE_SERVICE_ROLE_KEY in the environment)");
  return SECRET;
}
// New-style sb_secret_ keys are accepted in the apikey header (PostgREST rejects
// them as Bearer); the legacy service-role JWT wants both. Send what fits.
const isJwt = (k) => k.split(".").length === 3;
const dbHeaders = () => (isJwt(secret()) ? { apikey: secret(), Authorization: `Bearer ${secret()}` } : { apikey: secret() });
const storageHeadersList = () => (isJwt(secret()) ? [{ apikey: secret(), Authorization: `Bearer ${secret()}` }] : [{ apikey: secret(), Authorization: `Bearer ${secret()}` }, { apikey: secret() }]);

async function pgFetch(path, init = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders(), "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`PostgREST ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
async function pendingDirect(limit, mod, rem) {
  if (IDS.length) {
    const mine = IDS.filter((id) => id % mod === rem);
    if (!mine.length) return [];
    const r = await pgFetch(`incidents?select=id,headline,summary,entity,industry,primary_category,location_name,country&id=in.(${mine.join(",")})&${FILTER}`);
    return (await r.json()).slice(0, limit);
  }
  const fetchN = mod > 1 ? limit * mod * 2 : limit;
  const r = await pgFetch(`incidents?select=id,headline,summary,entity,industry,primary_category,location_name,country&${FILTER}&order=incident_day.desc.nullslast,id.desc&limit=${fetchN}`);
  const rows = await r.json();
  return (mod > 1 ? rows.filter((x) => Number(x.id) % mod === rem) : rows).slice(0, limit);
}
async function remainingDirect() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/incidents?select=id&${FILTER}`, { method: "HEAD", headers: { ...dbHeaders(), Prefer: "count=exact" } });
    const n = Number((r.headers.get("content-range") || "").split("/")[1]);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
// The generator rate-limits anonymous callers (429 on concurrent requests), so
// images are made ONE at a time with a pause between them, and a 429 waits and
// retries rather than failing the incident.
const GEN_GAP_MS = 2500, GEN_RETRIES = 4, GEN_BACKOFF_MS = 9000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let genChain = Promise.resolve();
function generate(prompt, seed) {
  const job = genChain.then(async () => {
    for (let attempt = 0; ; attempt++) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90000);
      try {
        const r = await fetch(generatorUrl(prompt, seed), { signal: ctl.signal, headers: { Accept: "image/jpeg,image/*" } });
        if (r.status === 429 || r.status >= 500) {
          if (attempt >= GEN_RETRIES) throw new Error(`generator ${r.status} after ${attempt + 1} tries`);
          await sleep(GEN_BACKOFF_MS * (attempt + 1)); continue;
        }
        if (!r.ok) throw new Error(`generator ${r.status}`);
        const ct = r.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) throw new Error(`generator returned ${ct || "no content-type"}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 5000) throw new Error(`generator returned ${buf.length} bytes`);
        await sleep(GEN_GAP_MS);
        return buf;
      } finally { clearTimeout(t); }
    }
  });
  genChain = job.catch(() => {});
  return job;
}
async function cropAndEncode(buf) {
  if (!Jimp) ({ Jimp } = await import("jimp"));
  const img = await Jimp.read(buf);
  // Centre crop to OUT_ASPECT; whatever the source shape, the bottom 8 % (the
  // watermark) must go, so never keep more than 92 % of the height.
  const W = img.width, H = img.height;
  let w = W, h = Math.round(W / OUT_ASPECT);
  if (h > H * 0.92) { h = Math.round(H * 0.92); w = Math.round(h * OUT_ASPECT); }
  const x = Math.round((W - w) / 2);
  const y = Math.min(Math.round((H - h) / 2), H - h - Math.round(H * 0.08));
  img.crop({ x, y: Math.max(0, y), w, h });
  const jpeg = await img.getBuffer("image/jpeg", { quality: JPEG_QUALITY });
  return { jpeg, width: w, height: h };
}
async function upload(id, jpeg) {
  const path = `${FOLDER}/${id}.jpg`;
  let last = "";
  for (const headers of storageHeadersList()) {
    const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { ...headers, "Content-Type": "image/jpeg", "x-upsert": "true", "Cache-Control": "public, max-age=31536000" }, body: jpeg });
    if (r.ok) return `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
    last = `storage ${r.status}: ${(await r.text()).slice(0, 160)}`;
    if (r.status !== 401 && r.status !== 403) break;
  }
  throw new Error(last);
}
async function record(id, url, prompt) {
  await pgFetch(`incidents?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ image_url: url, image_source: "generated", image_credit: CREDIT, image_prompt: prompt, image_updated_at: new Date().toISOString() }) });
}
async function illustrate(i) {
  const id = Number(i.id); const prompt = buildPrompt(i);
  const raw = await generate(prompt, id);
  const { jpeg, width, height } = await cropAndEncode(raw);
  const url = await upload(id, jpeg);
  await record(id, url, prompt);
  return { id, url, bytes: jpeg.length, width, height };
}
async function batchDirect(rem) {
  const started = Date.now();
  const rows = await pendingDirect(LIMIT, WORKERS, rem);
  const done = [], errors = [];
  for (let k = 0; k < rows.length; k += 3) {
    const chunk = rows.slice(k, k + 3);
    const res = await Promise.allSettled(chunk.map(illustrate));
    res.forEach((x, j) => { if (x.status === "fulfilled") done.push(x.value); else errors.push({ id: chunk[j].id, error: String(x.reason?.message || x.reason) }); });
  }
  return { ok: true, processed: done.length, failed: errors.length, remaining: await remainingDirect(), ms: Date.now() - started, done, errors };
}

// ── Edge-function driver ───────────────────────────────────────────────────
const FN = `${SB_URL}/functions/v1/incident-images`;
async function batchRemote(rem) {
  const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: LIMIT, mod: WORKERS, rem }) });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { throw new Error(`HTTP ${r.status} ${text.slice(0, 200)}`); }
  if (!r.ok || !j.ok) throw new Error(j.error || text.slice(0, 200));
  return j;
}

async function worker(rem) {
  let idle = 0;
  for (;;) {
    let j;
    try { j = DIRECT ? await batchDirect(rem) : await batchRemote(rem); }
    catch (e) { console.log(`  ! w${rem}: ${e.message}`); failures++; if (ONCE) return; await new Promise((r) => setTimeout(r, 15000)); continue; }
    total += j.processed; failures += j.failed;
    const first = j.done?.[0];
    console.log(`  w${rem} +${j.processed} (${j.failed} failed) in ${Math.round(j.ms / 1000)}s · remaining ${j.remaining ?? "?"} · total ${total} · ${elapsed()}${first ? ` · e.g. #${first.id} ${first.width}x${first.height}` : ""}`);
    for (const e of j.errors || []) console.log(`    ✗ #${e.id}: ${e.error}`);
    if (ONCE || IDS.length) return;
    if (j.remaining === 0) return;
    idle = j.processed === 0 ? idle + 1 : 0;
    if (idle >= 2) return;
  }
}

console.log(`incident images · ${DIRECT ? "direct from this machine" : "via " + FN}\n  ${WORKERS} workers × ${LIMIT} per batch${ONCE ? " · once" : ""}${IDS.length ? ` · ids ${IDS.join(",")}` : ""}${REDO_BEFORE ? ` · redo pictures generated before ${REDO_BEFORE}` : ""}\n`);
await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)));
console.log(`\ndone: ${total} pictures stored, ${failures} failures, ${elapsed()}`);
