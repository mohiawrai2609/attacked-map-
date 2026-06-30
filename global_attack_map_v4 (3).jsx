import React, { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

// ============================================================================
// ATTACKED.AI GLOBAL ATTACK MAP v4
// ----------------------------------------------------------------------------
// Single-file React component. Upload a GUARD daily-sweep JSON file → renders
// incidents on a world map. Two RENDERING SURFACES, one data model:
//
//   FLAT view  → d3.geoNaturalEarth1 + SVG  (zoom-pan, country/city labels)
//   GLOBE view → d3.geoOrthographic + SVG   (interactive drag-rotate, zoom)
//
// Both views use the same SVG pipeline — no Cesium, no WebGL, no Web Workers.
// Brand-coherent, single-file, no external runtime dependencies beyond d3 and
// the world-atlas TopoJSON (loaded from CDN, same as flat view). Works in any
// modern browser including sandboxed iframes (e.g. the Claude artifact preview).
//
// The toggle is in the top-right. All filters, sidebar, KPI overlay, detail
// panel, audit drawer, and search work IDENTICALLY across both views. Only
// the projection swaps — state stays in the parent. Lat/lng plotting is exact
// in both modes; no clustering on either side; spiderfy applies the same way
// to exact-coordinate collisions.
//
// GLOBE view specifics:
//   - d3.geoOrthographic projection with clipAngle(90) for back-of-globe culling
//   - Drag to rotate (longitude + latitude); scroll-wheel to zoom in/out
//   - Country outlines, ocean fill, and graticule grid in obsidian brand colours
//   - Pin click rotates globe to centre the incident
//   - Blast-radius arcs become great-circle geodesic paths
//
// v3 features preserved:
//   - d3-zoom pan/zoom on flat view (1× to 20×, hold-to-zoom buttons)
//   - Exact lat/lng plotting, spiderfy for coordinate collisions
//   - Counter-scaling at all zoom levels
//   - Country + city labels with zoom-fade
//   - Search across headline/entity/country/summary/sector/cat/vendors
//
// v2 features preserved:
//   - KPI overlay, sidebar incident list, audit drawer, severity/confidence
//     filter pills, distinct blast-radius glyphs, run-window timestamp.
//
// Data contract:
//   sweep.results[CAT].incidents[] — each incident has:
//     headline, summary, event_date, severity (1-5), confidence, country,
//     latitude, longitude, entity, sector, sources[], vendors[],
//     peer_watchlist[], historical_analogues[], blast_radius{ internal[],
//     supply_chain[], competitive_peer[], regulatory[], customer_counterparty[],
//     financial_market[] }, _enriched, _verified (optional v14.21+),
//     _verification_* (optional)
//   sweep.newsroom — reporter map keyed by reporter id
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// BRAND TOKENS (Attacked.ai — gold #F5B800, NEVER Replaceable.ai crimson)
// ─────────────────────────────────────────────────────────────────────────────
const BRAND = {
  gold: "#F5B800",
  goldDim: "#D4A000",
  goldTint: "rgba(245,184,0,0.12)",
  obsidian: "#1A1A1A",
  obsidianDeep: "#080808",
  obsidianCard: "#242424",
  obsidianElevated: "#2E2E2E",
  white: "#FFFFFF",
  textSecondary: "#A8A8A8",
  textMuted: "#585858",
  borderSubtle: "#333333",
  borderGold: "rgba(245,184,0,0.3)",
};

// 5-tier risk scale (Attacked.ai standard, NOT the 3-tier RPI scale)
const SEVERITY = {
  5: { label: "CRITICAL", color: "#FF3B30", glow: "rgba(255,59,48,0.4)" },
  4: { label: "HIGH",     color: "#FF6B35", glow: "rgba(255,107,53,0.35)" },
  3: { label: "MEDIUM",   color: "#F5B800", glow: "rgba(245,184,0,0.35)" },
  2: { label: "LOW",      color: "#34C759", glow: "rgba(52,199,89,0.30)" },
  1: { label: "MINIMAL",  color: "#8E8E93", glow: "rgba(142,142,147,0.25)" },
};

// 13 GUARD categories — short labels + colours
const CATEGORIES = {
  CYB: { label: "Cyber",        color: "#F5B800" },
  DAT: { label: "Data",         color: "#FFD166" },
  TEC: { label: "Technology",   color: "#FFE99A" },
  GEO: { label: "Geopolitical", color: "#FF8C5A" },
  PHY: { label: "Physical",     color: "#FF6B35" },
  OPS: { label: "Operations",   color: "#34C759" },
  TPR: { label: "Third Party",  color: "#7BD693" },
  REG: { label: "Regulatory",   color: "#D4A000" },
  FIN: { label: "Financial",    color: "#B89A00" },
  STR: { label: "Strategic",    color: "#9D7BEC" },
  REP: { label: "Reputation",   color: "#BFA2F0" },
  PPL: { label: "People",       color: "#4FC3D7" },
  ENV: { label: "Environment",  color: "#7DDAEA" },
};

// Reporter desks (matches v14.21 newsroom assignment)
const DEFAULT_REPORTERS = {
  cyber_bob:        { name: "Cyber Bob",        desk: "Digital Defence",        cats: ["CYB","DAT","TEC"], color: "#F5B800" },
  commander_vance:  { name: "Commander Vance",  desk: "Geopolitical & Physical",cats: ["GEO","PHY"],       color: "#FF8C5A" },
  saskia_martin:    { name: "Saskia Martin",    desk: "Operations & Supply",    cats: ["OPS","TPR"],       color: "#34C759" },
  jack_whistler:    { name: "Jack Whistler",    desk: "Regulatory & Financial", cats: ["REG","FIN"],       color: "#D4A000" },
  lulu_kim:         { name: "Lulu Kim",         desk: "Strategic & Reputation", cats: ["STR","REP"],       color: "#9D7BEC" },
  priya_banerjee:   { name: "Priya Banerjee",   desk: "People & Environment",   cats: ["PPL","ENV"],       color: "#4FC3D7" },
};

// ─────────────────────────────────────────────────────────────────────────────
// WORLD CITIES — curated set of major cities for labelling at higher zoom.
// Compact list (~140 entries) covering G20 capitals + top metros worldwide.
// Used to anchor city labels at zoom ≥ 3.5×. Each: [name, lat, lng].
// Population-weighted: we want capitals + finance/tech hubs to show up first.
// ─────────────────────────────────────────────────────────────────────────────
const WORLD_CITIES = [
  // North America
  ["New York", 40.7128, -74.0060], ["Los Angeles", 34.0522, -118.2437],
  ["Chicago", 41.8781, -87.6298], ["Washington", 38.9072, -77.0369],
  ["San Francisco", 37.7749, -122.4194], ["Boston", 42.3601, -71.0589],
  ["Seattle", 47.6062, -122.3321], ["Miami", 25.7617, -80.1918],
  ["Houston", 29.7604, -95.3698], ["Atlanta", 33.7490, -84.3880],
  ["Dallas", 32.7767, -96.7970], ["Detroit", 42.3314, -83.0458],
  ["Toronto", 43.6532, -79.3832], ["Vancouver", 49.2827, -123.1207],
  ["Montreal", 45.5017, -73.5673], ["Mexico City", 19.4326, -99.1332],
  ["Salt Lake City", 40.7608, -111.8910], ["San Jose", 37.3382, -121.8863],
  // South America
  ["São Paulo", -23.5505, -46.6333], ["Rio de Janeiro", -22.9068, -43.1729],
  ["Buenos Aires", -34.6037, -58.3816], ["Lima", -12.0464, -77.0428],
  ["Bogotá", 4.7110, -74.0721], ["Santiago", -33.4489, -70.6693],
  ["Caracas", 10.4806, -66.9036], ["Brasília", -15.8267, -47.9218],
  // Europe
  ["London", 51.5074, -0.1278], ["Paris", 48.8566, 2.3522],
  ["Berlin", 52.5200, 13.4050], ["Madrid", 40.4168, -3.7038],
  ["Rome", 41.9028, 12.4964], ["Amsterdam", 52.3676, 4.9041],
  ["Brussels", 50.8503, 4.3517], ["Vienna", 48.2082, 16.3738],
  ["Stockholm", 59.3293, 18.0686], ["Oslo", 59.9139, 10.7522],
  ["Copenhagen", 55.6761, 12.5683], ["Helsinki", 60.1699, 24.9384],
  ["Dublin", 53.3498, -6.2603], ["Lisbon", 38.7223, -9.1393],
  ["Warsaw", 52.2297, 21.0122], ["Prague", 50.0755, 14.4378],
  ["Athens", 37.9838, 23.7275], ["Zurich", 47.3769, 8.5417],
  ["Frankfurt", 50.1109, 8.6821], ["Milan", 45.4642, 9.1900],
  ["Barcelona", 41.3851, 2.1734], ["Moscow", 55.7558, 37.6173],
  ["Saint Petersburg", 59.9311, 30.3609], ["Kyiv", 50.4501, 30.5234],
  ["Istanbul", 41.0082, 28.9784], ["Ankara", 39.9334, 32.8597],
  ["Budapest", 47.4979, 19.0402], ["Bucharest", 44.4268, 26.1025],
  // Middle East
  ["Dubai", 25.2048, 55.2708], ["Riyadh", 24.7136, 46.6753],
  ["Tehran", 35.6892, 51.3890], ["Tel Aviv", 32.0853, 34.7818],
  ["Jerusalem", 31.7683, 35.2137], ["Doha", 25.2854, 51.5310],
  ["Abu Dhabi", 24.4539, 54.3773], ["Kuwait City", 29.3759, 47.9774],
  ["Baghdad", 33.3152, 44.3661], ["Beirut", 33.8938, 35.5018],
  ["Amman", 31.9454, 35.9284], ["Cairo", 30.0444, 31.2357],
  // Africa
  ["Lagos", 6.5244, 3.3792], ["Nairobi", -1.2921, 36.8219],
  ["Johannesburg", -26.2041, 28.0473], ["Cape Town", -33.9249, 18.4241],
  ["Addis Ababa", 9.0320, 38.7423], ["Accra", 5.6037, -0.1870],
  ["Casablanca", 33.5731, -7.5898], ["Dakar", 14.7167, -17.4677],
  ["Algiers", 36.7538, 3.0588], ["Tunis", 36.8065, 10.1815],
  ["Khartoum", 15.5007, 32.5599], ["Kinshasa", -4.4419, 15.2663],
  ["Luanda", -8.8390, 13.2894], ["Dar es Salaam", -6.7924, 39.2083],
  // Asia
  ["Tokyo", 35.6762, 139.6503], ["Osaka", 34.6937, 135.5023],
  ["Seoul", 37.5665, 126.9780], ["Beijing", 39.9042, 116.4074],
  ["Shanghai", 31.2304, 121.4737], ["Hong Kong", 22.3193, 114.1694],
  ["Shenzhen", 22.5431, 114.0579], ["Guangzhou", 23.1291, 113.2644],
  ["Taipei", 25.0330, 121.5654], ["Manila", 14.5995, 120.9842],
  ["Jakarta", -6.2088, 106.8456], ["Singapore", 1.3521, 103.8198],
  ["Kuala Lumpur", 3.1390, 101.6869], ["Bangkok", 13.7563, 100.5018],
  ["Hanoi", 21.0285, 105.8542], ["Ho Chi Minh City", 10.8231, 106.6297],
  ["Mumbai", 19.0760, 72.8777], ["Delhi", 28.7041, 77.1025],
  ["Bangalore", 12.9716, 77.5946], ["Kolkata", 22.5726, 88.3639],
  ["Chennai", 13.0827, 80.2707], ["Hyderabad", 17.3850, 78.4867],
  ["Pune", 18.5204, 73.8567], ["Karachi", 24.8607, 67.0011],
  ["Lahore", 31.5204, 74.3587], ["Islamabad", 33.6844, 73.0479],
  ["Dhaka", 23.8103, 90.4125], ["Colombo", 6.9271, 79.8612],
  ["Kabul", 34.5553, 69.2075], ["Tashkent", 41.2995, 69.2401],
  ["Almaty", 43.2220, 76.8512], ["Ulaanbaatar", 47.8864, 106.9057],
  // Oceania
  ["Sydney", -33.8688, 151.2093], ["Melbourne", -37.8136, 144.9631],
  ["Brisbane", -27.4698, 153.0251], ["Perth", -31.9505, 115.8605],
  ["Auckland", -36.8485, 174.7633], ["Wellington", -41.2865, 174.7762],
];

// Blast-radius channel styling (subtle, doesn't compete with category colour)
// `kind: primary` = directly named/affected entity (filled marker, solid arc)
// `kind: indirect` = read-across / sectoral inference (dashed-ring marker, dashed arc)
const BLAST_CHANNELS = {
  internal:              { label: "Internal",      color: "#F5B800", dash: "0",      width: 1.2, opacity: 0.55, kind: "primary",  icon: "◉" },
  supply_chain:          { label: "Supply Chain",  color: "#FF8C5A", dash: "0",      width: 1.0, opacity: 0.50, kind: "primary",  icon: "⟿" },
  customer_counterparty: { label: "Customer",      color: "#4FC3D7", dash: "0",      width: 0.9, opacity: 0.45, kind: "primary",  icon: "◊" },
  competitive_peer:      { label: "Peer",          color: "#9D7BEC", dash: "4,3",    width: 0.9, opacity: 0.45, kind: "indirect", icon: "≈" },
  regulatory:            { label: "Regulator",     color: "#A8A8A8", dash: "2,3",    width: 0.9, opacity: 0.45, kind: "indirect", icon: "§" },
  financial_market:      { label: "Capital",       color: "#7BD693", dash: "6,3",    width: 0.9, opacity: 0.40, kind: "indirect", icon: "$" },
};

// Blast-radius rich-field lookup tables. The new schema (May 2026+) attaches
// per-entity impact_score, transmission_mechanism, impact_horizon, recommended
// action text, and a product hook with CTA. These tables convert the snake_case
// machine codes into human-readable labels for the detail panel card.
const IMPACT_HORIZONS = {
  immediate: { label: "Immediate", hint: "0–72h" },
  short:     { label: "Short",     hint: "1–4 wks" },
  medium:    { label: "Medium",    hint: "1–6 mo" },
  long:      { label: "Long",      hint: "6+ mo" },
};

// Each mechanism includes a plain-English description that explains how
// the risk actually transmits from the source incident to the affected
// entity. Without this, the user sees a code chip like "SHARED VENDOR"
// and has no idea what it means in practice. The description appears
// directly under the mechanism chip in the cascade card.
const TRANSMISSION_MECHANISMS = {
  shared_technology:        { label: "Shared technology",        desc: "Same underlying tech stack — if one is compromised, others are exposed via the same vector." },
  shared_geography:         { label: "Shared geography",         desc: "Located in the same region — same regulatory, political, or physical disruption window." },
  shared_vendor:            { label: "Shared vendor",            desc: "Common third-party supplier — a single vendor failure affects all dependent parties." },
  shared_workforce_market:  { label: "Shared workforce market",  desc: "Compete for the same talent pool — wage shocks or attrition spread across all participants." },
  supply_chain_link:        { label: "Supply chain link",        desc: "Direct supply-chain dependency — upstream disruption cascades into operational impact." },
  customer_overlap:         { label: "Customer overlap",         desc: "Serve substantially the same customers — demand-side shocks transmit across the cluster." },
  capability_substitution:  { label: "Capability substitution",  desc: "Competing capability — failure here drives customers to the alternative provider." },
  sentiment_contagion:      { label: "Sentiment contagion",      desc: "Investor or market sentiment spillover — perception of risk in one drags the cluster." },
  regulatory_spillover:     { label: "Regulatory spillover",     desc: "Regulatory response triggered here applies to peers — enforcement extends across category." },
};

// Product hooks — each blast entity may carry a CTA referencing an Attacked.ai
// product. The icon + label render as a small chip; clicking it would (in
// production) deep-link into the relevant product flow.
const PRODUCT_HOOKS = {
  wargaming_sim:         { label: "Wargaming.ai",        icon: "⚡", color: "#F5B800" },
  apple_supply:          { label: "Supply Wargame",      icon: "◈", color: "#FF8C5A" },
  greyteaming:           { label: "Grey Teaming",        icon: "◇", color: "#9D7BEC" },
  fdri_watchlist:        { label: "FDRI Watchlist",      icon: "▲", color: "#A8A8A8" },
  attacked_brief:        { label: "Attacked Brief",      icon: "✦", color: "#4FC3D7" },
  replaceable_workforce: { label: "Replaceable.ai",      icon: "⊕", color: "#7BD693" },
};

// Reporter desks — icon + brand colour per reporter. Surfaces as a chip in the
// detail panel header so the user knows which editorial desk owns the incident.
const REPORTER_BADGES = {
  "Cyber Bob":          { desk: "Digital Defence",          color: "#F5B800", icon: "⌬" },
  "Commander Vance":    { desk: "Geopolitical & Physical",  color: "#FF8C5A", icon: "▼" },
  "Saskia Martin":      { desk: "Operations & Supply Chain",color: "#34C759", icon: "◐" },
  "Jack Whistler":      { desk: "Regulatory & Financial",   color: "#D4A000", icon: "§" },
  "Lulu Kim":           { desk: "Strategic & Reputation",   color: "#9D7BEC", icon: "✦" },
  "Priya Banerjee":     { desk: "People & Environment",     color: "#4FC3D7", icon: "❋" },
};

// ─────────────────────────────────────────────────────────────────────────────
// SWEEP ARCHIVE — persistent day-wise storage of uploaded sweep JSONs.
// ----------------------------------------------------------------------------
// In the Claude artifact runtime, persists via window.storage (cross-session,
// per-user). When this file is deployed to attackmap.ai with a real backend,
// replace the four functions below with fetch() calls to your API. Schema and
// key shape stay the same so the UI doesn't need to change.
//
// Storage keys:
//   sweep:YYYY-MM-DD      → full sweep JSON for that calendar date
//   sweep_index           → JSON array of { date, generatedAt, incidentCount,
//                            fileName, sevCounts } sorted by date descending
//
// The index is the read-fast list the date picker renders from. Without it
// rendering the picker would require fetching every sweep. Index stays in
// sync via writeSweep() and deleteSweep() helpers below.
// ─────────────────────────────────────────────────────────────────────────────

// Storage substrate state — populated by verifyStorage() at app boot.
// Until verifyStorage() resolves, we don't know which substrate is live.
const _storageState = {
  substrate: "unknown",  // "persistent" | "session" | "unknown"
  canaryError: null,     // last error captured during boot verification
  verifiedAt: null,      // timestamp of the last successful canary round-trip
};

// In-memory fallback — only used if window.storage is unavailable OR the
// canary round-trip fails. State persists for the page session only.
const _memoryStore = new Map();
const _memoryFallback = {
  async get(key) {
    if (!_memoryStore.has(key)) throw new Error("Key not found");
    return { key, value: _memoryStore.get(key), shared: false };
  },
  async set(key, value) {
    _memoryStore.set(key, value);
    return { key, value, shared: false };
  },
  async delete(key) {
    const had = _memoryStore.has(key);
    _memoryStore.delete(key);
    return { key, deleted: had, shared: false };
  },
  async list(prefix) {
    const keys = [];
    for (const k of _memoryStore.keys()) {
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return { keys, prefix, shared: false };
  },
};

// _store() returns the active substrate. If verifyStorage() has flagged
// window.storage as unusable, we route to the memory fallback so callers
// don't need to branch on substrate state.
function _store() {
  if (_storageState.substrate === "persistent"
      && typeof window !== "undefined"
      && window.storage
      && typeof window.storage.get === "function") {
    return window.storage;
  }
  return _memoryFallback;
}

// True if persistent storage is live and verified. Used for the UI banner.
function isPersistent() {
  return _storageState.substrate === "persistent";
}

// Run a real write-read-delete round-trip on a canary key. This is the only
// reliable test of whether window.storage is actually functional in this
// runtime — the existence check `typeof window.storage.get === "function"`
// can pass while writes silently fail (sandbox quirks, missing permissions,
// disabled-by-policy, etc.). Called once at app boot.
async function verifyStorage() {
  const CANARY_KEY = "__attackmap_canary__";
  const canaryValue = JSON.stringify({ t: Date.now() });
  if (typeof window === "undefined"
      || !window.storage
      || typeof window.storage.get !== "function") {
    _storageState.substrate = "session";
    _storageState.canaryError = "window.storage API unavailable";
    return false;
  }
  try {
    await window.storage.set(CANARY_KEY, canaryValue);
    const res = await window.storage.get(CANARY_KEY);
    const got = res && res.value;
    if (got !== canaryValue) {
      throw new Error(`canary mismatch (wrote ${canaryValue.length}b, read ${got ? String(got).length : 0}b)`);
    }
    // Cleanup — don't litter the user's storage with canary records
    try { await window.storage.delete(CANARY_KEY); } catch { /* non-fatal */ }
    _storageState.substrate = "persistent";
    _storageState.canaryError = null;
    _storageState.verifiedAt = Date.now();
    return true;
  } catch (e) {
    _storageState.substrate = "session";
    _storageState.canaryError = e?.message || String(e);
    return false;
  }
}

// ── Serialised write queue. Without this, concurrent uploads (or rapid
//    user actions) can race on the index: write A reads idx=[], pushes A,
//    writes [A]; write B reads idx=[] (before A's write lands), pushes B,
//    writes [B] — losing A. The queue forces writes to complete in order.
let _writeChain = Promise.resolve();
function _queueWrite(fn) {
  const next = _writeChain.then(fn, fn);
  // Swallow chain errors so one failure doesn't poison subsequent writes
  _writeChain = next.then(() => undefined, () => undefined);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// SWEEP ARCHIVE — high-level helpers used by the UI. All public functions
// route through the substrate selected by verifyStorage(), and all writes
// serialise through _queueWrite() to prevent races.
// ─────────────────────────────────────────────────────────────────────────────

// Derive a YYYY-MM-DD key from a sweep object. Tries the sweep's own
// generated_at timestamp first; falls back to today if absent.
function dateKeyFromSweep(sweep) {
  const raw = sweep && (sweep.generated_at || sweep.generatedAt);
  if (typeof raw === "string" && raw.length >= 10) {
    return raw.slice(0, 10);
  }
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function indexEntryFor(sweep, dateKey, fileName) {
  const sevCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let count = 0;
  const results = (sweep && sweep.results) || {};
  for (const cat of Object.values(results)) {
    const incs = (cat && cat.incidents) || [];
    for (const inc of incs) {
      count++;
      const s = inc.severity;
      if (s >= 1 && s <= 5) sevCounts[s]++;
    }
  }
  return {
    date: dateKey,
    generatedAt: (sweep && sweep.generated_at) || new Date().toISOString(),
    incidentCount: count,
    fileName: fileName || null,
    sevCounts,
  };
}

// Low-level: read the stored index (does NOT discover orphans).
async function _readStoredIndex() {
  try {
    const res = await _store().get("sweep_index");
    if (!res || !res.value) return [];
    const parsed = typeof res.value === "string" ? JSON.parse(res.value) : res.value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Low-level: write the index back, sorted desc by date.
async function _writeStoredIndex(entries) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  try {
    await _store().set("sweep_index", JSON.stringify(sorted));
    return sorted;
  } catch (e) {
    console.error("Sweep index write failed:", e);
    throw e;
  }
}

// Public: read the index, with a self-healing pass that discovers any
// `sweep:YYYY-MM-DD` keys not represented in the index and rebuilds their
// metadata from the stored sweep. This recovers from:
//   - a corrupted/missing sweep_index
//   - a race where a sweep was written but the index update failed
//   - manual storage inspection
async function readIndex() {
  const stored = await _readStoredIndex();
  let allKeys = [];
  try {
    const res = await _store().list("sweep:");
    allKeys = Array.isArray(res?.keys) ? res.keys : [];
  } catch (e) {
    // list() failed — just return the stored index as-is
    return stored;
  }
  const indexDates = new Set(stored.map(e => e.date));
  const orphanKeys = allKeys.filter(k => k.startsWith("sweep:") && !indexDates.has(k.slice(6)));
  if (orphanKeys.length === 0) return stored;

  // Reconstruct entries for orphan sweeps
  const recovered = [...stored];
  for (const key of orphanKeys) {
    const dateKey = key.slice(6);
    try {
      const r = await _store().get(key);
      if (!r || !r.value) continue;
      const sweepJson = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
      const meta = indexEntryFor(sweepJson, dateKey, sweepJson?._recoveredFileName || null);
      recovered.push(meta);
    } catch (e) {
      console.warn(`Could not recover orphan sweep ${key}:`, e);
    }
  }
  // Persist the healed index so next read is fast
  try {
    return await _writeStoredIndex(recovered);
  } catch {
    return recovered.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}

// Public: persist a sweep. Serialised via the write queue to avoid index
// races when multiple uploads land in quick succession.
async function writeSweep(sweep, fileName) {
  const dateKey = dateKeyFromSweep(sweep);
  const meta = indexEntryFor(sweep, dateKey, fileName);
  return _queueWrite(async () => {
    // Write the sweep blob first
    try {
      await _store().set(`sweep:${dateKey}`, JSON.stringify(sweep));
    } catch (e) {
      throw new Error(`Could not save sweep for ${dateKey}: ${e?.message || e}`);
    }
    // Read-modify-write the index (now safe because we're queued)
    const idx = await _readStoredIndex();
    const filtered = idx.filter(x => x.date !== dateKey);
    filtered.push(meta);
    const updated = await _writeStoredIndex(filtered);
    return { dateKey, index: updated, meta };
  });
}

async function readSweep(dateKey) {
  try {
    const res = await _store().get(`sweep:${dateKey}`);
    if (!res || !res.value) return null;
    return typeof res.value === "string" ? JSON.parse(res.value) : res.value;
  } catch (e) {
    console.warn(`Sweep read failed for ${dateKey}:`, e);
    return null;
  }
}

async function deleteSweep(dateKey) {
  return _queueWrite(async () => {
    try {
      await _store().delete(`sweep:${dateKey}`);
    } catch (e) {
      console.warn(`Sweep delete failed for ${dateKey}:`, e);
    }
    const idx = await _readStoredIndex();
    return _writeStoredIndex(idx.filter(x => x.date !== dateKey));
  });
}

// Diagnostics — used by the Archive panel's status banner. Reads the
// substrate state plus a live count of stored sweep keys.
async function storageDiagnostics() {
  let liveKeys = [];
  try {
    const res = await _store().list("sweep:");
    liveKeys = Array.isArray(res?.keys) ? res.keys : [];
  } catch (e) {
    // ignore
  }
  return {
    substrate: _storageState.substrate,
    canaryError: _storageState.canaryError,
    verifiedAt: _storageState.verifiedAt,
    storedSweepCount: liveKeys.length,
    storedSweepKeys: liveKeys,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FONT LOADER
// ─────────────────────────────────────────────────────────────────────────────
function FontLoader() {
  useEffect(() => {
    if (document.getElementById("attacked-fonts")) return;
    const link = document.createElement("link");
    link.id = "attacked-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD MAP DATA — fetched once from CDN, simplified countries GeoJSON
// ─────────────────────────────────────────────────────────────────────────────
const WORLD_GEOJSON_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const TOPOJSON_CLIENT_URL = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";

function useWorldGeo() {
  const [world, setWorld] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Load topojson-client as a script tag if not already loaded
        if (!window.topojson) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = TOPOJSON_CLIENT_URL;
            s.onload = res;
            s.onerror = () => rej(new Error("topojson-client failed to load"));
            document.head.appendChild(s);
          });
        }
        const res = await fetch(WORLD_GEOJSON_URL);
        if (!res.ok) throw new Error(`World atlas fetch ${res.status}`);
        const topo = await res.json();
        const countries = window.topojson.feature(topo, topo.objects.countries);
        if (!cancelled) setWorld(countries);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  return { world, err };
}

// ─────────────────────────────────────────────────────────────────────────────
// SWEEP JSON PARSER — flattens results{} into a list of enriched incidents
// ─────────────────────────────────────────────────────────────────────────────
function parseSweep(sweep) {
  if (!sweep || typeof sweep !== "object") return { incidents: [], meta: {} };
  const incidents = [];
  const results = sweep.results || {};
  for (const [catCode, payload] of Object.entries(results)) {
    const incs = payload?.incidents || [];
    incs.forEach((inc, idx) => {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;
      // _id must be unique across ALL incidents fed to the map, not just
      // within one category. For a single-day sweep `${catCode}-${idx}` is
      // sufficient. For a MERGED multi-day sweep (Week/Month/All views),
      // incidents from different source dates can collide on catCode+idx,
      // which would break pin selection and the cascade. mergeSweeps()
      // stamps each merged incident with `_sourceDate`; when present we
      // prefix the id with it so it is globally unique. Single-day sweeps
      // have no _sourceDate and keep the original id shape (no regression).
      const id = inc._sourceDate
        ? `${inc._sourceDate}-${catCode}-${idx}`
        : `${catCode}-${idx}`;
      incidents.push({
        ...inc,
        _cat: catCode,
        _idx: idx,
        _id: id,
      });
    });
  }
  const meta = {
    generated_at: sweep.generated_at,
    lookback_hours: sweep.lookback_hours,
    model: sweep.model,
    schema_version: sweep.schema_version,
    total_incidents: incidents.length,
    newsroom: sweep.newsroom || DEFAULT_REPORTERS,
  };
  return { incidents, meta };
}

// ─────────────────────────────────────────────────────────────────────────────
// SWEEP MERGE LAYER — for the Day / Week / Month / All time-window views.
// ----------------------------------------------------------------------------
// Takes an array of { date, sweep } objects (each `sweep` being a full
// GUARD sweep JSON read from the existing archive) and merges them into ONE
// synthetic sweep object with the same shape parseSweep already understands:
//   { results: { CAT: { incidents:[] } }, newsroom, generated_at, ... }
// so the merged result feeds the existing setSweep → parseSweep path and the
// map / filters / cascade are untouched.
//
// Behaviour (confirmed design decisions):
//   • DEDUPE across days — one incident per unique identity. Identity key is
//     entity + headline + country, case-normalised. Same incident recurring
//     across days collapses to a single pin.
//   • Severity for a deduped pin = HIGHEST severity seen across the window.
//   • Each merged incident is stamped with:
//       _occurrences  — how many days it appeared in
//       _firstSeen    — earliest source date it appeared
//       _lastSeen     — latest source date it appeared
//       _sourceDate   — date of the kept representative (drives _id keying in
//                       parseSweep so merged ids are globally unique)
//   • The kept representative is the FIRST-SEEN occurrence's object, severity
//     bumped to the window max, stamps applied — so narrative fields are the
//     original sighting.
function mergeIdentity(inc) {
  const norm = v => (v == null ? "" : String(v)).trim().toLowerCase();
  return [norm(inc.entity), norm(inc.headline), norm(inc.country)].join("\u0001");
}

function mergeSweeps(inputs) {
  const valid = (Array.isArray(inputs) ? inputs : [])
    .filter(x => x && x.sweep && typeof x.sweep === "object")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const dedupeMap = new Map();
  let newsroom = null;

  for (const { date, sweep } of valid) {
    if (!newsroom && sweep.newsroom) newsroom = sweep.newsroom;
    const results = sweep.results || {};
    for (const [catCode, payload] of Object.entries(results)) {
      const incs = (payload && payload.incidents) || [];
      for (const inc of incs) {
        const key = mergeIdentity(inc);
        const sev = (typeof inc.severity === "number") ? inc.severity : 0;
        const existing = dedupeMap.get(key);
        if (!existing) {
          dedupeMap.set(key, {
            rep: inc, cat: catCode,
            firstSeen: date, lastSeen: date,
            occurrences: 1, maxSev: sev,
          });
        } else {
          existing.occurrences += 1;
          if (date < existing.firstSeen) { existing.firstSeen = date; existing.rep = inc; existing.cat = catCode; }
          if (date > existing.lastSeen) existing.lastSeen = date;
          if (sev > existing.maxSev) existing.maxSev = sev;
        }
      }
    }
  }

  const mergedResults = {};
  for (const entry of dedupeMap.values()) {
    const cat = entry.cat || "UNK";
    if (!mergedResults[cat]) mergedResults[cat] = { incidents: [] };
    mergedResults[cat].incidents.push({
      ...entry.rep,
      severity: entry.maxSev > 0 ? entry.maxSev : entry.rep.severity,
      _occurrences: entry.occurrences,
      _firstSeen: entry.firstSeen,
      _lastSeen: entry.lastSeen,
      _sourceDate: entry.firstSeen,
    });
  }

  return {
    results: mergedResults,
    newsroom: newsroom || undefined,
    generated_at: valid.length ? valid[valid.length - 1].date : undefined,
    _merged: true,
    _windowDays: valid.length,
    _windowFrom: valid.length ? valid[0].date : null,
    _windowTo: valid.length ? valid[valid.length - 1].date : null,
  };
}

// Given the archive index (array of { date, ... } sorted desc) and an anchor
// date (the day currently centred on), return the subset of dates within the
// requested window. Windows are inclusive of the anchor and look BACKWARD:
//   "day"   → just the anchor; "week" → anchor + 6 prior (7-day span)
//   "month" → anchor + ~29 prior (30-day span); "all" → every archived date
// Only dates actually present in the index are returned.
function datesInWindow(archiveIndex, anchorDate, windowKind) {
  const allDates = (Array.isArray(archiveIndex) ? archiveIndex : [])
    .map(e => e && e.date).filter(Boolean);
  if (allDates.length === 0) return [];
  if (windowKind === "all") return [...allDates];

  const anchor = anchorDate || allDates[0]; // index is desc, [0] is newest
  if (windowKind === "day") {
    return allDates.includes(anchor) ? [anchor] : [];
  }

  const span = windowKind === "week" ? 7 : 30;
  const anchorMs = Date.parse(anchor + "T00:00:00Z");
  if (Number.isNaN(anchorMs)) {
    return allDates.includes(anchor) ? [anchor] : [];
  }
  const lowerMs = anchorMs - (span - 1) * 86400000;
  return allDates.filter(d => {
    const ms = Date.parse(d + "T00:00:00Z");
    return !Number.isNaN(ms) && ms <= anchorMs && ms >= lowerMs;
  });
}

// Pick reporter for a given category (matches scraper logic)
function reporterForCat(catCode, reporters) {
  for (const [id, r] of Object.entries(reporters || {})) {
    if (r.cats?.includes(catCode)) return { id, ...r };
  }
  return null;
}

// Search match: case-insensitive substring across headline, entity, country,
// summary, sector, cat code + label, and vendor names. Empty query = match all.
function searchMatches(inc, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const cat = CATEGORIES[inc._cat];
  const vendorBlob = (inc.vendors || [])
    .map(v => typeof v === "string" ? v : (v?.name || ""))
    .join(" ");
  const haystack = [
    inc.headline,
    inc.entity,
    inc.country,
    inc.location_name,
    inc.summary,
    inc.sector,
    inc._cat,
    cat?.label,
    vendorBlob,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOAD ZONE
// ─────────────────────────────────────────────────────────────────────────────
function UploadZone({ onLoad, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target.result);
        onLoad(json, file.name);
      } catch (err) {
        onError(`Invalid JSON: ${err.message}`);
      }
    };
    reader.onerror = () => onError(`Failed to read ${file.name}`);
    reader.readAsText(file);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      onClick={() => fileInputRef.current?.click()}
      style={{
        width: "min(640px, 90vw)",
        margin: "0 auto",
        padding: "64px 48px",
        background: dragOver ? BRAND.goldTint : BRAND.obsidianCard,
        border: `2px dashed ${dragOver ? BRAND.gold : BRAND.borderSubtle}`,
        borderRadius: 12,
        textAlign: "center",
        cursor: "pointer",
        transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
      }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 32, color: BRAND.white, marginBottom: 12 }}>
        Drop a sweep JSON
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: BRAND.textSecondary, marginBottom: 24 }}>
        or click to browse · accepts GUARD daily sweep exports
      </div>
      <div style={{ display: "inline-block", padding: "8px 20px", background: BRAND.gold, color: BRAND.obsidian, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", borderRadius: 4 }}>
        SELECT FILE
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP CANVAS — d3.geoNaturalEarth1 projection, country fills, pins, arcs
// ─────────────────────────────────────────────────────────────────────────────
function MapCanvas({ world, visibleIncidents, viewMode, hoveredId, selectedId, onHover, onSelect, showBlastRadius, showHeat, showLabels }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 1200, height: 720 });

  // Resize observer — height fills the available vertical space, with a
  // floor of 480px so the map is never claustrophobic on small windows.
  // Falls back to viewport-derived height so on a tall window the map uses
  // the room available rather than clamping to a fixed aspect ratio.
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width;
        // Use the parent's actual height when it has one (the parent flex
        // cell stretches with the viewport). If the parent is shorter than
        // ideal aspect, fall back to a calculated height.
        const parentH = e.contentRect.height;
        // Prefer the parent height when available; only fall back to a
        // computed height (via window.innerHeight) when ResizeObserver
        // returns zero, which happens on first paint before layout.
        const fallbackH = (typeof window !== "undefined")
          ? Math.max(480, window.innerHeight - 280)
          : 600;
        const h = parentH > 100 ? parentH : fallbackH;
        setDims({ width: w, height: Math.max(480, h) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const projection = useMemo(() => {
    // Pick the scale that fits the world inside the canvas regardless of
    // whether the canvas is wide or tall. Natural Earth projection has a
    // ~2:1 width-to-height ratio, so scale is bounded by min(w/6.3, h/3.15).
    const scale = Math.min(dims.width / 6.3, dims.height / 3.15);
    return d3.geoNaturalEarth1()
      .scale(scale)
      .translate([dims.width / 2, dims.height / 2 + 10]);
  }, [dims]);

  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);

  // Project a [lng, lat] → [x, y] safely
  function project(lng, lat) {
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    const p = projection([lng, lat]);
    if (!p || isNaN(p[0]) || isNaN(p[1])) return null;
    return p;
  }

  // ───────────────────────────────────────────────────────────────────────
  // PAN / ZOOM (v3 — intelligence-grade, d3-zoom driven)
  // Every incident is plotted at its exact lat/lng. No clustering. As the
  // user zooms in, dense city stacks naturally separate. When two pins share
  // EXACTLY the same coordinates (e.g. AWS Washington DC × 2), spiderfy:
  // fan them on a small ring so each is individually clickable at any zoom.
  // ───────────────────────────────────────────────────────────────────────
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 20;
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });
  const k = zoomTransform.k; // shorthand — used heavily for counter-scaling
  // Hovered blast-radius destination entity (separate from hovered incident pin)
  const [hoveredEntity, setHoveredEntity] = useState(null);

  // Belt-and-braces: blast arcs only render when a pin is hovered or
  // selected. If both are null, the destination dots are unmounted and any
  // lingering hoveredEntity is stale — clear it. Fixes the "tooltip pinned
  // on load" bug where mouse movement through the artifact-panel edge
  // unmounts the dot before its onMouseLeave can fire.
  useEffect(() => {
    if (!hoveredId && !selectedId) setHoveredEntity(null);
  }, [hoveredId, selectedId]);

  // Attach d3-zoom once. We listen for zoom events and mirror the transform
  // into React state so the SVG can be re-rendered with the right transform
  // attribute. The actual DOM transform is applied by React, not by d3 — this
  // keeps d3 as the gesture handler and React as the renderer.
  useEffect(() => {
    if (!svgRef.current) return;
    const sel = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      // Tuned wheel sensitivity — d3's default is calibrated for legacy
      // mice and feels sluggish on trackpads/modern wheels. ×3 gives a much
      // snappier "one notch = noticeable zoom" feel without becoming jumpy.
      .wheelDelta(event => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * 3)
      .filter(event => {
        // Allow wheel, drag, double-click; ignore right-click drag
        if (event.type === "mousedown" && event.button !== 0) return false;
        return !event.ctrlKey;
      })
      .on("zoom", event => {
        setZoomTransform({ k: event.transform.k, x: event.transform.x, y: event.transform.y });
      });
    zoomBehaviorRef.current = zoom;
    sel.call(zoom);
    // Double-click zooms in by a clean 2× (default d3 behaviour kept)
    return () => { sel.on(".zoom", null); };
  }, []);

  // Keep the zoom's translateExtent synced with current canvas size, so the
  // user can't pan the map off into empty space. The extent is generous (one
  // full canvas of slack in each direction) so panning still feels free.
  useEffect(() => {
    if (!zoomBehaviorRef.current) return;
    zoomBehaviorRef.current.translateExtent([
      [-dims.width * 0.5, -dims.height * 0.5],
      [dims.width * 1.5, dims.height * 1.5],
    ]);
  }, [dims]);

  // Reset zoom when the visible set changes substantially (e.g. new file).
  // Filter changes shouldn't reset zoom — the user might have zoomed into a
  // region and then applied a filter to narrow what they see there.
  // We use the SVG dimensions as the trigger: if they change, world re-layout.
  // (Manual zoom controls reset zoom explicitly via resetZoom.)
  function programmaticZoom(scale, cx, cy) {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const sel = d3.select(svgRef.current);
    const t = d3.zoomIdentity.translate(cx - cx * scale, cy - cy * scale).scale(scale);
    sel.transition().duration(280).call(zoomBehaviorRef.current.transform, t);
  }
  function zoomBy(factor) {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const sel = d3.select(svgRef.current);
    sel.transition().duration(220).call(zoomBehaviorRef.current.scaleBy, factor);
  }
  function resetZoom() {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const sel = d3.select(svgRef.current);
    sel.transition().duration(280).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }

  // Hold-to-zoom: while the user holds the +/- button, fire zoomBy on an
  // interval so the map continues to zoom smoothly until they release.
  // Works for mouse, touch, and stylus via pointer events.
  const holdTimerRef = useRef(null);
  function startHoldZoom(factor) {
    // Fire one immediate step so the first press always does something
    zoomBy(factor);
    // Clear any existing timer (defensive — pointerup may have been missed)
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    // Smaller factor per tick (the button's full factor is ~1.8×; here we
    // step ~1.18× every 150ms which feels like continuous zoom)
    const tickFactor = factor > 1 ? 1.18 : 1 / 1.18;
    holdTimerRef.current = setInterval(() => {
      zoomBy(tickFactor);
    }, 150);
  }
  function stopHoldZoom() {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }
  // Guarantee cleanup if the component unmounts mid-hold
  useEffect(() => () => stopHoldZoom(), []);

  // Shift+click anywhere on the map → zoom OUT centered on that point.
  // Mirrors d3-zoom's built-in double-click-to-zoom-in. The transform math:
  // we want the clicked point in world space to stay at the same screen
  // position after the zoom-out by factor 0.6.
  function zoomOutAtPoint(e) {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    if (!e.shiftKey) return;
    // Only respond to clicks on empty SVG/rect surfaces — pin clicks call
    // stopPropagation() so they never reach us
    const tag = e.target.tagName;
    if (tag !== "svg" && tag !== "rect" && tag !== "path") return;
    const sel = d3.select(svgRef.current);
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = 0.6;
    // d3.zoomTransform gives current transform; .scaleBy + point keeps the
    // clicked point fixed under the cursor (same as d3-zoom's dblclick logic)
    sel.transition().duration(280).call(zoomBehaviorRef.current.scaleBy, factor, [px, py]);
  }

  // Keyboard shortcuts: + / - / 0 when the SVG (or its container) has focus
  useEffect(() => {
    function onKey(e) {
      // Only handle if nothing else is focused (avoid clobbering inputs)
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "+" || e.key === "=") { zoomBy(1.4); e.preventDefault(); }
      else if (e.key === "-" || e.key === "_") { zoomBy(1 / 1.4); e.preventDefault(); }
      else if (e.key === "0") { resetZoom(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // SPIDERFY (exact-coordinate collision avoidance)
  // When multiple incidents share the same lat/lng to 4 decimal places
  // (~11m precision), they would render on top of each other forever, even
  // at maximum zoom. Spiderfy them: each gets a small offset on a ring
  // around the original position, so all pins are reachable. Ring radius
  // counter-scales with zoom — bigger when zoomed out, smaller when zoomed
  // in (so spiderfied pins eventually look like a tight cluster of dots).
  // ───────────────────────────────────────────────────────────────────────
  const spiderfyMap = useMemo(() => {
    // Group by lat/lng key. Returns: Map<incidentId, {dx, dy}> in projected
    // coords at zoom=1. Apply / k at render time to counter-scale.
    const groups = new Map();
    for (const inc of visibleIncidents) {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") continue;
      const key = `${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(inc);
    }
    const map = new Map();
    for (const members of groups.values()) {
      if (members.length === 1) continue; // no spiderfy needed
      const n = members.length;
      // Ring radius in projected pixels at zoom=1. Will be divided by k at
      // render time, so at zoom=10 it's a 1.4px ring (tight) — at zoom=1
      // it's a 14px ring (clearly fanned).
      const ringR = 14 + Math.min(8, n);
      members.forEach((inc, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        map.set(inc._id, {
          dx: ringR * Math.cos(angle),
          dy: ringR * Math.sin(angle),
        });
      });
    }
    return map;
  }, [visibleIncidents]);

  // Compute the on-screen position of an incident, including spiderfy offset
  // (the offset is in projected-pixel space at zoom=1, divided by k so it
  // shrinks proportionally as we zoom in)
  function incidentPos(inc) {
    const p = project(inc.longitude, inc.latitude);
    if (!p) return null;
    const offset = spiderfyMap.get(inc._id);
    if (!offset) return { x: p[0], y: p[1], hasOffset: false };
    return {
      x: p[0] + offset.dx / k,
      y: p[1] + offset.dy / k,
      hasOffset: true,
      anchorX: p[0],
      anchorY: p[1],
    };
  }

  // (Filter logic moved to parent — MapCanvas receives pre-filtered visibleIncidents)

  // Build blast-radius arc data for selected incident (or all if hovering nothing)
  const blastArcs = useMemo(() => {
    if (!showBlastRadius) return [];
    const arcs = [];
    const targets = selectedId
      ? visibleIncidents.filter(i => i._id === selectedId)
      : (hoveredId ? visibleIncidents.filter(i => i._id === hoveredId) : []);
    for (const inc of targets) {
      const origin = project(inc.longitude, inc.latitude);
      if (!origin) continue;
      const radius = inc.blast_radius || {};
      for (const [channel, entities] of Object.entries(radius)) {
        if (!Array.isArray(entities)) continue;
        const channelDef = BLAST_CHANNELS[channel];
        if (!channelDef) continue;
        entities.forEach((ent, i) => {
          if (typeof ent.latitude !== "number" || typeof ent.longitude !== "number") return;
          const dest = project(ent.longitude, ent.latitude);
          if (!dest) return;
          arcs.push({
            id: `${inc._id}-${channel}-${i}`,
            x1: origin[0], y1: origin[1],
            x2: dest[0], y2: dest[1],
            channel,
            channelDef,
            label: ent.name || ent.entity || "",
            entity: ent,
          });
        });
      }
    }
    return arcs;
  }, [visibleIncidents, hoveredId, selectedId, showBlastRadius, projection]);

  // Compute graticule once
  const graticule = useMemo(() => {
    const g = d3.geoGraticule().step([20, 20]);
    return pathGen(g());
  }, [pathGen]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", minHeight: 480, background: "#080808", borderRadius: 8, overflow: "hidden", border: `1px solid ${BRAND.borderSubtle}` }}>
      {/* Ambience — very subtle warm wash, not a visible halo. Earlier 7%
          made the map look haloed; demo has a flat black background. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,184,0,0.025) 0%, transparent 70%)",
        zIndex: 0,
      }} />
      <svg
        ref={svgRef}
        width={dims.width}
        height={dims.height}
        style={{ display: "block", cursor: "grab", touchAction: "none", position: "relative", zIndex: 1 }}
        onMouseDown={e => { if (e.currentTarget) e.currentTarget.style.cursor = "grabbing"; }}
        onMouseUp={e => { if (e.currentTarget) e.currentTarget.style.cursor = "grab"; }}
        onMouseLeave={e => {
          // Clear all hover state when cursor leaves the SVG entirely.
          // Without this, fast cursor movement out of the iframe (e.g. into
          // the chat panel) can leave onMouseLeave handlers on inner dots
          // ungated, leaving blast-radius tooltips stuck visible. Belt-and-
          // braces: wipe both pin hover and entity hover here.
          if (e.currentTarget) e.currentTarget.style.cursor = "grab";
          setHoveredEntity(null);
          onHover(null);
        }}
        onClick={zoomOutAtPoint}
      >
        <defs>
          {/* Severity-tier radial-glow gradients */}
          {Object.entries(SEVERITY).map(([level, s]) => (
            <radialGradient key={level} id={`heat-${level}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="60%" stopColor={s.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </radialGradient>
          ))}
          {/* Soft pin glow */}
          <filter id="pin-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          {/* Clip path so geographic content doesn't bleed outside the viewport */}
          <clipPath id="map-viewport">
            <rect x={0} y={0} width={dims.width} height={dims.height} />
          </clipPath>
        </defs>

        {/* Ocean — flat dark, matches demo. Sits OUTSIDE the zoom layer so
            it always fills the viewport even at high pan. */}
        <rect x={0} y={0} width={dims.width} height={dims.height} fill="#080808" />

        {/* All geographic content goes inside the zoom transform group */}
        <g
          clipPath="url(#map-viewport)"
          transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${k})`}>

          {/* Graticule — neutral grey, very subtle. Matches the demo's
              barely-visible reference lines. */}
          <path d={graticule} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={0.3 / k} strokeOpacity={1} />

          {/* Countries — uniform medium-dark fill, soft border. Reads as
              clean silhouettes against the ocean, like the reference demo. */}
          {world && world.features.map((feat, i) => (
            <path
              key={i}
              d={pathGen(feat)}
              fill="#242424"
              stroke="#333333"
              strokeWidth={0.4 / k}
            />
          ))}

          {/* Country labels — gated on the showLabels toggle. When off, only
              the country of the selected or hovered incident gets a soft label
              so the user is never lost. When on, all countries label with the
              previous zoom-fade behaviour. */}
          {world && (() => {
            // When labels are globally off, only label the focused-incident country
            if (!showLabels) {
              const focusInc = visibleIncidents.find(i => i._id === (selectedId || hoveredId));
              if (!focusInc || !focusInc.country) return null;
              const focusFeat = world.features.find(f => f.properties?.name === focusInc.country);
              if (!focusFeat) return null;
              const centroid = d3.geoCentroid(focusFeat);
              if (!centroid) return null;
              const p = projection(centroid);
              if (!p || isNaN(p[0])) return null;
              const fontSize = 11 / k;
              return (
                <text
                  key="focus-country"
                  x={p[0]}
                  y={p[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={BRAND.gold}
                  fillOpacity={0.9}
                  stroke={BRAND.obsidianDeep}
                  strokeWidth={3 / k}
                  strokeOpacity={0.7}
                  paintOrder="stroke"
                  fontFamily="Inter, sans-serif"
                  fontSize={fontSize}
                  fontWeight={600}
                  letterSpacing={`${0.08 / k}em`}
                  style={{ pointerEvents: "none", textTransform: "uppercase" }}>
                  {focusInc.country}
                </text>
              );
            }
            // Full labels mode (toggle on) — previous zoom-fade behaviour
            const opacity = k >= 7 ? 0 : k >= 4 ? (7 - k) / 3 : 1;
            if (opacity <= 0.02) return null;
            const fontSize = (k >= 1.5 ? 9 : 9) / k;
            return world.features.map((feat, i) => {
              const name = feat.properties?.name;
              if (!name) return null;
              const centroid = d3.geoCentroid(feat);
              if (!centroid) return null;
              const p = projection(centroid);
              if (!p || isNaN(p[0])) return null;
              return (
                <text
                  key={`country-${i}`}
                  x={p[0]}
                  y={p[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={BRAND.textSecondary}
                  fillOpacity={opacity * 0.7}
                  stroke={BRAND.obsidianDeep}
                  strokeWidth={2.5 / k}
                  strokeOpacity={opacity * 0.5}
                  paintOrder="stroke"
                  fontFamily="Inter, sans-serif"
                  fontSize={fontSize}
                  fontWeight={500}
                  letterSpacing={`${0.04 / k}em`}
                  style={{ pointerEvents: "none", textTransform: "uppercase" }}>
                  {name}
                </text>
              );
            });
          })()}

          {/* City labels — gated on showLabels toggle. When off, completely
              hidden so the map stays clean. When on, appear at zoom ≥ 2.5×,
              ramping to full opacity by 4×. */}
          {showLabels && (() => {
            const opacity = k <= 2.5 ? 0 : k >= 4 ? 1 : (k - 2.5) / 1.5;
            if (opacity <= 0.02) return null;
            // At higher zooms, show smaller text; at lower, slightly larger
            const fontSize = (k >= 8 ? 9 : 10) / k;
            // Compute world-space viewport extents so we cull labels off-screen
            const visMinX = -zoomTransform.x / k;
            const visMaxX = (dims.width - zoomTransform.x) / k;
            const visMinY = -zoomTransform.y / k;
            const visMaxY = (dims.height - zoomTransform.y) / k;
            return WORLD_CITIES.map(([name, lat, lng]) => {
              const p = projection([lng, lat]);
              if (!p || isNaN(p[0])) return null;
              // Cull cities outside the visible viewport in world space
              if (p[0] < visMinX - 50 || p[0] > visMaxX + 50) return null;
              if (p[1] < visMinY - 30 || p[1] > visMaxY + 30) return null;
              return (
                <g key={`city-${name}`} style={{ pointerEvents: "none" }}>
                  {/* Small dot at the city point */}
                  <circle
                    cx={p[0]}
                    cy={p[1]}
                    r={1.5 / k}
                    fill={BRAND.textMuted}
                    fillOpacity={opacity * 0.8}
                  />
                  {/* Label, offset above-right of the dot */}
                  <text
                    x={p[0] + 4 / k}
                    y={p[1] - 4 / k}
                    fill={BRAND.white}
                    fillOpacity={opacity * 0.85}
                    stroke={BRAND.obsidianDeep}
                    strokeWidth={2.5 / k}
                    strokeOpacity={opacity * 0.7}
                    paintOrder="stroke"
                    fontFamily="Inter, sans-serif"
                    fontSize={fontSize}
                    fontWeight={500}>
                    {name}
                  </text>
                </g>
              );
            });
          })()}

          {/* Severity heat halos — one per incident, drawn at the spiderfied
              position. Radius counter-scales so halos stay a fixed visual size
              at every zoom level (they shouldn't bloat or shrink). */}
          {showHeat && visibleIncidents.map(inc => {
            const pos = incidentPos(inc);
            if (!pos) return null;
            const sev = inc.severity || 3;
            const baseR = 14 + (sev || 1) * 8;
            return (
              <circle
                key={`heat-${inc._id}`}
                cx={pos.x}
                cy={pos.y}
                r={baseR / k}
                fill={`url(#heat-${sev})`}
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {/* Blast-radius arcs — stroke counter-scales */}
          {blastArcs.map(arc => {
            const dx = arc.x2 - arc.x1;
            const dy = arc.y2 - arc.y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const sag = Math.min(dist * 0.15, 80);
            const mx = (arc.x1 + arc.x2) / 2;
            const my = (arc.y1 + arc.y2) / 2 - sag;
            const d = `M ${arc.x1} ${arc.y1} Q ${mx} ${my} ${arc.x2} ${arc.y2}`;
            // Dash array must counter-scale too, else dashes stretch at zoom
            const dashStr = arc.channelDef.dash === "0"
              ? "0"
              : arc.channelDef.dash.split(",").map(v => (parseFloat(v) / k).toFixed(2)).join(",");
            return (
              <path
                key={arc.id}
                d={d}
                fill="none"
                stroke={arc.channelDef.color}
                strokeWidth={arc.channelDef.width / k}
                strokeDasharray={dashStr}
                strokeOpacity={arc.channelDef.opacity}
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {/* Blast-radius destination markers — counter-scaled, interactive.
              Each marker is wrapped in a group with a generous invisible hit
              target so the small visual dots are easy to hover at any zoom. */}
          {blastArcs.map(arc => {
            const isHovered = hoveredEntity && hoveredEntity._id === arc.id;
            const baseR = arc.channelDef.kind === "primary" ? 2.8 : 3.2;
            const r = (isHovered ? baseR + 1.6 : baseR) / k;
            return (
              <g
                key={`dest-${arc.id}`}
                transform={`translate(${arc.x2},${arc.y2})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => {
                  setHoveredEntity({ _id: arc.id, entity: arc.entity, channel: arc.channel, channelDef: arc.channelDef, x: arc.x2, y: arc.y2 });
                }}
                onMouseLeave={() => setHoveredEntity(null)}
              >
                {/* Invisible hit target — 10/k radius so dots stay reachable at any zoom */}
                <circle r={10 / k} fill="transparent" />
                {/* Hovered halo */}
                {isHovered && (
                  <circle r={(baseR + 4) / k} fill="none" stroke={arc.channelDef.color} strokeWidth={1 / k} strokeOpacity={0.6} />
                )}
                {/* Visible marker */}
                {arc.channelDef.kind === "primary" ? (
                  <circle
                    r={r}
                    fill={arc.channelDef.color}
                    fillOpacity={isHovered ? 1 : 0.85}
                  />
                ) : (
                  <circle
                    r={r}
                    fill="none"
                    stroke={arc.channelDef.color}
                    strokeWidth={1.2 / k}
                    strokeDasharray={`${2 / k},${1.5 / k}`}
                    strokeOpacity={isHovered ? 1 : 0.85}
                  />
                )}
              </g>
            );
          })}

          {/* Spiderfy tether lines — only when offset is in effect, only at
              lower zoom levels where the spiderfy ring is large enough to see */}
          {visibleIncidents.map(inc => {
            const pos = incidentPos(inc);
            if (!pos || !pos.hasOffset) return null;
            // Hide tether when offset is sub-pixel
            const dx = pos.x - pos.anchorX;
            const dy = pos.y - pos.anchorY;
            if (Math.sqrt(dx * dx + dy * dy) * k < 4) return null;
            return (
              <line
                key={`tether-${inc._id}`}
                x1={pos.anchorX}
                y1={pos.anchorY}
                x2={pos.x}
                y2={pos.y}
                stroke={BRAND.gold}
                strokeWidth={0.5 / k}
                strokeOpacity={0.25}
                style={{ pointerEvents: "none" }}
              />
            );
          })}

          {/* Incident pins — one per incident, no clustering. Pin size and
              stroke widths counter-scale so they read identically at any zoom.
              Geographic accuracy preserved: pin sits at exact projected lat/lng
              (or spiderfied if same-coord collision). */}
          {visibleIncidents.map(inc => {
            const pos = incidentPos(inc);
            if (!pos) return null;
            const sev = SEVERITY[inc.severity] || SEVERITY[3];
            const cat = CATEGORIES[inc._cat] || { color: BRAND.gold };
            const isActive = hoveredId === inc._id || selectedId === inc._id;
            const isSelected = selectedId === inc._id;
            const isCritical = (inc.severity || 0) >= 5;
            const basePinSize = 3 + (inc.severity || 1) * 1.2;
            const pinSize = basePinSize / k;
            return (
              <g
                key={inc._id}
                transform={`translate(${pos.x},${pos.y})`}
                onMouseEnter={() => onHover(inc._id)}
                onMouseLeave={() => onHover(null)}
                onClick={e => { e.stopPropagation(); onSelect(inc._id); }}
                style={{ cursor: "pointer" }}>
                {/* Soft outer glow — small bleed outside the ring */}
                <circle
                  r={pinSize + 5 / k}
                  fill={sev.color}
                  fillOpacity={isActive ? 0.22 : 0.12}
                  filter="url(#pin-glow)"
                  style={{ transition: "fill-opacity 320ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {/* Idle breathing — only on critical (sev 5) pins. Very slow
                    and subtle so it draws the eye without being noisy.
                    Suppressed while hovering/selecting so the louder pulse
                    can take over without ringing into it. */}
                {isCritical && !isActive && (
                  <circle r={pinSize + 4 / k} fill="none" stroke={sev.color} strokeWidth={1 / k} strokeOpacity={0.4}>
                    <animate attributeName="r" values={`${pinSize + 3 / k};${pinSize + 8 / k};${pinSize + 3 / k}`} dur="3.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3.5s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Hover / selected pulse — louder, faster. Two concentric
                    pulses on the SELECTED pin so the user has a clear "this
                    is the one you're looking at" signal that persists while
                    the panel is open. */}
                {isActive && (
                  <>
                    <circle r={pinSize + 6 / k} fill="none" stroke={sev.color} strokeWidth={1.5 / k} strokeOpacity={0.85}>
                      <animate attributeName="r" from={pinSize + 5 / k} to={pinSize + 14 / k} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" from="0.85" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {isSelected && (
                      <circle r={pinSize + 6 / k} fill="none" stroke={sev.color} strokeWidth={1.5 / k} strokeOpacity={0.6}>
                        <animate attributeName="r" from={pinSize + 5 / k} to={pinSize + 18 / k} dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </>
                )}
                {/* Severity ring — sits directly at the dot's edge so it
                    reads as an attached border, not a separate halo.
                    Thickens slightly when active for tactile feedback. */}
                <circle
                  r={pinSize + 1.5 / k}
                  fill="none"
                  stroke={sev.color}
                  strokeWidth={(isActive ? 2.2 : 1.5) / k}
                  strokeOpacity={1}
                  style={{ transition: "stroke-width 220ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {/* Severity-coloured core. Scales up subtly on hover for a
                    "pressable" feel. */}
                <circle
                  r={isActive ? pinSize * 1.12 : pinSize}
                  fill={sev.color}
                  style={{ transition: "r 220ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {(inc.severity || 0) >= 4 && (
                  <circle r={pinSize * 0.45} fill="#FFFFFF" fillOpacity={0.95} />
                )}
              </g>
            );
          })}
        </g>

        {/* Hover tooltip — rendered OUTSIDE the zoom layer so it stays at
            fixed screen size and doesn't get clipped at high zoom. Position
            is computed in screen space (post-transform) and we account for
            spiderfy offset. */}
        {hoveredId && (() => {
          const inc = visibleIncidents.find(i => i._id === hoveredId);
          if (!inc) return null;
          const pos = incidentPos(inc);
          if (!pos) return null;
          // Convert from world-space to screen-space using the zoom transform
          const screenX = pos.x * k + zoomTransform.x;
          const screenY = pos.y * k + zoomTransform.y;
          // Off-screen? hide tooltip
          if (screenX < -50 || screenX > dims.width + 50 || screenY < -50 || screenY > dims.height + 50) return null;
          const sev = SEVERITY[inc.severity] || SEVERITY[3];
          const cat = CATEGORIES[inc._cat];
          const labelText = inc.headline || "";
          const tooltipWidth = Math.min(360, Math.max(220, labelText.length * 6.2));
          const tooltipHeight = 62;
          // HUD safe-zones — never sit under the control strip / caption bar
          const HUD_TOP = 56;
          const HUD_BOTTOM = 96;
          let tx = screenX + 16;
          let ty = screenY - 10;
          if (tx + tooltipWidth > dims.width - 12) tx = screenX - tooltipWidth - 16;
          if (tx < 8) tx = 8;
          if (ty < HUD_TOP) ty = screenY + 24;
          if (ty + tooltipHeight > dims.height - HUD_BOTTOM) ty = dims.height - HUD_BOTTOM - tooltipHeight;
          if (ty < HUD_TOP) ty = HUD_TOP;
          return (
            <g transform={`translate(${tx},${ty})`} style={{ pointerEvents: "none" }}>
              <rect width={tooltipWidth} height={62} fill={BRAND.obsidianElevated} stroke={BRAND.borderGold} strokeWidth={1} rx={4} fillOpacity={0.98} />
              <text x={10} y={16} fill={sev.color} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="0.08em">
                {cat?.label?.toUpperCase()} · SEV {inc.severity} · {sev.label}
              </text>
              <foreignObject x={10} y={22} width={tooltipWidth - 20} height={36}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: BRAND.white, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {labelText}
                </div>
              </foreignObject>
            </g>
          );
        })()}

        {/* Blast-destination entity tooltip — shows when hovering a related-
            party dot in the flat view. Same data as the globe's destination
            tooltip: channel pill (DIRECT / INDIRECT), entity name, country,
            and the analyst-written `reason` text. Positioned in screen space
            (post-transform). */}
        {hoveredEntity && (() => {
          const { entity: ent, channel, channelDef, x: wx, y: wy } = hoveredEntity;
          const screenX = wx * k + zoomTransform.x;
          const screenY = wy * k + zoomTransform.y;
          if (screenX < -50 || screenX > dims.width + 50 || screenY < -50 || screenY > dims.height + 50) return null;
          const name = ent.name || ent.entity || "—";
          const reason = ent.reason || "";
          const country = ent.country || "";
          const typeStr = ent.type || "";
          const shownName = name.length > 64 ? name.slice(0, 64) + "…" : name;
          // Wrap reason
          const reasonLines = [];
          if (reason) {
            const words = reason.split(/\s+/);
            let line = "";
            for (const w of words) {
              if ((line + " " + w).trim().length > 62) {
                reasonLines.push(line.trim());
                line = w;
              } else {
                line += " " + w;
              }
              if (reasonLines.length >= 3) break;
            }
            if (line && reasonLines.length < 3) reasonLines.push(line.trim());
          }
          // ── Geometry — same layout rules as the globe tooltip so both
          //    surfaces stay visually identical and reason text never spills.
          const PILL_H = 14;
          const REASON_GAP = 14;
          const PAD_BOTTOM = 12;
          const pillBaselineY = 20;
          const nameY = 38;
          const countryY = country ? 52 : nameY;
          const firstReasonY = (country ? countryY : nameY) + 14;
          const lastReasonY = firstReasonY + Math.max(0, reasonLines.length - 1) * REASON_GAP;
          const contentBottom = (reasonLines.length > 0) ? lastReasonY : (country ? countryY : nameY);
          const tooltipWidth = 380;
          const tooltipHeight = Math.ceil(contentBottom + PAD_BOTTOM);
          // ── Pill geometry — width fits the actual label so the outline
          //    never breaks against the type label sitting beside it.
          const pillLabel = `${channelDef.kind === "primary" ? "DIRECT" : "INDIRECT"} · ${channelDef.label.toUpperCase()}`;
          const pillTextWidth = pillLabel.length * 5.4;
          const pillWidth = Math.ceil(pillTextWidth + 14);
          const pillX = 10;
          const pillRight = pillX + pillWidth;
          const typeX = pillRight + 8;
          // HUD safe-zones. The parent overlays the control strip at the
          // bottom (height 56) and the filter chips at the top (height 56).
          // Keep the tooltip outside those bands so it never sits under chrome.
          const HUD_TOP = 56;
          const HUD_BOTTOM = 96;  // bottom strip + caption row
          let tx = screenX + 14;
          let ty = screenY - 8;
          if (tx + tooltipWidth > dims.width - 8) tx = screenX - tooltipWidth - 14;
          if (tx < 8) tx = 8;
          if (ty < HUD_TOP) ty = screenY + 22;
          if (ty + tooltipHeight > dims.height - HUD_BOTTOM) ty = dims.height - HUD_BOTTOM - tooltipHeight;
          if (ty < HUD_TOP) ty = HUD_TOP;
          return (
            <g transform={`translate(${tx},${ty})`} style={{ pointerEvents: "none" }}>
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                fill={BRAND.obsidianElevated}
                stroke={channelDef.color}
                strokeWidth={1}
                rx={4}
                fillOpacity={0.98}
              />
              <rect x={pillX} y={10} width={pillWidth} height={PILL_H} rx={2} fill={channelDef.color} fillOpacity={0.15} stroke={channelDef.color} strokeWidth={0.6} />
              <text x={pillX + pillWidth / 2} y={pillBaselineY} textAnchor="middle" fill={channelDef.color} fontFamily="JetBrains Mono, monospace" fontSize={8} letterSpacing="0.1em">
                {pillLabel}
              </text>
              {typeStr && (() => {
                const raw = typeStr.toUpperCase().replace(/_/g, " ");
                const maxChars = Math.max(4, Math.floor((tooltipWidth - typeX - 12) / 5.2));
                const shown = raw.length > maxChars ? raw.slice(0, maxChars - 1) + "…" : raw;
                return (
                  <text x={typeX} y={pillBaselineY} fill={BRAND.textMuted} fontFamily="JetBrains Mono, monospace" fontSize={8} letterSpacing="0.08em">
                    {shown}
                  </text>
                );
              })()}
              <text x={10} y={nameY} fill={BRAND.white} fontFamily="Inter, sans-serif" fontSize={11} fontWeight={600}>
                {shownName}
              </text>
              {country && (
                <text x={10} y={countryY} fill={BRAND.textSecondary} fontFamily="Inter, sans-serif" fontSize={10}>
                  {country}
                </text>
              )}
              {reasonLines.map((ln, i) => (
                <text
                  key={i}
                  x={10}
                  y={firstReasonY + i * REASON_GAP}
                  fill={BRAND.textSecondary}
                  fontFamily="Inter, sans-serif"
                  fontSize={10}
                  fontStyle="italic"
                >
                  {ln}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Cinematic vignette — radial darken at edges for filmic depth.
          Non-interactive overlay; pins/HUD controls stay above (zIndex 10+). */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 90% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
        zIndex: 2,
      }} />

      {/* Zoom controls — bottom-right corner of the map, above audit drawer btn */}
      <div style={{
        position: "absolute",
        bottom: 56,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 11,
      }}>
        <button
          onPointerDown={e => { e.preventDefault(); startHoldZoom(1.8); }}
          onPointerUp={stopHoldZoom}
          onPointerLeave={stopHoldZoom}
          onPointerCancel={stopHoldZoom}
          title="Zoom in (+) — hold for continuous zoom"
          style={{
            width: 32, height: 32, padding: 0,
            background: "rgba(36,36,36,0.92)",
            backdropFilter: "blur(8px)",
            color: BRAND.gold,
            border: `1px solid ${BRAND.borderGold}`,
            borderRadius: 3,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 18, lineHeight: 1, fontWeight: 500,
            cursor: "pointer",
          }}>+</button>
        <button
          onPointerDown={e => { e.preventDefault(); startHoldZoom(1 / 1.8); }}
          onPointerUp={stopHoldZoom}
          onPointerLeave={stopHoldZoom}
          onPointerCancel={stopHoldZoom}
          title="Zoom out (−) — hold for continuous zoom"
          style={{
            width: 32, height: 32, padding: 0,
            background: "rgba(36,36,36,0.92)",
            backdropFilter: "blur(8px)",
            color: BRAND.gold,
            border: `1px solid ${BRAND.borderGold}`,
            borderRadius: 3,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 18, lineHeight: 1, fontWeight: 500,
            cursor: "pointer",
          }}>−</button>
        <button
          onClick={resetZoom}
          title="Reset view (0)"
          style={{
            width: 32, height: 32, padding: 0,
            background: "rgba(36,36,36,0.92)",
            backdropFilter: "blur(8px)",
            color: BRAND.textSecondary,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 3,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11, lineHeight: 1,
            cursor: "pointer",
          }}>⌂</button>
        {/* Zoom level indicator */}
        <div style={{
          marginTop: 4,
          padding: "3px 0",
          textAlign: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9,
          color: k > 1.05 ? BRAND.gold : BRAND.textMuted,
          letterSpacing: "0.04em",
          background: "rgba(36,36,36,0.92)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${BRAND.borderSubtle}`,
          borderRadius: 3,
        }}>
          {k.toFixed(1)}×
        </div>
      </div>

      {/* Loading state */}
      {!world && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${BRAND.borderSubtle}`, borderTopColor: BRAND.gold, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.textMuted, letterSpacing: "0.1em" }}>LOADING WORLD ATLAS…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBE ERROR BOUNDARY — catches any runtime error from GlobeCanvas so a
// rendering issue can't take down the whole app. Should rarely fire now that
// the globe is pure SVG (no async workers, no WebGL context), but kept as
// belt-and-braces protection.
// ─────────────────────────────────────────────────────────────────────────────
class GlobeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("GlobeCanvas runtime error:", error, info);
  }
  render() {
    if (this.state.error) {
      const errStr = String(this.state.error?.message || this.state.error);
      return (
        <div style={{
          position: "relative", width: "100%", minHeight: 480,
          background: BRAND.obsidianDeep, borderRadius: 8,
          border: `1px solid rgba(255,107,107,0.3)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 40,
        }}>
          <div style={{ textAlign: "center", maxWidth: 560 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#FF6B6B", letterSpacing: "0.16em", marginBottom: 12 }}>
              ◇ GLOBE VIEW · RUNTIME ERROR
            </div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 700, fontSize: 24, color: BRAND.white, lineHeight: 1.25, marginBottom: 16 }}>
              The 3D globe encountered a runtime error.
            </div>
            <div style={{
              padding: "10px 14px",
              background: BRAND.obsidianCard,
              border: `1px solid ${BRAND.borderSubtle}`,
              borderRadius: 4,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              color: BRAND.textMuted,
              textAlign: "left",
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              <div style={{ color: "#FF6B6B", marginBottom: 4 }}>// error</div>
              <div>{errStr}</div>
            </div>
            <div style={{ marginTop: 16, fontFamily: "Inter, sans-serif", fontSize: 12, color: BRAND.textMuted }}>
              Switch back to flat view to continue.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBE CANVAS — d3.geoOrthographic SVG globe
// ─────────────────────────────────────────────────────────────────────────────
// Pure SVG globe (no Cesium, no Three.js, no WebGL). Uses d3.geoOrthographic
// with clipAngle(90) so back-of-globe geometry is automatically culled. Drag
// to rotate (longitude + latitude); scroll-wheel to zoom in/out. Click a pin
// to rotate the globe to centre it. Click a pin to select; hover for highlight.
// All filters, sidebar, KPI overlay, detail panel, audit drawer, and search
// come from the parent and apply identically — only the projection changes.
//
// Layers (back-to-front in the SVG):
//   1. Ocean sphere (obsidian fill)
//   2. Graticule grid (10° lat/lng lines, very subtle)
//   3. Country outlines from the world-atlas TopoJSON
//   4. Blast-radius arcs (great-circle geodesics)
//   5. Incident pins (severity-coloured)
// ─────────────────────────────────────────────────────────────────────────────
function GlobeCanvas({ world, visibleIncidents, viewMode, hoveredId, selectedId, onHover, onSelect, showBlastRadius, showHeat, showLabels }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);

  // Globe state lives in refs so drag/zoom handlers can mutate without
  // forcing React re-renders on every animation frame. We bump a counter
  // to trigger redraws when needed.
  const rotationRef = useRef([0, -20, 0]);  // [lambda, phi, gamma]
  const scaleRef = useRef(260);              // base scale; grows on zoom
  const [, forceRender] = useState(0);
  const tick = () => forceRender(n => n + 1);

  // Auto-rotate state — pauses on interaction, resumes after a beat of idle.
  const autoRotateRef = useRef(true);
  const lastInteractionRef = useRef(0);

  // Hovered blast-radius destination entity (separate from hovered incident).
  // Holds the full entity object plus its channel definition for the tooltip.
  const [hoveredEntity, setHoveredEntity] = useState(null);

  // Belt-and-braces: blast arcs only render when a pin is hovered or
  // selected. If both are null, the destination dots are unmounted and any
  // lingering hoveredEntity is stale — clear it.
  useEffect(() => {
    if (!hoveredId && !selectedId) setHoveredEntity(null);
  }, [hoveredId, selectedId]);

  // Container dimensions — matches v3 flat-view canvas height
  const WIDTH = 1000;
  const HEIGHT = 580;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;

  // ── Spiderfy: cluster by lat/lng to 4dp and offset members on a ring.
  //    Globe uses degrees so the offset works regardless of projection scale.
  const spiderfyMap = useMemo(() => {
    const groups = new Map();
    for (const inc of visibleIncidents) {
      if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") continue;
      const key = `${inc.latitude.toFixed(4)},${inc.longitude.toFixed(4)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(inc);
    }
    const map = new Map();
    const ringDeg = 0.9;
    for (const members of groups.values()) {
      if (members.length === 1) continue;
      const n = members.length;
      members.forEach((inc, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        map.set(inc._id, {
          dLng: ringDeg * Math.cos(angle),
          dLat: ringDeg * Math.sin(angle),
        });
      });
    }
    return map;
  }, [visibleIncidents]);

  function coordFor(inc) {
    const offset = spiderfyMap.get(inc._id);
    if (offset) return [inc.longitude + offset.dLng, inc.latitude + offset.dLat];
    return [inc.longitude, inc.latitude];
  }

  // ── Projection + path generator
  const projection = useMemo(() => {
    return d3.geoOrthographic()
      .scale(scaleRef.current)
      .translate([CX, CY])
      .rotate(rotationRef.current)
      .clipAngle(90)
      .precision(0.3);
  }, [rotationRef.current[0], rotationRef.current[1], scaleRef.current]); // eslint-disable-line

  const path = useMemo(() => d3.geoPath(projection), [projection]);

  // ── Drag-to-rotate + wheel-to-zoom
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    let r0, p0;
    const drag = d3.drag()
      .on("start", (event) => {
        autoRotateRef.current = false;
        lastInteractionRef.current = performance.now();
        r0 = rotationRef.current;
        p0 = [event.x, event.y];
      })
      .on("drag", (event) => {
        const sensitivity = 75 / scaleRef.current;
        const dx = (event.x - p0[0]) * sensitivity;
        const dy = (event.y - p0[1]) * sensitivity;
        const newPhi = Math.max(-90, Math.min(90, r0[1] - dy));
        rotationRef.current = [r0[0] + dx, newPhi, r0[2]];
        lastInteractionRef.current = performance.now();
        tick();
      })
      .on("end", () => {
        lastInteractionRef.current = performance.now();
      });

    svg.call(drag);

    function onWheel(event) {
      event.preventDefault();
      autoRotateRef.current = false;
      lastInteractionRef.current = performance.now();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.max(180, Math.min(1400, scaleRef.current * factor));
      scaleRef.current = newScale;
      tick();
    }
    const node = svgRef.current;
    node.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      svg.on(".drag", null);
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ── Idle auto-rotation. Runs constantly via requestAnimationFrame. Pauses
  //    on any user interaction; resumes 3.5s after the last interaction.
  //    Spins at 4° per second around the longitude axis (lambda).
  useEffect(() => {
    let raf;
    let lastFrame = performance.now();
    function frame(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      const idleFor = now - lastInteractionRef.current;
      // Resume auto-rotate after 3.5s of idle
      if (!autoRotateRef.current && idleFor > 3500) {
        autoRotateRef.current = true;
      }
      if (autoRotateRef.current) {
        const degPerSec = 2.5;
        const deltaLambda = (degPerSec * dt) / 1000;
        const [lambda, phi, gamma] = rotationRef.current;
        rotationRef.current = [lambda + deltaLambda, phi, gamma];
        tick();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Smooth tween from current rotation/scale to a target
  function rotateGlobeTo(lambda, phi, dur = 900, targetScale = null) {
    autoRotateRef.current = false;
    lastInteractionRef.current = performance.now();
    const startRot = rotationRef.current;
    const startScale = scaleRef.current;
    const endRot = [lambda, phi, 0];
    const endScale = targetScale != null ? targetScale : startScale;
    const interpRot = d3.interpolate(startRot, endRot);
    const interpScale = d3.interpolate(startScale, endScale);
    const t0 = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      const eased = d3.easeCubicInOut(t);
      rotationRef.current = interpRot(eased);
      scaleRef.current = interpScale(eased);
      lastInteractionRef.current = performance.now();
      tick();
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ── When selectedId changes externally, rotate to centre that incident
  useEffect(() => {
    if (!selectedId) return;
    const inc = visibleIncidents.find(i => i._id === selectedId);
    if (!inc || typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return;
    const [lng, lat] = coordFor(inc);
    rotateGlobeTo(-lng, -lat, 1200, Math.max(scaleRef.current, 380));
  }, [selectedId]);

  // ── Graticule
  const graticule = useMemo(() => d3.geoGraticule10(), []);

  // ── Visible-hemisphere test for point culling
  function isVisible(lng, lat) {
    const [rLng, rLat] = rotationRef.current;
    const toRad = Math.PI / 180;
    const c1 = Math.cos(lat * toRad);
    const x1 = c1 * Math.cos(lng * toRad);
    const y1 = c1 * Math.sin(lng * toRad);
    const z1 = Math.sin(lat * toRad);
    const lng2 = -rLng;
    const lat2 = -rLat;
    const c2 = Math.cos(lat2 * toRad);
    const x2 = c2 * Math.cos(lng2 * toRad);
    const y2 = c2 * Math.sin(lng2 * toRad);
    const z2 = Math.sin(lat2 * toRad);
    return (x1 * x2 + y1 * y2 + z1 * z2) > 0;
  }

  // ── Pause auto-rotation when hovered (so labels stay readable)
  function pauseAutoRotate() {
    autoRotateRef.current = false;
    lastInteractionRef.current = performance.now();
  }

  // ── Country labels — use centroid of each country, show only large-enough
  //    countries on the visible hemisphere. Fade with rotation cull.
  const countryLabels = useMemo(() => {
    if (!world || !world.features) return [];
    return world.features
      .map(f => {
        if (!f.properties || !f.properties.name) return null;
        let centroid;
        try {
          centroid = d3.geoCentroid(f);
        } catch { return null; }
        if (!centroid) return null;
        // Filter to substantial countries only (rough area heuristic)
        let bounds;
        try { bounds = d3.geoBounds(f); } catch { return null; }
        const w = Math.abs(bounds[1][0] - bounds[0][0]);
        const h = Math.abs(bounds[1][1] - bounds[0][1]);
        if (w * h < 12) return null; // skip tiny territories
        return { name: f.properties.name, lng: centroid[0], lat: centroid[1] };
      })
      .filter(Boolean);
  }, [world]);

  // ── Build a lookup of incident locations for the hover tooltip lookup
  const incLookup = useMemo(() => {
    const m = new Map();
    for (const i of visibleIncidents) m.set(i._id, i);
    return m;
  }, [visibleIncidents]);

  return (
    <div ref={wrapRef} style={{
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: 480,
      background: BRAND.obsidianDeep,
      borderRadius: 8,
      overflow: "hidden",
      border: `1px solid ${BRAND.borderSubtle}`,
    }}>
      {/* Ambience — very subtle warm glow behind the globe. Previous 10%
          opacity was way too strong and made the globe look haloed; the
          reference demo has no visible rim at all. Dialled back to a barely-
          perceptible warmth that only registers subconsciously. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(245,184,0,0.03) 0%, transparent 70%)",
        zIndex: 0,
      }} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab", userSelect: "none", position: "relative", zIndex: 1 }}
        onMouseEnter={pauseAutoRotate}
        onMouseLeave={() => {
          // Clear stuck hover state when cursor exits the globe SVG. Mirrors
          // the flat-map behaviour; without this, blast-radius tooltips can
          // remain pinned if cursor leaves through the iframe edge.
          setHoveredEntity(null);
          onHover(null);
        }}
      >
        <defs>
          {/* Ocean — flat, uniform dark. The reference demo's globe doesn't
              have a centre-to-edge radial gradient; it's one even shade so
              countries stand on their own. Closer to that here: tiny tonal
              shift only, almost imperceptible. */}
          {/* Ocean — dark so the lighter country fill (#242424) reads as
              distinct continent silhouettes. Earlier attempt at #1F1F1F made
              ocean and countries nearly the same shade — everything flattened
              into one grey blob. Back to clear contrast: ocean noticeably
              darker than land. */}
          <radialGradient id="globe-ocean-grad" cx="0.5" cy="0.5" r="0.55">
            <stop offset="0%"   stopColor="#0E0E0E" />
            <stop offset="100%" stopColor="#080808" />
          </radialGradient>
          {/* Atmospheric rim — soft gold scatter only at the very limb of the
              sphere. This is what gives the 3D feel in the reference demo:
              the centre stays flat dark, but the edge fades into a warm halo
              like sunlight scattering through atmosphere. Tuned much
              gentler than the first attempt — barely-there warmth, not a
              bright ring. */}
          <radialGradient id="globe-atmosphere" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%"   stopColor="rgba(245,184,0,0)" />
            <stop offset="94%"  stopColor="rgba(245,184,0,0)" />
            <stop offset="99%"  stopColor="rgba(245,184,0,0.08)" />
            <stop offset="100%" stopColor="rgba(245,184,0,0)" />
          </radialGradient>
          {/* Pin glow — softer Gaussian for the cinematic bloom */}
          <filter id="globe-pin-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          {/* Heat-tier radial gradients — one per severity level. Used by
              the HEAT toggle to render density halos at each incident's
              projected position. Prefixed `globe-heat-` so the IDs don't
              collide with MapCanvas's `heat-` defs. */}
          {Object.entries(SEVERITY).map(([level, s]) => (
            <radialGradient key={level} id={`globe-heat-${level}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.55} />
              <stop offset="60%"  stopColor={s.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* Ocean sphere */}
        <circle
          cx={CX}
          cy={CY}
          r={scaleRef.current}
          fill="url(#globe-ocean-grad)"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.6}
        />

        {/* Atmospheric rim halo — sits a couple of pixels larger than the
            sphere so the gold fade reads as light bleeding off the edge.
            Pointer-events disabled so it doesn't intercept clicks. */}
        <circle
          cx={CX}
          cy={CY}
          r={scaleRef.current + 3}
          fill="url(#globe-atmosphere)"
          pointerEvents="none"
        />

        {/* Graticule grid — slightly more visible than before so the user
            can still feel the sphere's curvature (the reference demo has
            faint lines too), but still neutral grey, not gold. */}
        <path
          d={path(graticule) || ""}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.4}
          opacity={1}
          pointerEvents="none"
        />

        {/* Country outlines — uniform medium-dark fill, soft border. Matches
            the demo's flat continent rendering: no fight between fill and
            stroke, continents read as silhouettes against the void. */}
        {world && world.features && (
          <g pointerEvents="none">
            {world.features.map((feature, i) => {
              const d = path(feature);
              if (!d) return null;
              return (
                <path
                  key={i}
                  d={d}
                  fill="#242424"
                  stroke="#333333"
                  strokeWidth={0.4}
                  opacity={1}
                />
              );
            })}
          </g>
        )}

        {/* Country labels — gated on showLabels toggle. When off, only the
            country of the selected or hovered incident shows (gold, soft).
            When on, all countries label when zoomed close enough. */}
        {(() => {
          if (!showLabels) {
            const focusInc = visibleIncidents.find(i => i._id === (selectedId || hoveredId));
            if (!focusInc || !focusInc.country) return null;
            if (typeof focusInc.latitude !== "number" || typeof focusInc.longitude !== "number") return null;
            if (!isVisible(focusInc.longitude, focusInc.latitude)) return null;
            const p = projection([focusInc.longitude, focusInc.latitude]);
            if (!p) return null;
            return (
              <g pointerEvents="none">
                <text
                  x={p[0]}
                  y={p[1] - 18}
                  textAnchor="middle"
                  fill={BRAND.gold}
                  stroke={BRAND.obsidianDeep}
                  strokeWidth={3}
                  strokeOpacity={0.7}
                  paintOrder="stroke"
                  fontFamily="Inter, sans-serif"
                  fontSize={11}
                  fontWeight={600}
                  letterSpacing="0.16em"
                  opacity={0.9}
                  style={{ textTransform: "uppercase" }}
                >
                  {focusInc.country}
                </text>
              </g>
            );
          }
          // Full labels mode
          if (scaleRef.current <= 300) return null;
          return (
            <g pointerEvents="none">
              {countryLabels.map((c, i) => {
                if (!isVisible(c.lng, c.lat)) return null;
                const p = projection([c.lng, c.lat]);
                if (!p) return null;
                const opacity = Math.min(1, (scaleRef.current - 300) / 250);
                return (
                  <text
                    key={`country-${i}`}
                    x={p[0]}
                    y={p[1]}
                    textAnchor="middle"
                    fill={BRAND.textSecondary}
                    fontFamily="Inter, sans-serif"
                    fontSize={9}
                    fontWeight={500}
                    letterSpacing="0.12em"
                    opacity={opacity * 0.85}
                    style={{ textTransform: "uppercase" }}
                  >
                    {c.name}
                  </text>
                );
              })}
            </g>
          );
        })()}

        {/* City labels — gated on showLabels toggle. Off by default. */}
        {showLabels && scaleRef.current > 420 && (
          <g pointerEvents="none">
            {WORLD_CITIES.map(([name, lat, lng], i) => {
              if (!isVisible(lng, lat)) return null;
              const p = projection([lng, lat]);
              if (!p) return null;
              const opacity = Math.min(1, (scaleRef.current - 420) / 180);
              return (
                <g key={`city-${i}`} transform={`translate(${p[0]},${p[1]})`}>
                  <circle r={1.5} fill={BRAND.textMuted} opacity={opacity * 0.7} />
                  <text
                    x={4}
                    y={3}
                    fill={BRAND.textMuted}
                    fontFamily="Inter, sans-serif"
                    fontSize={9}
                    opacity={opacity}
                  >
                    {name}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Blast-radius arcs — great-circle paths from incident origin to
            each related entity in blast_radius{}. Mirrors the flat view's
            data model: filtered to selected (or hovered if nothing selected),
            grouped by channel, primary = solid arc/filled dot, indirect =
            dashed arc/hollow ring. Paths are real geodesics, so they trace
            the shortest path over the sphere — the visual signature of a
            globe-based intelligence map. Back-of-globe segments are clipped
            automatically by clipAngle(90). */}
        {showBlastRadius && (() => {
          const sourceId = selectedId || hoveredId;
          if (!sourceId) return null;
          const sel = visibleIncidents.find(i => i._id === sourceId);
          if (!sel || typeof sel.latitude !== "number") return null;
          const [origLng, origLat] = coordFor(sel);
          const radius = sel.blast_radius || {};
          const arcs = [];
          for (const [channel, entities] of Object.entries(radius)) {
            if (!Array.isArray(entities)) continue;
            const channelDef = BLAST_CHANNELS[channel];
            if (!channelDef) continue;
            entities.forEach((ent, i) => {
              if (typeof ent.latitude !== "number" || typeof ent.longitude !== "number") return;
              arcs.push({
                id: `${sel._id}-${channel}-${i}`,
                from: [origLng, origLat],
                to: [ent.longitude, ent.latitude],
                channel,
                channelDef,
                entity: ent,
              });
            });
          }
          return (
            <g>
              {/* Arc paths — non-interactive */}
              <g pointerEvents="none">
                {arcs.map(arc => {
                  const geo = { type: "LineString", coordinates: [arc.from, arc.to] };
                  const d = path(geo);
                  if (!d) return null;
                  return (
                    <path
                      key={arc.id}
                      d={d}
                      fill="none"
                      stroke={arc.channelDef.color}
                      strokeWidth={arc.channelDef.width + 0.3}
                      strokeDasharray={arc.channelDef.dash === "0" ? "0" : arc.channelDef.dash}
                      strokeOpacity={arc.channelDef.opacity + 0.15}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
              {/* Destination markers — clickable, with a generous invisible
                  hit target so the small visual dots are easy to grab. Hover
                  pauses auto-rotate and shows the entity-name tooltip. */}
              {arcs.map(arc => {
                if (!isVisible(arc.to[0], arc.to[1])) return null;
                const p = projection(arc.to);
                if (!p) return null;
                const isHovered = hoveredEntity && hoveredEntity._id === arc.id;
                const r = isHovered ? 4.5 : 3.3;
                return (
                  <g
                    key={`dest-${arc.id}`}
                    transform={`translate(${p[0]},${p[1]})`}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => {
                      pauseAutoRotate();
                      setHoveredEntity({ _id: arc.id, entity: arc.entity, channel: arc.channel, channelDef: arc.channelDef, x: p[0], y: p[1] });
                    }}
                    onMouseLeave={() => setHoveredEntity(null)}
                  >
                    {/* Invisible hit target — 10px radius so tiny dots are reachable */}
                    <circle r={10} fill="transparent" />
                    {/* Hovered halo */}
                    {isHovered && (
                      <circle r={r + 4} fill="none" stroke={arc.channelDef.color} strokeWidth={1} strokeOpacity={0.6} />
                    )}
                    {/* Visible marker — primary = filled dot, indirect = hollow dashed ring */}
                    {arc.channelDef.kind === "primary" ? (
                      <circle
                        r={r}
                        fill={arc.channelDef.color}
                        fillOpacity={isHovered ? 1 : 0.9}
                        stroke={BRAND.obsidianDeep}
                        strokeWidth={0.6}
                      />
                    ) : (
                      <circle
                        r={r + 0.3}
                        fill="none"
                        stroke={arc.channelDef.color}
                        strokeWidth={1.3}
                        strokeDasharray="2,1.5"
                        strokeOpacity={isHovered ? 1 : 0.9}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Incident pins — cinematic: a soft severity-coloured glow halo
            (the visual signature of the reference demo), then a crisp
            severity ring, then a saturated severity-coloured core. The pin
            colour now matches severity (red/orange/gold/green/grey) rather
            than category, because severity is what makes the map readable
            at a glance from a distance. Category is still surfaced in
            tooltips, sidebar, and detail panel. */}

        {/* HEAT halos — density visualisation, only when the toggle is on.
            Rendered before pins so the pins sit on top. Each halo is a
            radial gradient circle centred at the incident's projected
            screen position, sized by severity. Same `isVisible` cull as
            pins so halos don't bleed onto the back-of-globe hemisphere. */}
        {showHeat && (
          <g pointerEvents="none">
            {visibleIncidents.map(inc => {
              if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return null;
              const [lng, lat] = coordFor(inc);
              if (!isVisible(lng, lat)) return null;
              const point = projection([lng, lat]);
              if (!point) return null;
              const sev = inc.severity || 3;
              const baseR = 14 + sev * 8;
              return (
                <circle
                  key={`globe-heat-${inc._id}`}
                  cx={point[0]}
                  cy={point[1]}
                  r={baseR}
                  fill={`url(#globe-heat-${sev})`}
                />
              );
            })}
          </g>
        )}

        <g>
          {visibleIncidents.map(inc => {
            if (typeof inc.latitude !== "number" || typeof inc.longitude !== "number") return null;
            const [lng, lat] = coordFor(inc);
            if (!isVisible(lng, lat)) return null;
            const point = projection([lng, lat]);
            if (!point) return null;
            const sev = SEVERITY[inc.severity] || SEVERITY[3];
            const cat = CATEGORIES[inc._cat] || { color: BRAND.gold };
            const isActive = hoveredId === inc._id || selectedId === inc._id;
            const isSelected = selectedId === inc._id;
            const isCritical = (inc.severity || 0) >= 5;
            const pinSize = 3 + (inc.severity || 1) * 1.2;
            return (
              <g
                key={inc._id}
                transform={`translate(${point[0]},${point[1]})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => { pauseAutoRotate(); onHover(inc._id); }}
                onMouseLeave={() => onHover(null)}
                onClick={() => {
                  onSelect(inc._id);
                  rotateGlobeTo(-lng, -lat, 900, Math.max(scaleRef.current, 380));
                }}
              >
                {/* Soft outer glow */}
                <circle
                  r={pinSize + 5}
                  fill={sev.color}
                  fillOpacity={isActive ? 0.22 : 0.12}
                  filter="url(#globe-pin-glow)"
                  style={{ transition: "fill-opacity 320ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {/* Idle breathing on critical pins */}
                {isCritical && !isActive && (
                  <circle r={pinSize + 4} fill="none" stroke={sev.color} strokeWidth={1} strokeOpacity={0.4}>
                    <animate attributeName="r" values={`${pinSize + 3};${pinSize + 9};${pinSize + 3}`} dur="3.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="3.5s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Hover/selected pulse */}
                {isActive && (
                  <>
                    <circle r={pinSize + 6} fill="none" stroke={sev.color} strokeWidth={1.5} strokeOpacity={0.85}>
                      <animate attributeName="r" from={pinSize + 5} to={pinSize + 16} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" from="0.85" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    {isSelected && (
                      <circle r={pinSize + 6} fill="none" stroke={sev.color} strokeWidth={1.5} strokeOpacity={0.6}>
                        <animate attributeName="r" from={pinSize + 5} to={pinSize + 20} dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </>
                )}
                {/* Severity ring — sits at the dot's edge with thicker stroke
                    when active for tactile feedback */}
                <circle
                  r={pinSize + 1.5}
                  fill="none"
                  stroke={sev.color}
                  strokeWidth={isActive ? 2.2 : 1.5}
                  strokeOpacity={1}
                  style={{ transition: "stroke-width 220ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {/* Core dot — scales up on hover */}
                <circle
                  r={isActive ? pinSize * 1.12 : pinSize}
                  fill={sev.color}
                  style={{ transition: "r 220ms cubic-bezier(0.4,0,0.2,1)" }}
                />
                {(inc.severity || 0) >= 4 && (
                  <circle r={pinSize * 0.45} fill="#FFFFFF" fillOpacity={0.95} />
                )}
              </g>
            );
          })}
        </g>

        {/* Hover tooltip — same shape as flat-view: cat label, sev, headline,
            entity. Positioned next to the projected pin location. */}
        {hoveredId && (() => {
          const inc = incLookup.get(hoveredId);
          if (!inc || typeof inc.latitude !== "number") return null;
          const [lng, lat] = coordFor(inc);
          if (!isVisible(lng, lat)) return null;
          const p = projection([lng, lat]);
          if (!p) return null;
          const sev = SEVERITY[inc.severity] || SEVERITY[3];
          const cat = CATEGORIES[inc._cat];
          const headline = inc.headline || "";
          const tooltipWidth = Math.min(340, Math.max(220, headline.length * 6.2));
          const tooltipHeight = 62;
          // HUD safe-zones — keeps tooltip from sliding under the control strip
          // or the LIVE / filter-chip overlays that live above the SVG.
          const HUD_TOP = 56;
          const HUD_BOTTOM = 96;
          let tx = p[0] + 14;
          let ty = p[1] - 8;
          if (tx + tooltipWidth > WIDTH - 8) tx = p[0] - tooltipWidth - 14;
          if (tx < 8) tx = 8;
          if (ty < HUD_TOP) ty = p[1] + 22;
          if (ty + tooltipHeight > HEIGHT - HUD_BOTTOM) ty = HEIGHT - HUD_BOTTOM - tooltipHeight;
          if (ty < HUD_TOP) ty = HUD_TOP;
          // Truncate headline visually
          const shownHeadline = headline.length > 56 ? headline.slice(0, 56) + "…" : headline;
          return (
            <g transform={`translate(${tx},${ty})`} pointerEvents="none">
              <rect width={tooltipWidth} height={62} fill={BRAND.obsidianElevated} stroke={BRAND.borderGold} strokeWidth={1} rx={4} fillOpacity={0.98} />
              <text x={10} y={16} fill={sev.color} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="0.08em">
                {cat?.label?.toUpperCase()} · SEV {inc.severity} · {sev.label}
              </text>
              <text x={10} y={34} fill={BRAND.white} fontFamily="Inter, sans-serif" fontSize={11} fontWeight={600}>
                {shownHeadline}
              </text>
              <text x={10} y={50} fill={BRAND.textSecondary} fontFamily="Inter, sans-serif" fontSize={10}>
                {(inc.entity || "—")}{inc.country ? ` · ${inc.country}` : ""}
              </text>
            </g>
          );
        })()}

        {/* Blast-destination entity tooltip — appears when hovering any of
            the small dots radiating from the selected/hovered incident.
            Larger than the incident tooltip because it includes the
            channel label, country, and the analyst-written `reason`. */}
        {hoveredEntity && (() => {
          const { entity: ent, channel, channelDef, x, y } = hoveredEntity;
          const name = ent.name || ent.entity || "—";
          const reason = ent.reason || "";
          const country = ent.country || "";
          const typeStr = ent.type || "";
          const shownName = name.length > 64 ? name.slice(0, 64) + "…" : name;
          // Wrap reason to multiple lines (very rough: ~62 chars per line)
          const reasonLines = [];
          if (reason) {
            const words = reason.split(/\s+/);
            let line = "";
            for (const w of words) {
              if ((line + " " + w).trim().length > 62) {
                reasonLines.push(line.trim());
                line = w;
              } else {
                line += " " + w;
              }
              if (reasonLines.length >= 3) break;
            }
            if (line && reasonLines.length < 3) reasonLines.push(line.trim());
            if (reason.split(/\s+/).length > reasonLines.join(" ").split(/\s+/).length) {
              const last = reasonLines[reasonLines.length - 1] || "";
              reasonLines[reasonLines.length - 1] = (last.length > 58 ? last.slice(0, 58) : last) + "…";
            }
          }
          // ── Geometry. We lay text out top-to-bottom and size the rect to
          //    actually contain every row. Previous code under-sized the rect
          //    so reason lines spilled past the bottom edge.
          //    Rows: [pill row · 28px] [name · 18px] [country · 16px?] [reasons · 14px each] + bottom pad
          const PAD_TOP = 10;          // pill row start
          const PILL_H = 14;
          const PILL_TO_NAME = 14;     // gap from pill bottom (y=24) to name baseline (y=38)
          const NAME_TO_COUNTRY = 14;
          const REASON_GAP = 14;
          const PAD_BOTTOM = 12;
          const pillBaselineY = PAD_TOP + 10;                 // = 20
          const nameY = pillBaselineY + PILL_TO_NAME + 4;     // = 38
          const countryY = country ? nameY + NAME_TO_COUNTRY - 2 : nameY;  // = 50 when country present
          const firstReasonY = (country ? countryY : nameY) + 14;
          const lastReasonY = firstReasonY + Math.max(0, reasonLines.length - 1) * REASON_GAP;
          const contentBottom = (reasonLines.length > 0) ? lastReasonY : (country ? countryY : nameY);
          const tooltipWidth = 380;
          const tooltipHeight = Math.ceil(contentBottom + PAD_BOTTOM);
          // ── Pill geometry — width must fit the actual label text or the
          //    pill outline visually breaks ("INDIRECT · CAPITAL" overflowed
          //    the fixed 84-px pill and ran into the type label). Approx 5.4px
          //    per char at fontSize 8 + letterSpacing 0.1em, with 14px side pad.
          const pillLabel = `${channelDef.kind === "primary" ? "DIRECT" : "INDIRECT"} · ${channelDef.label.toUpperCase()}`;
          const pillTextWidth = pillLabel.length * 5.4;
          const pillWidth = Math.ceil(pillTextWidth + 14);
          const pillX = 10;
          const pillRight = pillX + pillWidth;
          const typeX = pillRight + 8;  // 8-px gap after pill
          // HUD safe-zones (viewBox space): bottom band reserved for caption +
          // control strip (~96px), top band for LIVE counter / filter chips.
          // Keeps tooltip from sliding under chrome.
          const HUD_TOP = 56;
          const HUD_BOTTOM = 96;
          let tx = x + 14;
          let ty = y - 8;
          if (tx + tooltipWidth > WIDTH - 8) tx = x - tooltipWidth - 14;
          if (tx < 8) tx = 8;
          if (ty < HUD_TOP) ty = y + 22;
          if (ty + tooltipHeight > HEIGHT - HUD_BOTTOM) ty = HEIGHT - HUD_BOTTOM - tooltipHeight;
          if (ty < HUD_TOP) ty = HUD_TOP; // final safety clamp
          return (
            <g transform={`translate(${tx},${ty})`} pointerEvents="none">
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                fill={BRAND.obsidianElevated}
                stroke={channelDef.color}
                strokeWidth={1}
                rx={4}
                fillOpacity={0.98}
              />
              {/* Channel pill — width fits the label text so the outline
                  never breaks. Text is positioned dead-centre of the pill. */}
              <rect x={pillX} y={10} width={pillWidth} height={PILL_H} rx={2} fill={channelDef.color} fillOpacity={0.15} stroke={channelDef.color} strokeWidth={0.6} />
              <text x={pillX + pillWidth / 2} y={pillBaselineY} textAnchor="middle" fill={channelDef.color} fontFamily="JetBrains Mono, monospace" fontSize={8} letterSpacing="0.1em">
                {pillLabel}
              </text>
              {typeStr && (() => {
                // Type label sits after the pill. Truncate if it would overflow
                // the right edge of the tooltip so it can't bleed past the rect.
                const raw = typeStr.toUpperCase().replace(/_/g, " ");
                const maxChars = Math.max(4, Math.floor((tooltipWidth - typeX - 12) / 5.2));
                const shown = raw.length > maxChars ? raw.slice(0, maxChars - 1) + "…" : raw;
                return (
                  <text x={typeX} y={pillBaselineY} fill={BRAND.textMuted} fontFamily="JetBrains Mono, monospace" fontSize={8} letterSpacing="0.08em">
                    {shown}
                  </text>
                );
              })()}
              {/* Entity name */}
              <text x={10} y={nameY} fill={BRAND.white} fontFamily="Inter, sans-serif" fontSize={11} fontWeight={600}>
                {shownName}
              </text>
              {country && (
                <text x={10} y={countryY} fill={BRAND.textSecondary} fontFamily="Inter, sans-serif" fontSize={10}>
                  {country}
                </text>
              )}
              {/* Reason — wrapped, italic */}
              {reasonLines.map((ln, i) => (
                <text
                  key={i}
                  x={10}
                  y={firstReasonY + i * REASON_GAP}
                  fill={BRAND.textSecondary}
                  fontFamily="Inter, sans-serif"
                  fontSize={10}
                  fontStyle="italic"
                >
                  {ln}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Cinematic vignette — radial darken at edges for filmic depth */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 90% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
        zIndex: 2,
      }} />

      {/* Controls hint bottom-left */}
      <div style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9,
        color: BRAND.textMuted,
        letterSpacing: "0.08em",
        pointerEvents: "none",
        zIndex: 5,
      }}>
        DRAG · SCROLL · CLICK PIN
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND — categories, severity, channels
// ─────────────────────────────────────────────────────────────────────────────
function Legend({ visibleCats, showBlastRadius, showHeat, onToggleHeat, onToggleBlast }) {
  return (
    <div style={{ background: BRAND.obsidianCard, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 6, padding: 16, fontFamily: "Inter, sans-serif" }}>
      {/* Toggles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={onToggleHeat}
          style={{ flex: 1, padding: "6px 10px", fontSize: 10, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em",
            background: showHeat ? BRAND.gold : "transparent", color: showHeat ? BRAND.obsidian : BRAND.textSecondary,
            border: `1px solid ${showHeat ? BRAND.gold : BRAND.borderSubtle}`, borderRadius: 3, cursor: "pointer" }}>
          {showHeat ? "✓ HEAT" : "○ HEAT"}
        </button>
        <button onClick={onToggleBlast}
          style={{ flex: 1, padding: "6px 10px", fontSize: 10, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em",
            background: showBlastRadius ? BRAND.gold : "transparent", color: showBlastRadius ? BRAND.obsidian : BRAND.textSecondary,
            border: `1px solid ${showBlastRadius ? BRAND.gold : BRAND.borderSubtle}`, borderRadius: 3, cursor: "pointer" }}>
          {showBlastRadius ? "✓ BLAST" : "○ BLAST"}
        </button>
      </div>

      {/* Severity scale */}
      <div style={{ fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>SEVERITY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
        {[5, 4, 3, 2, 1].map(level => {
          const s = SEVERITY[level];
          return (
            <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: s.color }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.textSecondary }}>{level}</span>
              <span style={{ color: BRAND.textSecondary }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Visible categories */}
      <div style={{ fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>CATEGORIES IN VIEW</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
        {Array.from(visibleCats).sort().map(cat => {
          const c = CATEGORIES[cat];
          if (!c) return null;
          return (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: c.color }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.textSecondary }}>{cat}</span>
              <span style={{ color: BRAND.textSecondary }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      {/* Blast-radius channels */}
      {showBlastRadius && (
        <>
          <div style={{ fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>BLAST · DIRECT</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {Object.entries(BLAST_CHANNELS).filter(([, ch]) => ch.kind === "primary").map(([k, ch]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <svg width={22} height={8}>
                  <line x1={0} y1={4} x2={14} y2={4} stroke={ch.color} strokeWidth={ch.width} strokeDasharray={ch.dash} strokeOpacity={ch.opacity * 1.6} />
                  <circle cx={17} cy={4} r={2.5} fill={ch.color} fillOpacity={0.85} />
                </svg>
                <span style={{ color: BRAND.textSecondary }}>{ch.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>BLAST · INDIRECT</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(BLAST_CHANNELS).filter(([, ch]) => ch.kind === "indirect").map(([k, ch]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <svg width={22} height={8}>
                  <line x1={0} y1={4} x2={14} y2={4} stroke={ch.color} strokeWidth={ch.width} strokeDasharray={ch.dash} strokeOpacity={ch.opacity * 1.6} />
                  <circle cx={17} cy={4} r={3} fill="none" stroke={ch.color} strokeWidth={1.2} strokeDasharray="2,1.5" strokeOpacity={0.85} />
                </svg>
                <span style={{ color: BRAND.textSecondary }}>{ch.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT CASCADE — manual-step carousel modelled on the GUARD Sentinel demo
// (single incident card position, top-right). One panel visible at a time;
// user advances through up to six sections with ← / → arrow buttons or the
// keyboard. Globe stays full-bleed underneath.
//
// Sequence (each section auto-skipped if its source data is empty):
//   1. Classification
//   2. Blast Radius
//   3. Peer Watchlist
//   4. Adaptive Controls
//   5. Historical Analogues
//   6. Vendor Marketplace  (newsroom mode only)
//
// Behaviour:
//   • Always starts at index 0 (Classification) on new incident
//   • Next → / Prev ← arrows advance/retreat; disabled at the ends
//   • ArrowRight / ArrowLeft keyboard keys do the same
//   • On incident change, key={incident._id} forces remount → resets to 0
//   • On close (✕ or Esc, handled by parent), the whole cascade unmounts
// ─────────────────────────────────────────────────────────────────────────────

// Defensive renderer for fields that might be plain strings OR structured
// objects. The GUARD pipeline emits some fields (velocity_signal,
// emerging_risk_signal, severity_rationale, peer_watchlist entries) either
// as prose strings or as structured objects with keys like { pattern,
// count_quarter, trajectory, brief }. React throws "objects are not valid
// as a React child" if we try to render the object directly — so coerce.
function toText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(" · ");
  if (typeof v === "object") {
    if (typeof v.brief === "string") return v.brief;
    if (typeof v.description === "string") return v.description;
    if (typeof v.statement === "string") return v.statement;
    if (typeof v.text === "string") return v.text;
    if (typeof v.summary === "string") return v.summary;
    const parts = [];
    if (v.pattern) parts.push(`Pattern: ${v.pattern}`);
    if (v.trajectory) parts.push(`Trajectory: ${v.trajectory}`);
    if (v.count_quarter != null) parts.push(`Q-count: ${v.count_quarter}`);
    if (parts.length > 0) return parts.join(" · ");
    try { return JSON.stringify(v).slice(0, 200); }
    catch { return ""; }
  }
  return String(v);
}

// Shared CSS for the cascade. Keyframes are reused across the body
// components for internal row stagger; the panel itself swaps cards via a
// React-state-driven crossfade rather than CSS animation.
const CASCADE_STYLES = `
  @keyframes panelInTR { from { opacity: 0; transform: translate(28px, -10px); } to { opacity: 1; transform: translate(0, 0); } }
  @keyframes panelInTL { from { opacity: 0; transform: translate(-28px, -10px); } to { opacity: 1; transform: translate(0, 0); } }
  @keyframes panelInBR { from { opacity: 0; transform: translate(28px, 10px); } to { opacity: 1; transform: translate(0, 0); } }
  @keyframes panelInBL { from { opacity: 0; transform: translate(-28px, 10px); } to { opacity: 1; transform: translate(0, 0); } }
  @keyframes panelOutTR { from { opacity: 1; transform: translate(0,0); } to { opacity: 0; transform: translate(20px, 0); } }
  @keyframes panelOutTL { from { opacity: 1; transform: translate(0,0); } to { opacity: 0; transform: translate(-20px, 0); } }
  @keyframes panelOutBR { from { opacity: 1; transform: translate(0,0); } to { opacity: 0; transform: translate(20px, 0); } }
  @keyframes panelOutBL { from { opacity: 1; transform: translate(0,0); } to { opacity: 0; transform: translate(-20px, 0); } }
  @keyframes rowIn      { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rowInLeft  { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes barFill    { from { width: 0; } to { width: var(--bar-w, 100%); } }

  /* Scene-panel — the shared shell for every panel in a scene. Each
     instance is positioned by a corner-specific override class below. */
  .scene-panel {
    position: fixed;
    width: 380px;
    max-height: calc(100vh - 200px);
    background: rgba(26,26,26,0.92);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    font-family: Inter, sans-serif;
    color: #FFFFFF;
    z-index: 99;
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.55);
  }
  .scene-panel::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: #F5B800; border-radius: 8px 0 0 8px;
  }
  /* Four corner anchors. Width varies per slot — top panels narrower so
     they don't crowd the centre, bottom panels can grow wider for the
     denser content (controls, vendors).

     Per-slot max-height: keep Classification (tr) generous because its
     content fits naturally; cap Blast Radius (tl), Outreach (br), and
     Adaptive Controls (bl) to roughly 60% of viewport so they stay
     readable without dominating the screen. Internal overflow scrolls
     inside the body. */
  .scene-panel.slot-tr { top: 90px;    right: 28px; width: 380px; }
  .scene-panel.slot-tl { top: 90px;    left:  28px; width: 360px; max-height: 60vh; }
  .scene-panel.slot-br { bottom: 28px; right: 28px; width: 380px; max-height: 60vh; }
  .scene-panel.slot-bl { bottom: 28px; left:  28px; width: 460px; max-height: 60vh; }
  /* Slide direction matched to anchor — feels like the panel "emerges"
     from its corner rather than appearing arbitrarily. */
  .scene-panel.slot-tr { animation: panelInTR 480ms cubic-bezier(0.16,1,0.3,1); }
  .scene-panel.slot-tl { animation: panelInTL 480ms cubic-bezier(0.16,1,0.3,1); }
  .scene-panel.slot-br { animation: panelInBR 480ms cubic-bezier(0.16,1,0.3,1); }
  .scene-panel.slot-bl { animation: panelInBL 480ms cubic-bezier(0.16,1,0.3,1); }
  /* When the scene transitions out, the panels slide back toward their
     respective corners — opposite directions for top vs bottom feel
     intentional rather than random. */
  .scene-panel.slot-tr.leaving { animation: panelOutTR 200ms cubic-bezier(0.4,0,0.6,1) forwards; }
  .scene-panel.slot-tl.leaving { animation: panelOutTL 200ms cubic-bezier(0.4,0,0.6,1) forwards; }
  .scene-panel.slot-br.leaving { animation: panelOutBR 200ms cubic-bezier(0.4,0,0.6,1) forwards; }
  .scene-panel.slot-bl.leaving { animation: panelOutBL 200ms cubic-bezier(0.4,0,0.6,1) forwards; }

  .scene-panel-header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px 12px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .scene-panel-body {
    padding: 18px 22px 20px;
    overflow-y: auto;
    flex: 1 1 auto;
    /* Firefox: thin gold-tinted scrollbar */
    scrollbar-width: thin;
    scrollbar-color: rgba(245,184,0,0.30) transparent;
  }
  /* WebKit/Blink: custom thin scrollbar. The default bright white
     stripe is harsh against the dark panel — we want a quiet gold
     thumb that's only visible when actually needed. */
  .scene-panel-body::-webkit-scrollbar {
    width: 6px;
  }
  .scene-panel-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .scene-panel-body::-webkit-scrollbar-thumb {
    background: rgba(245,184,0,0.25);
    border-radius: 3px;
    transition: background 200ms ease;
  }
  .scene-panel-body::-webkit-scrollbar-thumb:hover {
    background: rgba(245,184,0,0.50);
  }
  .scene-panel-body::-webkit-scrollbar-corner {
    background: transparent;
  }
  .scene-panel-footer {
    display: flex; justify-content: space-between; align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }
  .cascade-tag {
    font-family: 'JetBrains Mono', monospace; font-size: 9px;
    letter-spacing: 0.18em; color: #F5B800; text-transform: uppercase;
    font-weight: 600;
  }
  .cascade-nav-btn {
    min-width: 34px; height: 28px;
    background: rgba(245,184,0,0.08);
    border: 1px solid rgba(245,184,0,0.30);
    color: #F5B800;
    border-radius: 3px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 14px;
    line-height: 1; padding: 0 8px;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 220ms cubic-bezier(0.16,1,0.3,1);
  }
  .cascade-nav-btn:hover:not(:disabled) {
    background: rgba(245,184,0,0.18);
    border-color: #F5B800;
    transform: translateY(-1px);
  }
  .cascade-nav-btn:disabled {
    opacity: 0.25; cursor: not-allowed;
  }
  .cascade-counter {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    letter-spacing: 0.10em; color: rgba(255,255,255,0.5);
  }
  .scene-close {
    width: 24px; height: 24px;
    background: rgba(245,184,0,0.08);
    border: 1px solid rgba(245,184,0,0.30);
    color: #F5B800;
    border-radius: 3px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    line-height: 1; padding: 0;
    transition: all 220ms cubic-bezier(0.16,1,0.3,1);
  }
  .scene-close:hover {
    background: rgba(245,184,0,0.18);
    border-color: #F5B800;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// IncidentCascade — scene-paired panel layout modelled on the demo's
// scene flow (Classification + Controls together → Blast + Peers together
// → History + Vendors together). Two panels are visible at once, each
// anchored to a different corner. Arrows advance through scenes.
// ─────────────────────────────────────────────────────────────────────────────
function IncidentCascade({ incident, viewMode, onClose }) {
  if (!incident) return null;
  const sev = SEVERITY[incident.severity] || SEVERITY[3];
  const cat = CATEGORIES[incident._cat];
  const newsroomMode = viewMode === "newsroom";

  // ── Compute which sections actually have data ───────────────────────
  const blastChannels = useMemo(() => incident.blast_radius
    ? Object.entries(incident.blast_radius).filter(([, v]) => Array.isArray(v) && v.length > 0)
    : [],
    [incident]
  );
  const objs = useMemo(() => Array.isArray(incident.adaptive_objectives) ? incident.adaptive_objectives : [], [incident]);
  const masters = useMemo(() => Array.isArray(incident.adaptive_master_controls) ? incident.adaptive_master_controls : [], [incident]);
  const acts = useMemo(() => Array.isArray(incident.adaptive_controls) ? incident.adaptive_controls : [], [incident]);
  const bps = useMemo(() => Array.isArray(incident.best_practices) ? incident.best_practices : [], [incident]);
  const hasControls = (
    incident.if_you_operate_x_then_y || incident.severity_rationale ||
    incident.velocity_signal || incident.emerging_risk_signal ||
    objs.length > 0 || masters.length > 0 || acts.length > 0 || bps.length > 0
  );
  const history = useMemo(() => Array.isArray(incident.historical_analogues) ? incident.historical_analogues : [], [incident]);
  const vendors = useMemo(() => Array.isArray(incident.vendors) ? incident.vendors : [], [incident]);

  // ── Build scenes. Each scene is { label, slots: [{slot, panel}] }.
  // A scene is included only if it has at least one panel with data —
  // empty scenes are skipped entirely.
  const scenes = useMemo(() => {
    const all = [];

    // Scene 1: What happened + What to do about it
    // (Classification top-right, Adaptive Controls bottom-left)
    const scene1Slots = [];
    scene1Slots.push({
      slot: "slot-tr", label: "INCIDENT · CLASSIFIED",
      render: () => <ClassificationBody incident={incident} sev={sev} cat={cat} />,
    });
    if (hasControls) {
      scene1Slots.push({
        slot: "slot-bl", label: "ADAPTIVE CONTROLS",
        render: () => <AdaptiveControlsBody incident={incident} objs={objs} masters={masters} acts={acts} bps={bps} />,
      });
    }
    if (scene1Slots.length > 0) all.push({ id: "scene1", label: "Incident & Response", slots: scene1Slots });

    // Scene 2: Who else is exposed + What to say to them
    // (Blast Radius top-left, Outreach Hooks bottom-right). Matches the
    // demo's Scene 6 + 7 pairing — blast panel stays visible while the
    // outreach panel appears alongside it, so the user sees the
    // exposed entities AND the editorial hooks to reach them in the
    // same view.
    const scene2Slots = [];
    if (blastChannels.length > 0) {
      // Eyebrow includes the incident entity name (e.g. "BLAST RADIUS ·
      // AIR INDIA 787") — matches the demo's bp-tag exactly. Falls back
      // to just "BLAST RADIUS" if no entity is available.
      const blastEntity = (incident.entity || incident.affected_entity || "").toString().trim().toUpperCase();
      scene2Slots.push({
        slot: "slot-tl",
        label: blastEntity ? `BLAST RADIUS · ${blastEntity}` : "BLAST RADIUS",
        render: () => <BlastRadiusBody incident={incident} channels={blastChannels} />,
      });
    }
    // Peer Watchlist panel (replaces the former Outreach Hooks panel) —
    // surfaces peers showing comparable risk signals: the analyst
    // "read-across" view. Primary source is incident.peer_watchlist[];
    // when that's empty we fall back to blast_radius.competitive_peer[]
    // (which is where real sweeps carry peer entities — e.g. the Mali/JNIM
    // sweep's "Africa Corps Command" peer), so the panel never renders
    // blank when peer data exists. PeerWatchlistBody handles both shapes.
    // OutreachBody is left defined but uncalled — harmless and restorable.
    const peerList = Array.isArray(incident.peer_watchlist) ? incident.peer_watchlist : [];
    const competitivePeers = Array.isArray(incident.blast_radius?.competitive_peer)
      ? incident.blast_radius.competitive_peer
      : [];
    const peers = peerList.length > 0 ? peerList : competitivePeers;
    if (peers.length > 0) {
      scene2Slots.push({
        slot: "slot-br", label: "PEER WATCHLIST · READ-ACROSS",
        render: () => <PeerWatchlistBody peers={peers} />,
      });
    }
    if (scene2Slots.length > 0) all.push({ id: "scene2", label: "Exposure & Engagement", slots: scene2Slots });

    // Scene 3: Has this happened before + Who can help
    // (Historical top-right, Vendors bottom-left). Vendors are
    // newsroom-mode only per the original product gating.
    const scene3Slots = [];
    if (history.length > 0) {
      scene3Slots.push({
        slot: "slot-tr", label: "HISTORICAL ANALOGUES",
        render: () => <HistoricalBody items={history} />,
      });
    }
    if (newsroomMode && vendors.length > 0) {
      scene3Slots.push({
        slot: "slot-bl", label: "VENDORS",
        render: () => <VendorBody vendors={vendors} />,
      });
    }
    if (scene3Slots.length > 0) {
      // Scene 3 label adapts to what's actually inside — historical
      // analogues alone, vendors alone, or both. Avoids the
      // generic "History & Help" when only one panel is rendering.
      const hasHistory = history.length > 0;
      const hasVendors = newsroomMode && vendors.length > 0;
      let scene3Label = "Precedent & Vendors";
      if (hasHistory && !hasVendors) scene3Label = "Historical Precedent";
      else if (!hasHistory && hasVendors) scene3Label = "Vendor Marketplace";
      all.push({ id: "scene3", label: scene3Label, slots: scene3Slots });
    }

    return all;
  }, [incident, sev, cat, blastChannels, hasControls, objs, masters, acts, bps, history, vendors, newsroomMode]);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Per-scene dismissed slots. Each entry is a Set of slot keys
  // (e.g. "slot-tl", "slot-br") that the user has individually closed
  // within the current scene. Resets on every scene transition —
  // dismissals don't bleed across scenes because each scene is its
  // own chapter. If the user closes every panel in a scene, the
  // cascade auto-advances to the next scene with content.
  const [dismissedSlots, setDismissedSlots] = useState(new Set());

  // Reset dismissed slots whenever the scene index changes — each
  // scene starts fresh with all its panels visible.
  useEffect(() => {
    setDismissedSlots(new Set());
  }, [sceneIndex]);

  // Keyboard nav: ← / → step between scenes; Esc closes the cascade.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") { advance(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { advance(-1); e.preventDefault(); }
      else if (e.key === "Escape") { onClose && onClose(); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function advance(delta) {
    setSceneIndex(prev => {
      const next = prev + delta;
      if (next < 0 || next >= scenes.length) return prev;
      // Leave animation runs on current panels, then we swap. The leave
      // window must match panelOut* duration in CSS (200ms) plus a small
      // buffer so the new entry doesn't compete with the old exit.
      setLeaving(true);
      setTimeout(() => { setLeaving(false); }, 220);
      return next;
    });
  }

  // Dismiss a single panel within the current scene. If this dismissal
  // empties the scene, behavior depends on where we are:
  //   • If a next scene exists  → auto-advance (user's signaling "next")
  //   • If we're on the last scene → fully close the cascade
  function dismissSlot(slotKey) {
    setDismissedSlots(prev => {
      const newSet = new Set(prev);
      newSet.add(slotKey);
      // Check if every slot in this scene is now dismissed
      const currentSceneSlots = scenes[sceneIndex]?.slots || [];
      const allDismissed = currentSceneSlots.every(s => newSet.has(s.slot));
      if (allDismissed) {
        // Defer the decision so the dismissal animation can play
        setTimeout(() => {
          if (sceneIndex < scenes.length - 1) {
            advance(1);
          } else {
            onClose && onClose();
          }
        }, 220);
      }
      return newSet;
    });
  }

  if (scenes.length === 0) return null;
  const currentScene = scenes[sceneIndex];
  const canPrev = sceneIndex > 0;
  const canNext = sceneIndex < scenes.length - 1;

  // Filter out the slots the user has individually dismissed from
  // the current scene. The remaining (visible) slots are what we
  // actually render. The footer (arrows + counter) attaches to
  // whichever visible slot is rendered last so the navigation
  // controls are always present somewhere on screen.
  const visibleSlots = currentScene.slots.filter(s => !dismissedSlots.has(s.slot));

  // If somehow every slot got dismissed but auto-advance hasn't
  // fired yet (mid-animation window), render nothing — avoids a
  // flash of an empty cascade.
  if (visibleSlots.length === 0) return <style>{CASCADE_STYLES}</style>;

  return (
    <>
      <style>{CASCADE_STYLES}</style>

      {visibleSlots.map((slot, slotIdx) => {
        // The footer (with arrows + counter) attaches to the LAST
        // VISIBLE panel in the scene, so the nav controls follow
        // whichever panel is still on screen even after dismissals.
        const isLastSlot = slotIdx === visibleSlots.length - 1;
        return (
          <div
            key={`${currentScene.id}-${slot.slot}`}
            className={`scene-panel ${slot.slot}${leaving ? " leaving" : ""}`}
          >
            {/* Header — section tag + per-panel close button. Each
                panel has its own × which dismisses only itself. If
                the user closes every panel in this scene, the cascade
                auto-advances to the next scene (or closes entirely
                if this was the last scene). */}
            <div className="scene-panel-header">
              <div className="cascade-tag">{slot.label}</div>
              <button
                className="scene-close"
                onClick={() => dismissSlot(slot.slot)}
                title="Close this panel (Esc to close all)"
                aria-label={`Close ${slot.label}`}
              >✕</button>
            </div>

            {/* Body — re-mounts on scene change so the row-stagger
                animations replay cleanly */}
            <div className="scene-panel-body" key={sceneIndex}>
              {slot.render()}
            </div>

            {/* Footer — only on the last panel of the scene. Holds the
                scene nav arrows and counter. */}
            {isLastSlot && (
              <div className="scene-panel-footer">
                <button
                  className="cascade-nav-btn"
                  onClick={() => advance(-1)}
                  disabled={!canPrev}
                  title={canPrev ? `Previous: ${(scenes[sceneIndex - 1] || {}).label || "—"}` : "Previous scene (←)"}
                  aria-label="Previous scene"
                >‹</button>
                {/* Counter — shows the CURRENT scene's meaningful label
                    on top with a quiet ordinal underneath. The user sees
                    "EXPOSURE & OUTREACH · 02 / 03" instead of a generic
                    "SCENE 02 / 03". Tooltips on the nav arrows preview
                    the destination scene's name. */}
                <span className="cascade-counter" style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.1, gap: 2 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: "#F5B800", letterSpacing: "0.14em",
                    textTransform: "uppercase", fontWeight: 600,
                  }}>
                    {(scenes[sceneIndex] || {}).label || `Scene ${sceneIndex + 1}`}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                    color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em",
                  }}>
                    {String(sceneIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
                  </span>
                </span>
                <button
                  className="cascade-nav-btn"
                  onClick={() => advance(1)}
                  disabled={!canNext}
                  title={canNext ? `Next: ${(scenes[sceneIndex + 1] || {}).label || "—"}` : "Next scene (→)"}
                  aria-label="Next scene"
                >›</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD BODIES — each returns content only, no positioning, no panel chrome.
// The carousel shell handles positioning, header, footer, transitions.
// Internal row staggering uses CSS keyframes defined in CASCADE_STYLES.
// ─────────────────────────────────────────────────────────────────────────────

// ───── 1. CLASSIFICATION ─────
function ClassificationBody({ incident, sev, cat }) {
  const stats = useMemo(() => {
    // Only surface the stats trio when there are REAL impact numbers to
    // show — financial loss, records compromised, downtime, casualties.
    // Falling back to severity / country / confidence here was duplicating
    // information already shown in the severity pill and the VICTIM meta
    // block above, which made the card feel padded with redundant filler.
    // If no real impact stats exist, the trio is hidden entirely — the
    // card reads as a cleaner 2-section piece.
    const out = [];
    if (incident.financial_impact) out.push({ num: incident.financial_impact, lbl: "FINANCIAL" });
    if (incident.records_affected) out.push({ num: incident.records_affected, lbl: "RECORDS" });
    if (incident.downtime) out.push({ num: incident.downtime, lbl: "DOWNTIME" });
    if (incident.casualties) out.push({ num: incident.casualties, lbl: "CASUALTIES" });
    if (incident.affected_systems_count) out.push({ num: incident.affected_systems_count, lbl: "SYSTEMS" });
    // Only render if we have at least 2 real impact stats — a single number
    // alone looks lost.
    return out.length >= 2 ? out.slice(0, 3) : [];
  }, [incident]);

  const secondaryCats = useMemo(() => {
    if (Array.isArray(incident._secondary_cats)) return incident._secondary_cats;
    if (Array.isArray(incident.secondary_adaptive_mappings)) {
      return incident.secondary_adaptive_mappings
        .map(m => m.category || m.code || m)
        .filter(c => typeof c === "string")
        .slice(0, 4);
    }
    return [];
  }, [incident]);

  return (
    <>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontWeight: 700, letterSpacing: "-0.005em",
        fontSize: 23, lineHeight: 1.2, marginBottom: 10,
      }}>
        {toText(incident.headline) || "—"}
      </div>
      {incident.summary && (
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.7)",
          fontStyle: "italic", lineHeight: 1.45, marginBottom: 14,
        }}>
          "{toText(incident.summary)}"
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{
          padding: "3px 10px", borderRadius: 3,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#1A1A1A", background: sev.color,
        }}>
          {sev.label}
        </span>
        {cat && (
          <span style={{
            padding: "3px 9px", borderRadius: 3,
            border: "1px solid rgba(245,184,0,0.30)",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: "#F5B800", letterSpacing: "0.06em",
          }}>
            {incident._cat}
          </span>
        )}
        {secondaryCats.map((sc, i) => (
          <span key={i} style={{
            padding: "3px 9px", borderRadius: 3,
            border: "1px solid rgba(245,184,0,0.18)",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: "rgba(245,184,0,0.7)", letterSpacing: "0.06em",
          }}>
            {toText(sc)}
          </span>
        ))}
      </div>

      <div style={{ fontSize: 11 }}>
        {incident.adversary && (
          <>
            <div style={{
              fontWeight: 600, fontSize: 8, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
              marginTop: 8, marginBottom: 2,
            }}>
              Adversary
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              {toText(incident.adversary)}
              {incident.adversary_origin && <> &nbsp;·&nbsp; ORIGIN &nbsp;{toText(incident.adversary_origin)}</>}
            </div>
          </>
        )}
        {(incident.entity || incident.country) && (
          <>
            <div style={{
              fontWeight: 600, fontSize: 8, letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
              marginTop: 8, marginBottom: 2,
            }}>
              Victim
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              {toText(incident.entity || "—")}
              {incident.sector && <> &nbsp;·&nbsp; {toText(incident.sector)}</>}
              {incident.country && <> &nbsp;·&nbsp; {toText(incident.country)}</>}
            </div>
          </>
        )}
      </div>

      {stats.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: 8, marginTop: 12, paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 18,
                color: "#F5B800", fontWeight: 600, lineHeight: 1.1,
              }}>{toText(s.num)}</div>
              <div style={{
                fontSize: 8, fontWeight: 600, letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
                marginTop: 3,
              }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───── 2. BLAST RADIUS ─────
// Demo-faithful compact ring-list. The blast panel shows ONE row per
// ring (6 rings max), each row a 4-column grid:
//
//   num   RING NAME         org1 · org2 · org3       +N
//
// Per-entity detail (impact_rationale, mechanism, recommended action)
// is intentionally NOT in this panel — that depth lives in the audit
// drawer and (for the top 3 entities) in the Outreach Hooks panel.
// The blast panel itself is about BREADTH: who is in the radius,
// grouped by ring type, at a single glance.
function BlastRadiusBody({ incident, channels }) {
  const totalEntities = channels.reduce((acc, [, ents]) => acc + ents.length, 0);
  const ringCount = channels.length;
  // Watchlist-hit count must match what the Peer Watchlist panel renders:
  // peer_watchlist[] when present, else blast_radius.competitive_peer[].
  // Counting only peer_watchlist[] showed "0 hits" next to a populated
  // panel on sweeps (e.g. Rosneft) that carry peers under competitive_peer.
  const watchlistHits = (() => {
    const pw = Array.isArray(incident.peer_watchlist) ? incident.peer_watchlist : [];
    if (pw.length > 0) return pw.length;
    const cp = Array.isArray(incident.blast_radius?.competitive_peer) ? incident.blast_radius.competitive_peer : [];
    return cp.length;
  })();

  // Which ring is expanded for detail view? Null = none. Click a row
  // to reveal the per-entity rich detail (impact rationale, mechanism,
  // horizon, recommended action) for that ring. Click again to collapse.
  const [expandedRing, setExpandedRing] = useState(null);

  // Impact score → traffic-light colours for the IMPACT N/5 badge in
  // the expanded view. Same palette as the audit drawer so the same
  // entity reads identically across surfaces.
  function impactColors(score) {
    if (typeof score !== "number") return null;
    if (score >= 4) return { bg: "#FF3B3022", fg: "#FF6B6B", bd: "#FF6B6B55" };
    if (score >= 3) return { bg: "#FF8C5A22", fg: "#FF8C5A", bd: "#FF8C5A55" };
    return { bg: "#34C75922", fg: "#34C759", bd: "#34C75955" };
  }

  return (
    <>
      {/* Title — Cormorant serif anchor matching the demo's "Who else
          should care." headline */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontWeight: 700, letterSpacing: "-0.005em",
        fontSize: 22, marginBottom: 12, lineHeight: 1.2,
      }}>
        Who else should care.
      </div>

      {/* Stats trio — Named accounts / Ring types / Watchlist hits.
          3-col grid with top/bottom borders, identical to the demo's
          .bp-stats pattern. */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
        padding: "10px 0", margin: "10px 0 14px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <Stat n={totalEntities} l="Named accounts" />
        <Stat n={ringCount} l="Ring types" />
        <Stat n={watchlistHits} l="Watchlist hits" />
      </div>

      {/* Tap-to-expand hint — small mono caps line above the ring
          list. Tells the user the rows are interactive without
          shouting it. */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
        color: "rgba(255,255,255,0.35)", letterSpacing: "0.14em",
        textTransform: "uppercase", fontWeight: 600,
        marginBottom: 6,
      }}>
        Tap a ring to see why · who · when · what to do
      </div>

      {/* Ring list — one compact row per channel. 4-column grid:
          number, ring name, comma-separated orgs, count.
          Each ring renders the first ~3 org names inline; the rest
          surface as "+N" on the right edge. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {channels.map(([channelKey, entities], chIdx) => {
          const ch = BLAST_CHANNELS[channelKey] || { label: channelKey.replace(/_/g, " "), color: "#F5B800" };
          // Take the first 3 org names for the inline list — keeps the
          // row to roughly one line per ring. Anything beyond surfaces
          // as the +N count on the right.
          const orgNames = entities
            .slice(0, 3)
            .map(e => typeof e === "string" ? e : (e && (e.name || e.entity)))
            .filter(Boolean);
          const rowDelay = 250 + chIdx * 140;
          const isExpanded = expandedRing === channelKey;
          return (
            <div key={channelKey}>
              {/* Clickable row. Hover changes background subtly; the
                  chevron rotates 90° when expanded so users see the
                  state without reading. */}
              <div
                onClick={() => setExpandedRing(isExpanded ? null : channelKey)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "14px 22px 96px 1fr 32px",
                  gap: 8, alignItems: "center",
                  padding: "8px 4px",
                  borderTop: chIdx === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  borderRadius: 3,
                  background: isExpanded ? "rgba(245,184,0,0.05)" : "transparent",
                  transition: "background 180ms cubic-bezier(0.16,1,0.3,1)",
                  opacity: 0,
                  animation: `rowInLeft 500ms cubic-bezier(0.16,1,0.3,1) ${rowDelay}ms forwards`,
                }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Disclosure chevron — rotates 90° when row is open */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: isExpanded ? "#F5B800" : "rgba(255,255,255,0.4)",
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                  transition: "transform 220ms cubic-bezier(0.16,1,0.3,1), color 220ms",
                  display: "inline-block", textAlign: "center",
                }}>▸</span>
                {/* Number — small gold mono, 01–06 padded */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  color: "#F5B800", fontWeight: 600,
                }}>
                  {String(chIdx + 1).padStart(2, "0")}
                </span>
                {/* Ring name — uppercase mono, channel-coloured for tonal
                    variety (matches the channel's blast-arc colour on the
                    map so the panel and the map speak the same visual
                    language) */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: ch.color, letterSpacing: "0.12em",
                  textTransform: "uppercase", fontWeight: 600,
                  lineHeight: 1.3,
                }}>
                  {ch.label}
                </span>
                {/* Inline org list — italic Inter, secondary white. The
                    italic is exactly how the demo renders ring-orgs. */}
                <span style={{
                  fontSize: 11, color: "rgba(255,255,255,0.75)",
                  fontStyle: "italic", lineHeight: 1.4,
                  overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {orgNames.length > 0 ? orgNames.join(" · ") : "—"}
                </span>
                {/* Count — total entities in this ring, gold mono,
                    right-aligned. Matches the demo's "+5 / +4 / +3"
                    pattern where the number is the FULL ring size, not
                    "extras beyond inline". The inline org list is a
                    preview; this count is the truth. */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                  color: "#F5B800", fontWeight: 600, textAlign: "right",
                }}>
                  +{entities.length}
                </span>
              </div>

              {/* Expanded entity detail — slides in below the clicked
                  row. Shows EVERY entity in this ring with its full
                  impact rationale, transmission mechanism, horizon, and
                  recommended action. This is the "where do I see the
                  details" answer. */}
              {isExpanded && (
                <div style={{
                  padding: "10px 8px 12px 30px",
                  borderLeft: `2px solid ${ch.color}`,
                  marginLeft: 11,
                  marginBottom: 8,
                  display: "flex", flexDirection: "column", gap: 8,
                  animation: "rowIn 320ms cubic-bezier(0.16,1,0.3,1) both",
                }}>
                  {entities.map((ent, entIdx) => {
                    // Strings (rare schema shape) — render as one-liner
                    if (typeof ent === "string") {
                      return (
                        <div key={entIdx} style={{
                          fontSize: 12, color: "#FFFFFF",
                          padding: "8px 10px",
                          background: "rgba(36,36,36,0.6)",
                          borderRadius: 3,
                        }}>{ent}</div>
                      );
                    }
                    const horizon = IMPACT_HORIZONS[ent.impact_horizon];
                    const mechanism = TRANSMISSION_MECHANISMS[ent.transmission_mechanism];
                    const impactCol = impactColors(ent.impact_score);
                    const showAction = typeof ent.impact_score === "number" && ent.impact_score >= 4 && ent.recommended_action_for_them;
                    const rationale = ent.impact_rationale || ent.reason;
                    return (
                      <div key={entIdx} style={{
                        padding: "10px 11px",
                        background: "rgba(36,36,36,0.6)",
                        borderRadius: 3,
                      }}>
                        {/* Row 1: name + impact badge */}
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "flex-start", gap: 8,
                          marginBottom: ent.country ? 2 : 7,
                        }}>
                          <div style={{
                            fontSize: 12.5, color: "#FFFFFF", fontWeight: 600,
                            lineHeight: 1.25, flex: 1, minWidth: 0,
                          }}>
                            {toText(ent.name || ent.entity || "—")}
                          </div>
                          {impactCol && (
                            <span style={{
                              flexShrink: 0,
                              padding: "1px 6px", borderRadius: 3,
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
                              fontWeight: 600, letterSpacing: "0.08em",
                              background: impactCol.bg, color: impactCol.fg,
                              border: `1px solid ${impactCol.bd}`,
                            }}>
                              IMPACT {ent.impact_score}/5
                            </span>
                          )}
                        </div>
                        {/* Country — subtle mono caps under name */}
                        {ent.country && (
                          <div style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
                            color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em",
                            marginBottom: 7,
                          }}>
                            {toText(ent.country)}
                          </div>
                        )}
                        {/* Rationale — the WHY paragraph */}
                        {rationale && (
                          <div style={{
                            fontSize: 11, color: "rgba(255,255,255,0.85)",
                            lineHeight: 1.5,
                            marginBottom: (mechanism || horizon) ? 8 : (showAction ? 9 : 0),
                          }}>
                            {toText(rationale)}
                          </div>
                        )}
                        {/* Mechanism + horizon chips on one row */}
                        {(mechanism || horizon) && (
                          <div style={{
                            display: "flex", gap: 5, flexWrap: "wrap",
                            marginBottom: showAction ? 9 : 0,
                          }}>
                            {mechanism && (
                              <span style={{
                                padding: "2px 6px", borderRadius: 3,
                                border: `1px solid ${ch.color}44`,
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 7.5,
                                color: ch.color, letterSpacing: "0.10em",
                                textTransform: "uppercase",
                              }}>
                                ↬ {mechanism.label}
                              </span>
                            )}
                            {horizon && (
                              <span style={{
                                padding: "2px 6px", borderRadius: 3,
                                border: "1px solid rgba(245,184,0,0.30)",
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 7.5,
                                color: "#F5B800", letterSpacing: "0.10em",
                                textTransform: "uppercase",
                              }}>
                                ⏱ {horizon.label}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Recommended action callout (impact ≥ 4 only) */}
                        {showAction && (
                          <div style={{
                            padding: "6px 9px",
                            background: "rgba(245,184,0,0.06)",
                            borderLeft: "2px solid rgba(245,184,0,0.40)",
                            borderRadius: 2,
                            fontSize: 10.5, lineHeight: 1.5,
                          }}>
                            <div style={{
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 7.5,
                              color: "#F5B800", letterSpacing: "0.14em",
                              textTransform: "uppercase", fontWeight: 600,
                              marginBottom: 2,
                            }}>Recommended</div>
                            <div style={{ color: "#FFFFFF" }}>
                              {toText(ent.recommended_action_for_them)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 22,
        color: "#F5B800", fontWeight: 600, lineHeight: 1.1,
      }}>{n}</div>
      <div style={{
        fontSize: 8, fontWeight: 600, letterSpacing: "0.14em",
        color: "rgba(255,255,255,0.4)", textTransform: "uppercase",
        marginTop: 3,
      }}>{l}</div>
    </div>
  );
}

// ───── 3. PEER WATCHLIST ─────
// ───── 3. PEER WATCHLIST ─────
// "Companies showing similar risk" — companies that aren't directly in
// this incident's blast radius, but show similar trajectory / pattern in
// their own data. The WHY is the most important content here, so the
// rationale gets prominent placement (not buried as italic footer text).
function PeerWatchlistBody({ peers }) {
  return (
    <>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontWeight: 700, letterSpacing: "-0.005em",
        fontSize: 22, marginBottom: 4,
      }}>
        Companies showing similar risk.
      </div>
      <div style={{
        fontSize: 11.5, color: "rgba(255,255,255,0.6)",
        fontStyle: "italic", lineHeight: 1.5, marginBottom: 14,
      }}>
        Peers tracking comparable signals in their own activity — read-across to watch.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {peers.slice(0, 6).map((p, i) => {
          const rowDelay = 200 + i * 100;
          const isStr = typeof p === "string";

          // ── Field extraction — handles BOTH real schemas ──────────────
          // peer_watchlist[] entries carry: name, country, exposure_reason,
          //   confidence, source_anchor{citation,url}.
          // blast_radius.competitive_peer[] entries carry: name, type,
          //   country, reason, impact_score (2-5), impact_rationale,
          //   transmission_mechanism, impact_horizon,
          //   recommended_action_for_them, attacked_ai_product_hook{cta_label},
          //   confidence, source_anchor.
          // We surface every field that exists; missing ones just don't render.
          const name = isStr ? p : (p.name || p.entity || p.pattern || "—");
          const country = !isStr ? (p.country || null) : null;

          // WHY this peer shares the risk. peer_watchlist → exposure_reason;
          // competitive_peer → reason (the trade-reported linkage) with
          // impact_rationale as a secondary fallback. Legacy fields kept.
          const why = !isStr ? (
            p.exposure_reason || p.reason || p.impact_rationale ||
            p.brief || p.rationale || p.description || p.pattern_description
          ) : null;

          // WHAT TO DO — the analyst action. Shown as its own line so it is
          // no longer swallowed by the "why" fallback (the previous bug).
          const action = !isStr ? (p.recommended_action_for_them || null) : null;
          // Only show action if it isn't literally the same string as why.
          const showAction = action && action !== why;

          // Attacked.ai product hook CTA (greyteaming / wargaming etc.)
          const hook = !isStr && p.attacked_ai_product_hook && typeof p.attacked_ai_product_hook === "object"
            ? p.attacked_ai_product_hook : null;
          const hookCta = hook && (hook.cta_label || hook.label) ? (hook.cta_label || hook.label) : null;

          // Analytical chips — real schema fields (transmission mechanism,
          // impact horizon, competitor type). Replace the old pattern/traj
          // chips, which don't exist in this schema.
          const mechanism = !isStr && p.transmission_mechanism ? p.transmission_mechanism : null;
          const horizon = !isStr && p.impact_horizon ? p.impact_horizon : null;
          const peerType = !isStr && p.type && p.type !== "competitor" ? p.type : null;

          // Confidence badge — HIGH / MEDIUM / DIRECTIONAL / CONFIRMED.
          const conf = !isStr && p.confidence ? String(p.confidence).toUpperCase() : null;
          const confStyle = (() => {
            switch (conf) {
              case "CONFIRMED": return { color: "#FF6B6B", bg: "#FF3B3022", bd: "#FF6B6B55" };
              case "HIGH":      return { color: "#FF8C5A", bg: "#FF8C5A22", bd: "#FF8C5A55" };
              case "MEDIUM":    return { color: "#F5B800", bg: "#F5B80022", bd: "#F5B80055" };
              case "DIRECTIONAL": return { color: "#34C759", bg: "#34C75922", bd: "#34C75955" };
              default:          return conf ? { color: "#9D7BEC", bg: "#9D7BEC22", bd: "#9D7BEC55" } : null;
            }
          })();

          // Signal-strength bar — driven by the REAL impact_score (2-5) on
          // competitive_peer entries. peer_watchlist has no score, so the bar
          // is simply omitted there. impact_score 5 → 100%, 2 → 40%.
          const score = !isStr && typeof p.impact_score === "number" ? p.impact_score : null;
          const pct = score != null ? Math.min(100, Math.max(0, Math.round((score / 5) * 100))) : null;
          const barColor = pct == null ? "#F5B800"
            : pct >= 80 ? "#FF6B6B" : pct >= 60 ? "#FF8C5A" : "#34C759";

          // Source citation — surfaced as a small line, with the url linked.
          const src = !isStr && p.source_anchor && typeof p.source_anchor === "object" ? p.source_anchor : null;
          const srcCitation = src ? (src.citation || src.url || null) : null;
          const srcUrl = src && typeof src.url === "string" ? src.url : null;

          return (
            <div key={i} style={{
              padding: "11px 13px",
              background: "rgba(36,36,36,0.6)",
              borderLeft: "2px solid #F5B800",
              borderRadius: 3,
              opacity: 0,
              animation: `rowIn 500ms cubic-bezier(0.16,1,0.3,1) ${rowDelay}ms forwards`,
            }}>
              {/* Row 1: company name (+ country) + confidence badge (right) */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", gap: 10, marginBottom: 4,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: "#FFFFFF", fontWeight: 600,
                    lineHeight: 1.3,
                  }}>{toText(name)}</div>
                  {country && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                      color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em",
                      marginTop: 2,
                    }}>{toText(country)}</div>
                  )}
                </div>
                {conf && confStyle && (
                  <span style={{
                    flexShrink: 0,
                    padding: "2px 7px", borderRadius: 3,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                    fontWeight: 600, letterSpacing: "0.10em",
                    background: confStyle.bg,
                    color: confStyle.color,
                    border: `1px solid ${confStyle.bd}`,
                  }}>
                    {conf}
                  </span>
                )}
              </div>

              {/* Row 2: WHY this peer is at similar risk — primary content. */}
              {why && (
                <div style={{
                  fontSize: 11.5, color: "rgba(255,255,255,0.85)",
                  lineHeight: 1.45, marginTop: 6, marginBottom: 6,
                }}>
                  {toText(why)}
                </div>
              )}

              {/* Row 3: WHAT TO DO — analyst recommended action, its own line
                  with a quiet label so it reads as guidance, not narrative. */}
              {showAction && (
                <div style={{
                  marginTop: 6, marginBottom: 6, paddingLeft: 8,
                  borderLeft: "2px solid rgba(245,184,0,0.35)",
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                    color: "#F5B800", letterSpacing: "0.10em",
                    textTransform: "uppercase", marginBottom: 3,
                  }}>▸ Recommended action</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.78)", lineHeight: 1.4 }}>
                    {toText(action)}
                  </div>
                </div>
              )}

              {/* Row 4: analytical chips — transmission mechanism · impact
                  horizon · peer type. Real competitive_peer fields. */}
              {(mechanism || horizon || peerType) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginBottom: pct != null ? 8 : 0 }}>
                  {mechanism && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 3,
                      border: "1px solid rgba(245,184,0,0.30)",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                      color: "#F5B800", letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}>
                      ◇ {toText(mechanism).replace(/_/g, " ")}
                    </span>
                  )}
                  {horizon && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 3,
                      border: "1px solid rgba(157,123,236,0.35)",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                      color: "#9D7BEC", letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}>
                      ↗ {toText(horizon)} horizon
                    </span>
                  )}
                  {peerType && (
                    <span style={{
                      padding: "2px 7px", borderRadius: 3,
                      border: "1px solid rgba(255,255,255,0.15)",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                      color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}>
                      {toText(peerType)}
                    </span>
                  )}
                </div>
              )}

              {/* Row 5: impact-score signal bar — only for entries that
                  carry a real impact_score (competitive_peer). */}
              {pct != null && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    color: "rgba(255,255,255,0.4)", letterSpacing: "0.10em",
                    textTransform: "uppercase", minWidth: 64,
                  }}>impact {score}/5</span>
                  <span style={{
                    flex: 1, height: 3,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 2, overflow: "hidden",
                  }}>
                    <span style={{
                      display: "block", height: "100%",
                      background: barColor,
                      borderRadius: 2,
                      width: `${pct}%`,
                      animation: `barFill 800ms cubic-bezier(0.4,0,0.2,1) ${rowDelay + 250}ms both`,
                      ["--bar-w"]: `${pct}%`,
                    }} />
                  </span>
                </div>
              )}

              {/* Row 6: Attacked.ai product hook CTA — the "simulate this"
                  action that ties the peer back to a product (greyteaming
                  / wargaming). Matches the demo's ▸ CTA styling. */}
              {hookCta && (
                <div style={{
                  marginTop: 8,
                  padding: "5px 9px",
                  background: "rgba(245,184,0,0.08)",
                  border: "1px solid rgba(245,184,0,0.25)",
                  borderRadius: 3,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: "#F5B800", letterSpacing: "0.04em",
                }}>
                  ▸ {toText(hookCta)}
                </div>
              )}

              {/* Row 7: source citation — provenance line, url linked. */}
              {srcCitation && (
                <div style={{
                  marginTop: 8, paddingTop: 7,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5,
                  color: "rgba(255,255,255,0.4)", lineHeight: 1.5,
                }}>
                  {srcUrl ? (
                    <a href={srcUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "rgba(245,184,0,0.7)", textDecoration: "none" }}>
                      ⌖ {toText(srcCitation)}
                    </a>
                  ) : (
                    <span>⌖ {toText(srcCitation)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {peers.length > 6 && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "rgba(255,255,255,0.4)", textAlign: "center",
            fontStyle: "italic", padding: "4px 0",
          }}>+ {peers.length - 6} more in audit</div>
        )}
      </div>
    </>
  );
}

// ───── 4. ADAPTIVE CONTROLS ─────
// Each control row shows: number, ID, statement, and a right-side stack
// of (1) control kind (DIRECT/INDIRECT/OBJECTIVE) and (2) fit pill if
// the JSON provides one. The kind classification is derived from which
// section the row came from (objectives vs masters/acts vs best practices)
// so the user always sees whether a control is direct or indirect, even
// when the JSON's `fit` field isn't populated.
function AdaptiveControlsBody({ incident, objs, masters, acts, bps }) {
  const rows = useMemo(() => {
    const out = [];
    // OBJ = Adaptive Objective — desired-outcome goal (not a control per se)
    objs.forEach((o, i) => out.push({
      kind: "OBJ", kindLabel: "OBJECTIVE", kindTone: "objective",
      id: o.id || `CO-${i + 1}`,
      text: o.statement || o.description || (typeof o === "string" ? o : toText(o)),
      fit: o.fit || null,
    }));
    // MC = Master Control — top-level direct control
    masters.forEach((m, i) => out.push({
      kind: "MC", kindLabel: "DIRECT", kindTone: "direct",
      id: m.id || `MC-${i + 1}`,
      text: m.statement || m.description || (typeof m === "string" ? m : toText(m)),
      fit: m.fit || null,
    }));
    // AC = Adaptive Control — scenario-tuned direct control
    acts.forEach((a, i) => out.push({
      kind: "AC", kindLabel: "DIRECT", kindTone: "direct",
      id: a.id || `AC-${i + 1}`,
      text: a.statement || a.description || (typeof a === "string" ? a : toText(a)),
      fit: a.fit || null,
    }));
    // BP = Best Practice — advisory / indirect
    bps.forEach((b, i) => out.push({
      kind: "BP", kindLabel: "INDIRECT", kindTone: "indirect",
      id: b.id || `BP-${i + 1}`,
      text: b.statement || b.description || (typeof b === "string" ? b : toText(b)),
      fit: b.fit || null,
    }));
    return out.slice(0, 10);
  }, [objs, masters, acts, bps]);

  // Fit pill colour — solid background with dark text (demo style).
  // Maps directly to the demo's pill palette: STRONG/FULL = green, PARTIAL = grey,
  // GAP/FAIL = red. The original had orange for STRONG; demo screenshot shows
  // orange for STRONG/HIGH-impact pills so we'll match it.
  const fitColor = (f) => {
    const fu = (f || "").toUpperCase();
    if (fu === "FULL" || fu === "OK")     return "#34C759";     // green = full coverage
    if (fu === "STRONG")                  return "#FF8C5A";     // orange = strong fit (demo)
    if (fu === "PARTIAL")                 return "#9A9A9A";     // grey = partial (demo)
    if (fu === "GAP" || fu === "FAIL")    return "#FF6B6B";     // red = gap
    return null;
  };

  // Kind tag style — demo-faithful solid pills. No outlines, dark text on
  // saturated background. DIRECT = bright gold (primary), INDIRECT = muted
  // grey-gold (advisory), OBJECTIVE = neutral grey (goal not action).
  const kindStyle = (tone) => {
    const base = {
      padding: "3px 9px", borderRadius: 3,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
      fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase",
      textAlign: "center", border: "none",
      color: "#1A1A1A",  // demo uses dark text on solid pill
      whiteSpace: "nowrap",
    };
    if (tone === "direct")   return { ...base, background: "#F5B800" };
    if (tone === "indirect") return { ...base, background: "rgba(245,184,0,0.55)" };
    return { ...base, background: "rgba(255,255,255,0.35)", color: "#1A1A1A" }; // objective
  };

  return (
    <>
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontWeight: 700, letterSpacing: "-0.005em",
        fontSize: 22, marginBottom: 14,
      }}>
        GUARD controls in scope
      </div>

      {incident.if_you_operate_x_then_y && (
        <div style={{
          padding: "10px 12px",
          background: "rgba(245,184,0,0.06)",
          border: "1px solid rgba(245,184,0,0.18)",
          borderRadius: 4, marginBottom: 14,
          fontSize: 11, lineHeight: 1.5,
          fontStyle: "italic", color: "#FFFFFF",
        }}>
          {toText(incident.if_you_operate_x_then_y)}
        </div>
      )}

      <div>
        {rows.map((r, i) => {
          const fc = fitColor(r.fit);
          const rowDelay = 150 + i * 70;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "28px 100px 1fr 76px",
              gap: 12,
              // Generous vertical breathing room (demo has ~14px padding
              // top/bottom per row). No top border — let whitespace separate
              // rows so the visual rhythm comes from gaps not lines.
              padding: "12px 0",
              alignItems: "center",
              opacity: 0,
              animation: `rowIn 400ms cubic-bezier(0.4,0,0.2,1) ${rowDelay}ms forwards`,
            }}>
              {/* Row number — large gold mono, vertically centred with the
                  longest line of the statement */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                fontWeight: 600, color: "#F5B800", lineHeight: 1.4,
                alignSelf: "center",
              }}>{String(i + 1).padStart(2, "0")}</span>
              {/* Control ID — vertically centred */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                color: "#FFFFFF", fontWeight: 500,
                wordBreak: "break-word", overflowWrap: "anywhere",
                lineHeight: 1.4, alignSelf: "center",
              }}>{toText(r.id)}</span>
              {/* Statement text — full text, allowed to wrap naturally.
                  Vertically centred so single-line and multi-line both look
                  good alongside the row number and pills. */}
              <span style={{
                fontSize: 11.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5,
                wordBreak: "break-word",
                alignSelf: "center",
              }}>{toText(r.text)}</span>
              {/* Right column: kind tag + fit pill stacked, vertically
                  centred against the statement. Pills are solid demo-style
                  blocks with no outline. */}
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                alignItems: "flex-end", alignSelf: "center",
              }}>
                <span style={kindStyle(r.kindTone)}>{r.kindLabel}</span>
                {r.fit && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 3,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase",
                    textAlign: "center", color: "#1A1A1A", border: "none",
                    background: fc || "rgba(255,255,255,0.35)",
                    whiteSpace: "nowrap",
                  }}>{r.fit}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ───── 5. HISTORICAL ANALOGUES ─────
function HistoricalBody({ items }) {
  return (
    <>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 14,
      }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.005em" }}>
          Has this happened before?
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: "rgba(255,255,255,0.4)",
        }}>{items.length} {items.length === 1 ? "event" : "events"}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.slice(0, 4).map((h, i) => {
          const rowDelay = 150 + i * 80;
          return (
            <div key={i} style={{
              padding: "10px 12px",
              background: "rgba(36,36,36,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #F5B800",
              borderRadius: 6,
              opacity: 0,
              animation: `rowInLeft 400ms cubic-bezier(0.4,0,0.2,1) ${rowDelay}ms forwards`,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", gap: 8, marginBottom: 4,
              }}>
                <span style={{
                  fontWeight: 700, letterSpacing: "-0.01em",
                  fontSize: 13, color: "#FFFFFF", lineHeight: 1.2,
                }}>{toText(h.event_name || h.event || h.name || "—")}</span>
                {h.year && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                    color: "#F5B800", flexShrink: 0, fontWeight: 600,
                  }}>{toText(h.year)}</span>
                )}
              </div>
              {h.entity && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                  color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em",
                  marginBottom: 5, textTransform: "uppercase",
                }}>{toText(h.entity)}</div>
              )}
              {h.parallel && (
                <div style={{
                  fontSize: 10.5, color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.45, fontStyle: "italic",
                  marginBottom: h.outcome ? 6 : 0,
                }}>{toText(h.parallel)}</div>
              )}
              {h.outcome && (
                <div style={{
                  fontSize: 10.5, color: "#FFFFFF", lineHeight: 1.45,
                  paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                    color: "#F5B800", letterSpacing: "0.12em", textTransform: "uppercase",
                    marginRight: 6, fontWeight: 600,
                  }}>Outcome</span>
                  {toText(h.outcome)}
                </div>
              )}
            </div>
          );
        })}
        {items.length > 4 && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: "rgba(255,255,255,0.4)", textAlign: "center", fontStyle: "italic",
          }}>+ {items.length - 4} more analogues</div>
        )}
      </div>
    </>
  );
}

// ───── 6. VENDOR MARKETPLACE ─────
function VendorBody({ vendors }) {
  return (
    <>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 12,
      }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.005em" }}>
          Who can help.
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: "rgba(255,255,255,0.4)",
        }}>{vendors.length}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {vendors.slice(0, 16).map((v, i) => {
          const rowDelay = 150 + i * 40;
          const name = typeof v === "string" ? v : (v.name || v.label || toText(v));
          return (
            <span key={i} style={{
              padding: "4px 10px",
              fontSize: 10,
              background: "rgba(36,36,36,0.7)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(245,184,0,0.18)",
              borderRadius: 3,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em",
              opacity: 0,
              animation: `rowIn 400ms cubic-bezier(0.4,0,0.2,1) ${rowDelay}ms forwards`,
            }}>{toText(name)}</span>
          );
        })}
        {vendors.length > 16 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "rgba(255,255,255,0.4)", padding: "4px 10px",
            fontStyle: "italic",
          }}>+ {vendors.length - 16} more</span>
        )}
      </div>
    </>
  );
}

// ───── 7. OUTREACH HOOKS ─────
// Strategic engagement intelligence — each card answers
// "what should we say or do about this exposed entity, right now?"
//
// Reads like an analyst-authored brief: entity name as hero, severity
// + ring context anchoring beneath, exposure bar as visual signal,
// operational narrative as the body, single strategic verb as the
// closing action line.
//
// Rules:
//   1. Entity name is the visual lead (Inter 16px bold)
//   2. CTAs are strategic verbs (SIMULATE, MODEL, BRIEF) — never the
//      raw product name. Buyers see operational intent, not product
//      pitch. The product is the means; the strategic action is the
//      headline.
//   3. The narrative is the heart. impact_rationale +
//      recommended_action_for_them are joined into one operational
//      brief — real analyst-written prose, never generated labels.
//   4. No product icons, no "Via Wargaming.ai", no progress-bar
//      labels that scream "data". Just signal.
//   5. Top 3 cards. Restraint is the point.
//
// Source field mapping (real fields, not placeholder hook_* labels):
//   impact_rationale            → the WHY ("Directly owns the
//                                  rulemaking docket and registrant
//                                  disclosure review workstream")
//   recommended_action_for_them → the WHAT + WHEN ("Convene
//                                  cross-divisional working group to
//                                  redraft staff comment guidance
//                                  within 30 days")
//   reason                      → legacy alias for impact_rationale
//   hook_product                → mapped to strategic verb via
//                                  PRODUCT_TO_VERB (the only hook_*
//                                  field still used)
//
// Why we don't use hook_scenario_seed or hook_cta_label: those fields
// currently contain noun-phrase topic labels generated by the
// pipeline (e.g. "SEC Corp Finance comment review gap") rather than
// analyst prose. The two real fields above carry the actual
// operational sentences the analyst wrote.

// Strategic verb mapping — abstracts product-specific pitch ("Run
// IndiGo cascade disruption sim") into operational intelligence
// language ("MODEL CASCADE EXPOSURE"). The buyer reads strategic
// action; the system handles which product fires.
const PRODUCT_TO_VERB = {
  wargaming_sim:          "SIMULATE CASCADE EXPOSURE",
  apple_supply:           "MODEL SUPPLY-CHAIN EXPOSURE",
  greyteaming:            "STAGE STAKEHOLDER SIMULATION",
  fdri_watchlist:         "MONITOR REGULATORY EXPOSURE",
  attacked_brief:         "PREPARE INTELLIGENCE BRIEF",
  replaceable_workforce:  "MODEL WORKFORCE EXPOSURE",
};

function OutreachBody({ channels }) {
  // Flatten every hook-bearing entity across rings. Each entry
  // surfaces the operational narrative (scenario_seed), the entity
  // identity (name + sub-id + ring), the severity (impact_score),
  // and the strategic verb (derived from hook_product).
  const hooks = useMemo(() => {
    const out = [];
    channels.forEach(([channelKey, entities], chIdx) => {
      const ch = BLAST_CHANNELS[channelKey];
      const ringLabel = ch ? ch.label.toUpperCase() : channelKey.replace(/_/g, " ").toUpperCase();
      entities.forEach(ent => {
        if (typeof ent !== "object" || ent == null) return;

        // Pull the REAL operational fields, not the placeholder hook_*
        // ones. impact_rationale carries the "why this entity is
        // exposed" sentence (e.g. "Directly owns the rulemaking docket
        // and registrant disclosure review workstream"). The legacy
        // `reason` field is an older alias kept as fallback.
        const rationale = ent.impact_rationale || ent.reason;
        // recommended_action_for_them carries the operational next
        // step with stakeholders and timeframes baked in (e.g.
        // "Convene cross-divisional working group to redraft staff
        // comment guidance within 30 days"). This is the analyst's
        // actual recommendation, not a generated label.
        const recommendedAction = ent.recommended_action_for_them;

        // Hooks_product is still useful — it tells us which Attacked.ai
        // product the strategic verb should map to. Accept either flat
        // or nested shape.
        const nested = ent.attacked_ai_product_hook || {};
        const productKey = ent.hook_product || nested.product;

        // Skip entities without at least one of the two real fields —
        // a card without rationale OR action has nothing operational
        // to communicate. We do NOT use hook_scenario_seed or
        // hook_cta_label as the narrative anymore (they contain
        // pipeline-generated topic labels, not analyst prose).
        if (!rationale && !recommendedAction) return;

        // Compose the narrative from the two real fields. Both
        // present → joined into one operational brief. One present
        // → use it alone. Never invents text; only joins what exists.
        let narrative;
        if (rationale && recommendedAction) {
          // Ensure rationale ends cleanly before appending the action.
          // If rationale already ends with punctuation, just append;
          // otherwise add a period.
          const trimmed = rationale.trim();
          const endsClean = /[.!?]$/.test(trimmed);
          narrative = `${trimmed}${endsClean ? "" : "."} ${recommendedAction.trim()}`;
        } else {
          narrative = (rationale || recommendedAction).trim();
        }

        // Strategic verb — derived from hook_product so the closing
        // action line reads as operational intelligence, not as a
        // product pitch. Falls back to "REVIEW EXPOSURE" if no
        // product mapping exists.
        const strategicVerb = (productKey && PRODUCT_TO_VERB[productKey]) || "REVIEW EXPOSURE";

        out.push({
          name: ent.name || ent.entity || "—",
          // Sub-identifier — ticker / sector / type / country, in
          // priority order. Matches demo's "NYSE: BA" / "Govt of
          // Dubai" / "Aviation hull market" pattern.
          sub: ent.ticker || ent.sector || ent.type || ent.country || null,
          ringIdx: chIdx + 1,
          ringLabel,
          impactScore: typeof ent.impact_score === "number" ? ent.impact_score : null,
          narrative,
          strategicVerb,
        });
      });
    });
    // Highest impact first — most urgent outreach to the top
    out.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
    return out;
  }, [channels]);

  // Severity pill — solid colour, dark text. Same palette as demo
  // and consistent with Blast Radius impact badges so the same
  // entity reads identically across panels.
  function sevPill(score) {
    if (typeof score !== "number") return null;
    if (score >= 5) return { label: "CRITICAL", bg: "#FF3B30" };
    if (score >= 4) return { label: "HIGH",     bg: "#FF6B6B" };
    if (score >= 3) return { label: "MEDIUM",   bg: "#FF8C5A" };
    if (score >= 2) return { label: "LOW",      bg: "#34C759" };
    return { label: "MINIMAL", bg: "rgba(255,255,255,0.30)" };
  }

  if (hooks.length === 0) return null;

  // Top 3 — cinematic restraint, matches demo's "3 / 14" pattern.
  const top = hooks.slice(0, 3);

  return (
    <>
      {/* Count badge — eyebrow lives in scene-panel header. Just the
          "3 / 14" indicator here, right-aligned, quiet. */}
      <div style={{
        display: "flex", justifyContent: "flex-end",
        alignItems: "baseline", marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: "rgba(255,255,255,0.4)",
        }}>{top.length} / {hooks.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((h, i) => {
          const rowDelay = 200 + i * 140;
          const pill = sevPill(h.impactScore);
          const pct = typeof h.impactScore === "number" ? Math.min(100, h.impactScore * 20) : null;
          return (
            <div key={i} style={{
              padding: 13,
              background: "rgba(36,36,36,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #F5B800",
              borderRadius: 6,
              opacity: 0,
              animation: `rowIn 500ms cubic-bezier(0.16,1,0.3,1) ${rowDelay}ms forwards`,
            }}>
              {/* Row 1: entity name (hero) + severity pill.
                  Name takes 16px Inter bold — visual lead position. */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 3, gap: 10,
              }}>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 700,
                  letterSpacing: "-0.01em",
                  fontSize: 16, color: "#FFFFFF", lineHeight: 1.15,
                  flex: 1, minWidth: 0,
                }}>{toText(h.name)}</div>
                {pill && (
                  <span style={{
                    flexShrink: 0,
                    padding: "2px 8px", borderRadius: 3,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                    fontWeight: 600, letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    color: "#1A1A1A", background: pill.bg,
                    alignSelf: "flex-start",
                  }}>{pill.label}</span>
                )}
              </div>

              {/* Row 2: sub-identifier (left) + ring tag (right).
                  Tight 9px mono — institutional metadata, not
                  competing with the name. */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "baseline", marginBottom: 10, gap: 8,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em",
                }}>{h.sub ? toText(h.sub) : ""}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                  color: "#F5B800", letterSpacing: "0.10em",
                  textAlign: "right", fontWeight: 600,
                }}>
                  RING {String(h.ringIdx).padStart(1, "0")} · {h.ringLabel}
                </span>
              </div>

              {/* Row 3: exposure bar — visual signal only, no
                  "%" label that screams "data app". Just a quiet
                  gold bar showing severity weight. */}
              {pct != null && (
                <div style={{
                  height: 3, background: "rgba(255,255,255,0.06)",
                  borderRadius: 2, overflow: "hidden", marginBottom: 11,
                }}>
                  <div style={{
                    height: "100%", background: "#F5B800",
                    borderRadius: 2, width: `${pct}%`,
                    animation: `barFill 800ms cubic-bezier(0.4,0,0.2,1) ${rowDelay + 200}ms both`,
                    ["--bar-w"]: `${pct}%`,
                  }} />
                </div>
              )}

              {/* Row 4: OPERATIONAL NARRATIVE — the heart of the card.
                  Quoted, italic, white, dense. Reads as analyst-authored
                  brief: time-sensitive, business-aware, executive-readable.
                  No bullets, no headers, just the narrative. */}
              {h.narrative && (
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 11,
                  color: "rgba(255,255,255,0.92)", fontStyle: "italic",
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}>
                  &ldquo;{toText(h.narrative)}&rdquo;
                </div>
              )}

              {/* Row 5: STRATEGIC ACTION — a single mono caps line, gold,
                  subtle. Reads as the system's recommended operational
                  next-step. No button styling, no border, no icon. Just
                  the verb. The product is invisible; only the strategic
                  action is named. */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: "#F5B800", letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
                paddingTop: 9,
                borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>
                ▸ {h.strategicVerb}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT DETAIL PANEL (right side, slides in on click)
// ─────────────────────────────────────────────────────────────────────────────
function IncidentPanel({ incident, reporter, viewMode, onClose }) {
  if (!incident) return null;
  const sev = SEVERITY[incident.severity] || SEVERITY[3];
  const cat = CATEGORIES[incident._cat];
  const newsroomMode = viewMode === "newsroom";

  // Accordion state: a Set of currently-expanded section IDs. Multiple
  // sections can be open at once (user decides what to compare). Resets
  // every time the incident changes; auto-opens whichever section has the
  // strongest data signal for the current incident so the user lands on
  // something useful rather than a wall of collapsed headings.
  const [openSections, setOpenSections] = useState(() => new Set());
  useEffect(() => {
    // Auto-open priority — whichever section has the strongest data signal
    // for this incident so the user lands on something useful:
    //   1. "controls"  — the full GUARD Adaptive Controls section (A through F)
    //   2. "blast"     — if blast_radius has entities
    //   3. "sources"   — fallback
    let firstOpen = "sources";
    const hasControls = (
      incident.if_you_operate_x_then_y ||
      incident.severity_rationale ||
      incident.velocity_signal ||
      incident.emerging_risk_signal ||
      (incident.adaptive_objectives?.length > 0) ||
      (incident.adaptive_master_controls?.length > 0) ||
      (incident.adaptive_controls?.length > 0) ||
      (incident.secondary_adaptive_mappings?.length > 0) ||
      (incident.best_practices?.length > 0)
    );
    if (hasControls) {
      firstOpen = "controls";
    } else if (incident.blast_radius && Object.values(incident.blast_radius).some(v => Array.isArray(v) && v.length > 0)) {
      firstOpen = "blast";
    }
    setOpenSections(new Set([firstOpen]));
  }, [incident._id || incident.headline]);

  // Local state for the Classification card's secondary mappings reveal.
  // Resets per incident so each new selection starts collapsed.
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);
  useEffect(() => {
    setSecondaryExpanded(false);
  }, [incident._id || incident.headline]);

  const toggleSection = (id) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div style={{
      position: "fixed",
      top: 72, right: 24, bottom: 24,
      width: "min(440px, 90vw)",
      background: "rgba(26,26,26,0.95)",
      backdropFilter: "blur(20px)",
      border: `1px solid ${BRAND.borderSubtle}`,
      borderRadius: 8,
      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
      overflowY: "auto",
      zIndex: 100,
      padding: "20px 24px 32px 24px",
      fontFamily: "Inter, sans-serif",
      animation: "slideIn 220ms cubic-bezier(0.4,0,0.2,1)",
    }}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      {/* Gold left edge accent */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: BRAND.gold, borderRadius: "8px 0 0 8px" }} />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.08em", background: sev.color + "22", color: sev.color, border: `1px solid ${sev.color}55`, borderRadius: 3 }}>
            SEV {incident.severity} · {sev.label}
          </span>
          {cat && (
            <span style={{ padding: "3px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.08em", background: cat.color + "22", color: cat.color, border: `1px solid ${cat.color}55`, borderRadius: 3 }}>
              {incident._cat} · {cat.label.toUpperCase()}
            </span>
          )}
          {/* Reporter chip — shows which editorial desk owns the incident */}
          {(() => {
            const rep = REPORTER_BADGES[incident.reporter];
            if (!rep && !incident.reporter) return null;
            const color = rep?.color || BRAND.gold;
            const icon = rep?.icon || "◯";
            return (
              <span title={rep?.desk || incident.desk || ""}
                style={{ padding: "3px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.08em", background: color + "22", color: color, border: `1px solid ${color}55`, borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, lineHeight: 1 }}>{icon}</span>
                {(incident.reporter || "—").toUpperCase()}
              </span>
            );
          })()}
        </div>
        <button onClick={onClose}
          title="Close detail panel"
          style={{
            flexShrink: 0,
            background: "rgba(245,184,0,0.08)",
            border: `1px solid ${BRAND.borderGold}`,
            color: BRAND.gold,
            width: 32, height: 32,
            borderRadius: 4, cursor: "pointer",
            fontFamily: "JetBrains Mono, monospace", fontSize: 16,
            lineHeight: 1,
          }}>✕</button>
      </div>

      {/* Headline */}
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 24, color: BRAND.white, lineHeight: 1.25, margin: "0 0 8px 0" }}>
        {incident.headline}
      </h2>

      {/* Reporter byline — desk attribution under headline */}
      {incident.reporter && (
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: BRAND.textMuted, fontStyle: "italic", marginBottom: 12 }}>
          By <span style={{ color: REPORTER_BADGES[incident.reporter]?.color || BRAND.gold, fontStyle: "normal", fontWeight: 600 }}>{incident.reporter}</span>
          {incident.desk && <span> · {incident.desk} Desk</span>}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          CLASSIFICATION CARD — always visible, the panel's anchor.
          Every field rendered comes directly from the incident JSON; nothing
          fabricated. Structure (top → bottom):

            1. Severity strip            ← uses sev.color edge + SEV N + label
                Confidence chip          ← right-aligned (incident.confidence)
            2. Primary classification    ← subcategory code pill + full name
            3. Secondary mappings        ← chips; tap "expand" to reveal each
                                            mapping's full name + why text
            4. Compact meta row          ← event_date · days_to_disclosure ·
                                            location_name (mono one-liner)
            5. Victim + Actor rows       ← entity + sector / threat_actor
            6. Summary prose             ← incident.summary
            7. Financial impact callout  ← if financial_impact_disclosed
            8. CVE chip row              ← if related_cve_ids exists
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        marginBottom: 14,
        background: BRAND.obsidianElevated,
        border: `1px solid ${BRAND.borderSubtle}`,
        borderRadius: 6,
        overflow: "hidden",
      }}>
        {/* ── Top header strip ──
            Severity owns the visual weight; confidence sits opposite as a
            small right-aligned indicator. The whole strip uses the severity
            color as a left edge accent so the card carries the severity
            signal at a glance. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px 10px 12px",
          borderLeft: `3px solid ${sev.color}`,
          background: `linear-gradient(90deg, ${sev.color}10 0%, transparent 60%)`,
          borderBottom: `1px solid ${BRAND.borderSubtle}`,
        }}>
          <span style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 10,
            color: sev.color, letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 700,
          }}>
            SEV {incident.severity} · {sev.label}
          </span>
          <span style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 9,
            color: BRAND.textMuted, letterSpacing: "0.12em",
            textTransform: "uppercase", marginLeft: 4,
          }}>
            Classification
          </span>
          {incident.confidence && (
            <span style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase",
              color: String(incident.confidence).toLowerCase() === "high" ? "#34C759"
                   : String(incident.confidence).toLowerCase() === "medium" ? BRAND.gold
                   : BRAND.textSecondary,
              border: `1px solid ${
                String(incident.confidence).toLowerCase() === "high" ? "#34C75944"
              : String(incident.confidence).toLowerCase() === "medium" ? BRAND.gold + "44"
              : BRAND.borderSubtle}`,
              borderRadius: 2,
            }}>
              {incident.confidence} conf
            </span>
          )}
        </div>

        {/* ── Card body — primary + secondary + meta ── */}
        <div style={{ padding: "14px 16px 0 16px" }}>
          {/* Primary classification — code pill + full name */}
          {(incident.primary_subcategory_code || incident.primary_subcategory_name) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {incident.primary_subcategory_code && (
                <span style={{
                  padding: "3px 8px",
                  fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.06em",
                  background: (cat?.color || BRAND.gold) + "22",
                  color: cat?.color || BRAND.gold,
                  border: `1px solid ${(cat?.color || BRAND.gold)}55`,
                  borderRadius: 3,
                }}>
                  {incident.primary_subcategory_code}
                </span>
              )}
              {incident.primary_subcategory_name && (
                <span style={{ fontSize: 12, color: BRAND.white, fontWeight: 500 }}>
                  {incident.primary_subcategory_name}
                </span>
              )}
            </div>
          )}

          {/* Secondary mappings — chips with optional expand for full detail */}
          {Array.isArray(incident.secondary_mappings) && incident.secondary_mappings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 4,
                }}>
                  Also:
                </span>
                {incident.secondary_mappings.map((m, i) => {
                  const mc = CATEGORIES[m.category];
                  const mcColor = mc?.color || BRAND.textSecondary;
                  return (
                    <span key={i}
                      title={m.why || m.subcategory_name || ""}
                      style={{
                        padding: "2px 7px",
                        fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 500,
                        letterSpacing: "0.06em",
                        background: mcColor + "15",
                        color: mcColor,
                        border: `1px solid ${mcColor}44`,
                        borderRadius: 3,
                      }}>
                      {m.subcategory_code || m.category}
                    </span>
                  );
                })}
                {/* Expand toggle — only shows if any mapping has a name or why */}
                {incident.secondary_mappings.some(m => m.subcategory_name || m.why) && (
                  <button
                    onClick={() => setSecondaryExpanded(v => !v)}
                    style={{
                      marginLeft: 4,
                      padding: "2px 7px",
                      fontFamily: "JetBrains Mono, monospace", fontSize: 8,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: BRAND.gold,
                      background: "transparent",
                      border: `1px solid ${BRAND.gold}55`,
                      borderRadius: 3,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}>
                    {secondaryExpanded ? "− hide" : "+ details"}
                  </button>
                )}
              </div>
              {/* Expanded rows — full subcategory name + why for each mapping */}
              {secondaryExpanded && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.secondary_mappings.map((m, i) => {
                    const mc = CATEGORIES[m.category];
                    const mcColor = mc?.color || BRAND.textSecondary;
                    return (
                      <div key={i} style={{
                        padding: "8px 10px",
                        background: BRAND.obsidian,
                        borderRadius: 3,
                        borderLeft: `2px solid ${mcColor}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: m.why ? 4 : 0, flexWrap: "wrap" }}>
                          <span style={{
                            fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                            color: mcColor, fontWeight: 600, letterSpacing: "0.06em",
                          }}>
                            {m.subcategory_code || m.category}
                          </span>
                          {m.subcategory_name && (
                            <span style={{ fontSize: 11, color: BRAND.white, fontWeight: 500 }}>
                              {m.subcategory_name}
                            </span>
                          )}
                        </div>
                        {m.why && (
                          <div style={{ fontSize: 11, color: BRAND.textSecondary, lineHeight: 1.45, fontStyle: "italic" }}>
                            {m.why}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Compact meta row — event_date · disclosure gap · location.
              Single mono one-liner. Only renders parts that exist. */}
          {(() => {
            const parts = [];
            if (incident.event_date) parts.push(incident.event_date);
            // days_to_disclosure: integer; render only when meaningfully > 0
            if (typeof incident.days_to_disclosure === "number" && incident.days_to_disclosure > 0) {
              const d = incident.days_to_disclosure;
              parts.push(`disclosed ${d}d later`);
            } else if (typeof incident.days_to_disclosure === "number" && incident.days_to_disclosure === 0) {
              parts.push("disclosed same-day");
            }
            const loc = incident.location_name || incident.country;
            if (loc) parts.push(loc);
            if (parts.length === 0) return null;
            return (
              <div style={{
                marginBottom: 12,
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: BRAND.textSecondary, letterSpacing: "0.04em",
                lineHeight: 1.5,
              }}>
                {parts.join(" · ")}
              </div>
            );
          })()}
        </div>

        {/* ── Victim + Threat actor zone ── */}
        {(incident.entity || incident.threat_actor) && (
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${BRAND.borderSubtle}`,
          }}>
            {incident.entity && (
              <div style={{ marginBottom: incident.threat_actor ? 8 : 0, display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  minWidth: 56, flexShrink: 0,
                }}>
                  Victim
                </span>
                <span style={{ fontSize: 12, color: BRAND.white, fontWeight: 500, lineHeight: 1.4 }}>
                  {incident.entity}
                  {incident.sector && (
                    <span style={{ color: BRAND.textMuted, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      · {incident.sector}
                    </span>
                  )}
                </span>
              </div>
            )}
            {incident.threat_actor && (
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  minWidth: 56, flexShrink: 0,
                }}>
                  Actor
                </span>
                <span style={{ fontSize: 12, color: BRAND.white, fontWeight: 500, lineHeight: 1.4 }}>
                  {typeof incident.threat_actor === "string"
                    ? incident.threat_actor
                    : (incident.threat_actor.name || JSON.stringify(incident.threat_actor))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Summary prose ── */}
        {incident.summary && (
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${BRAND.borderSubtle}`,
            fontSize: 13, color: BRAND.white, lineHeight: 1.55,
          }}>
            {incident.summary}
          </div>
        )}

        {/* ── Financial impact + CVE row (when present) ── */}
        {(incident.financial_impact_disclosed || (Array.isArray(incident.related_cve_ids) && incident.related_cve_ids.length > 0)) && (
          <div style={{
            padding: "12px 16px",
            borderTop: `1px solid ${BRAND.borderSubtle}`,
          }}>
            {incident.financial_impact_disclosed && (
              <div style={{
                padding: "9px 12px",
                background: BRAND.goldTint,
                borderLeft: `2px solid ${BRAND.gold}`,
                borderRadius: "0 3px 3px 0",
                marginBottom: (Array.isArray(incident.related_cve_ids) && incident.related_cve_ids.length > 0) ? 10 : 0,
              }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3, fontWeight: 600 }}>
                  Financial Impact
                </div>
                <div style={{ fontSize: 12, color: BRAND.white, lineHeight: 1.45 }}>
                  {incident.financial_impact_disclosed}
                </div>
              </div>
            )}
            {Array.isArray(incident.related_cve_ids) && incident.related_cve_ids.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginRight: 4,
                }}>
                  CVE:
                </span>
                {incident.related_cve_ids.map((cveId, i) => (
                  <a key={i}
                    href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      padding: "2px 7px",
                      fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600,
                      letterSpacing: "0.04em",
                      background: BRAND.obsidian,
                      color: BRAND.gold,
                      border: `1px solid ${BRAND.borderGold}`,
                      borderRadius: 3,
                      textDecoration: "none",
                    }}>
                    {cveId}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>






      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — BLAST RADIUS
          Collapsed by default unless auto-opened (when this is the strongest
          data signal). Header is the tap target. Body shows when open.
          Returns null entirely if no blast_radius data exists.
          ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const id = "blast";
        const channels = incident.blast_radius
          ? Object.entries(incident.blast_radius).filter(([, v]) => Array.isArray(v) && v.length > 0)
          : [];
        if (channels.length === 0) return null;
        const totalEntities = channels.reduce((acc, [, ents]) => acc + ents.length, 0);
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button
              onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Blast Radius
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>
                {totalEntities} accounts · {channels.length} rings
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px" }}>

      {/* Blast radius summary — opens with a "Who else should care" master
          card showing the big stats (named accounts / ring types / watchlist
          hits), then renders the existing rich per-entity cards beneath. */}
      {incident.blast_radius && (() => {
        const channels = Object.entries(incident.blast_radius).filter(([, v]) => Array.isArray(v) && v.length > 0);
        if (channels.length === 0) return null;
        const totalEntities = channels.reduce((acc, [, ents]) => acc + ents.length, 0);
        const watchlistHits = channels.reduce((acc, [, ents]) => {
          return acc + ents.filter(e => e?.attacked_ai_product_hook).length;
        }, 0);
        return (
          <div style={{ marginBottom: 24 }}>
            {/* "Who else should care" master header card */}
            <div style={{
              padding: "16px 16px 18px 16px", marginBottom: 16,
              background: BRAND.obsidianElevated,
              border: `1px solid ${BRAND.borderSubtle}`,
              borderLeft: `3px solid ${BRAND.gold}`,
              borderRadius: 4,
            }}>
              <div style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.gold,
                letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4,
                fontWeight: 600,
              }}>
                Blast Radius · {incident.entity ? incident.entity.split(' ').slice(0, 3).join(' ') : 'Network'}
              </div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
                fontSize: 22, color: BRAND.white, lineHeight: 1.2, marginBottom: 14,
              }}>
                Who else should care.
              </div>
              {/* Three big stats: named accounts · ring types · watchlist hits */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, color: BRAND.gold, fontWeight: 600, lineHeight: 1 }}>{totalEntities}</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>Named Accounts</div>
                </div>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, color: BRAND.gold, fontWeight: 600, lineHeight: 1 }}>{channels.length}</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>Ring Types</div>
                </div>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 24, color: BRAND.gold, fontWeight: 600, lineHeight: 1 }}>{watchlistHits}</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>Watchlist Hits</div>
                </div>
              </div>
              {/* Numbered ring summary row — like the demo's 01/02/03 layout */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BRAND.borderSubtle}` }}>
                {channels.map(([channel, entities], i) => {
                  const ch = BLAST_CHANNELS[channel];
                  if (!ch) return null;
                  const top3 = entities.slice(0, 3).map(e => (e.name || e.entity || '—').split('(')[0].trim()).join(' · ');
                  const extra = entities.length > 3 ? ` · +${entities.length - 3}` : '';
                  return (
                    <div key={channel} style={{
                      display: 'flex', alignItems: 'baseline', gap: 10,
                      padding: '4px 0', fontSize: 10, lineHeight: 1.4,
                    }}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 600,
                        color: BRAND.textMuted, minWidth: 18,
                      }}>0{i + 1}</span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 600,
                        color: ch.color, letterSpacing: '0.10em', textTransform: 'uppercase',
                        minWidth: 78,
                      }}>{ch.label}</span>
                      <span style={{
                        fontStyle: 'italic', fontSize: 11, color: BRAND.textSecondary,
                        fontFamily: 'Inter, sans-serif', flex: 1,
                      }}>
                        {top3}<span style={{ color: BRAND.gold }}>{extra}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full per-entity rich cards (collapsible label) */}
            <div style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted,
              letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 2,
            }}>
              Every Named Account
            </div>
            {channels.map(([channel, entities]) => {
              const ch = BLAST_CHANNELS[channel];
              if (!ch) return null;
              return (
                <div key={channel} style={{ marginBottom: 16 }}>
                  {/* Channel header — icon + label + count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${ch.color}33` }}>
                    <span style={{ color: ch.color, fontFamily: "JetBrains Mono, monospace", fontSize: 14, lineHeight: 1 }}>{ch.icon}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: ch.color, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                      {ch.label}
                    </span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, marginLeft: "auto" }}>
                      {entities.length}
                    </span>
                  </div>
                  {/* Per-entity rich cards. Each card surfaces every field that exists
                      in the new (May 2026+) schema; older sweeps with thinner data
                      simply skip the missing fields. */}
                  {entities.map((ent, i) => {
                    const horizon = IMPACT_HORIZONS[ent.impact_horizon];
                    const mechanism = TRANSMISSION_MECHANISMS[ent.transmission_mechanism];
                    const hook = ent.attacked_ai_product_hook;
                    const product = hook && PRODUCT_HOOKS[hook.product];
                    return (
                      <div key={i} style={{
                        padding: "10px 12px",
                        marginBottom: 8,
                        background: BRAND.obsidianElevated,
                        borderLeft: `2px solid ${ch.color}`,
                        borderRadius: 3,
                      }}>
                        {/* Entity name + country + impact badge */}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <div>
                            <div style={{ color: BRAND.white, fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>
                              {ent.name || ent.entity || "—"}
                            </div>
                            {ent.country && (
                              <div style={{ color: BRAND.textMuted, fontSize: 10, marginTop: 2 }}>
                                <span style={{ marginRight: 4 }}>📍</span>{ent.country}
                              </div>
                            )}
                          </div>
                          {typeof ent.impact_score === "number" && (
                            <div style={{
                              flexShrink: 0, alignSelf: "flex-start",
                              padding: "2px 7px", borderRadius: 3,
                              fontFamily: "JetBrains Mono, monospace", fontSize: 9, fontWeight: 600,
                              background: ent.impact_score >= 4 ? "#FF3B3022" : ent.impact_score >= 3 ? "#FF8C5A22" : "#34C75922",
                              color:      ent.impact_score >= 4 ? "#FF6B6B"   : ent.impact_score >= 3 ? "#FF8C5A"   : "#34C759",
                              border: `1px solid ${ent.impact_score >= 4 ? "#FF6B6B55" : ent.impact_score >= 3 ? "#FF8C5A55" : "#34C75955"}`,
                              letterSpacing: "0.08em",
                            }}>
                              IMPACT {ent.impact_score}/5
                            </div>
                          )}
                        </div>
                        {/* Impact rationale (or fallback to reason) */}
                        {(ent.impact_rationale || ent.reason) && (
                          <div style={{ color: BRAND.textSecondary, fontSize: 11, lineHeight: 1.45, marginBottom: 6 }}>
                            {ent.impact_rationale || ent.reason}
                          </div>
                        )}
                        {/* Mechanism + horizon row — small mono tags */}
                        {(mechanism || horizon) && (
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.04em" }}>
                            {mechanism && <span><span style={{ color: ch.color, marginRight: 4 }}>↬</span>{mechanism.label}</span>}
                            {horizon && <span><span style={{ color: BRAND.gold, marginRight: 4 }}>⏱</span>{horizon.label} · {horizon.hint}</span>}
                          </div>
                        )}
                        {/* Recommended action — italic */}
                        {ent.recommended_action_for_them && (
                          <div style={{ marginTop: 6, padding: "6px 8px", background: "rgba(245,184,0,0.05)", borderLeft: `1px solid ${BRAND.borderGold}`, borderRadius: 2 }}>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.gold, letterSpacing: "0.10em", textTransform: "uppercase", marginRight: 6 }}>ACTION</span>
                            <span style={{ color: BRAND.white, fontSize: 11, fontStyle: "italic", lineHeight: 1.45 }}>
                              {ent.recommended_action_for_them}
                            </span>
                          </div>
                        )}
                        {/* Product hook CTA — Attacked.ai cross-product chip */}
                        {product && hook?.cta_label && (
                          <div style={{
                            marginTop: 8, padding: "5px 9px",
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: `${product.color}15`,
                            border: `1px solid ${product.color}44`,
                            borderRadius: 3, cursor: "pointer",
                          }}>
                            <span style={{ color: product.color, fontSize: 12, lineHeight: 1 }}>{product.icon}</span>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: product.color, letterSpacing: "0.08em", fontWeight: 600 }}>
                              {product.label}
                            </span>
                            <span style={{ color: BRAND.textSecondary, fontSize: 10 }}>·</span>
                            <span style={{ color: BRAND.textSecondary, fontSize: 10, fontStyle: "italic" }}>
                              {hook.cta_label}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

              </div>
            )}
          </div>
        );
      })()}{/* end Blast Radius accordion */}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — ADAPTIVE CONTROLS
          ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const id = "controls";
        const objs = Array.isArray(incident.adaptive_objectives) ? incident.adaptive_objectives : [];
        const masters = Array.isArray(incident.adaptive_master_controls) ? incident.adaptive_master_controls : [];
        const acts = Array.isArray(incident.adaptive_controls) ? incident.adaptive_controls : [];
        const mappings = Array.isArray(incident.secondary_adaptive_mappings) ? incident.secondary_adaptive_mappings : [];
        const bps = Array.isArray(incident.best_practices) ? incident.best_practices : [];
        const totalCount = objs.length + masters.length + acts.length;
        // Section renders if any of the nine GUARD Adaptive Controls fields exist
        const hasAny = (
          incident.if_you_operate_x_then_y ||
          incident.severity_rationale ||
          incident.velocity_signal ||
          incident.emerging_risk_signal ||
          totalCount > 0 ||
          mappings.length > 0 ||
          bps.length > 0
        );
        if (!hasAny) return null;
        // Build meta chip summary that reflects what's actually in this section
        const metaParts = [];
        if (totalCount > 0) metaParts.push(`${totalCount} controls`);
        if (mappings.length > 0) metaParts.push(`${mappings.length} cross-map`);
        if (bps.length > 0) metaParts.push(`${bps.length} std`);
        // If only A/B/C signals exist (no D/E/F), surface a generic label
        if (metaParts.length === 0) metaParts.push("guidance");
        const metaLabel = metaParts.join(" · ");
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button
              onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Adaptive Controls
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>
                {metaLabel}
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px" }}>

      {/* ─────────────────────────────────────────────────────────────────
          GUARD ADAPTIVE CONTROLS — full editorial rendering of every field
          the sweep enrichment pipeline produces. Six conceptual sections,
          each rendered only if the underlying data exists. Designed from the
          incident JSON schema (not from any reference design), keeping the
          same mono section-label + gold-edge styling already used across the
          panel so visual language stays consistent.

          Sections (in reading order):
            A. "If you operate X then Y" callout      — incident.if_you_operate_x_then_y
            B. Severity rationale                       — incident.severity_rationale
            C. Velocity + emerging-risk signals         — incident.velocity_signal / .emerging_risk_signal
            D. Three-layer control hierarchy            — adaptive_objectives → adaptive_master_controls → adaptive_controls
            E. Cross-category mappings                  — incident.secondary_adaptive_mappings
            F. Reference standards / best practices     — incident.best_practices
          ──────────────────────────────────────────────────────────────── */}
      {(() => {
        // Renders the full GUARD Adaptive Controls section — all six fields
        // produced by the sweep enrichment pipeline, in reading order:
        //   A. If-this-is-you           — if_you_operate_x_then_y
        //   B. Severity rationale       — severity_rationale
        //   C. Velocity + emerging risk — velocity_signal / emerging_risk_signal
        //   D. Control hierarchy        — adaptive_objectives / master_controls / controls
        //   E. Cross-category mappings  — secondary_adaptive_mappings
        //   F. Reference standards      — best_practices
        const hasAny = (
          incident.if_you_operate_x_then_y ||
          incident.severity_rationale ||
          incident.velocity_signal ||
          incident.emerging_risk_signal ||
          (incident.adaptive_objectives?.length > 0) ||
          (incident.adaptive_master_controls?.length > 0) ||
          (incident.adaptive_controls?.length > 0) ||
          (incident.secondary_adaptive_mappings?.length > 0) ||
          (incident.best_practices?.length > 0)
        );
        if (!hasAny) return null;
        return (
          <div>

            {/* ── A. "If you operate X then Y" callout ─────────────────────
                Highest-signal data point: tells the reader whether *they*
                should care. Gold-edged callout in white prose. */}
            {incident.if_you_operate_x_then_y && (
              <div style={{
                marginBottom: 14, padding: "12px 14px",
                background: BRAND.goldTint,
                borderLeft: `3px solid ${BRAND.gold}`, borderRadius: "0 3px 3px 0",
              }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.gold,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6,
                  fontWeight: 600,
                }}>
                  If This Is You
                </div>
                <div style={{ fontSize: 13, color: BRAND.white, lineHeight: 1.5 }}>
                  {typeof incident.if_you_operate_x_then_y === "string"
                    ? incident.if_you_operate_x_then_y
                    : JSON.stringify(incident.if_you_operate_x_then_y)}
                </div>
              </div>
            )}

            {/* ── B. Severity rationale — italic secondary text ────────── */}
            {incident.severity_rationale && (
              <div style={{ marginBottom: 16, paddingLeft: 12, borderLeft: `2px solid ${BRAND.borderSubtle}` }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                  Severity Rationale
                </div>
                <div style={{ fontSize: 12, color: BRAND.textSecondary, lineHeight: 1.5, fontStyle: "italic" }}>
                  {incident.severity_rationale}
                </div>
              </div>
            )}

            {/* ── C. Velocity + emerging-risk signals (two-column) ────── */}
            {(incident.velocity_signal || incident.emerging_risk_signal) && (() => {
              const v = incident.velocity_signal;
              const e = incident.emerging_risk_signal;
              const trajectoryArrow = { rising: "↑", falling: "↓", steady: "→", flat: "→" };
              return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: (v && e) ? "1fr 1fr" : "1fr",
                  gap: 10, marginBottom: 16,
                }}>
                  {v && typeof v === "object" && (
                    <div style={{ padding: "10px 12px", background: BRAND.obsidian, borderRadius: 3, borderLeft: `2px solid ${BRAND.gold}` }}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                        Velocity Signal
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        {typeof v.count_quarter === "number" && (
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: BRAND.gold, fontWeight: 600, lineHeight: 1 }}>
                            {v.count_quarter}
                          </span>
                        )}
                        {v.trajectory && (
                          <span style={{
                            fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                            color: v.trajectory === "rising" ? "#FF6B35" : v.trajectory === "falling" ? "#34C759" : BRAND.textSecondary,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                          }}>
                            {trajectoryArrow[v.trajectory] || "•"} {v.trajectory}
                          </span>
                        )}
                      </div>
                      {v.pattern && (
                        <div style={{ fontSize: 11, color: BRAND.white, lineHeight: 1.4, fontWeight: 500, marginBottom: 4 }}>
                          {v.pattern}
                        </div>
                      )}
                      {v.brief && (
                        <div style={{ fontSize: 10, color: BRAND.textSecondary, lineHeight: 1.4, fontStyle: "italic" }}>
                          {v.brief}
                        </div>
                      )}
                    </div>
                  )}
                  {e && (
                    <div style={{ padding: "10px 12px", background: BRAND.obsidian, borderRadius: 3, borderLeft: `2px solid #FF8C5A` }}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#FF8C5A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                        Emerging Risk
                      </div>
                      <div style={{ fontSize: 11, color: BRAND.white, lineHeight: 1.5 }}>
                        {typeof e === "string" ? e : JSON.stringify(e)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── D. Three-layer control hierarchy ──────────────────────
                Objectives → Master Controls → Recommended Actions, each as
                a labelled subsection. Full statement text — no truncation. */}
            {Array.isArray(incident.adaptive_objectives) && incident.adaptive_objectives.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.gold,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                  fontWeight: 600,
                }}>
                  Control Objectives · {incident.adaptive_objectives.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.adaptive_objectives.map((o, i) => (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: BRAND.obsidianElevated,
                      borderRadius: 3,
                      borderLeft: `2px solid ${BRAND.gold}`,
                    }}>
                      <div style={{
                        fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold,
                        letterSpacing: "0.04em", marginBottom: 5, fontWeight: 600,
                      }}>
                        {o.id || `CO-${i + 1}`}
                      </div>
                      <div style={{ fontSize: 12, color: BRAND.white, lineHeight: 1.5 }}>
                        {o.statement || o.description || (typeof o === "string" ? o : "")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(incident.adaptive_master_controls) && incident.adaptive_master_controls.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.goldDim,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                  fontWeight: 600,
                }}>
                  Master Controls · {incident.adaptive_master_controls.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.adaptive_master_controls.map((c, i) => (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: BRAND.obsidianElevated,
                      borderRadius: 3,
                      borderLeft: `2px solid ${BRAND.goldDim}`,
                      marginLeft: 12, // indented to show implementation of objectives
                    }}>
                      <div style={{
                        fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.goldDim,
                        letterSpacing: "0.04em", marginBottom: 5, fontWeight: 600,
                      }}>
                        {c.id || `AC-${i + 1}`}
                      </div>
                      <div style={{ fontSize: 12, color: BRAND.white, lineHeight: 1.5 }}>
                        {c.statement || c.description || (typeof c === "string" ? c : "")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(incident.adaptive_controls) && incident.adaptive_controls.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textSecondary,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                  fontWeight: 600,
                }}>
                  Recommended Actions · {incident.adaptive_controls.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.adaptive_controls.map((a, i) => (
                    <div key={i} style={{
                      padding: "8px 12px",
                      background: BRAND.obsidian,
                      borderRadius: 3,
                      border: `1px solid ${BRAND.borderSubtle}`,
                      display: "flex", gap: 10,
                    }}>
                      <span style={{
                        fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold,
                        flexShrink: 0, paddingTop: 1, fontWeight: 600,
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 12, color: BRAND.textSecondary, lineHeight: 1.5 }}>
                        {typeof a === "string" ? a : (a.statement || a.description || "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── E. Cross-category mappings ─────────────────────────────
                Each secondary mapping shows its category code and the
                objective/master-control IDs it triggers there. Tight rows. */}
            {Array.isArray(incident.secondary_adaptive_mappings) && incident.secondary_adaptive_mappings.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                  fontWeight: 600,
                }}>
                  Cross-Category Mappings · {incident.secondary_adaptive_mappings.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.secondary_adaptive_mappings.map((m, i) => {
                    const cat = CATEGORIES[m.category];
                    const catColor = cat?.color || BRAND.textSecondary;
                    return (
                      <div key={i} style={{
                        padding: "8px 12px",
                        background: BRAND.obsidian,
                        borderRadius: 3,
                        border: `1px solid ${BRAND.borderSubtle}`,
                        borderLeft: `2px solid ${catColor}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{
                            padding: "2px 6px", borderRadius: 2,
                            fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                            fontWeight: 600, letterSpacing: "0.08em",
                            background: catColor + "22", color: catColor,
                            border: `1px solid ${catColor}55`,
                          }}>
                            {m.subcategory_code || m.category}
                          </span>
                          {cat && (
                            <span style={{ fontSize: 11, color: BRAND.textSecondary }}>
                              {cat.label}
                            </span>
                          )}
                        </div>
                        {/* Show triggered IDs from this secondary mapping */}
                        {(Array.isArray(m.objective_ids) && m.objective_ids.length > 0) && (
                          <div style={{ marginBottom: 4 }}>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", marginRight: 6 }}>
                              Objectives:
                            </span>
                            {m.objective_ids.map((id, j) => (
                              <span key={j} style={{
                                display: "inline-block", marginRight: 4, marginBottom: 2,
                                padding: "2px 5px", fontSize: 9,
                                fontFamily: "JetBrains Mono, monospace", color: BRAND.gold,
                                background: BRAND.obsidianElevated,
                                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
                              }}>{id}</span>
                            ))}
                          </div>
                        )}
                        {(Array.isArray(m.master_control_ids) && m.master_control_ids.length > 0) && (
                          <div>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", marginRight: 6 }}>
                              Controls:
                            </span>
                            {m.master_control_ids.map((id, j) => (
                              <span key={j} style={{
                                display: "inline-block", marginRight: 4, marginBottom: 2,
                                padding: "2px 5px", fontSize: 9,
                                fontFamily: "JetBrains Mono, monospace", color: BRAND.goldDim,
                                background: BRAND.obsidianElevated,
                                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
                              }}>{id}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── F. Reference standards / best practices ────────────────
                ICAO / ISO / NIST / etc. framework references with clause +
                jurisdiction + URL + relevance text. */}
            {Array.isArray(incident.best_practices) && incident.best_practices.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted,
                  letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8,
                  fontWeight: 600,
                }}>
                  Reference Standards · {incident.best_practices.length}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incident.best_practices.map((bp, i) => (
                    <div key={i} style={{
                      padding: "10px 12px",
                      background: BRAND.obsidianElevated,
                      borderRadius: 3,
                      border: `1px solid ${BRAND.borderSubtle}`,
                    }}>
                      {/* Framework badge + version + jurisdiction */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
                        {bp.framework && (
                          <span style={{
                            padding: "2px 7px", borderRadius: 2,
                            fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                            fontWeight: 600, letterSpacing: "0.10em",
                            background: BRAND.gold, color: BRAND.obsidian,
                          }}>
                            {bp.framework}
                          </span>
                        )}
                        {bp.version && (
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.textSecondary }}>
                            {bp.version}
                          </span>
                        )}
                        {bp.jurisdiction && (
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, marginLeft: "auto" }}>
                            {bp.jurisdiction}
                          </span>
                        )}
                      </div>
                      {/* Title (linked if URL exists) */}
                      {bp.title && (
                        <div style={{ marginBottom: 4 }}>
                          {bp.url ? (
                            <a href={bp.url} target="_blank" rel="noreferrer" style={{
                              color: BRAND.white, fontSize: 12, fontWeight: 600,
                              textDecoration: "none", borderBottom: `1px dashed ${BRAND.borderGold}`,
                              lineHeight: 1.4,
                            }}>
                              {bp.title}
                            </a>
                          ) : (
                            <span style={{ color: BRAND.white, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
                              {bp.title}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Clause */}
                      {bp.clause && (
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold, letterSpacing: "0.04em", marginBottom: 4 }}>
                          {bp.clause}
                        </div>
                      )}
                      {/* Relevance — why this standard matters here */}
                      {bp.relevance && (
                        <div style={{ fontSize: 11, color: BRAND.textSecondary, lineHeight: 1.45, fontStyle: "italic" }}>
                          {bp.relevance}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Also-mapped IDs — compact fallback if any mapped_controls or
                mapped_objectives IDs aren't already shown above. */}
            {(() => {
              const shown = new Set();
              (incident.adaptive_master_controls || []).forEach(c => c?.id && shown.add(c.id));
              (incident.adaptive_objectives || []).forEach(o => o?.id && shown.add(o.id));
              (incident.secondary_adaptive_mappings || []).forEach(m => {
                (m.master_control_ids || []).forEach(id => shown.add(id));
                (m.objective_ids || []).forEach(id => shown.add(id));
              });
              const extras = [
                ...(incident.mapped_controls || []),
                ...(incident.mapped_objectives || []),
              ].filter(id => !shown.has(id));
              if (extras.length === 0) return null;
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BRAND.borderSubtle}` }}>
                  <div style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted,
                    letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6,
                  }}>
                    Also Mapped
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {extras.map((id, i) => (
                      <span key={i} style={{
                        padding: "2px 6px", fontSize: 9, fontFamily: "JetBrains Mono, monospace",
                        background: BRAND.obsidian, color: BRAND.goldDim,
                        border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
                        letterSpacing: "0.04em",
                      }}>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

              </div>
            )}
          </div>
        );
      })()}{/* end Adaptive Controls accordion */}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — HISTORICAL ANALOGUES
          ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const id = "history";
        const items = Array.isArray(incident.historical_analogues) ? incident.historical_analogues : [];
        if (items.length === 0) return null;
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button
              onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Historical Analogues
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>
                {items.length} {items.length === 1 ? "event" : "events"}
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((h, i) => (
                  <div key={i} style={{
                    padding: "10px 12px",
                    background: BRAND.obsidian,
                    border: `1px solid ${BRAND.borderSubtle}`,
                    borderRadius: 3,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: BRAND.white, fontWeight: 600 }}>
                        {h.event_name || h.event || h.name || "—"}
                      </span>
                      {h.year && (
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold, flexShrink: 0 }}>
                          {h.year}
                        </span>
                      )}
                    </div>
                    {h.entity && (
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.04em", marginBottom: 5 }}>
                        {h.entity}
                      </div>
                    )}
                    {h.parallel && (
                      <div style={{ fontSize: 11, color: BRAND.textSecondary, lineHeight: 1.45, marginBottom: h.outcome ? 6 : 0 }}>
                        {h.parallel}
                      </div>
                    )}
                    {h.outcome && (
                      <div style={{
                        fontSize: 11, color: BRAND.white, lineHeight: 1.45,
                        paddingTop: 6, borderTop: `1px solid ${BRAND.borderSubtle}`,
                        fontStyle: "italic",
                      }}>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.gold, letterSpacing: "0.12em", textTransform: "uppercase", marginRight: 6, fontStyle: "normal" }}>
                          Outcome
                        </span>
                        {h.outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — SOURCES
          ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const id = "sources";
        const items = Array.isArray(incident.sources) ? incident.sources : [];
        if (items.length === 0) return null;
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button
              onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left",
                fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Sources
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>
                {items.length} cited
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <ul style={{ margin: 0, padding: "0 16px 16px 16px", listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((s, i) => (
                  <li key={i} style={{ fontSize: 11, color: BRAND.textSecondary, padding: "8px 10px", background: BRAND.obsidian, borderRadius: 3, border: `1px solid ${BRAND.borderSubtle}` }}>
                    <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.gold, marginBottom: 3 }}>[S{i + 1}] {s.publisher || "?"}</div>
                    <div style={{ color: BRAND.white, lineHeight: 1.4 }}>{s.title || "—"}</div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer"
                        style={{ color: BRAND.gold, fontSize: 10, textDecoration: "none", wordBreak: "break-all", display: "inline-block", marginTop: 4 }}>
                        {s.url}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — VENDORS (newsroom mode only)
          ═══════════════════════════════════════════════════════════════════ */}
      {newsroomMode && (() => {
        const id = "vendors";
        const items = Array.isArray(incident.vendors) ? incident.vendors : [];
        if (items.length === 0) return null;
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Vendors
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>{items.length}</span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((v, i) => (
                  <span key={i} style={{ padding: "3px 8px", fontSize: 11, background: BRAND.obsidian, color: BRAND.textSecondary, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2 }}>
                    {typeof v === "string" ? v : (v.name || JSON.stringify(v).slice(0, 40))}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — PEER WATCHLIST (newsroom mode only)
          ═══════════════════════════════════════════════════════════════════ */}
      {newsroomMode && (() => {
        const id = "peers";
        const items = Array.isArray(incident.peer_watchlist) ? incident.peer_watchlist : [];
        if (items.length === 0) return null;
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Peer Watchlist
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: BRAND.textMuted, letterSpacing: "0.06em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2,
              }}>{items.length}</span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((p, i) => (
                  <span key={i} style={{ padding: "3px 8px", fontSize: 11, background: BRAND.obsidian, color: BRAND.textSecondary, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2 }}>
                    {typeof p === "string" ? p : (p.name || p.entity || JSON.stringify(p).slice(0, 40))}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════
          ACCORDION SECTION — VERIFICATION (newsroom mode only)
          ═══════════════════════════════════════════════════════════════════ */}
      {newsroomMode && incident._verified !== undefined && (() => {
        const id = "verify";
        const isOpen = openSections.has(id);
        return (
          <div style={{
            marginBottom: 8,
            background: BRAND.obsidianElevated,
            border: `1px solid ${BRAND.borderSubtle}`,
            borderRadius: 6,
            overflow: "hidden",
          }}>
            <button onClick={() => toggleSection(id)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", gap: 10,
                background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                color: isOpen ? BRAND.gold : BRAND.white, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                Verification
              </span>
              <span style={{
                padding: "1px 6px",
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: incident._verified ? "#34C759" : "#FF6B6B",
                letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600,
                border: `1px solid ${incident._verified ? "#34C75955" : "#FF6B6B55"}`, borderRadius: 2,
              }}>
                {incident._verified ? "verified" : "unverified"}
              </span>
              <span style={{
                marginLeft: "auto",
                fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                color: BRAND.gold, lineHeight: 1,
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}>+</span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px 16px", fontSize: 11, color: BRAND.textSecondary }}>
                Status: <strong style={{ color: incident._verified ? "#34C759" : "#FF6B6B" }}>{incident._verified ? "verified" : "unverified"}</strong>
                {incident._verification_confidence && <> · confidence: <strong style={{ color: BRAND.white }}>{incident._verification_confidence}</strong></>}
                {incident._verification_flagged_claims && <> · flagged: <strong style={{ color: BRAND.white }}>{incident._verification_flagged_claims.length}</strong></>}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI OVERLAY — floats top-left of the map
// ─────────────────────────────────────────────────────────────────────────────
function KpiOverlay({ visibleIncidents, totalIncidents }) {
  const stats = useMemo(() => {
    const highSev = visibleIncidents.filter(i => i.severity >= 4).length;
    const countries = new Set(visibleIncidents.map(i => i.country).filter(Boolean));
    const cats = new Set(visibleIncidents.map(i => i._cat));
    return {
      total: visibleIncidents.length,
      filteredOut: totalIncidents - visibleIncidents.length,
      highSev,
      countries: countries.size,
      cats: cats.size,
    };
  }, [visibleIncidents, totalIncidents]);

  return (
    <div style={{
      position: "absolute",
      top: 12,
      left: 12,
      display: "flex",
      gap: 8,
      zIndex: 10,
      pointerEvents: "none",
    }}>
      {[
        { label: "Incidents",      value: stats.total,     sub: stats.filteredOut > 0 ? `+${stats.filteredOut} filtered` : "all visible" },
        { label: "Sev 4 & 5",      value: stats.highSev,   sub: "high + critical" },
        { label: "Countries",      value: stats.countries, sub: "geolocated" },
        { label: "GUARD cats",     value: `${stats.cats}/13`, sub: "categories hit" },
      ].map((k, i) => (
        <div key={i} style={{
          background: "rgba(36,36,36,0.92)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${BRAND.borderSubtle}`,
          borderRadius: 4,
          padding: "8px 14px",
          minWidth: 92,
        }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
            {k.label}
          </div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500, fontSize: 22, color: BRAND.gold, lineHeight: 1 }}>
            {k.value}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: BRAND.textMuted, marginTop: 3 }}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT LIST PANEL — persistent left sidebar with all incidents, click to select
// ─────────────────────────────────────────────────────────────────────────────
function IncidentListPanel({ visibleIncidents, selectedId, onSelect, onHover, hoveredId, reporters, onClose }) {
  // Group by severity, descending
  const grouped = useMemo(() => {
    const buckets = { 5: [], 4: [], 3: [], 2: [], 1: [] };
    for (const inc of visibleIncidents) {
      const sev = inc.severity || 1;
      if (buckets[sev]) buckets[sev].push(inc);
    }
    return buckets;
  }, [visibleIncidents]);

  return (
    <div style={{
      background: "rgba(26,26,26,0.95)",
      backdropFilter: "blur(20px)",
      border: `1px solid ${BRAND.borderSubtle}`,
      borderRadius: 8,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      position: "relative",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {/* Gold edge accent */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: BRAND.gold, borderRadius: "8px 0 0 8px" }} />
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${BRAND.borderSubtle}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>
          ☷ FLEET · <span style={{ color: BRAND.white }}>{visibleIncidents.length}</span>
        </div>
        {onClose && (
          <button onClick={onClose}
            title="Close fleet panel"
            style={{
              width: 24, height: 24, padding: 0,
              background: "transparent", color: BRAND.textSecondary,
              border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3,
              cursor: "pointer", fontFamily: "JetBrains Mono, monospace", fontSize: 13,
              lineHeight: 1,
            }}>
            ×
          </button>
        )}
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
        {[5, 4, 3, 2, 1].map(level => {
          const items = grouped[level];
          if (!items || items.length === 0) return null;
          const sev = SEVERITY[level];
          return (
            <div key={level}>
              <div style={{ padding: "6px 14px 4px 14px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: sev.color, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>
                Sev {level} · {sev.label} · {items.length}
              </div>
              {items.map(inc => {
                const isSel = inc._id === selectedId;
                const isHover = inc._id === hoveredId;
                const cat = CATEGORIES[inc._cat];
                const rep = reporterForCat(inc._cat, reporters);
                return (
                  <div
                    key={inc._id}
                    onClick={() => onSelect(inc._id)}
                    onMouseEnter={() => onHover(inc._id)}
                    onMouseLeave={() => onHover(null)}
                    style={{
                      padding: "8px 14px",
                      borderLeft: isSel ? `3px solid ${sev.color}` : `3px solid transparent`,
                      background: isSel ? BRAND.goldTint : (isHover ? BRAND.obsidianElevated : "transparent"),
                      cursor: "pointer",
                      transition: "background 120ms",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: cat?.color || BRAND.gold, display: "inline-block" }} />
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.textMuted, letterSpacing: "0.06em" }}>
                        {inc._cat} · {inc.country || "—"} · {inc.event_date}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: BRAND.white, lineHeight: 1.3, marginBottom: 3, fontWeight: 500 }}>
                      {inc.headline}
                    </div>
                    {rep && (
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: rep.color, letterSpacing: "0.04em" }}>
                        {rep.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {visibleIncidents.length === 0 && (
          <div style={{ padding: 20, fontSize: 12, color: BRAND.textMuted, textAlign: "center" }}>
            No incidents match active filters.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT DRAWER — full-screen overlay with source-data audit trail table
// ─────────────────────────────────────────────────────────────────────────────
function AuditDrawer({ incidents, onClose }) {
  // Build a source-level audit: each unique source → list of incidents citing it
  const auditRows = useMemo(() => {
    const sourcesMap = new Map(); // url-or-title → { publisher, title, url, citingIncidents: [] }
    for (const inc of incidents) {
      for (const src of (inc.sources || [])) {
        const key = src.url || `${src.publisher || ""}-${src.title || ""}`;
        if (!key) continue;
        let row = sourcesMap.get(key);
        if (!row) {
          row = {
            publisher: src.publisher || "—",
            title: src.title || "—",
            url: src.url || null,
            citingIncidents: [],
          };
          sourcesMap.set(key, row);
        }
        row.citingIncidents.push(inc);
      }
    }
    return Array.from(sourcesMap.values()).sort((a, b) => b.citingIncidents.length - a.citingIncidents.length);
  }, [incidents]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8,8,8,0.92)",
      backdropFilter: "blur(6px)",
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
      animation: "fadeIn 180ms cubic-bezier(0.4,0,0.2,1)",
    }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${BRAND.borderSubtle}` }}>
        <div>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontWeight: 700, fontSize: 28, color: BRAND.white, margin: 0 }}>
            Source-data audit trail
          </h2>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: BRAND.textSecondary, marginTop: 4 }}>
            Every source cited in the sweep · groupable by publisher · click an incident to navigate
          </div>
        </div>
        <button onClick={onClose}
          style={{ padding: "8px 16px", background: BRAND.gold, color: BRAND.obsidian, border: "none", borderRadius: 3, fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.08em", cursor: "pointer", fontWeight: 600 }}>
          CLOSE
        </button>
      </div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 32, padding: "12px 32px", borderBottom: `1px solid ${BRAND.borderSubtle}`, background: BRAND.obsidianDeep, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: BRAND.textSecondary, letterSpacing: "0.04em" }}>
        <div><span style={{ color: BRAND.gold, fontSize: 16, marginRight: 6 }}>{auditRows.length}</span>unique sources</div>
        <div><span style={{ color: BRAND.gold, fontSize: 16, marginRight: 6 }}>{incidents.length}</span>incidents</div>
        <div><span style={{ color: BRAND.gold, fontSize: 16, marginRight: 6 }}>{auditRows.reduce((a, r) => a + r.citingIncidents.length, 0)}</span>citations total</div>
      </div>
      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 32px 32px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, background: BRAND.obsidianDeep, zIndex: 1 }}>
            <tr style={{ borderBottom: `1px solid ${BRAND.borderSubtle}` }}>
              <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Publisher</th>
              <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Title</th>
              <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, width: 100 }}>Citations</th>
              <th style={{ textAlign: "left", padding: "12px 8px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Cited in</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${BRAND.borderSubtle}` }}>
                <td style={{ padding: "10px 8px", color: BRAND.gold, fontFamily: "JetBrains Mono, monospace", fontSize: 11, verticalAlign: "top" }}>
                  {row.publisher}
                </td>
                <td style={{ padding: "10px 8px", color: BRAND.white, verticalAlign: "top", maxWidth: 360 }}>
                  <div style={{ marginBottom: row.url ? 4 : 0 }}>{row.title}</div>
                  {row.url && (
                    <a href={row.url} target="_blank" rel="noreferrer"
                      style={{ color: BRAND.textMuted, fontSize: 10, fontFamily: "JetBrains Mono, monospace", textDecoration: "none", wordBreak: "break-all" }}>
                      {row.url}
                    </a>
                  )}
                </td>
                <td style={{ padding: "10px 8px", color: BRAND.gold, fontFamily: "JetBrains Mono, monospace", fontSize: 14, verticalAlign: "top" }}>
                  {row.citingIncidents.length}
                </td>
                <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {row.citingIncidents.slice(0, 8).map((inc, j) => {
                      const cat = CATEGORIES[inc._cat];
                      const sev = SEVERITY[inc.severity] || SEVERITY[3];
                      return (
                        <span key={j} title={inc.headline}
                          style={{ padding: "2px 7px", fontFamily: "JetBrains Mono, monospace", fontSize: 9, background: BRAND.obsidianElevated, color: cat?.color || BRAND.white, borderLeft: `2px solid ${sev.color}`, borderRadius: 2 }}>
                          {inc._cat}·{inc._idx}
                        </span>
                      );
                    })}
                    {row.citingIncidents.length > 8 && (
                      <span style={{ padding: "2px 6px", fontSize: 10, color: BRAND.textMuted }}>+{row.citingIncidents.length - 8}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditRows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: BRAND.textMuted }}>No sources in the current sweep.</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE PANEL — date-wise list of stored sweeps with click-to-load,
// delete, and persistence-status messaging. Reads from the archive index
// (passed in as a prop) so it renders fast without fetching sweeps.
// ─────────────────────────────────────────────────────────────────────────────
function ArchivePanel({ archiveIndex, currentDate, onLoad, onDelete, onClose, busy, storageSubstrate, storageCanaryError, onRefresh, timeWindow, onWindow, windowInfo }) {
  const persistsAcrossSessions = storageSubstrate === "persistent";
  // Live diagnostics: actual count of stored sweep keys (which may differ
  // from archiveIndex.length if the index is mid-recovery or a write failed)
  const [diag, setDiag] = useState(null);
  const [showDiag, setShowDiag] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await storageDiagnostics();
      if (!cancelled) setDiag(d);
    })();
    return () => { cancelled = true; };
  }, [archiveIndex]);

  // Group entries by month for readability when the archive grows large.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of archiveIndex) {
      const monthKey = e.date.slice(0, 7); // YYYY-MM
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey).push(e);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [archiveIndex]);

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr + "T00:00:00Z");
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    } catch { return dateStr; }
  }
  function formatMonth(ym) {
    try {
      const [y, m] = ym.split("-");
      const d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1));
      return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    } catch { return ym; }
  }

  const orphans = diag ? Math.max(0, diag.storedSweepCount - archiveIndex.length) : 0;

  return (
    <div style={{
      position: "fixed",
      top: 0, right: 0, bottom: 0,
      width: 440,
      background: BRAND.obsidianDeep,
      borderLeft: `1px solid ${BRAND.borderGold}`,
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      boxShadow: "-8px 0 24px rgba(0,0,0,0.6)",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BRAND.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.gold, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>
            ◇ Sweep Archive
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, color: BRAND.white, lineHeight: 1.1 }}>
            {archiveIndex.length} {archiveIndex.length === 1 ? "day" : "days"} stored
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onRefresh}
            title="Re-scan storage for sweeps"
            style={{ width: 32, height: 32, padding: 0, background: "transparent", color: BRAND.gold, fontFamily: "JetBrains Mono, monospace", fontSize: 12, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3, cursor: "pointer" }}>
            ↻
          </button>
          <button onClick={onClose}
            style={{ width: 32, height: 32, padding: 0, background: "transparent", color: BRAND.textSecondary, fontFamily: "JetBrains Mono, monospace", fontSize: 16, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3, cursor: "pointer" }}>
            ×
          </button>
        </div>
      </div>

      {/* Persistence-status banner — colour-coded and expandable to diagnostics */}
      <div style={{
        padding: "12px 20px",
        background: persistsAcrossSessions ? "rgba(52,199,89,0.08)" : "rgba(245,184,0,0.08)",
        borderBottom: `1px solid ${persistsAcrossSessions ? "rgba(52,199,89,0.2)" : "rgba(245,184,0,0.25)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: persistsAcrossSessions ? "#34C759" : "#F5B800", flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textSecondary, letterSpacing: "0.08em", lineHeight: 1.5 }}>
            {persistsAcrossSessions
              ? "PERSISTENT · SWEEPS SURVIVE RELOAD"
              : "SESSION ONLY · DATA WILL BE LOST ON RELOAD"}
          </span>
          <button onClick={() => setShowDiag(s => !s)}
            style={{ padding: "2px 6px", background: "transparent", color: BRAND.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.08em", border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2, cursor: "pointer" }}>
            {showDiag ? "HIDE" : "DIAG"}
          </button>
        </div>
        {/* Inline warning if any orphan sweeps were detected (will be auto-recovered on next list) */}
        {orphans > 0 && (
          <div style={{ marginTop: 8, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "#FF8C5A", letterSpacing: "0.06em" }}>
            ⚠ {orphans} orphan sweep{orphans === 1 ? "" : "s"} detected · click ↻ to recover
          </div>
        )}
        {showDiag && diag && (
          <div style={{ marginTop: 10, padding: 10, background: BRAND.obsidianDeep, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, lineHeight: 1.6 }}>
            <div>substrate · <span style={{ color: persistsAcrossSessions ? "#34C759" : "#F5B800" }}>{diag.substrate}</span></div>
            <div>stored keys · <span style={{ color: BRAND.white }}>{diag.storedSweepCount}</span></div>
            <div>index entries · <span style={{ color: BRAND.white }}>{archiveIndex.length}</span></div>
            {diag.verifiedAt && (
              <div>verified · <span style={{ color: BRAND.textSecondary }}>{new Date(diag.verifiedAt).toLocaleTimeString()}</span></div>
            )}
            {storageCanaryError && (
              <div style={{ marginTop: 4, color: "#FF8C5A", wordBreak: "break-word" }}>error · {storageCanaryError}</div>
            )}
          </div>
        )}
      </div>

      {/* Time-window aggregation toggle — Day / Week / Month / All.
          "Day" renders one archived sweep; the others merge the relevant
          archived days into one rolled-up view (dedupe across days, highest
          severity wins per incident), computed BACKWARD from the anchor date. */}
      {archiveIndex.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BRAND.borderSubtle}` }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            ◇ Time Window {windowInfo && windowInfo.kind !== "day" && windowInfo.days > 0 ? `· merged ${windowInfo.days} day${windowInfo.days === 1 ? "" : "s"}` : ""}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { k: "day", label: "DAY" },
              { k: "week", label: "WEEK" },
              { k: "month", label: "MONTH" },
              { k: "all", label: "ALL" },
            ].map(({ k, label }) => {
              const active = (timeWindow || "day") === k;
              return (
                <button
                  key={k}
                  onClick={() => !busy && onWindow && onWindow(k)}
                  disabled={busy}
                  title={
                    k === "day" ? "Single day — the anchored sweep" :
                    k === "week" ? "Roll up the anchor day + 6 days before it" :
                    k === "month" ? "Roll up the anchor day + ~29 days before it" :
                    "Roll up every archived day"
                  }
                  style={{
                    flex: 1, padding: "7px 0",
                    background: active ? BRAND.gold : "transparent",
                    color: active ? BRAND.obsidian : BRAND.textSecondary,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                    fontWeight: 600, letterSpacing: "0.10em",
                    border: `1px solid ${active ? BRAND.gold : BRAND.borderSubtle}`,
                    borderRadius: 3,
                    cursor: busy ? "wait" : "pointer",
                    transition: "background 120ms, color 120ms, border 120ms",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
          {windowInfo && windowInfo.kind !== "day" && windowInfo.from && (
            <div style={{ marginTop: 8, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.06em", lineHeight: 1.5 }}>
              {windowInfo.from} → {windowInfo.to}
              {windowInfo.requested != null && windowInfo.days !== windowInfo.requested && (
                <span style={{ color: "#FF8C5A" }}> · {windowInfo.requested - windowInfo.days} day(s) unreadable</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {archiveIndex.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: BRAND.textMuted }}>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, color: BRAND.white, marginBottom: 8 }}>No archived sweeps yet</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: BRAND.textSecondary, lineHeight: 1.5 }}>
              Upload a GUARD sweep JSON. It will be stored by its date and listed here automatically. Future uploads accumulate; tomorrow's upload doesn't replace today's.
            </div>
          </div>
        )}
        {groups.map(([monthKey, entries]) => (
          <div key={monthKey} style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
              {formatMonth(monthKey)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map(e => {
                const isCurrent = e.date === currentDate;
                return (
                  <div key={e.date}
                    style={{
                      padding: "10px 12px",
                      background: isCurrent ? BRAND.goldTint : BRAND.obsidianCard,
                      border: `1px solid ${isCurrent ? BRAND.gold : BRAND.borderSubtle}`,
                      borderRadius: 4,
                      cursor: busy ? "wait" : "pointer",
                      opacity: busy ? 0.6 : 1,
                      transition: "background 120ms, border 120ms",
                    }}
                    onClick={() => !busy && !isCurrent && onLoad(e.date)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: isCurrent ? BRAND.gold : BRAND.white, letterSpacing: "0.08em", fontWeight: 600 }}>
                          {e.date}
                        </div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: BRAND.textMuted, marginTop: 2 }}>
                          {formatDate(e.date)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isCurrent && (
                          <span style={{ padding: "2px 6px", fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: BRAND.obsidian, background: BRAND.gold, borderRadius: 2, letterSpacing: "0.08em" }}>
                            CURRENT
                          </span>
                        )}
                        <button
                          onClick={ev => {
                            ev.stopPropagation();
                            if (busy) return;
                            if (window.confirm(`Delete archived sweep for ${e.date}? This cannot be undone.`)) {
                              onDelete(e.date);
                            }
                          }}
                          title={`Delete ${e.date}`}
                          style={{ width: 22, height: 22, padding: 0, background: "transparent", color: BRAND.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 11, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 2, cursor: "pointer" }}>
                          ×
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: BRAND.textSecondary }}>
                      <span><strong style={{ color: BRAND.white }}>{e.incidentCount}</strong> incidents</span>
                      {[5, 4, 3, 2, 1].map(level => e.sevCounts?.[level] > 0 && (
                        <span key={level} style={{ color: SEVERITY[level].color }}>
                          S{level}·{e.sevCounts[level]}
                        </span>
                      ))}
                    </div>
                    {e.fileName && (
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.fileName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${BRAND.borderSubtle}`, fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.08em", lineHeight: 1.55 }}>
        Click any date to render that day's incidents on the map. Re-uploading a JSON for an existing date overwrites it.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function GlobalAttackMap() {
  const [sweep, setSweep] = useState(null);
  const [sweepName, setSweepName] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("buyer"); // "buyer" | "newsroom"

  // Cosmetic role flag from URL — ?role=user hides admin chrome (archive,
  // upload, new-file). Default = admin = everything visible. This is NOT
  // real access control; anyone removing the param sees the full app. Use
  // for demo links until a real backend with auth lands.
  const isUserMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("role") === "user";
    } catch { return false; }
  }, []);
  const [mapMode, setMapMode] = useState("flat");    // "flat" | "globe" — v4
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activeReporters, setActiveReporters] = useState(new Set()); // empty = all
  // Per-category filter — drives the top-left chip strip. Each chip toggles
  // ONE category (CYB, DAT, TEC, …) independently. Previously the chips
  // toggled the whole reporter desk that owned the category, which meant
  // clicking CYB also activated DAT + TEC (both owned by Cyber Bob). This
  // set lets the user select categories one at a time as the chips suggest.
  const [activeCats, setActiveCats] = useState(new Set());
  const [showBlastRadius, setShowBlastRadius] = useState(true);
  const [showHeat, setShowHeat] = useState(false);  // off by default — heat halos compete with the cinematic pin bloom; user can toggle on for analytical density view
  const [showLabels, setShowLabels] = useState(false);  // country + city labels off by default
  // v2 additions
  const [activeSeverities, setActiveSeverities] = useState(new Set()); // empty = all
  const [activeConfidences, setActiveConfidences] = useState(new Set()); // empty = all
  const [showListPanel, setShowListPanel] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  // v3 additions
  const [searchQuery, setSearchQuery] = useState(""); // substring search

  // v4 archive — persistent day-wise storage of uploaded sweeps. The index
  // is loaded once on mount and refreshed whenever a sweep is added or
  // deleted. `currentDate` tracks which date is currently rendered.
  const [archiveIndex, setArchiveIndex] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveToast, setArchiveToast] = useState(null);  // { type, text }
  const [storageSubstrate, setStorageSubstrate] = useState("unknown");  // "persistent" | "session" | "unknown"
  const [storageCanaryError, setStorageCanaryError] = useState(null);
  // Time-window aggregation — "day" (default, single sweep) | "week" |
  // "month" | "all". When not "day", the rendered sweep is a synthetic
  // merge of the relevant archived days (see applyTimeWindow). currentDate
  // still tracks the anchor day the window is computed backward from.
  const [timeWindow, setTimeWindow] = useState("day");
  const [windowInfo, setWindowInfo] = useState(null);  // { kind, from, to, days, requested }

  const { world, err: worldErr } = useWorldGeo();

  // On mount: verify storage works (real write/read round-trip), then load
  // the index (with orphan-recovery). If anything's stored, auto-restore
  // the most recent sweep so reopening the app feels like the session
  // never ended. Errors are surfaced via state for the UI to display
  // rather than swallowed silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await verifyStorage();
        if (cancelled) return;
        setStorageSubstrate(_storageState.substrate);
        setStorageCanaryError(_storageState.canaryError);

        const idx = await readIndex();   // self-healing — discovers orphans
        if (cancelled) return;
        setArchiveIndex(idx);

        if (idx.length > 0) {
          const newest = idx[0]; // sorted desc by date
          const json = await readSweep(newest.date);
          if (cancelled || !json) return;
          setSweep(json);
          setSweepName(newest.fileName || `sweep_${newest.date}.json`);
          setCurrentDate(newest.date);
        }
      } catch (e) {
        console.error("Archive boot failed:", e);
        if (!cancelled) {
          setStorageSubstrate("session");
          setStorageCanaryError(e?.message || String(e));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC key closes the topmost open panel in a sensible priority order:
  // archive > audit > detail panel > filter popover > fleet > selection.
  // World-class apps always let Esc dismiss; this gives the user a reliable
  // exit when click-outside isn't obvious.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (showArchive)       { setShowArchive(false);       return; }
      if (showAuditDrawer)   { setShowAuditDrawer(false);   return; }
      if (selectedId)        { setSelectedId(null);         return; }
      if (showFilterPopover) { setShowFilterPopover(false); return; }
      if (showListPanel)     { setShowListPanel(false);     return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showArchive, showAuditDrawer, selectedId, showFilterPopover, showListPanel]);

  const { incidents, meta } = useMemo(() => parseSweep(sweep), [sweep]);

  const reporters = meta.newsroom || DEFAULT_REPORTERS;

  // Visible incidents after reporter + category + severity + confidence + search filters
  const visibleIncidents = useMemo(() => {
    let filtered = incidents;
    // Per-category filter — top-left chip strip. Empty = all.
    if (activeCats.size > 0) {
      filtered = filtered.filter(inc => activeCats.has(inc._cat));
    }
    // Reporter-desk filter (still used by the Newsroom desk surface). Empty = all.
    if (activeReporters.size > 0) {
      const deskCats = new Set();
      for (const repId of activeReporters) {
        const r = reporters[repId];
        r?.cats?.forEach(c => deskCats.add(c));
      }
      filtered = filtered.filter(inc => deskCats.has(inc._cat));
    }
    // Severity filter (empty = all)
    if (activeSeverities.size > 0) {
      filtered = filtered.filter(inc => activeSeverities.has(inc.severity));
    }
    // Confidence filter (empty = all)
    if (activeConfidences.size > 0) {
      filtered = filtered.filter(inc => activeConfidences.has(inc.confidence));
    }
    // Search filter (v3 — empty = all)
    if (searchQuery && searchQuery.trim()) {
      filtered = filtered.filter(inc => searchMatches(inc, searchQuery));
    }
    return filtered;
  }, [incidents, activeCats, activeReporters, activeSeverities, activeConfidences, searchQuery, reporters]);

  const visibleCats = useMemo(() => new Set(visibleIncidents.map(i => i._cat)), [visibleIncidents]);

  const selectedIncident = useMemo(() => incidents.find(i => i._id === selectedId) || null, [incidents, selectedId]);
  const selectedReporter = useMemo(() => selectedIncident ? reporterForCat(selectedIncident._cat, reporters) : null, [selectedIncident, reporters]);

  // Severity histogram (top-bar stat)
  const sevCounts = useMemo(() => {
    const c = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    visibleIncidents.forEach(i => { if (c[i.severity] !== undefined) c[i.severity]++; });
    return c;
  }, [visibleIncidents]);

  function toggleReporter(repId) {
    setActiveReporters(prev => {
      const n = new Set(prev);
      if (n.has(repId)) n.delete(repId); else n.add(repId);
      return n;
    });
  }

  function loadSweep(json, name) {
    setSweep(json);
    setSweepName(name);
    setError(null);
    setSelectedId(null);
    setHoveredId(null);
    setActiveReporters(new Set());
    setActiveCats(new Set());
    setActiveSeverities(new Set());
    setActiveConfidences(new Set());
    setSearchQuery("");
    setTimeWindow("day");
    setWindowInfo(null);
    // Auto-archive the upload. If the substrate is "session" (verified
    // non-persistent), tell the user clearly — their data WILL be lost on
    // reload and they should know that, not discover it tomorrow.
    (async () => {
      try {
        setArchiveBusy(true);
        const { dateKey, index } = await writeSweep(json, name);
        setCurrentDate(dateKey);
        setArchiveIndex(index);
        if (isPersistent()) {
          setArchiveToast({ type: "saved", text: `✓ Archived ${dateKey} · persists across sessions` });
          setTimeout(() => setArchiveToast(null), 2800);
        } else {
          setArchiveToast({ type: "warn", text: `⚠ Loaded ${dateKey} into session only — storage unavailable` });
          setTimeout(() => setArchiveToast(null), 5000);
        }
      } catch (e) {
        console.error("Sweep archive failed:", e);
        setArchiveToast({ type: "warn", text: `⚠ Save failed: ${e?.message || e}` });
        setTimeout(() => setArchiveToast(null), 5000);
      } finally {
        setArchiveBusy(false);
      }
    })();
  }

  // Load an archived sweep by date — used by the archive panel
  async function loadArchivedSweep(dateKey) {
    try {
      setArchiveBusy(true);
      const json = await readSweep(dateKey);
      if (!json) {
        setArchiveToast({ type: "warn", text: `No sweep stored for ${dateKey}` });
        setTimeout(() => setArchiveToast(null), 3000);
        return;
      }
      const entry = archiveIndex.find(x => x.date === dateKey);
      setSweep(json);
      setSweepName(entry?.fileName || `sweep_${dateKey}.json`);
      setCurrentDate(dateKey);
      setTimeWindow("day");
      setWindowInfo({ kind: "day", from: dateKey, to: dateKey, days: 1, requested: 1 });
      setError(null);
      setSelectedId(null);
      setHoveredId(null);
      setActiveReporters(new Set());
      setActiveCats(new Set());
      setActiveSeverities(new Set());
      setActiveConfidences(new Set());
      setSearchQuery("");
      setShowArchive(false);
    } catch (e) {
      setArchiveToast({ type: "warn", text: `Load failed: ${e.message || e}` });
      setTimeout(() => setArchiveToast(null), 3500);
    } finally {
      setArchiveBusy(false);
    }
  }

  // Delete an archived sweep
  async function removeArchivedSweep(dateKey) {
    try {
      setArchiveBusy(true);
      const idx = await deleteSweep(dateKey);
      setArchiveIndex(idx);
      // If we just deleted the currently-rendered sweep, clear the canvas
      if (currentDate === dateKey) {
        setSweep(null);
        setSweepName(null);
        setCurrentDate(null);
      }
      setArchiveToast({ type: "saved", text: `Removed ${dateKey}` });
      setTimeout(() => setArchiveToast(null), 2400);
    } catch (e) {
      setArchiveToast({ type: "warn", text: `Delete failed: ${e.message || e}` });
      setTimeout(() => setArchiveToast(null), 3500);
    } finally {
      setArchiveBusy(false);
    }
  }

  // Apply a time-window aggregation view. "day" renders a single archived
  // sweep exactly as before (no merge, original code path). "week"/"month"/
  // "all" build a synthetic merged sweep from the relevant archived days and
  // feed it through the same setSweep → parseSweep path, so the map, filters
  // and cascade are untouched.
  //
  // Runs orphan-recovery (readIndex) FIRST so any stray sweep: key in the
  // window is discovered before the rollup — otherwise an orphaned day would
  // silently drop from the merge. Warns if the number of days we could
  // actually READ differs from the number the window expected.
  async function applyTimeWindow(kind) {
    setTimeWindow(kind);
    try {
      setArchiveBusy(true);
      const idx = await readIndex();   // self-healing — discovers orphans
      setArchiveIndex(idx);

      const anchor = currentDate || (idx[0] && idx[0].date) || null;

      if (kind === "day") {
        if (!anchor) { setWindowInfo(null); return; }
        const json = await readSweep(anchor);
        if (!json) {
          setArchiveToast({ type: "warn", text: `No sweep stored for ${anchor}` });
          setTimeout(() => setArchiveToast(null), 3000);
          return;
        }
        const entry = idx.find(x => x.date === anchor);
        setSweep(json);
        setSweepName(entry?.fileName || `sweep_${anchor}.json`);
        setCurrentDate(anchor);
        setSelectedId(null);
        setHoveredId(null);
        setWindowInfo({ kind: "day", from: anchor, to: anchor, days: 1, requested: 1 });
        return;
      }

      const wantDates = datesInWindow(idx, anchor, kind);
      const inputs = [];
      for (const date of wantDates) {
        const json = await readSweep(date);
        if (json) inputs.push({ date, sweep: json });
      }

      const requested = wantDates.length;
      const readable = inputs.length;
      if (requested === 0) {
        setArchiveToast({ type: "warn", text: `No archived days in this ${kind} window` });
        setTimeout(() => setArchiveToast(null), 3200);
        setWindowInfo({ kind, from: null, to: null, days: 0, requested: 0 });
        return;
      }

      const merged = mergeSweeps(inputs);
      setSweep(merged);
      setSweepName(`${kind.toUpperCase()} · ${merged._windowFrom} → ${merged._windowTo} · ${readable} day${readable === 1 ? "" : "s"}`);
      setSelectedId(null);
      setHoveredId(null);
      setWindowInfo({ kind, from: merged._windowFrom, to: merged._windowTo, days: readable, requested });

      if (readable !== requested) {
        setArchiveToast({
          type: "warn",
          text: `⚠ ${kind} rollup: ${readable}/${requested} days readable — ${requested - readable} dropped`,
        });
        setTimeout(() => setArchiveToast(null), 5000);
      } else {
        const totalInc = Object.values(merged.results || {}).reduce((n, c) => n + ((c.incidents || []).length), 0);
        setArchiveToast({ type: "saved", text: `✓ ${kind.toUpperCase()} view · ${readable} days · ${totalInc} unique incidents` });
        setTimeout(() => setArchiveToast(null), 3200);
      }
    } catch (e) {
      console.error("Time-window apply failed:", e);
      setArchiveToast({ type: "warn", text: `⚠ ${kind} view failed: ${e?.message || e}` });
      setTimeout(() => setArchiveToast(null), 4500);
    } finally {
      setArchiveBusy(false);
    }
  }

  function reset() {
    setSweep(null);
    setSweepName(null);
    setError(null);
    setSelectedId(null);
    setHoveredId(null);
    setActiveReporters(new Set());
    setActiveCats(new Set());
    setActiveSeverities(new Set());
    setActiveConfidences(new Set());
    setSearchQuery("");
    setShowAuditDrawer(false);
    setTimeWindow("day");
    setWindowInfo(null);
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: BRAND.obsidianDeep,
      fontFamily: "Inter, sans-serif", color: BRAND.white,
      overflow: "hidden",
    }}>
      <FontLoader />
      <style>{`
        @keyframes attackmap-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>

      {/* ───── 56px GLASS HEADER ───── */}
      <header style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 56,
        padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(8,8,8,0.7)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${BRAND.borderSubtle}`, zIndex: 100,
        gap: 16,
      }}>
        {/* Brand left */}
        <div style={{
          fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 16,
          letterSpacing: "0.02em", whiteSpace: "nowrap",
        }}>
          Attacked<span style={{ color: BRAND.gold }}>.ai</span>
          <span style={{ color: BRAND.textMuted, margin: "0 12px" }}>·</span>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: BRAND.textSecondary, letterSpacing: "0.08em" }}>
            attackmap.ai
          </span>
        </div>

        {/* Centre — viewing date badge */}
        {currentDate && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 4,
            background: "rgba(245,184,0,0.10)", border: `1px solid ${BRAND.borderGold}`,
            fontFamily: "JetBrains Mono, monospace", fontSize: 10,
            letterSpacing: "0.18em", color: BRAND.gold, textTransform: "uppercase",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, background: BRAND.gold,
              animation: "attackmap-pulse 1.6s ease-in-out infinite",
            }} />
            VIEWING · {currentDate}
          </div>
        )}

        {/* Right — archive + new file (admin-only chrome) */}
        {!isUserMode && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowArchive(true)}
              title={`${archiveIndex.length} day${archiveIndex.length === 1 ? "" : "s"} stored`}
              style={{
                padding: "6px 14px",
                background: "transparent", color: BRAND.gold,
                fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em",
                border: `1px solid ${BRAND.borderGold}`, borderRadius: 4,
                cursor: "pointer", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              ◇ ARCHIVE
              {archiveIndex.length > 0 && (
                <span style={{ padding: "1px 5px", background: BRAND.gold, color: BRAND.obsidian, borderRadius: 2, fontSize: 9 }}>
                  {archiveIndex.length}
                </span>
              )}
            </button>
            <button onClick={reset}
              style={{
                padding: "6px 14px",
                background: "transparent", color: BRAND.textSecondary,
                fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em",
                border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
                cursor: "pointer", textTransform: "uppercase",
              }}>
              NEW FILE
            </button>
          </div>
        )}
      </header>

      {/* ───── LANDING when no sweep ───── */}
      {!sweep && (
        <div style={{
          position: "absolute", inset: "56px 0 0 0",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 32, gap: 32,
        }}>
          <div style={{ textAlign: "center", maxWidth: 720 }}>
            <div style={{
              fontFamily: "Cormorant Garamond, serif", fontWeight: 700, fontSize: 64,
              color: BRAND.white, lineHeight: 1.05, marginBottom: 16, letterSpacing: "-0.01em",
            }}>
              A live map of <span style={{ color: BRAND.gold, fontStyle: "italic" }}>corporate harm</span>.
            </div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 16, color: BRAND.textSecondary,
              maxWidth: 640, margin: "0 auto", lineHeight: 1.55,
            }}>
              {isUserMode
                ? "Daily incident intelligence, mapped to the GUARD framework. Today's sweep will appear here once it's published."
                : "Upload a GUARD daily sweep to render every materialised incident — geolocated, severity-ranked, blast-radius traced, source-cited."}
            </div>
          </div>
          {/* Upload zone — admin only */}
          {!isUserMode && <UploadZone onLoad={loadSweep} onError={setError} />}
          {!isUserMode && error && (
            <div style={{
              padding: 12, background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.3)", borderRadius: 4,
              color: "#FF6B6B", fontFamily: "JetBrains Mono, monospace", fontSize: 12,
            }}>
              {error}
            </div>
          )}
          {/* Archive shortcut — admin only */}
          {!isUserMode && archiveIndex.length > 0 && (
            <button onClick={() => setShowArchive(true)}
              style={{
                padding: "10px 18px",
                background: "rgba(36,36,36,0.85)", backdropFilter: "blur(12px)",
                color: BRAND.gold,
                fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.08em",
                border: `1px solid ${BRAND.borderGold}`, borderRadius: 4,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              }}>
              ◇ OPEN ARCHIVE
              <span style={{
                padding: "2px 8px", background: BRAND.gold, color: BRAND.obsidian,
                borderRadius: 2, fontSize: 10,
              }}>
                {archiveIndex.length} {archiveIndex.length === 1 ? "day" : "days"} stored
              </span>
            </button>
          )}
          {/* User-mode waiting indicator — small pulsing badge */}
          {isUserMode && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 18px", borderRadius: 4,
              background: "rgba(245,184,0,0.08)", border: `1px solid ${BRAND.borderGold}`,
              fontFamily: "JetBrains Mono, monospace", fontSize: 11,
              letterSpacing: "0.16em", color: BRAND.gold, textTransform: "uppercase",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: 4, background: BRAND.gold,
                animation: "attackmap-pulse 1.6s ease-in-out infinite",
              }} />
              AWAITING TODAY'S SWEEP
            </div>
          )}
        </div>
      )}

      {/* ───── EMPTY STATE — sweep loaded but no incidents ───── */}
      {sweep && incidents.length === 0 && (
        <div style={{
          position: "absolute", inset: "56px 0 0 0",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 16, padding: 40,
        }}>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: BRAND.white }}>
            No incidents with coordinates
          </div>
          <div style={{ color: BRAND.textSecondary }}>
            The uploaded sweep contained no plottable incidents.
          </div>
        </div>
      )}

      {/* ───── FULL-BLEED STAGE ───── */}
      {sweep && incidents.length > 0 && (
        <div style={{
          position: "absolute", inset: "56px 0 0 0",
          overflow: "hidden",
        }}>
          {/* Map fills entire stage — full-bleed at all times. Cascade
              panels float over the four corners (top-left, top-right,
              bot-left, bot-right) plus the two mid-edges; they do not push
              the globe aside. */}
          <div style={{ position: "absolute", inset: 0 }}>
            {mapMode === "flat" ? (
              <MapCanvas
                world={world}
                visibleIncidents={visibleIncidents}
                viewMode={viewMode}
                hoveredId={hoveredId}
                selectedId={selectedId}
                onHover={setHoveredId}
                onSelect={setSelectedId}
                showBlastRadius={showBlastRadius}
                showHeat={showHeat}
                showLabels={showLabels}
              />
            ) : (
              <GlobeErrorBoundary>
                <GlobeCanvas
                  world={world}
                  visibleIncidents={visibleIncidents}
                  viewMode={viewMode}
                  hoveredId={hoveredId}
                  selectedId={selectedId}
                  onHover={setHoveredId}
                  onSelect={setSelectedId}
                  showBlastRadius={showBlastRadius}
                  showHeat={showHeat}
                  showLabels={showLabels}
                />
              </GlobeErrorBoundary>
            )}
          </div>

          {/* ─── HUD: TOP-LEFT — filter chip strip + MORE ─── */}
          <div style={{
            position: "absolute", top: 20, left: 24,
            display: "flex", gap: 6, flexWrap: "wrap",
            maxWidth: "calc(100% - 320px)",
            zIndex: 20,
          }}>
            {/* CRITICAL+ chip — toggles S4+S5 */}
            {(() => {
              const isActive = activeSeverities.has(4) && activeSeverities.has(5) && activeSeverities.size === 2;
              return (
                <button onClick={() => {
                  if (isActive) {
                    setActiveSeverities(new Set());
                  } else {
                    setActiveSeverities(new Set([4, 5]));
                  }
                }}
                  style={{
                    padding: "5px 12px", borderRadius: 4,
                    background: isActive ? "rgba(245,184,0,0.12)" : "rgba(36,36,36,0.85)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${isActive ? BRAND.borderGold : BRAND.borderSubtle}`,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                    letterSpacing: "0.10em",
                    color: isActive ? BRAND.gold : BRAND.textSecondary,
                    textTransform: "uppercase", cursor: "pointer",
                  }}>
                  CRITICAL+
                </button>
              );
            })()}
            {/* Category chips — one per GUARD category, hiding only the
                ones that have zero incidents in the current data. Users
                need every active category visible on the strip so they can
                filter the map without opening a popover. */}
            {Object.entries(CATEGORIES).map(([code, cat]) => {
              const count = incidents.filter(i => i._cat === code).length;
              if (count === 0) return null;
              const desk = Object.entries(reporters).find(([_, r]) => r.cats?.includes(code));
              const deskName = desk?.[1]?.name;
              const isActive = activeCats.has(code);
              return (
                <button key={code}
                  onClick={() => setActiveCats(prev => {
                    const next = new Set(prev);
                    if (next.has(code)) next.delete(code); else next.add(code);
                    return next;
                  })}
                  title={`${cat.label} · ${count} incident${count === 1 ? "" : "s"}${deskName ? ` · ${deskName}` : ""}`}
                  style={{
                    padding: "5px 12px", borderRadius: 4,
                    background: isActive ? "rgba(245,184,0,0.12)" : "rgba(36,36,36,0.85)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${isActive ? BRAND.borderGold : BRAND.borderSubtle}`,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                    letterSpacing: "0.10em",
                    color: isActive ? BRAND.gold : BRAND.textSecondary,
                    textTransform: "uppercase", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "all 220ms cubic-bezier(0.4,0,0.2,1)",
                  }}>
                  {code}
                  <span style={{ opacity: 0.6, fontSize: 9 }}>{count}</span>
                </button>
              );
            })}
            {/* MORE — opens detailed filter popover */}
            <button onClick={() => setShowFilterPopover(s => !s)}
              style={{
                padding: "5px 12px", borderRadius: 4,
                background: showFilterPopover ? "rgba(245,184,0,0.12)" : "rgba(36,36,36,0.85)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${showFilterPopover ? BRAND.borderGold : BRAND.borderSubtle}`,
                fontFamily: "JetBrains Mono, monospace", fontSize: 10,
                letterSpacing: "0.10em",
                color: showFilterPopover ? BRAND.gold : BRAND.textSecondary,
                textTransform: "uppercase", cursor: "pointer",
              }}>
              ☰ MORE
            </button>
          </div>

          {/* Detailed filter popover — search + full severity + confidence */}
          {showFilterPopover && (
            <div style={{
              position: "absolute", top: 64, left: 24, width: 360,
              padding: 18,
              background: "rgba(26,26,26,0.95)", backdropFilter: "blur(20px)",
              border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              zIndex: 30,
            }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: BRAND.gold, borderRadius: "8px 0 0 8px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.gold, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
                  ◇ DETAILED FILTERS
                </div>
                <button onClick={() => setShowFilterPopover(false)}
                  style={{ width: 22, height: 22, padding: 0, background: "transparent", color: BRAND.textMuted, border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3, cursor: "pointer", fontSize: 12 }}>×</button>
              </div>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 14 }}>
                <span style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                  color: searchQuery ? BRAND.gold : BRAND.textMuted, pointerEvents: "none",
                }}>⌕</span>
                <input
                  type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search incidents…"
                  spellCheck={false}
                  style={{
                    padding: "7px 28px 7px 26px", width: "100%",
                    fontFamily: "Inter, sans-serif", fontSize: 12,
                    background: BRAND.obsidianElevated,
                    color: BRAND.white,
                    border: `1px solid ${searchQuery ? BRAND.borderGold : BRAND.borderSubtle}`,
                    borderRadius: 3, outline: "none",
                  }}
                />
              </div>
              {/* Severity full 5-pill */}
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                SEVERITY
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {[5, 4, 3, 2, 1].map(level => {
                  const isActive = activeSeverities.has(level);
                  const count = incidents.filter(i => i.severity === level).length;
                  if (count === 0) return null;
                  const s = SEVERITY[level];
                  return (
                    <button key={level}
                      onClick={() => setActiveSeverities(prev => {
                        const n = new Set(prev);
                        if (n.has(level)) n.delete(level); else n.add(level);
                        return n;
                      })}
                      style={{
                        padding: "4px 10px",
                        fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.06em",
                        background: isActive ? s.color : "transparent",
                        color: isActive ? BRAND.obsidian : s.color,
                        border: `1px solid ${isActive ? s.color : BRAND.borderSubtle}`,
                        borderRadius: 3, cursor: "pointer", fontWeight: 500,
                      }}>
                      S{level} <span style={{ fontSize: 9, opacity: 0.8, marginLeft: 3 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Confidence */}
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                CONFIDENCE
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {["high", "medium", "low"].map(level => {
                  const isActive = activeConfidences.has(level);
                  const count = incidents.filter(i => i.confidence === level).length;
                  if (count === 0) return null;
                  return (
                    <button key={level}
                      onClick={() => setActiveConfidences(prev => {
                        const n = new Set(prev);
                        if (n.has(level)) n.delete(level); else n.add(level);
                        return n;
                      })}
                      style={{
                        padding: "4px 10px",
                        fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.06em",
                        background: isActive ? BRAND.gold : "transparent",
                        color: isActive ? BRAND.obsidian : BRAND.textSecondary,
                        border: `1px solid ${isActive ? BRAND.gold : BRAND.borderSubtle}`,
                        borderRadius: 3, cursor: "pointer", fontWeight: 500, textTransform: "uppercase",
                      }}>
                      {level} <span style={{ fontSize: 9, opacity: 0.8, marginLeft: 3 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Clear all + fleet/audit buttons */}
              <div style={{ display: "flex", gap: 6, paddingTop: 10, borderTop: `1px solid ${BRAND.borderSubtle}` }}>
                <button onClick={() => {
                    setActiveReporters(new Set());
                    setActiveCats(new Set());
                    setActiveSeverities(new Set());
                    setActiveConfidences(new Set());
                    setSearchQuery("");
                  }}
                  style={{
                    padding: "5px 10px", flex: 1,
                    background: "transparent", color: BRAND.gold,
                    border: `1px solid ${BRAND.borderGold}`, borderRadius: 3,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.08em",
                    cursor: "pointer", textTransform: "uppercase",
                  }}>
                  ✕ CLEAR ALL
                </button>
                <button onClick={() => setShowListPanel(s => !s)}
                  style={{
                    padding: "5px 10px",
                    background: showListPanel ? "rgba(245,184,0,0.12)" : "transparent",
                    color: showListPanel ? BRAND.gold : BRAND.textSecondary,
                    border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.08em",
                    cursor: "pointer", textTransform: "uppercase",
                  }}>
                  ☷ FLEET
                </button>
                <button onClick={() => setShowAuditDrawer(true)}
                  style={{
                    padding: "5px 10px",
                    background: "transparent", color: BRAND.textSecondary,
                    border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.08em",
                    cursor: "pointer", textTransform: "uppercase",
                  }}>
                  ◇ AUDIT
                </button>
              </div>
            </div>
          )}

          {/* ─── HUD: TOP-RIGHT — LIVE counter ─── */}
          <div style={{
            position: "absolute", top: 20, right: 24,
            padding: "14px 18px", minWidth: 200,
            background: "rgba(36,36,36,0.85)", backdropFilter: "blur(12px)",
            border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 6,
            zIndex: 20,
          }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 9,
              letterSpacing: "0.18em", color: BRAND.textMuted, textTransform: "uppercase",
              marginBottom: 6,
            }}>
              LIVE · LAST {meta.lookback_hours || 24}H
            </div>
            <div style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 28, color: BRAND.gold,
              fontWeight: 600, lineHeight: 1,
            }}>
              {visibleIncidents.length}
              {visibleIncidents.length !== incidents.length && (
                <span style={{ fontSize: 14, color: BRAND.textMuted, marginLeft: 6 }}>/ {incidents.length}</span>
              )}
            </div>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 11, color: BRAND.textSecondary,
              fontStyle: "italic", marginTop: 3,
            }}>
              incidents classified
            </div>
            {meta.generated_at && (
              <div style={{
                marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BRAND.borderSubtle}`,
                fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: BRAND.textMuted, letterSpacing: "0.06em",
              }}>
                ENDED {(() => {
                  try {
                    const d = new Date(meta.generated_at);
                    return d.toUTCString().replace(" GMT", " UTC").slice(5);
                  } catch { return meta.generated_at; }
                })()}
              </div>
            )}
          </div>

          {/* ─── HUD: BOTTOM-LEFT — single consolidated control strip ───
              All map controls live in one horizontal glass pill, separated
              into four logical groups by thin vertical dividers:
                1. Severity legend  · 2. Map mode  · 3. View mode  · 4. Layer toggles */}
          <div style={{
            position: "absolute", bottom: 24, left: 24,
            display: "flex", alignItems: "center",
            padding: "6px 8px",
            background: "rgba(36,36,36,0.85)", backdropFilter: "blur(12px)",
            border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
            zIndex: 20,
            gap: 4,
          }}>
            {/* Group 1: Severity legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 10px" }}>
              {[5, 4, 3, 2, 1].map(level => (
                <div key={level} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                  letterSpacing: "0.10em", color: BRAND.textSecondary, textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: SEVERITY[level].color }} />
                  {SEVERITY[level].label}
                </div>
              ))}
            </div>

            {/* Thin vertical divider */}
            <div style={{ width: 1, height: 18, background: BRAND.borderSubtle, margin: "0 2px" }} />

            {/* Group 2: Map mode (flat / globe) — segmented */}
            <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: `1px solid ${BRAND.borderSubtle}` }}>
              {[
                { id: "flat",  label: "▭ FLAT"  },
                { id: "globe", label: "◯ GLOBE" },
              ].map(m => (
                <button key={m.id} onClick={() => setMapMode(m.id)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.10em",
                    background: mapMode === m.id ? BRAND.gold : "transparent",
                    color: mapMode === m.id ? BRAND.obsidian : BRAND.textSecondary,
                    border: "none", cursor: "pointer",
                  }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Thin vertical divider */}
            <div style={{ width: 1, height: 18, background: BRAND.borderSubtle, margin: "0 2px" }} />

            {/* Group 3: View mode (buyer / newsroom) — segmented */}
            <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", border: `1px solid ${BRAND.borderSubtle}` }}>
              {["buyer", "newsroom"].map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{
                    padding: "5px 10px",
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.10em",
                    background: viewMode === m ? BRAND.gold : "transparent",
                    color: viewMode === m ? BRAND.obsidian : BRAND.textSecondary,
                    border: "none", cursor: "pointer", textTransform: "uppercase",
                  }}>
                  {m}
                </button>
              ))}
            </div>

            {/* Thin vertical divider */}
            <div style={{ width: 1, height: 18, background: BRAND.borderSubtle, margin: "0 2px" }} />

            {/* Group 4: Layer toggles — labels / heat / blast */}
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "labels", label: "🅰 LABELS", active: showLabels,       toggle: () => setShowLabels(s => !s) },
                { id: "heat",   label: "◉ HEAT",    active: showHeat,         toggle: () => setShowHeat(h => !h) },
                { id: "blast",  label: "↯ BLAST",   active: showBlastRadius,  toggle: () => setShowBlastRadius(b => !b) },
              ].map(b => (
                <button key={b.id} onClick={b.toggle}
                  style={{
                    padding: "5px 10px",
                    background: b.active ? "rgba(245,184,0,0.12)" : "transparent",
                    color: b.active ? BRAND.gold : BRAND.textMuted,
                    border: `1px solid ${b.active ? BRAND.borderGold : BRAND.borderSubtle}`,
                    borderRadius: 4,
                    fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.10em",
                    cursor: "pointer", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── HUD: BOTTOM-CENTRE — contextual caption ─── */}
          {/* Sits ABOVE the control strip (bottom: 90 vs strip's bottom: 24)
              so the two never overlap. Constrained to centre-only width so
              the strip on the left edge can claim its space without fighting. */}
          <div style={{
            position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
            padding: "8px 18px",
            background: "rgba(8,8,8,0.7)", backdropFilter: "blur(12px)",
            border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
            fontFamily: "Inter, sans-serif", fontSize: 12, color: BRAND.textSecondary,
            maxWidth: 560, textAlign: "center",
            pointerEvents: "none", zIndex: 15,
          }}>
            {(() => {
              if (selectedId) {
                return <>Hover the dots radiating outward — each one is a related entity in the blast radius.</>;
              }
              if (hoveredId) {
                const inc = visibleIncidents.find(i => i._id === hoveredId);
                return <>{inc?.headline ? inc.headline.slice(0, 80) : "Click to open the full GUARD classification."}</>;
              }
              return <>Click any incident to see GUARD classification, blast radius, and adaptive controls.</>;
            })()}
          </div>
        </div>
      )}

      {/* ───── INCIDENT LIST PANEL (slides in from left) ───── */}
      {sweep && showListPanel && (
        <div style={{
          position: "fixed", top: 64, left: 24, bottom: 24, width: 320,
          zIndex: 50,
        }}>
          <IncidentListPanel
            visibleIncidents={visibleIncidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            hoveredId={hoveredId}
            reporters={reporters}
            onClose={() => setShowListPanel(false)}
          />
        </div>
      )}

      {/* Detail panel — cascade of floating cards. key={_id} forces a full
          remount on incident change so the cascade replays from scratch. */}
      {selectedIncident && (
        <IncidentCascade
          key={selectedIncident._id || selectedIncident.headline}
          incident={selectedIncident}
          reporter={selectedReporter}
          viewMode={viewMode}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Audit drawer */}
      {showAuditDrawer && (
        <AuditDrawer
          incidents={incidents}
          onClose={() => setShowAuditDrawer(false)}
        />
      )}

      {/* Archive drawer */}
      {showArchive && (
        <ArchivePanel
          archiveIndex={archiveIndex}
          currentDate={currentDate}
          onLoad={loadArchivedSweep}
          onDelete={removeArchivedSweep}
          onClose={() => setShowArchive(false)}
          busy={archiveBusy}
          storageSubstrate={storageSubstrate}
          storageCanaryError={storageCanaryError}
          timeWindow={timeWindow}
          onWindow={applyTimeWindow}
          windowInfo={windowInfo}
          onRefresh={async () => {
            setArchiveBusy(true);
            try {
              await verifyStorage();
              setStorageSubstrate(_storageState.substrate);
              setStorageCanaryError(_storageState.canaryError);
              const idx = await readIndex();
              setArchiveIndex(idx);
              setArchiveToast({ type: "saved", text: `✓ Re-scanned · ${idx.length} sweep${idx.length === 1 ? "" : "s"} found` });
              setTimeout(() => setArchiveToast(null), 2800);
            } catch (e) {
              setArchiveToast({ type: "warn", text: `⚠ Rescan failed: ${e?.message || e}` });
              setTimeout(() => setArchiveToast(null), 4000);
            } finally {
              setArchiveBusy(false);
            }
          }}
        />
      )}

      {/* Toast */}
      {archiveToast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          padding: "10px 18px",
          background: "rgba(46,46,46,0.95)", backdropFilter: "blur(16px)",
          color: archiveToast.type === "warn" ? "#FF8C5A" : BRAND.gold,
          border: `1px solid ${archiveToast.type === "warn" ? "rgba(255,107,107,0.4)" : BRAND.borderGold}`,
          borderRadius: 4,
          fontFamily: "JetBrains Mono, monospace", fontSize: 11, letterSpacing: "0.08em",
          zIndex: 1001, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {archiveToast.text}
        </div>
      )}

      {worldErr && sweep && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          padding: "8px 12px", background: "rgba(255,107,107,0.08)",
          border: "1px solid rgba(255,107,107,0.25)", borderRadius: 3,
          color: "#FF8C5A", fontFamily: "JetBrains Mono, monospace", fontSize: 10,
          zIndex: 50,
        }}>
          World atlas: {worldErr}
        </div>
      )}
    </div>
  );
}
