// images.js — where an incident's picture comes from, shared by the dashboard
// and the Hub page.
//
// incidentPhoto(i)  — the REAL picture for this incident: the same source the
//                     live map's incident card uses (MapIncidentImage in
//                     GlobalAttackMap.jsx). A hand-made local image for the
//                     incidents we generated pictures for, otherwise an
//                     editorial photo generated from the exact headline. The
//                     URL is byte-identical to the map's so both surfaces show
//                     the same picture and share the generator's cache.
// incidentImage(i)  — a category stock photo. Used as the placeholder while
//                     the real picture loads and as the fallback if it fails.
//
// The local override list mirrors the one in GlobalAttackMap.jsx; keep the
// two in step when adding a picture to public/incidents/.

export const CATEGORY_IMG = {
  CYB: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=900&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=900&q=70&auto=format&fit=crop",
  _default: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=70&auto=format&fit=crop",
};

const ALT_IMG = {
  CYB: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=900&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=900&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1450101499163-c8f4ea0b7e2d?w=900&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=900&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=900&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900&q=70&auto=format&fit=crop",
};

const hash = (v) => { let h = 5381; const s = String(v); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };

// Category stock photo, stable per incident (alternates between two per category).
export function incidentImage(i) {
  const cat = i?.cat || i?.primary_category;
  const primary = CATEGORY_IMG[cat] || CATEGORY_IMG._default;
  const alt = ALT_IMG[cat];
  return alt && hash(i?.id) % 2 ? alt : primary;
}

// The dashboard masthead picture for an industry.
//
// The delivered design puts a full-bleed photograph behind the masthead, with
// a gradient over it. Curating one image per industry would mean 43 hand-picked
// photographs and a gap every time a new industry is added, so it is derived
// instead: the most severe recent incident in that industry supplies the
// picture, which is both relevant and automatic for every customer.
export function industryPhoto(incidents, fallbackCat) {
  const list = Array.isArray(incidents) ? incidents : [];
  const best = [...list].sort((a, b) => (b?.severity || 0) - (a?.severity || 0))[0];
  if (best) return incidentPhoto(best);
  return CATEGORY_IMG[fallbackCat] || CATEGORY_IMG._default;
}

// Hand-made pictures in public/incidents/, keyed by a headline fragment.
// Same list as MapIncidentImage in GlobalAttackMap.jsx.
const LOCAL_BY_HEADLINE = [
  ["Rocket Lab", "/incidents/rocket_lab_iridium_1782896030009.png"],
  ["The Founder-Fused Brand", "/incidents/corporate_reputation_crisis_1782896048377.png"],
  ["EU Anti-Subsidy Duties", "/incidents/eu_chinese_ev_1782896064535.png"],
  ["China's Rare-Earth Valve", "/incidents/rare_earth_valve_1782896707184.png"],
  ["When the Balance Sheet Is the Breach", "/incidents/northvolt_fraud_probe_1782896738561.png"],
  ["Concentration-Risk Ransomware", "/incidents/dealership_ransomware_1782896754530.png"],
  ["The Yield Trap", "/incidents/yield_trap_gigafactory.png"],
  ["BMW–Northvolt", "/incidents/bmw_northvolt_contract.png"],
  ["The Fuse, Not the Shot", "/incidents/pentagon_catl_fuse.png"],
  ["SPAC-Fraud Wells Notice", "/incidents/spac_fraud_faraday.png"],
  ["Regulatory Enforcement Sets a New Recall-Compliance Bar", "/incidents/nhtsa_ford_recall.png"],
  ["Strategic Repricing of a Legacy-OEM EV Program", "/incidents/ford_lightning_scrap.png"],
  ["Cruise Robotaxi Exit", "/incidents/gm_cruise_exit.png"],
  ["First-of-Kind FTC Enforcement", "/incidents/ftc_gm_onstar.png"],
  ["California's First Data-Minimization Strike", "/incidents/california_gm_ccpa.png"],
  ["The Sovereign Cost Reset", "/incidents/sovereign_cost_reset.png"],
  ["When One Country Owns the Valve", "/incidents/drc_cobalt_ban.png"],
  ["Akira's Battery-Supply Gambit", "/incidents/akira_lges_breach.png"],
];

// The real picture for an incident (see header).
//
// Since 2026-09-23 the backend owns the picture: incidents.image_url is filled
// once per incident by the incident-images edge function (generated from the
// whole record, stored in the incident-media bucket) or set by an admin. That
// wins. The hand-made local pictures and the on-the-fly generator URL remain
// only for rows the backfill has not reached yet.
export function incidentPhoto(i) {
  if (i?.image_url) return i.image_url;
  const h = i?.headline || "";
  for (const [needle, src] of LOCAL_BY_HEADLINE) if (h.includes(needle)) return src;
  // No live generator: its free tier now refuses anonymous requests with the
  // options we used (402, 2026-09-30), which left a broken image. The category
  // photo is the fallback until the backend has stored a picture.
  return incidentImage(i);
}
