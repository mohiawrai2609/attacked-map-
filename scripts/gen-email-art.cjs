// gen-email-art.cjs — premium branded email hero banners (SVG → PNG via sharp).
//
// Pure-visual strips (NO baked text) so the wordmark / headlines stay crisp HTML
// and there are no font/logo-break issues. Output → public/ so they ship at
// ${APP_URL}/<name>.png after a Vercel deploy.
//
//   node scripts/gen-email-art.cjs
//
// sharp is installed with --no-save (build-time only, not a runtime dep).
//
// Three banners, one visual language (obsidian + gold, Inter-era brand):
//   • email-hero-digest.png   global threat field — wireframe globe + glowing
//                             incident nodes + great-circle arcs.
//   • email-hero-welcome.png  McKinsey-style editorial hero — baked headline
//                             ("Narrow your blast radius.") on the left, the
//                             blast-radius radar on the right. Segoe UI (≈ Inter)
//                             renders crisp via librsvg; left scrim keeps text
//                             legible. This is the ONLY banner with baked text.
//   • email-hero-auth.png     slim horizon — earth limb at the base with a few
//                             rising signal nodes (signup confirm / magic link).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const GOLD = "#F5B800";
const OUT = path.join(__dirname, "..", "public");

// ── shared defs (gradients + glow filter) ────────────────────────────────────
const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050505"/>
      <stop offset="0.55" stop-color="#0f0f0f"/>
      <stop offset="1" stop-color="#181206"/>
    </linearGradient>
    <radialGradient id="sphere" cx="0.40" cy="0.36" r="0.80">
      <stop offset="0" stop-color="#1f1f1f"/>
      <stop offset="0.55" stop-color="#101010"/>
      <stop offset="1" stop-color="#050505"/>
    </radialGradient>
    <radialGradient id="topglow" cx="0.16" cy="0.10" r="0.7">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="centerglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="leftscrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#050505" stop-opacity="0.97"/>
      <stop offset="0.45" stop-color="#070707" stop-opacity="0.84"/>
      <stop offset="0.74" stop-color="#0a0a0a" stop-opacity="0"/>
    </linearGradient>
    <filter id="blur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="softblur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2"/>
    </filter>
  </defs>`;

// ── geometry helpers ─────────────────────────────────────────────────────────
const rad = (d) => (d * Math.PI) / 180;

// Orthographic projection of a lat/lon onto a sphere (front hemisphere = z>0).
function project(cx, cy, R, latDeg, lonDeg) {
  const lat = rad(latDeg), lon = rad(lonDeg);
  return {
    x: cx + R * Math.cos(lat) * Math.sin(lon),
    y: cy - R * Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lon),
  };
}

function dotGrid(w, h, { step = 30, r = 1.3, color = "rgba(168,168,168,0.08)", pad = 16, maxX = Infinity } = {}) {
  let s = "";
  for (let y = pad; y <= h - pad; y += step) {
    for (let x = pad; x <= Math.min(w - pad, maxX); x += step) {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
    }
  }
  return s;
}

// Glowing node: blurred halo + bright core + thin ring.
function node(x, y, r, bright = 1) {
  return (
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 3.6).toFixed(1)}" fill="${GOLD}" opacity="${(0.18 * bright).toFixed(2)}" filter="url(#blur)"/>` +
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${GOLD}" opacity="${(0.55 + 0.45 * bright).toFixed(2)}"/>` +
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 2).toFixed(1)}" fill="none" stroke="${GOLD}" stroke-width="0.8" opacity="${(0.4 * bright).toFixed(2)}"/>`
  );
}

// Wireframe globe (graticule clipped to the sphere) + lit rim.
function globe(cx, cy, R, clipId) {
  let g = `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#sphere)"/>`;
  g += `<g clip-path="url(#${clipId})">`;
  // meridians (longitude) — ellipses of decreasing width toward the centre line
  for (const lon of [30, 60]) {
    const rx = (R * Math.sin(rad(lon))).toFixed(1);
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${R}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.12"/>`;
  }
  g += `<line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="${GOLD}" stroke-width="1" opacity="0.12"/>`;
  // parallels (latitude)
  for (const lat of [-60, -30, 30, 60]) {
    const yy = (cy - R * Math.sin(rad(lat))).toFixed(1);
    const rx = (R * Math.cos(rad(lat))).toFixed(1);
    g += `<ellipse cx="${cx}" cy="${yy}" rx="${rx}" ry="${(rx * 0.16).toFixed(1)}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.09"/>`;
  }
  // equator (emphasised)
  g += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${(R * 0.16).toFixed(1)}" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity="0.18"/>`;
  g += `</g>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity="0.32"/>`;
  return g;
}

