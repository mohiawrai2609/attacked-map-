// gen_hub_ft.cjs — FULL FT-style editorial front page for the Attacked Hub.
// Standalone static preview → public/hub-ft.html (separate link; does NOT touch
// the live ?hub React app). The Financial Times homepage as a structural
// reference — 3-column hero, per-section bands with "More in X" rails, Spotlight,
// GUARD Analysis (op-ed treatment), a cinematic Deconstructed band, Most
// Critical, the Latest grid, and a full footer — rendered entirely in our brand:
// white body, gold #F5B800, Inter throughout (single typeface). Real GUARD intelligence from Supabase; cards deep-link to the hub.
const fs = require("fs"), path = require("path");

const env = {};
for (const l of fs.readFileSync(path.resolve(".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
}
const SB_URL = env.VITE_SUPABASE_URL, SB_KEY = env.VITE_SUPABASE_ANON_KEY;
const APP = "https://attackedmap.vercel.app";

const SEV_C = { 5: "#FF3B30", 4: "#FF6B35", 3: "#F5B800", 2: "#34C759", 1: "#8E8E93" };
const SEV_L = { 5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "MINIMAL" };
const CAT_NAME = { CYB: "Cyber", DAT: "Data & Privacy", ENV: "Environmental", FIN: "Financial", GEO: "Geopolitical", OPS: "Operations", PHY: "Physical Security", PPL: "People", REG: "Regulatory", REP: "Reputation", STR: "Strategic", TEC: "Technology", TPR: "Third Party" };
const CAT_IMG = {
  CYB: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1100&q=72&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1100&q=72&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1100&q=72&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1100&q=72&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1100&q=72&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1100&q=72&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1100&q=72&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1100&q=72&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1100&q=72&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1100&q=72&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1100&q=72&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1100&q=72&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1100&q=72&auto=format&fit=crop",
  _d: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1100&q=72&auto=format&fit=crop",
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const im = a => CAT_IMG[a.primary_category] || CAT_IMG._d;
const fmtDay = iso => { try { return new Date(iso + "T00:00:00Z").toUTCString().slice(0, 16); } catch { return iso || ""; } };
const fmtShort = iso => { try { return new Date(iso + "T00:00:00Z").toUTCString().slice(5, 11); } catch { return iso || ""; } };
const place = a => [a.entity, a.country].filter(Boolean).join(" · ");
const catName = a => CAT_NAME[a.primary_category] || a.primary_category || "OPS";
const href = a => `${APP}/?hub&open=${encodeURIComponent(a.id)}`;
const sevChip = a => `<span class="sev" style="background:${SEV_C[a.severity]}1c;color:${SEV_C[a.severity]};border-color:${SEV_C[a.severity]}55">${SEV_L[a.severity] || "—"}</span>`;
const kicker = (t, c) => `<span class="kick"${c ? ` style="color:${c}"` : ""}>${esc(t)}</span>`;
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n).trim() + "…" : s; };

const CSS = `
:root{--gold:#F5B800;--gold-d:#8A6D00;--ink:#14130F;--sub:#3D3A33;--mut:#6E6A60;--line:#E6E3DB;--rule:#DAD6CC;--deep:#080808;--ob:#1A1A1A}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#fff;color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5}
img{display:block}a{color:inherit;text-decoration:none}
.wrap{max-width:1280px;margin:0 auto;padding:0 clamp(18px,4vw,44px)}
.serif{font-family:Inter,system-ui,sans-serif}
.mono{font-family:Inter,system-ui,sans-serif}
.kick{font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-d)}
.sev{display:inline-block;font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid;white-space:nowrap}
/* app nav */
.appnav{position:sticky;top:0;z-index:50;background:rgba(8,8,8,0.88);backdrop-filter:blur(14px);border-bottom:1px solid #333}
.appnav .wrap{display:flex;justify-content:space-between;align-items:center;height:64px;width:100%}
.brand{display:inline-flex;align-items:center;gap:10px;font-family:Inter,sans-serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1}
.brand img{display:block;border-radius:4px}
.brand b{color:var(--gold);font-weight:700}
.brand sup{color:#fff;font-size:10px;font-weight:600;margin-left:1px;top:-.6em;position:relative}
.navlinks{display:flex;gap:4px;align-items:center}
.navlinks a,.navlinks .on{padding:8px 14px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#A8A8A8;transition:color .15s}
.navlinks a:hover{color:#fff}
.navlinks .on{color:var(--gold);cursor:default}
.navlinks .si{border:1px solid #333;border-radius:4px;color:#fff;margin-left:8px}
.navlinks .si:hover{border-color:#666;color:#fff}
.navlinks .sub{background:var(--gold);color:#1A1A1A;border-radius:4px;font-weight:700;margin-left:4px;transition:transform .15s}
.navlinks .sub:hover{transform:translateY(-1px)}
@media(max-width:720px){.navlinks a:not(.si):not(.sub),.navlinks .on{display:none}}
/* ticker */
.tick{background:var(--deep);border-bottom:1px solid #2a2a2a}
.tick .wrap{display:flex;align-items:center;gap:22px;height:42px;overflow-x:auto;scrollbar-width:none}
.tick .wrap::-webkit-scrollbar{display:none}
.tick .live{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.tick .dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px rgba(245,184,0,.8);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.tick .lbl{font-family:Inter,system-ui,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.16em;color:var(--gold);text-transform:uppercase}
.tick .ct{display:inline-flex;gap:6px;white-space:nowrap;font-family:Inter,system-ui,sans-serif;font-size:11.5px}
.tick .ct .c{color:#A8A8A8}.tick .ct .n{color:#fff;font-weight:600}
.tick .more{margin-left:auto;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:600;color:var(--gold);white-space:nowrap}
/* masthead */
.mast{text-align:center;padding:34px 0 22px;border-bottom:1px solid var(--line);background:radial-gradient(ellipse 60% 100% at 50% 0%,rgba(245,184,0,.07),transparent 70%)}
.mast .bar{width:54px;height:3px;background:var(--gold);margin:0 auto 18px}
.mast .date{font-family:Inter,system-ui,sans-serif;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--mut)}
.mast h1{font-size:clamp(40px,6.2vw,70px);font-weight:700;line-height:1;letter-spacing:-.01em;margin-top:10px}
.mast h1 i{color:var(--gold-d)}
.mast p{max-width:560px;margin:12px auto 0;font-size:14px;line-height:1.55;color:var(--mut)}
.kpis{display:flex;justify-content:center;gap:0;flex-wrap:wrap;margin-top:18px}
.kpis .k{padding:0 22px;border-right:1px solid var(--line)}
.kpis .k:last-child{border-right:none}
.kpis .v{font-family:Inter,system-ui,sans-serif;font-size:21px;font-weight:600;color:var(--ink)}
.kpis .l{font-family:Inter,system-ui,sans-serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-top:2px}
/* category nav */
.catnav{border-bottom:1px solid var(--line);background:#fff}
.catnav .wrap{display:flex;justify-content:center;gap:2px;overflow-x:auto;scrollbar-width:none}
.catnav .wrap::-webkit-scrollbar{display:none}
.catnav a{padding:13px 11px;font-size:12px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--mut);white-space:nowrap;border-bottom:2px solid transparent}
.catnav a.on{color:var(--ink);font-weight:700;border-bottom-color:var(--gold)}
.catnav a:hover{color:var(--ink)}
/* section header */
.sh{display:flex;align-items:center;gap:18px;margin:8px 0 24px}
.sh .ln{flex:1;border-top:1px dotted var(--rule)}
.sh h2{font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:18px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
.sh.l{justify-content:flex-start;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:20px;gap:12px}
.sh.l .ln{display:none}.sh.l h2{font-size:20px;letter-spacing:-.01em;text-transform:none}
.sh.l .sq{width:9px;height:9px;border-radius:2px}
.sh.l .more{margin-left:auto;font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--gold-d)}
.sec{padding:46px 0 0}
/* HERO 3-col */
.hero{display:grid;grid-template-columns:0.92fr 1.5fr 0.92fr;gap:34px;padding:32px 0 0;align-items:start}
.hcol{display:flex;flex-direction:column}
.heroline{border-top:1px solid var(--line);margin:0}
/* lead (center) */
.lead .img{border:1px solid var(--line);overflow:hidden;margin-bottom:15px;transition:border-color .22s,box-shadow .22s}
.lead .img img{width:100%;height:320px;object-fit:cover;transition:transform .55s}
.lead:hover .img{border-color:var(--gold);box-shadow:0 16px 38px rgba(20,20,20,.13)}
.lead:hover .img img{transform:scale(1.04)}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.lead h2{font-family:Inter,system-ui,sans-serif;font-size:clamp(30px,3.4vw,44px);font-weight:700;line-height:1.05;letter-spacing:-.01em;margin:11px 0 0;transition:color .16s}
.lead:hover h2{color:var(--gold-d)}
.by{font-family:Inter,system-ui,sans-serif;font-size:11px;color:var(--mut)}
.lead .dek{margin-top:13px;font-size:15px;line-height:1.66;color:var(--sub);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.rm{font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:600;color:var(--gold-d);letter-spacing:.06em;text-transform:uppercase}
/* side lead (left) — text headline + small dek */
.side{padding-bottom:18px}
.side h3{font-family:Inter,system-ui,sans-serif;font-size:27px;font-weight:700;line-height:1.1;margin:9px 0 0}
.side:hover h3{color:var(--gold-d)}
.side .dek{margin-top:9px;font-size:13px;line-height:1.55;color:var(--sub);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.side+.side{border-top:1px solid var(--line);padding-top:18px}
/* picks rail (right) */
.picks-h{font-family:Inter,system-ui,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding-bottom:11px;border-bottom:2px solid var(--ink)}
.rail a{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line)}
.rail a:first-of-type{border-top:none}
.rail .num{font-family:Inter,system-ui,sans-serif;font-size:20px;font-weight:600;color:var(--gold-d);line-height:1;min-width:24px}
.rail h4{font-family:Inter,system-ui,sans-serif;font-size:18px;font-weight:600;line-height:1.16;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rail a:hover h4{color:var(--gold-d)}
.rail .mrow{display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap}
.rail .by{margin-top:4px}
/* TOP STORIES 4col */
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.story .img{border:1px solid var(--line);overflow:hidden;margin-bottom:11px}
.story .img img{width:100%;height:150px;object-fit:cover;transition:transform .5s}
.story:hover .img img{transform:scale(1.05)}
.story h3{font-family:Inter,system-ui,sans-serif;font-size:20px;font-weight:600;line-height:1.16;margin-top:7px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.story:hover h3{color:var(--gold-d)}
.story .by{margin-top:6px}
/* SPOTLIGHT */
.spot{display:grid;grid-template-columns:1.7fr 1fr;gap:30px;align-items:start}
.spot .big .img{overflow:hidden;border:1px solid var(--line);margin-bottom:14px}
.spot .big .img img{width:100%;height:300px;object-fit:cover;transition:transform .55s}
.spot .big:hover .img img{transform:scale(1.04)}
.spot .big h3{font-family:Inter,system-ui,sans-serif;font-size:32px;font-weight:700;line-height:1.08;margin-top:6px}
.spot .big:hover h3{color:var(--gold-d)}
.spot .big .dek{margin-top:11px;font-size:14px;color:var(--sub);line-height:1.6;max-width:620px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.spot .aside .img{overflow:hidden;border:1px solid var(--line);margin-bottom:11px}
.spot .aside .img img{width:100%;height:170px;object-fit:cover;transition:transform .5s}
.spot .aside:hover .img img{transform:scale(1.05)}
.spot .aside h3{font-family:Inter,system-ui,sans-serif;font-size:23px;font-weight:600;line-height:1.14;margin-top:6px}
.spot .aside:hover h3{color:var(--gold-d)}
/* SECTION BAND (per category: lead + more rail) */
.band{display:grid;grid-template-columns:1.5fr 1fr;gap:34px;align-items:start}
.band .feat .img{overflow:hidden;border:1px solid var(--line);margin-bottom:13px}
.band .feat .img img{width:100%;height:240px;object-fit:cover;transition:transform .55s}
.band .feat:hover .img img{transform:scale(1.04)}
.band .feat h3{font-family:Inter,system-ui,sans-serif;font-size:28px;font-weight:700;line-height:1.1;margin-top:6px}
.band .feat:hover h3{color:var(--gold-d)}
.band .feat .dek{margin-top:10px;font-size:14px;color:var(--sub);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.morehead{font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding-bottom:10px;border-bottom:1px solid var(--ink)}
.moreitem{display:block;padding:12px 0;border-top:1px solid var(--line)}
.moreitem:first-of-type{border-top:none}
.moreitem h4{font-family:Inter,system-ui,sans-serif;font-size:18px;font-weight:600;line-height:1.18}
.moreitem:hover h4{color:var(--gold-d)}
.moreitem .by{margin-top:4px}
/* ANALYSIS (op-ed) */
.analysis{background:#FAF8F3;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.an3{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.opc{display:flex;flex-direction:column}
.opc .q{font-family:Inter,system-ui,sans-serif;font-size:34px;line-height:0;color:var(--gold-d);height:18px}
.opc h3{font-family:Inter,system-ui,sans-serif;font-size:23px;font-weight:700;line-height:1.18;margin-top:6px}
.opc:hover h3{color:var(--gold-d)}
.opc p{margin-top:9px;font-size:13px;color:var(--sub);line-height:1.6;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.opc .auth{display:flex;align-items:center;gap:10px;margin-top:13px}
.opc .av{width:38px;height:38px;border-radius:50%;background:rgba(245,184,0,.14);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:600;color:var(--gold-d)}
.opc .an{font-size:12px;font-weight:700}.opc .ad{font-family:Inter,system-ui,sans-serif;font-size:10px;color:var(--mut)}
/* DECONSTRUCTED (dark cinematic) */
.decon{background:var(--ob);color:#fff;border-top:1px solid #000}
.decon .in{display:grid;grid-template-columns:1.3fr 1fr;gap:34px;align-items:center}
.decon .img{position:relative;overflow:hidden;border-radius:4px;height:330px}
.decon .img img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
.decon:hover .img img{transform:scale(1.05)}
.decon .tag{position:absolute;left:16px;bottom:16px;background:var(--gold);color:#1A1A1A;font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px}
.decon h2{font-family:Inter,system-ui,sans-serif;font-size:clamp(28px,3vw,40px);font-weight:700;line-height:1.08}
.decon p{margin-top:14px;font-size:14px;color:#bdbdbd;line-height:1.66}
.decon .steps{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}
.decon .step{font-family:Inter,system-ui,sans-serif;font-size:10px;color:#A8A8A8;border:1px solid #333;border-radius:3px;padding:5px 9px}
.decon .step b{color:var(--gold)}
.btn{display:inline-block;background:var(--gold);color:#1A1A1A;font-family:Inter,system-ui,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:12px 24px;border-radius:4px;transition:transform .15s}
.btn:hover{transform:translateY(-2px)}
.btn.gh{background:transparent;color:#fff;border:1px solid #444}
/* MOST CRITICAL / LATEST */
.crit{display:grid;grid-template-columns:1fr 1fr;gap:0 48px}
.latest{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:26px}
.card{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;transition:border-color .2s,box-shadow .2s,transform .2s;display:flex;flex-direction:column}
.card:hover{border-color:var(--gold);box-shadow:0 12px 30px rgba(20,20,20,.10);transform:translateY(-2px)}
.card .img{overflow:hidden;height:165px}
.card .img img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.card:hover .img img{transform:scale(1.05)}
.card .bd{padding:0 17px 17px}
.card .row{margin:13px 0 8px}
.card .day{margin-left:auto;font-family:Inter,system-ui,sans-serif;font-size:10px;color:var(--mut)}
.card h3{font-family:Inter,system-ui,sans-serif;font-size:21px;font-weight:600;line-height:1.16;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card:hover h3{color:var(--gold-d)}
.card p{margin-top:9px;font-size:12.5px;line-height:1.55;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* CTA */
.cta{margin-top:54px;text-align:center;padding:42px 24px;background:var(--ob);border-radius:12px}
.cta h3{font-family:Inter,system-ui,sans-serif;font-size:30px;font-weight:700;color:#fff}
.cta p{max-width:470px;margin:10px auto 0;font-size:13.5px;color:#A8A8A8;line-height:1.6}
.cta .btn{margin-top:20px}
/* FOOTER */
.foot{background:var(--deep);color:#c9c9c9;margin-top:60px;border-top:1px solid #222;padding:46px 0 30px}
.foot .cols{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:30px}
.foot .brand{color:#fff;margin-bottom:0}
.foot .bl{font-size:12.5px;color:#8a8a8a;line-height:1.6;margin-top:12px;max-width:34ch}
.foot h5{font-family:Inter,system-ui,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}
.foot a{display:block;font-size:13px;color:#bdbdbd;padding:5px 0}
.foot a:hover{color:#fff}
.foot .base{border-top:1px solid #222;margin-top:34px;padding-top:18px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-family:Inter,system-ui,sans-serif;font-size:10.5px;color:#6a6a6a;letter-spacing:.04em}
@media(max-width:980px){.hero{grid-template-columns:1fr;gap:28px}.band{grid-template-columns:1fr;gap:24px}.spot{grid-template-columns:1fr;gap:24px}.an3{grid-template-columns:1fr 1fr}.decon .in{grid-template-columns:1fr;gap:22px}.foot .cols{grid-template-columns:1fr 1fr}}
@media(max-width:680px){.g4{grid-template-columns:1fr 1fr}.an3{grid-template-columns:1fr}.crit{grid-template-columns:1fr}.appnav .links{display:none}.kpis .k{padding:0 14px}.foot .cols{grid-template-columns:1fr}}
@media(max-width:460px){.g4{grid-template-columns:1fr}}
/* in-page reader modal */
.modal{position:fixed;inset:0;z-index:200;display:none;background:rgba(8,8,8,.62);backdrop-filter:blur(3px);overflow-y:auto}
.modal.open{display:block}
.modal .sheet{position:relative;max-width:760px;margin:48px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.55)}
.modal .x{position:absolute;top:14px;right:14px;z-index:2;width:38px;height:38px;border-radius:50%;border:none;background:rgba(8,8,8,.55);color:#fff;font-size:15px;cursor:pointer}
.modal .mhd{position:relative;height:300px}
.modal .mhd img{width:100%;height:100%;object-fit:cover}
.modal .mhd .tag{position:absolute;left:18px;bottom:16px;background:var(--gold);color:#1A1A1A;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px}
.modal .mbody{padding:28px 34px 38px}
.modal .mrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.modal h1{font-size:clamp(26px,3.4vw,40px);font-weight:800;line-height:1.1;letter-spacing:-.01em;color:var(--ink)}
.modal .mby{margin-top:12px;font-size:12px;color:var(--mut);font-weight:600}
.modal .msum{margin-top:18px;font-size:16px;line-height:1.7;color:var(--ink);white-space:pre-line}
.modal .blk{margin-top:22px}
.modal .blk .l{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-d);margin-bottom:7px}
.modal .blk .t{font-size:14.5px;line-height:1.65;color:var(--sub);white-space:pre-line}
.modal .mcta{margin-top:26px;padding-top:22px;border-top:1px solid var(--line)}
body.locked{overflow:hidden}
@media(max-width:560px){.modal .sheet{margin:0;border-radius:0;min-height:100%}.modal .mhd{height:200px}.modal .mbody{padding:22px 20px 32px}}
`;

// Client-side runtime: category filtering + in-page incident reader (no nav to
// the app). String-concatenated JS so the only ${} below are intentional
// server-side interpolations (CAT maps, APP).
const JS = `
(function(){
var DATA=window.__HUB__||[];var byId={};DATA.forEach(function(a){byId[String(a.id)]=a;});
var SEV_C={5:"#FF3B30",4:"#FF6B35",3:"#F5B800",2:"#34C759",1:"#8E8E93"},SEV_L={5:"CRITICAL",4:"HIGH",3:"MEDIUM",2:"LOW",1:"MINIMAL"};
var CAT_NAME=${JSON.stringify(CAT_NAME)},CAT_IMG=${JSON.stringify(CAT_IMG)},APP=${JSON.stringify(APP)};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c];});}
function im(a){return CAT_IMG[a.primary_category]||CAT_IMG._d;}
function fmtDay(iso){try{return new Date(iso+"T00:00:00Z").toUTCString().slice(0,16);}catch(e){return iso||"";}}
function fmtShort(iso){try{return new Date(iso+"T00:00:00Z").toUTCString().slice(5,11);}catch(e){return iso||"";}}
function catName(a){return CAT_NAME[a.primary_category]||a.primary_category||"OPS";}
function place(a){return [a.entity,a.country].filter(Boolean).join(" · ");}
function sevChip(a){return '<span class="sev" style="background:'+SEV_C[a.severity]+'1c;color:'+SEV_C[a.severity]+';border-color:'+SEV_C[a.severity]+'55">'+(SEV_L[a.severity]||"—")+'</span>';}
function kick(t){return '<span class="kick">'+esc(t)+'</span>';}
function cardHTML(a){return '<a class="card" data-id="'+a.id+'" href="#"><div class="img"><img src="'+im(a)+'" loading="lazy" alt=""></div><div class="bd"><div class="row">'+sevChip(a)+kick(catName(a))+'<span class="day">'+esc(fmtShort(a.incident_day))+'</span></div><h3>'+esc(a.headline)+'</h3><div class="by">'+esc(place(a))+'</div>'+(a.summary?'<p>'+esc(a.summary)+'</p>':'')+'</div></a>';}
var modal=document.getElementById('modal');
function openModal(a){
 document.getElementById('mimg').src=im(a);
 document.getElementById('mtag').textContent=catName(a);
 document.getElementById('mmeta').innerHTML=sevChip(a)+kick(a.primary_subcategory_name||catName(a))+'<span class="kick" style="color:#8a8a8a">'+esc(fmtDay(a.incident_day))+'</span>';
 document.getElementById('mh').textContent=a.headline;
 document.getElementById('mby').textContent=[a.entity,a.country,a.industry||a.sector].filter(Boolean).join("   ·   ");
 document.getElementById('msum').textContent=a.summary||"";
 function blk(l,t){return t?'<div class="blk"><div class="l">'+l+'</div><div class="t">'+esc(t)+'</div></div>':"";}
 document.getElementById('mblocks').innerHTML=blk("Why this severity",a.severity_rationale)+blk("Threat actor",a.threat_actor)+blk("If you operate this, then",a.if_you_operate_x_then_y);
 document.getElementById('mmap').href=APP+"/?hub&open="+encodeURIComponent(a.id);
 modal.classList.add('open');document.body.classList.add('locked');modal.scrollTop=0;
}
function closeModal(){modal.classList.remove('open');document.body.classList.remove('locked');}
document.getElementById('mx').addEventListener('click',closeModal);
modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
var editorial=document.getElementById('editorial'),fv=document.getElementById('filterView');
function filter(cat){
 var ns=document.querySelectorAll('.catnav a');for(var i=0;i<ns.length;i++){ns[i].className=(ns[i].getAttribute('data-cat')===cat)?'on':'';}
 if(cat==='ALL'){editorial.style.display='';fv.style.display='none';window.scrollTo({top:0,behavior:'smooth'});return;}
 var list=DATA.filter(function(a){return a.primary_category===cat;});
 fv.innerHTML='<div class="wrap"><div class="sh l"><span class="sq" style="background:var(--gold)"></span><h2>'+(CAT_NAME[cat]||cat)+'</h2><span class="more">'+list.length+' briefings</span></div><div class="latest">'+list.map(cardHTML).join('')+'</div></div>';
 editorial.style.display='none';fv.style.display='';window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',function(e){
 var el=e.target.closest&&e.target.closest('[data-id]');
 if(el){e.preventDefault();var a=byId[el.getAttribute('data-id')];if(a)openModal(a);return;}
 var c=e.target.closest&&e.target.closest('[data-cat]');
 if(c){e.preventDefault();filter(c.getAttribute('data-cat'));}
});
})();
`;

// ── component builders ─────────────────────────────────────────────────────
const railItem = (a, num) => `<a href="${href(a)}" data-id="${a.id}">${num ? `<span class="num">${num}</span>` : ""}<div><div class="mrow">${sevChip(a)}${kicker(catName(a))}</div><h4>${esc(a.headline)}</h4><div class="by">${esc(place(a))}</div></div></a>`;
const moreItem = a => `<a class="moreitem" data-id="${a.id}" href="${href(a)}"><div class="mrow" style="margin-bottom:4px">${sevChip(a)}<span class="by">${esc(fmtShort(a.incident_day))}</span></div><h4>${esc(a.headline)}</h4><div class="by">${esc(place(a))}</div></a>`;
const story = a => `<a class="story" data-id="${a.id}" href="${href(a)}"><div class="img"><img src="${im(a)}" alt="" loading="lazy"></div><div class="row">${sevChip(a)}${kicker(catName(a))}</div><h3>${esc(a.headline)}</h3><div class="by">${esc(place(a))}</div></a>`;
const card = a => `<a class="card" data-id="${a.id}" href="${href(a)}"><div class="img"><img src="${im(a)}" alt="" loading="lazy"></div><div class="bd"><div class="row">${sevChip(a)}${kicker(catName(a))}<span class="day">${esc(fmtShort(a.incident_day))}</span></div><h3>${esc(a.headline)}</h3><div class="by">${esc(place(a))}</div>${a.summary ? `<p>${esc(a.summary)}</p>` : ""}</div></a>`;
const sideLead = a => `<a class="side" data-id="${a.id}" href="${href(a)}"><div class="row">${sevChip(a)}${kicker(catName(a))}</div><h3>${esc(a.headline)}</h3>${a.summary ? `<div class="dek">${esc(a.summary)}</div>` : ""}<div class="by" style="margin-top:9px">${esc(place(a))} · ${esc(fmtShort(a.incident_day))}</div></a>`;

function band(catCode, lead, more) {
  return `<section class="sec"><div class="wrap"><div class="sh l"><span class="sq" style="background:${SEV_C[lead.severity] || '#F5B800'}"></span><h2 class="serif">${esc(CAT_NAME[catCode] || catCode)}</h2><a class="more" data-cat="${catCode}" href="#">More in ${esc(CAT_NAME[catCode] || catCode)} ›</a></div>
  <div class="band"><a class="feat" data-id="${lead.id}" href="${href(lead)}"><div class="img"><img src="${im(lead)}" alt="" loading="lazy"></div><div class="row">${sevChip(lead)}${kicker(catName(lead))}<span class="by">${esc(fmtShort(lead.incident_day))}</span></div><h3>${esc(lead.headline)}</h3>${lead.summary ? `<div class="dek">${esc(lead.summary)}</div>` : ""}<div class="rm" style="margin-top:12px">Read full briefing →</div></a>
  <div><div class="morehead">More in ${esc(CAT_NAME[catCode] || catCode)}</div>${more.map(moreItem).join("")}</div></div></div></section>`;
}

function opCard(a) {
  const take = a.if_you_operate_x_then_y || a.severity_rationale || a.summary || "";
  return `<a class="opc" data-id="${a.id}" href="${href(a)}"><div class="q">“</div><h3>${esc(clip(a.headline, 90))}</h3><p>${esc(clip(take, 180))}</p><div class="auth"><span class="av">${esc((a.primary_category || "G").slice(0, 3))}</span><div><div class="an">GUARD Analysis</div><div class="ad">${esc(CAT_NAME[a.primary_category] || "Risk")} desk · ${esc(fmtShort(a.incident_day))}</div></div></div></a>`;
}

function build(items, catCounts) {
  const featured = items[0];
  const leftLeads = items.slice(1, 3);
  const picks = items.slice(3, 8);
  const top = items.slice(8, 12);
  const spotMain = items[12], spotSide = items.slice(13, 15);
  const crit = items.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 5);
  const latest = items.slice(15, 39);
  const latestDay = items[0] && items[0].incident_day;
  const navCats = ["ALL", ...catCounts.map(c => c[0])];

  // Embed the full feed so the page is self-contained — category filtering and
  // the incident reader run client-side, no navigation to the app.
  const slim = items.map(a => ({
    id: a.id, headline: a.headline, summary: a.summary, entity: a.entity,
    country: a.country, industry: a.industry, sector: a.sector, severity: a.severity,
    primary_category: a.primary_category, primary_subcategory_name: a.primary_subcategory_name,
    severity_rationale: a.severity_rationale, threat_actor: a.threat_actor,
    if_you_operate_x_then_y: a.if_you_operate_x_then_y, incident_day: a.incident_day,
  }));
  const dataJson = JSON.stringify(slim).replace(/</g, "\\u003c");

  // Per-category bands — top 4 categories that have >= 4 stories each.
  const byCat = {};
  for (const a of items) { (byCat[a.primary_category] = byCat[a.primary_category] || []).push(a); }
  const bandCats = catCounts.filter(([c]) => (byCat[c] || []).length >= 4).slice(0, 4).map(c => c[0]);

  // Analysis = items carrying an operator takeaway / rationale (distinct headlines).
  const analysis = items.filter(a => a.if_you_operate_x_then_y || a.severity_rationale).slice(0, 3);
  const decon = items.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0))[0];

  const stats = {
    total: items.length,
    countries: new Set(items.map(a => a.country).filter(Boolean)).size,
    sectors: new Set(items.map(a => a.industry || a.sector).filter(Boolean)).size,
    critical: items.filter(a => (a.severity || 0) >= 4).length,
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>The Attacked Hub — Global Risk Intelligence</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="icon" href="/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>

<header class="appnav"><div class="wrap">
  <a class="brand" href="${APP}/"><img src="/attacked-ai-logo.svg" alt="Attacked.ai" width="30" height="30"><span>Attacked<b>.ai</b><sup>™</sup></span></a>
  <nav class="navlinks"><a href="${APP}/?home">Attack Map</a><span class="on">Attacked Hub</span><a href="${APP}/?pricing">Pricing</a><a class="si" href="${APP}/?home">Sign in</a><a class="sub" href="${APP}/?home">Subscribe</a></nav>
</div></header>

<header class="mast"><div class="wrap"><div class="bar"></div><h1 class="serif">The Attacked <i>Hub</i></h1><p>Every incident — cyber, financial, geopolitical, physical — classified through the GUARD framework, geolocated, and written for operators.</p>
<div class="kpis"><div class="k"><div class="v">${stats.total}</div><div class="l">Incidents</div></div><div class="k"><div class="v">${stats.critical}</div><div class="l">Critical / High</div></div><div class="k"><div class="v">${stats.countries}</div><div class="l">Countries</div></div><div class="k"><div class="v">${stats.sectors}</div><div class="l">Sectors</div></div></div></div></header>

<nav class="catnav"><div class="wrap">${navCats.map((c, i) => `<a class="${i === 0 ? "on" : ""}" data-cat="${c}" href="#">${esc(c === "ALL" ? "All" : (CAT_NAME[c] || c))}</a>`).join("")}</div></nav>

<div id="editorial">
<main class="wrap" style="padding-top:30px">

  <section class="hero">
    <div class="hol col">${leftLeads.map(sideLead).join("")}</div>
    <a class="lead col" data-id="${featured.id}" href="${href(featured)}">
      <div class="img"><img src="${im(featured)}" alt="" loading="lazy"></div>
      <div class="row">${kicker("Lead briefing")}${sevChip(featured)}<span class="by">${esc(fmtDay(featured.incident_day))}</span></div>
      <h2 class="serif">${esc(featured.headline)}</h2>
      <div class="by" style="margin-top:10px">${esc([featured.entity, featured.country, featured.industry || featured.sector].filter(Boolean).join("   ·   "))}</div>
      ${featured.summary ? `<p class="dek">${esc(featured.summary)}</p>` : ""}
      <div class="rm" style="margin-top:13px">Read full briefing →</div>
    </a>
    <aside class="col"><div class="picks-h">Editor's picks</div><div class="rail">${picks.map(a => railItem(a)).join("")}</div></aside>
  </section>
</main>

${top.length ? `<div class="wrap"><section class="sec"><div class="sh"><span class="ln"></span><h2 class="serif">Top Stories</h2><span class="ln"></span></div><div class="g4">${top.map(story).join("")}</div></section></div>` : ""}

${spotMain ? `<div class="wrap"><section class="sec"><div class="sh"><span class="ln"></span><h2 class="serif">Spotlight</h2><span class="ln"></span></div><div class="spot">
  <a class="big" data-id="${spotMain.id}" href="${href(spotMain)}"><div class="img"><img src="${im(spotMain)}" alt="" loading="lazy"></div><div class="row">${sevChip(spotMain)}${kicker(catName(spotMain))}<span class="by">${esc(fmtShort(spotMain.incident_day))}</span></div><h3 class="serif">${esc(spotMain.headline)}</h3>${spotMain.summary ? `<div class="dek">${esc(spotMain.summary)}</div>` : ""}</a>
  <div>${spotSide.map(a => `<a class="aside" data-id="${a.id}" href="${href(a)}" style="display:block;margin-bottom:22px"><div class="img"><img src="${im(a)}" alt="" loading="lazy"></div><div class="row">${sevChip(a)}${kicker(catName(a))}</div><h3 class="serif">${esc(a.headline)}</h3></a>`).join("")}</div>
</div></section></div>` : ""}

${bandCats.map(c => band(c, byCat[c][0], byCat[c].slice(1, 6))).join("")}

${analysis.length ? `<section class="analysis sec" style="margin-top:48px;padding:42px 0"><div class="wrap"><div class="sh l"><span class="sq" style="background:var(--gold)"></span><h2 class="serif">GUARD Analysis</h2><span class="more">Operator takeaways</span></div><div class="an3">${analysis.map(opCard).join("")}</div></div></section>` : ""}

${decon ? `<section class="decon sec" style="margin-top:0;padding:48px 0"><div class="wrap"><div class="sh l" style="border-bottom-color:#333"><span class="sq" style="background:var(--gold)"></span><h2 class="serif" style="color:#fff">Deconstructed · one incident, traced</h2></div>
  <div class="in"><a class="img" data-id="${decon.id}" href="${href(decon)}"><img src="${im(decon)}" alt="" loading="lazy"><span class="tag">Blast radius</span></a><div><div class="row" style="margin-bottom:10px">${sevChip(decon)}${kicker(catName(decon), '#F5B800')}</div><h2 class="serif">${esc(decon.headline)}</h2><p>${esc(clip(decon.severity_rationale || decon.summary, 280))}</p><div class="steps"><span class="step"><b>1</b> Entry</span><span class="step"><b>2</b> Spread</span><span class="step"><b>3</b> Impact</span><span class="step"><b>4</b> Blast radius</span></div><div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="${APP}/?home">Trace it on the map →</a><a class="btn gh" data-id="${decon.id}" href="${href(decon)}">Read briefing</a></div></div></div>
</div></section>` : ""}

<div class="wrap">
${crit.length ? `<section class="sec"><div class="sh"><span class="ln"></span><h2 class="serif">Most Critical Today</h2><span class="ln"></span></div><div class="crit"><div class="rail">${crit.slice(0, 3).map((a, i) => railItem(a, i + 1)).join("")}</div><div class="rail">${crit.slice(3, 5).map((a, i) => railItem(a, i + 4)).join("")}</div></div></section>` : ""}

${latest.length ? `<section class="sec"><div class="sh"><span class="ln"></span><h2 class="serif">Latest Intelligence</h2><span class="ln"></span></div><div class="latest">${latest.map(card).join("")}</div></section>` : ""}

<div class="cta"><h3 class="serif">The full picture lives on the map.</h3><p>Blast radius, adaptive controls and vendor Defence Ratings for every briefing above — free to enter, thirty seconds to sign up.</p><a class="btn" href="${APP}/?home">Sign up free →</a></div>
</div>
</div>
<section id="filterView" class="sec" style="display:none;padding-top:24px"></section>

<footer class="foot"><div class="wrap"><div class="cols">
  <div><span class="brand"><img src="/attacked-ai-logo.svg" alt="Attacked.ai" width="28" height="28"><span>Attacked<b>.ai</b><sup>™</sup></span></span><div class="bl">Global risk intelligence. Every incident classified through the GUARD framework, geolocated, with the blast radius traced to named companies.</div></div>
  <div><h5>The Hub</h5><a href="${APP}/?hub">Latest intelligence</a><a href="${APP}/?home">Attack map</a><a href="${APP}/?subscriptions">Daily briefing</a></div>
  <div><h5>Desks</h5>${catCounts.slice(0, 6).map(([c]) => `<a href="${APP}/?hub">${esc(CAT_NAME[c] || c)}</a>`).join("")}</div>
  <div><h5>Company</h5><a href="${APP}/?pricing">Pricing</a><a href="${APP}/?partners">Partners</a><a href="${APP}/?home">Sign in</a></div>
  <div><h5>Method</h5><a href="${APP}/?hub">GUARD framework</a><a href="${APP}/?home">Coverage</a><a href="${APP}/?home">Severity scale</a></div>
</div><div class="base"><span>© ${new Date(latestDay + "T00:00:00Z").getUTCFullYear() || ""} Attacked.ai — Confidential intelligence · GUARD-classified</span><span>Updated ${esc(fmtDay(latestDay))}</span></div></div></footer>

<div class="modal" id="modal" aria-hidden="true"><div class="sheet"><button class="x" id="mx" aria-label="Close">✕</button><div class="mhd"><img id="mimg" alt=""><span class="tag" id="mtag"></span></div><div class="mbody"><div class="mrow" id="mmeta"></div><h1 id="mh"></h1><div class="mby" id="mby"></div><p class="msum" id="msum"></p><div id="mblocks"></div><div class="mcta"><a class="btn" id="mmap" href="#">See the blast radius on the map →</a></div></div></div></div>
<script>window.__HUB__=${dataJson};</script>
<script>${JS}</script>

</body></html>`;
}

(async () => {
  const sel = "id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,severity_rationale,threat_actor,if_you_operate_x_then_y,incident_day,event_date";
  const r = await fetch(`${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=140`, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  let items = await r.json();
  if (!Array.isArray(items)) { console.error("fetch failed", items); process.exit(1); }
  items = items.filter(a => a.headline);
  const m = new Map();
  for (const a of items) { const c = a.primary_category; if (c) m.set(c, (m.get(c) || 0) + 1); }
  const catCounts = [...m.entries()].sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(path.resolve("public", "hub-ft.html"), build(items, catCounts));
  console.log(`OK — full FT edition → public/hub-ft.html · ${items.length} incidents · ${catCounts.length} categories`);
})();
