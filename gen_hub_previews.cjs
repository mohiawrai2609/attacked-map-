// Generates 3 standalone, full-scroll Attack Hub preview pages with REAL
// incident data + the real header/footer, into public/. Run: node gen_hub_previews.cjs
const fs = require("fs");
const path = require("path");

// ---- read .env for Supabase creds -----------------------------------------
const env = {};
for (const line of fs.readFileSync(path.resolve(".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

const SEV_C = { 5: "#FF3B30", 4: "#FF8C5A", 3: "#F5B800", 2: "#34C759", 1: "#8E8E93" };
const SEV_L = { 5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "MINIMAL" };
const CAT_IMG = {
  CYB: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=900&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=900&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=900&q=70&auto=format&fit=crop",
  _d:  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=70&auto=format&fit=crop",
};
const CAT_NAME = { CYB:"Cyber", DAT:"Data & Privacy", FIN:"Financial", GEO:"Geopolitical", REG:"Regulatory", PHY:"Physical", PPL:"People", TEC:"Technology", STR:"Strategic", REP:"Reputation", TPR:"Third Party", OPS:"Operations", ENV:"Environmental" };

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const img = (a) => CAT_IMG[a.primary_category] || CAT_IMG._d;
const meta = (a) => [a.entity, a.country, a.industry || a.sector].filter(Boolean).join("  ·  ");
const fmtDay = (iso) => { try { return new Date(iso + "T00:00:00Z").toUTCString().slice(0,16); } catch { return iso || ""; } };

function sevChip(s, light) {
  const c = SEV_C[s] || "#F5B800";
  return `<span class="mono" style="font-size:9px;font-weight:500;padding:3px 8px;background:${c}22;color:${light?darken(c):c};border:1px solid ${c}55;border-radius:3px;letter-spacing:.05em;">${SEV_L[s]||"—"}</span>`;
}
function darken(c){ return { "#FF3B30":"#A32D2D","#FF8C5A":"#993C1D","#F5B800":"#8A6D00","#34C759":"#1E6B33","#8E8E93":"#55555A" }[c] || c; }

// ---- shared header / footer (static replica of the real site) -------------
function header(active) {
  const link = (k,l) => `<a href="https://attackedmap.vercel.app/${k}" style="color:${active===l?'#F5B800':'#A8A8A8'};text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">${l}</a>`;
  return `<div style="height:3px;background:#F5B800;"></div>
  <nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,40px);height:64px;background:rgba(26,26,26,.96);backdrop-filter:blur(12px);border-bottom:1px solid #333;">
    <a href="https://attackedmap.vercel.app/?home" style="text-decoration:none;display:flex;align-items:center;gap:9px;">
      <span style="display:inline-flex;width:26px;height:30px;align-items:center;justify-content:center;color:#F5B800;"><i class="ti ti-shield-half-filled" style="font-size:24px;"></i></span>
      <span style="font-size:17px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span>
    </a>
    <div style="display:flex;align-items:center;gap:26px;">
      ${link("?map","ATTACK MAP")}${link("?hub","ATTACKED HUB")}${link("?pricing","PRICING")}
      <a href="https://attackedmap.vercel.app/?home" style="background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:4px;">Sign in</a>
    </div>
  </nav>`;
}

function footer() {
  const nl = (l,h) => `<a href="${h}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;">${l}</a>`;
  const soc = ["brand-linkedin","brand-x","brand-facebook","brand-youtube","brand-instagram"]
    .map(i => `<span style="width:40px;height:40px;border-radius:50%;border:1px solid #fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;"><i class="ti ti-${i}" style="font-size:17px;"></i></span>`).join("");
  return `<footer style="background:#080808;border-top:1px solid #333;">
    <div style="max-width:1640px;margin:0 auto;padding:56px clamp(28px,5vw,72px) 48px;">
      <span style="font-size:20px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span>
      <div style="margin-top:40px;display:flex;justify-content:space-between;gap:clamp(40px,8vw,140px);flex-wrap:wrap;">
        <div style="flex:1 1 360px;max-width:440px;">
          <div style="font-size:22px;font-weight:800;color:#fff;">Subscribe</div>
          <div style="margin-top:10px;font-size:14px;color:#A8A8A8;line-height:1.55;max-width:360px;">Select topics and stay current with our latest intelligence briefs</div>
          <div style="margin-top:18px;display:flex;gap:14px;max-width:480px;">
            <input placeholder="Email address" style="flex:1;min-width:0;padding:13px 16px;border-radius:4px;background:transparent;color:#fff;border:1px solid #4B5563;font-size:14px;"/>
            <button style="padding:13px 32px;background:#F5B800;color:#1A1A1A;border:none;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Submit</button>
          </div>
          <div style="margin-top:28px;font-size:13px;color:#585858;">© 2026 Attacked<span style="color:#F5B800;">.ai</span></div>
        </div>
        <div style="flex:1 1 600px;max-width:740px;">
          <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;align-items:center;">
            ${nl("Contact us","mailto:hello@attacked.ai")}${nl("Scam warning","https://attackedmap.vercel.app/?legal=scam")}${nl("FAQ","https://attackedmap.vercel.app/?legal=faq")}${nl("Privacy policy","https://attackedmap.vercel.app/?legal=privacy")}
          </div>
          <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;margin-top:14px;">
            ${nl("Cookie preferences","https://attackedmap.vercel.app/?legal=cookies")}${nl("Terms of use","https://attackedmap.vercel.app/?legal=terms")}${nl("Local language information","https://attackedmap.vercel.app/?legal=languages")}
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px;">${nl("Accessibility statement","https://attackedmap.vercel.app/?legal=accessibility")}</div>
          <div style="margin-top:36px;display:flex;gap:12px;justify-content:flex-end;">${soc}</div>
        </div>
      </div>
    </div>
  </footer>`;
}

function shell(title, body, banner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Attacked.ai Hub preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#fff;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.serif{font-family:'Cormorant Garamond',serif}
.mono{font-family:'JetBrains Mono',monospace}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}
a{color:inherit}
.previewbar{background:#F5B800;color:#1A1A1A;text-align:center;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px;font-family:'JetBrains Mono',monospace}
</style></head><body>
<div class="previewbar">${esc(banner)}</div>
${header("ATTACKED HUB")}
${body}
${footer()}
</body></html>`;
}

// ---- layout renderers ------------------------------------------------------
function masthead(sub) {
  return `<section style="padding:40px 0 26px;background:radial-gradient(ellipse 70% 120% at 50% 0%, rgba(245,184,0,.06), transparent 60%);border-bottom:1px solid #333;">
    <div class="wrap">
      <div class="mono" style="font-size:11px;color:#F5B800;letter-spacing:.2em;">◇ THE INTELLIGENCE FEED · UPDATED DAILY</div>
      <h1 class="serif" style="font-size:clamp(40px,6vw,58px);font-weight:700;line-height:1;margin-top:12px;">The Attacked <span style="color:#F5B800;font-style:italic;">Hub</span></h1>
      <p style="margin-top:12px;max-width:560px;font-size:14px;color:#A8A8A8;line-height:1.55;">${sub}</p>
    </div>
  </section>`;
}

function chips(cats) {
  return `<div class="wrap" style="padding-top:18px;"><div style="display:flex;gap:6px;flex-wrap:wrap;">
    <span class="mono" style="font-size:10px;padding:6px 12px;border:1px solid rgba(245,184,0,.3);color:#F5B800;background:rgba(245,184,0,.1);border-radius:4px;letter-spacing:.06em;">ALL</span>
    ${cats.map(c=>`<span class="mono" style="font-size:10px;padding:6px 12px;border:1px solid #333;color:#A8A8A8;border-radius:4px;letter-spacing:.06em;">${esc(c)}</span>`).join("")}
  </div></div>`;
}

function cta() {
  return `<div class="wrap" style="padding:30px 0 60px;"><div style="padding:34px;text-align:center;background:#1A1A1A;border:1px solid #333;border-radius:12px;">
    <div class="serif" style="font-size:28px;font-weight:700;">The full picture lives on the map.</div>
    <p style="margin:10px auto 0;max-width:460px;font-size:13px;color:#A8A8A8;line-height:1.6;">Blast radius, adaptive controls and vendor Defence Ratings for every briefing above.</p>
    <a href="https://attackedmap.vercel.app/?home" class="mono" style="display:inline-block;margin-top:18px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.06em;padding:13px 26px;border-radius:4px;">SIGN UP FREE →</a>
  </div></div>`;
}

function renderBroadsheet(items, cats) {
  const lead = items[0];
  const wire = items.slice(1, 6);
  const sec = items.slice(6, 12);
  const tail = items.slice(12, 30);
  const wireRow = (a) => `<div style="padding:13px 0;border-bottom:1px solid #ececec;"><div class="serif" style="font-size:20px;font-weight:700;line-height:1.1;color:#101010;">${esc(a.headline)}</div><div class="mono" style="font-size:9px;margin-top:4px;color:${darken(SEV_C[a.severity])};">${SEV_L[a.severity]||""} · ${esc(a.primary_category||"")} · ${esc(a.entity||"")}</div></div>`;
  const secCard = (a) => `<div><div style="height:120px;background:url('${img(a)}') center/cover;border:1px solid #e3e3e3;"></div><div style="margin-top:10px;">${sevChip(a.severity,true)} <span class="mono" style="font-size:9px;color:#888;">${esc(a.primary_category||"")}</span></div><h3 class="serif" style="font-size:21px;font-weight:700;line-height:1.1;margin-top:6px;color:#101010;">${esc(a.headline)}</h3><div class="mono" style="font-size:9px;color:#888;margin-top:5px;">${esc(meta(a))}</div></div>`;
  const tailCard = (a) => `<div style="border:1px solid #e7e7e9;background:#fafafa;"><div style="height:130px;background:url('${img(a)}') center/cover;"></div><div style="padding:14px;">${sevChip(a.severity,true)} <span class="mono" style="font-size:9px;color:#888;">${esc(a.primary_category||"")}</span><h3 class="serif" style="font-size:19px;font-weight:700;line-height:1.12;margin-top:6px;color:#101010;">${esc(a.headline)}</h3><div class="mono" style="font-size:9px;color:#999;margin-top:5px;">${esc(meta(a))}</div></div></div>`;
  const body = `${masthead("Every incident, GUARD-classified and written for operators. Latest incidents — "+fmtDay(lead&&lead.incident_day)+".")}
  ${chips(cats)}
  <main style="background:#fff;color:#101010;margin-top:18px;padding:26px 0 8px;"><div class="wrap">
    <div style="display:grid;grid-template-columns:1.7fr 1fr;gap:26px;">
      <div>
        <div class="mono" style="font-size:10px;color:#8A6D00;letter-spacing:.16em;">LEAD BRIEFING</div>
        <div style="height:300px;background:url('${img(lead)}') center/cover;border:1px solid #e3e3e3;margin-top:8px;"></div>
        <div style="margin-top:12px;">${sevChip(lead.severity,true)} <span class="mono" style="font-size:9px;color:#888;">${esc(lead.primary_category||"")} · ${esc(fmtDay(lead.incident_day))}</span></div>
        <h2 class="serif" style="font-size:38px;font-weight:700;line-height:1.04;margin-top:8px;color:#101010;">${esc(lead.headline)}</h2>
        <div class="mono" style="font-size:10px;color:#888;margin-top:8px;">${esc(meta(lead))}</div>
        <p style="font-size:14px;line-height:1.7;color:#52525B;margin-top:12px;">${esc((lead.summary||"").slice(0,360))}</p>
      </div>
      <div style="border-left:1px solid #e3e3e3;padding-left:22px;">
        <div class="mono" style="font-size:10px;color:#8A6D00;letter-spacing:.16em;margin-bottom:6px;">LATEST WIRE</div>
        ${wire.map(wireRow).join("")}
      </div>
    </div>
    <div style="border-top:1px solid #e3e3e3;margin:26px 0;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;">${sec.map(secCard).join("")}</div>
    <div style="border-top:1px solid #e3e3e3;margin:26px 0 22px;"></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px;">${tail.map(tailCard).join("")}</div>
  </div></main>
  ${cta()}`;
  return shell("Broadsheet", body, "Preview · Direction 1 — The Broadsheet · real data");
}

function renderTerminal(items, cats, counts) {
  const lead = items[0];
  const tape = items.slice(1, 14);
  const tail = items.slice(14, 40);
  const total = counts.total, crit = counts[5]||0, high = counts[4]||0;
  const mix = [5,4,3,2,1].map(s => ({ s, pct: total ? Math.round(((counts[s]||0)/total)*100) : 0 }));
  const tapeRow = (a) => `<div style="display:flex;gap:10px;padding:9px 0 9px 10px;border-bottom:1px solid #1a1a1a;border-left:3px solid ${SEV_C[a.severity]||'#F5B800'};"><span class="mono" style="font-size:10px;color:#585858;white-space:nowrap;">${esc((a.incident_day||'').slice(5))}</span><span class="serif" style="font-size:17px;font-weight:700;line-height:1.1;">${esc(a.headline)}</span></div>`;
  const tr = (a) => `<tr style="border-bottom:1px solid #1c1c1c;"><td style="padding:9px 10px;">${sevChip(a.severity)}</td><td class="mono" style="padding:9px 10px;font-size:10px;color:#A8A8A8;">${esc(a.primary_category||"")}</td><td style="padding:9px 10px;font-size:13px;">${esc(a.headline)}</td><td class="mono" style="padding:9px 10px;font-size:10px;color:#585858;white-space:nowrap;">${esc(a.entity||"")} · ${esc(a.country||"")}</td></tr>`;
  const body = `
  <div class="mono" style="display:flex;border-bottom:1px solid #333;background:#0d0d0d;">
    ${[["RECENT",total,"#fff"],["CRITICAL",crit,"#FF3B30"],["HIGH",high,"#FF8C5A"],["SECTORS",counts.sectors,"#F5B800"],["COUNTRIES",counts.countries,"#fff"]]
      .map(([l,v,c],i)=>`<div style="flex:1;padding:11px 16px;${i<4?'border-right:1px solid #1f1f1f;':''}"><span style="font-size:9px;color:#585858;">${l}</span><div style="font-size:22px;font-weight:600;color:${c};">${v}</div></div>`).join("")}
  </div>
  <div class="wrap" style="padding-top:22px;">
    <div style="display:grid;grid-template-columns:1.45fr 1fr;gap:26px;">
      <div>
        <div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.16em;margin-bottom:10px;">▌TOP STORY</div>
        <div style="border-left:3px solid ${SEV_C[lead.severity]||'#FF3B30'};padding-left:16px;">
          <h2 class="serif" style="font-size:36px;font-weight:700;line-height:1.04;">${esc(lead.headline)}</h2>
          <div class="mono" style="font-size:10px;color:#585858;margin-top:8px;">${SEV_L[lead.severity]||""} · ${esc(lead.primary_subcategory_name||lead.primary_category||"")} · ${esc(lead.entity||"")} · ${esc(lead.country||"")}</div>
          <p style="font-size:13.5px;line-height:1.65;color:#A8A8A8;margin-top:12px;">${esc((lead.summary||"").slice(0,340))}</p>
        </div>
        <div class="mono" style="font-size:10px;color:#585858;letter-spacing:.16em;margin:20px 0 8px;">▌SEVERITY MIX</div>
        <div style="display:flex;height:12px;border:1px solid #2a2a2a;overflow:hidden;">${mix.map(m=>`<div style="width:${m.pct}%;background:${SEV_C[m.s]};"></div>`).join("")}</div>
        <div class="mono" style="display:flex;justify-content:space-between;font-size:9px;color:#585858;margin-top:6px;"><span>CRIT</span><span>HIGH</span><span>MED</span><span>LOW</span><span>MIN</span></div>
      </div>
      <div>
        <div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.16em;margin-bottom:10px;">▌LIVE TAPE</div>
        ${tape.map(tapeRow).join("")}
      </div>
    </div>
    <div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.16em;margin:28px 0 8px;">▌ALL RECENT INCIDENTS</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #1c1c1c;background:#0d0d0d;">${tail.map(tr).join("")}</table>
  </div>
  ${cta()}`;
  return shell("Terminal", body, "Preview · Direction 2 — The Terminal · real data");
}

function renderDesks(items, cats) {
  const byCat = {};
  for (const a of items) { (byCat[a.primary_category] = byCat[a.primary_category] || []).push(a); }
  const order = Object.keys(byCat).sort((a,b)=>byCat[b].length-byCat[a].length);
  const card = (a) => `<div style="background:#161616;border:1px solid #2a2a2a;"><div style="height:120px;background:url('${img(a)}') center/cover;"></div><div style="padding:14px;"><span class="mono" style="font-size:9px;color:${SEV_C[a.severity]};">${SEV_L[a.severity]||""} · ${esc(a.primary_category||"")}</span><h3 class="serif" style="font-size:21px;font-weight:700;line-height:1.08;margin-top:6px;">${esc(a.headline)}</h3><div class="mono" style="font-size:9px;color:#585858;margin-top:6px;">${esc(meta(a))}</div></div></div>`;
  const desk = (c) => `<div style="margin-top:24px;"><div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #F5B800;padding-bottom:7px;">
      <span class="mono" style="font-size:13px;font-weight:600;letter-spacing:.14em;color:#F5B800;">${esc((CAT_NAME[c]||c).toUpperCase())} DESK</span>
      <span class="mono" style="font-size:10px;color:#585858;">${byCat[c].length} BRIEFINGS · VIEW ALL →</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:14px;">${byCat[c].slice(0,6).map(card).join("")}</div></div>`;
  const body = `${masthead("Browse every incident by GUARD desk — classified, geolocated, written for operators.")}
  ${chips(cats)}
  <div class="wrap" style="padding-bottom:8px;">${order.map(desk).join("")}</div>
  ${cta()}`;
  return shell("Desks", body, "Preview · Direction 3 — The Desks · real data");
}

function renderBloomberg(items, cats, counts) {
  const lead = items[0], center = items[1], sec = items[2];
  const related = items.slice(3, 6);
  const latest = items.slice(6, 16);
  const crit = items.filter(a => a.severity >= 4).slice(0, 4);
  const tail = items.slice(16, 24);
  const vr = "border-left:1px solid #e3e3e3;";
  const kicker = (a) => (a.severity >= 5 ? `<span class="mono" style="font-size:10px;font-weight:600;color:#A32D2D;letter-spacing:.1em;">CRITICAL</span>` : `<span class="mono" style="font-size:10px;font-weight:600;color:#8A6D00;letter-spacing:.1em;">${esc((CAT_NAME[a.primary_category]||a.primary_category||"BRIEFING").toUpperCase())}</span>`);
  const latestRow = (a) => `<div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid #e7e7e9;"><span class="mono" style="font-size:10px;color:#9a9a9a;white-space:nowrap;padding-top:2px;">${esc((a.incident_day||'').slice(5)||'—')}</span><div><div class="serif" style="font-size:17px;font-weight:700;line-height:1.12;color:#101010;">${esc(a.headline)}</div><span class="mono" style="font-size:8.5px;color:${SEV_C[a.severity]};">${SEV_L[a.severity]||''} · ${esc(a.primary_category||'')}</span></div></div>`;
  const fourUp = (a) => `<div style="${vr}padding:0 16px;"><div style="height:150px;background:url('${img(a)}') center/cover;"></div>${kicker(a)}<h3 class="serif" style="font-size:21px;font-weight:700;line-height:1.1;margin-top:6px;color:#101010;">${esc(a.headline)}</h3><div class="mono" style="font-size:9px;color:#999;margin-top:5px;">${esc(meta(a))}</div></div>`;
  const chip = (c) => `<span class="mono" style="display:inline-block;font-size:11px;color:#101010;border:1px solid #d6d6d1;border-radius:3px;padding:7px 12px;margin:0 8px 8px 0;">${esc(CAT_NAME[c]||c)}</span>`;

  const body = `
  <div class="mono" style="background:#0d0d0d;border-bottom:1px solid #333;padding:7px 0;"><div class="wrap" style="font-size:10px;color:#A8A8A8;letter-spacing:.08em;">● LIVE · GUARD-CLASSIFIED INTELLIGENCE · ${counts.total} RECENT INCIDENTS · ${counts.countries} COUNTRIES</div></div>
  <section style="padding:22px 0 14px;border-bottom:1px solid #333;"><div class="wrap" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
    <h1 class="serif" style="font-size:clamp(34px,5vw,50px);font-weight:700;line-height:1;">The Attacked <span style="color:#F5B800;font-style:italic;">Hub</span></h1>
    <span class="mono" style="font-size:11px;color:#585858;">${esc(fmtDay(lead&&lead.incident_day))} · ASIA / GLOBAL EDITION</span>
  </div></section>

  <main style="background:#fff;color:#101010;padding:24px 0 0;"><div class="wrap">
    <div style="display:grid;grid-template-columns:1fr 1.55fr 1fr;">
      <div style="padding-right:22px;">
        <div style="height:190px;background:url('${img(lead)}') center/cover;"></div>
        <div style="margin-top:10px;">${kicker(lead)}</div>
        <h2 class="serif" style="font-size:30px;font-weight:700;line-height:1.04;margin-top:4px;">${esc(lead.headline)}</h2>
        <div class="mono" style="font-size:9px;color:#888;margin-top:6px;">${esc(meta(lead))}</div>
        <div style="margin-top:16px;border:1px solid #e3e3e3;">
          <div class="mono" style="font-size:10px;font-weight:600;color:#52525B;letter-spacing:.1em;padding:8px 14px;background:#f4f4f1;border-bottom:1px solid #e3e3e3;">RELATED</div>
          ${related.map(a=>`<div style="padding:11px 14px;border-top:1px solid #ececec;"><div class="serif" style="font-size:16px;font-weight:700;line-height:1.18;color:#101010;">${esc(a.headline)}</div></div>`).join("")}
        </div>
      </div>

      <div style="padding:0 22px;${vr}border-right:1px solid #e3e3e3;">
        <div style="height:340px;background:url('${img(center)}') center/cover;"></div>
        <div style="margin-top:12px;">${kicker(center)}</div>
        <h2 class="serif" style="font-size:40px;font-weight:700;line-height:1.02;margin-top:4px;">${esc(center.headline)}</h2>
        <p style="font-size:14.5px;line-height:1.6;color:#52525B;margin-top:12px;">${esc((center.summary||"").slice(0,200))}</p>
        <div style="margin-top:18px;border:1px solid #e3e3e3;padding:14px 16px;">
          <div class="serif" style="font-size:20px;font-weight:700;line-height:1.12;">${esc(sec.headline)}</div>
          <div class="mono" style="font-size:9px;color:#888;margin-top:6px;">${esc(meta(sec))}</div>
        </div>
      </div>

      <div style="padding-left:22px;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #101010;padding-bottom:6px;">
          <span style="font-size:18px;font-weight:800;">Latest</span>
          <span class="mono" style="font-size:10px;color:#888;">ALL DESKS ▾</span>
        </div>
        ${latest.map(latestRow).join("")}
        <div class="mono" style="font-size:11px;font-weight:600;color:#8A6D00;padding:14px 0;border-top:1px solid #e7e7e9;">SEE ALL LATEST ›</div>
        <div style="font-size:18px;font-weight:800;margin-top:14px;">In focus</div>
        <div style="margin-top:12px;">${cats.slice(0,8).map(chip).join("")}</div>
      </div>
    </div>

    <div style="border-top:3px solid #101010;margin-top:28px;padding-top:16px;">
      <div style="font-size:20px;font-weight:800;margin-bottom:14px;">Most critical today</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);margin:0 -16px;">${crit.map(fourUp).join("")}</div>
    </div>

    <div style="border-top:1px solid #e3e3e3;margin-top:26px;padding-top:16px;">
      <div style="font-size:20px;font-weight:800;margin-bottom:14px;">Across the desks</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);margin:0 -16px;">${tail.slice(0,4).map(fourUp).join("")}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);margin:18px -16px 0;">${tail.slice(4,8).map(fourUp).join("")}</div>
    </div>
  </div></main>
  ${cta()}`;
  return shell("Bloomberg-style", body, "Preview · Direction 4 — Bloomberg-style · real data");
}

// ---- fetch + write ---------------------------------------------------------
(async () => {
  const sel = "id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,incident_day,event_date";
  const url = `${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=60`;
  const res = await fetch(url, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  let items = await res.json();
  if (!Array.isArray(items)) { console.error("fetch failed", items); process.exit(1); }
  items = items.filter(a => a.headline);
  const cats = Array.from(new Set(items.map(a => a.primary_category).filter(Boolean)));
  const counts = { total: items.length, sectors: new Set(items.map(a=>a.industry||a.sector).filter(Boolean)).size, countries: new Set(items.map(a=>a.country).filter(Boolean)).size };
  for (const a of items) counts[a.severity] = (counts[a.severity]||0)+1;

  const out = path.resolve("public");
  fs.writeFileSync(path.join(out,"hub-broadsheet.html"), renderBroadsheet(items, cats));
  fs.writeFileSync(path.join(out,"hub-terminal.html"), renderTerminal(items, cats, counts));
  fs.writeFileSync(path.join(out,"hub-desks.html"), renderDesks(items, cats));
  fs.writeFileSync(path.join(out,"hub-bloomberg.html"), renderBloomberg(items, cats, counts));
  console.log(`OK — ${items.length} real incidents baked into 4 preview pages.`);
})();