// Great-circle-ish arc between two lat/lon points, bowed away from the centre.
function arc(cx, cy, R, a, b) {
  const p1 = project(cx, cy, R, a[0], a[1]);
  const p2 = project(cx, cy, R, b[0], b[1]);
  if (p1.z <= 0 || p2.z <= 0) return "";
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
  const lift = 46;
  const cxp = mx + (dx / d) * lift, cyp = my + (dy / d) * lift;
  return `<path d="M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cxp.toFixed(1)} ${cyp.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}" fill="none" stroke="${GOLD}" stroke-width="1.1" opacity="0.5" filter="url(#softblur)"/>`;
}

function frame(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}` +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#topglow)"/>` +
    inner +
    `<rect x="0" y="${h - 3}" width="${w}" height="3" fill="${GOLD}" opacity="0.9"/>` +
    `</svg>`;
}

// ── DIGEST: global threat field ──────────────────────────────────────────────
function digestBanner() {
  const w = 1240, h = 340;
  const cx = 950, cy = 150, R = 300;
  const nodes = [[20, -30], [-10, 8], [40, 24], [5, 52], [-28, -14], [34, -58], [55, -4], [-16, 44], [12, -72]];
  const arcs = [[[20, -30], [40, 24]], [[-10, 8], [5, 52]], [[-28, -14], [12, -72]], [[40, 24], [55, -4]], [[-16, 44], [5, 52]]];

  let inner = dotGrid(w, h, { step: 30, r: 1.3, maxX: 560 });
  inner += globe(cx, cy, R, "gd");
  inner += arcs.map(([a, b]) => arc(cx, cy, R, a, b)).join("");
  inner += nodes.map(([la, lo]) => {
    const p = project(cx, cy, R, la, lo);
    return p.z > 0.02 ? node(p.x, p.y, 4 + p.z * 1.6, 0.5 + p.z * 0.5) : "";
  }).join("");
  // a couple of free-floating signal points over the left data field
  inner += node(150, 96, 4) + node(360, 232, 3) + node(250, 150, 2.6);
  return frame(w, h, inner);
}

// ── WELCOME: editorial hero (baked headline left · radar right) ───────────────
function welcomeHero() {
  const w = 1240, h = 440;
  const cx = 970, cy = 212; // radar centre, pushed to the right third
  const rings = [54, 112, 184, 268, 360, 460]
    .map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD}" stroke-width="1.3" opacity="${(0.5 - i * 0.07).toFixed(3)}"/>`)
    .join("");
  // sweep wedge (radar beam) — a pie slice from the centre
  const a0 = rad(-44), a1 = rad(8), Rw = 470;
  const sweep = `<path d="M ${cx} ${cy} L ${(cx + Rw * Math.cos(a0)).toFixed(1)} ${(cy + Rw * Math.sin(a0)).toFixed(1)} A ${Rw} ${Rw} 0 0 1 ${(cx + Rw * Math.cos(a1)).toFixed(1)} ${(cy + Rw * Math.sin(a1)).toFixed(1)} Z" fill="url(#sweep)" opacity="0.9"/>`;
  // peer nodes around the radar (your blast radius reaching others)
  const peers = [[cx + 96, cy - 26, 4], [cx + 150, cy + 58, 3.4], [cx + 228, cy - 72, 4],
    [cx + 40, cy - 150, 3.2], [cx + 196, cy + 150, 3], [cx - 84, cy + 156, 2.8], [cx - 150, cy - 70, 2.6]];

  let body = dotGrid(w, h, { step: 32, r: 1.2, color: "rgba(168,168,168,0.06)" });
  body += `<circle cx="${cx}" cy="${cy}" r="250" fill="url(#centerglow)"/>`;
  body += sweep + rings;
  body += peers.map((p) => node(p[0], p[1], p[2])).join("");
  body += `<line x1="${cx - 470}" y1="${cy}" x2="${cx + 250}" y2="${cy}" stroke="${GOLD}" stroke-width="0.8" opacity="0.12"/>`;
  body += node(cx, cy, 10, 1);
  body += `<circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.55"/>`;

  // left scrim → keeps the baked headline crisp over any radar bleed
  body += `<rect width="${w}" height="${h}" fill="url(#leftscrim)"/>`;

  // baked headline — Segoe UI ≈ Inter, renders crisp through librsvg
  const F = "Segoe UI, 'Helvetica Neue', Arial, sans-serif";
  body += `<text x="72" y="178" font-family="${F}" font-size="19" font-weight="700" letter-spacing="4" fill="${GOLD}">WELCOME TO ATTACKED.AI</text>`;
  body += `<text x="68" y="262" font-family="${F}" font-size="68" font-weight="800" letter-spacing="-1.5" fill="#FFFFFF">Narrow your</text>`;
  body += `<text x="68" y="336" font-family="${F}" font-size="68" font-weight="800" letter-spacing="-1.5" fill="#FFFFFF">blast radius.</text>`;
  body += `<rect x="72" y="366" width="64" height="4" fill="${GOLD}"/>`;
  body += `<text x="72" y="406" font-family="${F}" font-size="23" font-weight="400" fill="#B8B8B8">Your account is live — here's what it unlocks.</text>`;
  return frame(w, h, body);
}

// ── AUTH: slim horizon (signup confirm / magic link) ─────────────────────────
function authHero() {
  const w = 1240, h = 200;
  const cx = 620, cy = 560, R = 540; // big sphere mostly below the frame → top limb = horizon
  let inner = dotGrid(w, h, { step: 30, r: 1.2, color: "rgba(168,168,168,0.06)" });
  inner += globe(cx, cy, R, "ga");
  // rising signal nodes along the visible limb
  const nodes = [[78, -22], [80, 6], [76, 30], [73, -46], [82, -8]];
  inner += nodes.map(([la, lo]) => {
    const p = project(cx, cy, R, la, lo);
    return p.z > 0.02 ? node(p.x, p.y, 3.4 + p.z) : "";
  }).join("");
  inner += node(250, 70, 3) + node(1000, 96, 3.2) + node(150, 120, 2.4);
  return frame(w, h, inner);
}

// ── FEATURE ICONS — crisp gold line icons (NOT emoji) for email cards ─────────
// Transparent PNGs that sit on the dark feature cards. Rendered at 96px for
// retina sharpness, displayed ~30px in the mail.
function iconSvg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 100 100">${inner}</svg>`;
}
const ICONS = {
  // map pin → "Open the live map"
  "icon-map.png": `<path d="M50 12 C34 12 22 24 22 40 C22 62 50 88 50 88 C50 88 78 62 78 40 C78 24 66 12 50 12 Z" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="40" r="11" fill="none" stroke="${GOLD}" stroke-width="6"/>`,
  // shield + check → "Tune GUARD controls"
  "icon-shield.png": `<path d="M50 12 L80 24 L80 48 C80 70 50 88 50 88 C50 88 20 70 20 48 L20 24 Z" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linejoin="round"/><path d="M38 50 L47 60 L65 38" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // bar chart → "Rate your vendors"
  "icon-chart.png": `<line x1="22" y1="84" x2="84" y2="84" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><rect x="29" y="54" width="12" height="26" rx="2" fill="${GOLD}"/><rect x="49" y="40" width="12" height="40" rx="2" fill="${GOLD}"/><rect x="69" y="26" width="12" height="54" rx="2" fill="${GOLD}"/>`,
  // bell → application received / alerts
  "icon-bell.png": `<path d="M50 16 C40 16 33 24 33 35 L33 52 C33 58 30 62 26 66 L74 66 C70 62 67 58 67 52 L67 35 C67 24 60 16 50 16 Z" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linejoin="round"/><path d="M43 74 C44 79 47 82 50 82 C53 82 56 79 57 74" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>`,
  // document → "Read today's briefing"
  "icon-doc.png": `<path d="M32 16 L58 16 L72 30 L72 84 L32 84 Z" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linejoin="round"/><path d="M58 16 L58 30 L72 30" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linejoin="round"/><line x1="42" y1="48" x2="62" y2="48" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><line x1="42" y1="62" x2="62" y2="62" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>`,
  // sliders → "Set your alert preferences"
  "icon-sliders.png": `<line x1="20" y1="34" x2="80" y2="34" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><line x1="20" y1="50" x2="80" y2="50" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><line x1="20" y1="66" x2="80" y2="66" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/><circle cx="38" cy="34" r="8" fill="#0a0a0a" stroke="${GOLD}" stroke-width="5"/><circle cx="64" cy="50" r="8" fill="#0a0a0a" stroke="${GOLD}" stroke-width="5"/><circle cx="44" cy="66" r="8" fill="#0a0a0a" stroke="${GOLD}" stroke-width="5"/>`,
};

async function render(name, svg) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`✓ ${name}  (${kb} kB)`);
}

(async () => {
  await render("email-hero-digest.png", digestBanner());
  await render("email-hero-welcome.png", welcomeHero());
  await render("email-hero-auth.png", authHero());
  for (const [name, inner] of Object.entries(ICONS)) await render(name, iconSvg(inner));
  console.log("Done → public/");
})();
