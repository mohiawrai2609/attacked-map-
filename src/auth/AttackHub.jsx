// ─────────────────────────────────────────────────────────────────────────
// AttackHub — the public Attacked Hub (?hub), FT-style editorial front page.
//
// Financial-Times homepage layout (centred masthead, category nav that doubles
// as a filter, 3-column hero, Top Stories, Spotlight, per-category section bands
// with "More in X" rails, GUARD Analysis op-eds, a cinematic Deconstructed band,
// Most Critical, and a paginated Latest grid) — rendered in our brand: white
// body, gold #F5B800, single Inter typeface, dark SiteNav/SiteFooter.
//
// Fully data-driven and scalable: the live feed merges `incidents` +
// `vi_incidents` (as the map does) and every section/band/KPI is derived from
// that array, so it grows with the data. Clicking any incident opens the full
// briefing in-hub (ArticleView) — no navigation away. CTAs route to the map.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { supabase, supabaseHub } from "../lib/supabaseClient";
import { useAuth } from "./AuthProvider";
import { AuthModal } from "./AuthModal";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

const GOLD = "#F5B800", GOLD_D = "#8A6D00", OB = "#1A1A1A";
const SEV_C = { 5: "#FF3B30", 4: "#FF6B35", 3: GOLD, 2: "#34C759", 1: "#8E8E93" };
const SEV_L = { 5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "MINIMAL" };
const CAT_NAME = {
  CYB: "Cyber", DAT: "Data & Privacy", ENV: "Environmental", FIN: "Financial", GEO: "Geopolitical",
  OPS: "Operations", PHY: "Physical Security", PPL: "People", REG: "Regulatory", REP: "Reputation",
  STR: "Strategic", TEC: "Technology", TPR: "Third Party",
};
// Shorter labels for the single-line category nav (full names used in headings).
const CAT_SHORT = {
  CYB: "Cyber", DAT: "Data", ENV: "Environment", FIN: "Financial", GEO: "Geopolitical",
  OPS: "Operations", PHY: "Physical", PPL: "People", REG: "Regulatory", REP: "Reputation",
  STR: "Strategic", TEC: "Technology", TPR: "Third Party",
};
const CATEGORY_IMG = {
  CYB: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1000&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1000&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1000&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1000&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1000&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1000&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1000&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1000&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1000&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1000&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1000&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1000&q=70&auto=format&fit=crop",
  _default: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1000&q=70&auto=format&fit=crop",
};
const PAGE_SIZE = 12;

// A varied image pool so a single-category view doesn't repeat one photo on
// every card. Big "lead" slots stay thematic (imLead); small cards spread across
// the pool deterministically by incident id (imVaried), so the same incident
// always gets the same image but neighbours differ.
// Extra serious risk/intel imagery (verified-loading) to widen the variety pool
// so single-category pages don't repeat photos.
const EXTRA_POOL = [
  "1526374965328-7f61d4dc18c5", "1510511336377-1a9caa095849", "1551288049-bebda4e38f71",
  "1597852074816-d933c7d2b988", "1488229297570-58520851e868", "1590283603385-17ffb3a7f29f",
  "1612178991541-b48cc8e92a4d", "1502920917128-1aa500764cbd", "1494412574643-ff11b0a5c1c3",
  "1473341304170-971dccb5ac1e", "1486406146926-c627a92ad1ab", "1581092160562-40aa08e78837",
  "1589578527966-fdac0f44566c", "1444723121867-7a241cacace9", "1581094794329-c8112a89af12",
  "1504384764586-bb4cdc1707b0", "1526628953301-3e589a6a8b74",
].map(id => `https://images.unsplash.com/photo-${id}?w=1000&q=70&auto=format&fit=crop`);
const IMG_POOL = [...Object.keys(CATEGORY_IMG).filter(k => k !== "_default").map(k => CATEGORY_IMG[k]), ...EXTRA_POOL];
function hashId(id) { let h = 5381; const s = String(id); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
const imLead = (a) => a.image_url || CATEGORY_IMG[a.primary_category] || CATEGORY_IMG._default;
const imVaried = (a) => a.image_url || IMG_POOL[hashId(a.id) % IMG_POOL.length] || CATEGORY_IMG._default;
const catName = (a) => CAT_NAME[a.primary_category] || a.primary_category || "OPS";
const place = (a) => [a.entity, a.country].filter(Boolean).join(" · ");
const fmtDay = (iso) => { try { return new Date(iso + "T00:00:00Z").toUTCString().slice(0, 16); } catch { return iso || ""; } };
const fmtShort = (iso) => { try { return new Date(iso + "T00:00:00Z").toUTCString().slice(5, 11); } catch { return iso || ""; } };

// Scoped FT CSS — everything namespaced under .hubft so it can't collide with
// the rest of the app. Injected once. Hover/zoom/responsive live here; data and
// layout are React. A single Inter typeface throughout.
const HUB_CSS = `
.hubft{--gold:${GOLD};--gold-d:${GOLD_D};--ink:#14130F;--sub:#3D3A33;--mut:#6E6A60;--line:#E6E3DB;--rule:#DAD6CC;--ob:${OB};background:#fff;color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hubft button,.hubft select,.hubft input,.hubft textarea,.hubft optgroup{font-family:Inter,system-ui,sans-serif}
.hubft .wrap{max-width:1280px;margin:0 auto;padding:0 clamp(18px,4vw,44px)}
.hubft .kick{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-d)}
.hubft .sev{display:inline-block;font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;border:1px solid;white-space:nowrap}
.hubft .by{font-size:11px;color:var(--mut)}
.hubft img{display:block}
.hubft .mast{text-align:center;padding:34px 0 22px;border-bottom:1px solid var(--line);background:radial-gradient(ellipse 60% 100% at 50% 0%,rgba(245,184,0,.07),transparent 70%)}
.hubft .mast .bar{width:54px;height:3px;background:var(--gold);margin:0 auto 18px}
.hubft .mast h1{font-size:clamp(40px,6.2vw,70px);font-weight:700;line-height:1;letter-spacing:-.01em}
.hubft .mast h1 i{color:var(--gold-d);font-style:italic}
.hubft .mast p{max-width:560px;margin:12px auto 0;font-size:14px;line-height:1.55;color:var(--mut)}
.hubft .kpis{display:flex;justify-content:center;flex-wrap:wrap;margin-top:18px}
.hubft .kpis .k{padding:0 22px;border-right:1px solid var(--line)}
.hubft .kpis .k:last-child{border-right:none}
.hubft .kpis .v{font-size:21px;font-weight:700}
.hubft .kpis .l{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-top:2px}
.hubft .catnav{border-bottom:1px solid var(--line);background:#fff}
.hubft .catnav .wrap{display:flex;flex-wrap:nowrap;justify-content:safe center;gap:0;overflow-x:auto;scrollbar-width:none}
.hubft .catnav .wrap::-webkit-scrollbar{display:none}
.hubft .catnav button{padding:12px 9px;background:none;border:none;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:500;letter-spacing:0;text-transform:uppercase;color:var(--mut);white-space:nowrap;border-bottom:2px solid transparent}
.hubft .catnav button.on{color:var(--ink);font-weight:700;border-bottom-color:var(--gold)}
.hubft .catnav button:hover{color:var(--ink)}
.hubft .filterbar{display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap;padding:18px 0 0}
.hubft .filterbar .cnt{margin-right:auto;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.hubft select{appearance:none;-webkit-appearance:none;padding:7px 28px 7px 11px;border-radius:4px;cursor:pointer;outline:none;background:#fff;border:1px solid var(--line);color:var(--sub);font-family:inherit;font-size:11px;font-weight:500;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236E6A60' stroke-width='2.5'><path d='M6 9l6 6 6-6'/></svg>");background-repeat:no-repeat;background-position:right 9px center}
.hubft select.act{background-color:rgba(245,184,0,.12);border-color:rgba(245,184,0,.4);color:var(--gold-d)}
.hubft .clr{padding:7px 12px;border-radius:4px;cursor:pointer;background:transparent;border:1px solid var(--line);color:var(--mut);font-family:inherit;font-size:10.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase}
.hubft .sh{display:flex;align-items:center;gap:18px;margin:8px 0 24px}
.hubft .sh .ln{flex:1;border-top:1px dotted var(--rule)}
.hubft .sh h2{font-weight:700;font-size:18px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
.hubft .sh.l{justify-content:flex-start;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:20px;gap:12px}
.hubft .sh.l .ln{display:none}.hubft .sh.l h2{font-size:20px;letter-spacing:-.01em;text-transform:none}
.hubft .sh.l .sq{width:9px;height:9px;border-radius:2px}
.hubft .sh.l .more{margin-left:auto;font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--gold-d);background:none;border:none;cursor:pointer;font-family:inherit;text-transform:uppercase}
.hubft .sec{padding:46px 0 0}
.hubft .hero{display:grid;grid-template-columns:.92fr 1.5fr .92fr;gap:34px;padding:30px 0 0;align-items:start}
.hubft .col{display:flex;flex-direction:column}
.hubft .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hubft .rm{font-size:11px;font-weight:600;color:var(--gold-d);letter-spacing:.06em;text-transform:uppercase}
.hubft .lead{cursor:pointer}
.hubft .lead .img{border:1px solid var(--line);overflow:hidden;margin-bottom:15px;transition:border-color .22s,box-shadow .22s}
.hubft .lead .img img{width:100%;object-fit:cover;transition:transform .55s}
.hubft .lead:hover .img{border-color:var(--gold);box-shadow:0 16px 38px rgba(20,20,20,.13)}
.hubft .lead:hover .img img{transform:scale(1.04)}
.hubft .lead h2{font-size:clamp(30px,3.4vw,44px);font-weight:700;line-height:1.05;letter-spacing:-.01em;margin:11px 0 0}
.hubft .lead:hover h2{color:var(--gold-d)}
.hubft .lead .dek{margin-top:13px;font-size:15px;line-height:1.66;color:var(--sub);-webkit-line-clamp:4;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .side{cursor:pointer;padding-bottom:18px}
.hubft .side h3{font-size:27px;font-weight:700;line-height:1.1;margin:9px 0 0}
.hubft .side:hover h3{color:var(--gold-d)}
.hubft .side .dek{margin-top:9px;font-size:13px;line-height:1.55;color:var(--sub);-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .side+.side{border-top:1px solid var(--line);padding-top:18px}
.hubft .picks-h{font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding-bottom:11px;border-bottom:2px solid var(--ink)}
.hubft .ri{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line);cursor:pointer}
.hubft .rail .ri:first-child{border-top:none}
.hubft .ri .num{font-size:20px;font-weight:700;color:var(--gold-d);line-height:1;min-width:24px}
.hubft .ri h4{font-size:18px;font-weight:600;line-height:1.16;-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .ri:hover h4{color:var(--gold-d)}
.hubft .mrow{display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap}
.hubft .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.hubft .story{cursor:pointer}
.hubft .story .img{border:1px solid var(--line);overflow:hidden;margin-bottom:11px}
.hubft .story .img img{width:100%;object-fit:cover;transition:transform .5s}
.hubft .story:hover .img img{transform:scale(1.05)}
.hubft .story h3{font-size:20px;font-weight:600;line-height:1.16;margin-top:7px;-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .story:hover h3{color:var(--gold-d)}
.hubft .spot{display:grid;grid-template-columns:1.7fr 1fr;gap:30px;align-items:start}
.hubft .spot .big,.hubft .spot .aside{cursor:pointer}
.hubft .spot .img{overflow:hidden;border:1px solid var(--line);margin-bottom:12px}
.hubft .spot .img img{width:100%;object-fit:cover;transition:transform .55s}
.hubft .spot .big:hover .img img,.hubft .spot .aside:hover .img img{transform:scale(1.04)}
.hubft .spot .big h3{font-size:32px;font-weight:700;line-height:1.08;margin-top:6px}
.hubft .spot .big:hover h3{color:var(--gold-d)}
.hubft .spot .big .dek{margin-top:11px;font-size:14px;color:var(--sub);line-height:1.6;-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .spot .aside{display:block;margin-bottom:22px}
.hubft .spot .aside h3{font-size:23px;font-weight:600;line-height:1.14;margin-top:6px}
.hubft .spot .aside:hover h3{color:var(--gold-d)}
.hubft .band{display:grid;grid-template-columns:1.5fr 1fr;gap:34px;align-items:start}
.hubft .band .feat{cursor:pointer}
.hubft .band .feat .img{overflow:hidden;border:1px solid var(--line);margin-bottom:13px}
.hubft .band .feat .img img{width:100%;object-fit:cover;transition:transform .55s}
.hubft .band .feat:hover .img img{transform:scale(1.04)}
.hubft .band .feat h3{font-size:28px;font-weight:700;line-height:1.1;margin-top:6px}
.hubft .band .feat:hover h3{color:var(--gold-d)}
.hubft .band .feat .dek{margin-top:10px;font-size:14px;color:var(--sub);line-height:1.6;-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .morehead{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding-bottom:10px;border-bottom:1px solid var(--ink)}
.hubft .moreitem{display:block;padding:12px 0;border-top:1px solid var(--line);cursor:pointer}
.hubft .moreitem:first-of-type{border-top:none}
.hubft .moreitem h4{font-size:18px;font-weight:600;line-height:1.18}
.hubft .moreitem:hover h4{color:var(--gold-d)}
.hubft .analysis{background:#FAF8F3;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.hubft .an3{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.hubft .opc{cursor:pointer}
.hubft .opc .q{font-size:34px;line-height:0;color:var(--gold-d);height:18px}
.hubft .opc h3{font-size:23px;font-weight:700;line-height:1.18;margin-top:6px}
.hubft .opc:hover h3{color:var(--gold-d)}
.hubft .opc p{margin-top:9px;font-size:13px;color:var(--sub);line-height:1.6;-webkit-line-clamp:4;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .opc .auth{display:flex;align-items:center;gap:10px;margin-top:13px}
.hubft .opc .av{width:38px;height:38px;border-radius:50%;background:rgba(245,184,0,.14);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--gold-d)}
.hubft .opc .an{font-size:12px;font-weight:700}.hubft .opc .ad{font-size:10px;color:var(--mut)}
.hubft .decon{background:var(--ob);color:#fff}
.hubft .decon .in{display:grid;grid-template-columns:1.3fr 1fr;gap:34px;align-items:center}
.hubft .decon .img{position:relative;overflow:hidden;border-radius:4px;cursor:pointer}
.hubft .decon .img img{width:100%;object-fit:cover;transition:transform .6s}
.hubft .decon:hover .img img{transform:scale(1.05)}
.hubft .decon .tag{position:absolute;left:16px;bottom:16px;background:var(--gold);color:#1A1A1A;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px}
.hubft .decon h2{font-size:clamp(28px,3vw,40px);font-weight:700;line-height:1.08}
.hubft .decon p{margin-top:14px;font-size:14px;color:#bdbdbd;line-height:1.66}
.hubft .decon .steps{display:flex;gap:8px;margin-top:18px;flex-wrap:wrap}
.hubft .decon .step{font-size:10px;color:#A8A8A8;border:1px solid #333;border-radius:3px;padding:5px 9px}
.hubft .decon .step b{color:var(--gold)}
.hubft .btn{display:inline-block;background:var(--gold);color:#1A1A1A;border:none;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;padding:12px 24px;border-radius:4px;transition:transform .15s}
.hubft .btn:hover{transform:translateY(-2px)}
.hubft .btn.gh{background:transparent;color:#fff;border:1px solid #444}
.hubft .crit{display:grid;grid-template-columns:1fr 1fr;gap:0 48px}
.hubft .latest{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:26px}
.hubft .card{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .2s;display:flex;flex-direction:column}
.hubft .card:hover{border-color:var(--gold);box-shadow:0 12px 30px rgba(20,20,20,.10);transform:translateY(-2px)}
.hubft .card .img{overflow:hidden}
.hubft .card .img img{width:100%;object-fit:cover;transition:transform .5s}
.hubft .card:hover .img img{transform:scale(1.05)}
.hubft .card .bd{padding:0 17px 17px}
.hubft .card .crow{display:flex;align-items:center;gap:7px;margin:14px 0 8px;flex-wrap:wrap}
.hubft .card .day{margin-left:auto;font-size:10px;color:var(--mut)}
.hubft .card h3{font-size:22px;font-weight:700;line-height:1.14;letter-spacing:-.01em;-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .card:hover h3{color:var(--gold-d)}
.hubft .card p{margin-top:9px;font-size:12.5px;line-height:1.55;color:var(--sub);-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hubft .pager{margin-top:44px;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}
.hubft .pager button{min-width:38px;padding:8px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;background:#fff;color:var(--ink);border:1px solid var(--line)}
.hubft .pager button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.hubft .pager button:disabled{color:#C4BCA8;cursor:default}
.hubft .cta{margin-top:54px;text-align:center;padding:42px 24px;background:var(--ob);border-radius:12px}
.hubft .cta h3{font-size:30px;font-weight:700;color:#fff}
.hubft .cta p{max-width:470px;margin:10px auto 0;font-size:13.5px;color:#A8A8A8;line-height:1.6}
.hubft .empty{padding:90px 0;text-align:center;color:var(--mut);font-size:13px}
@media(max-width:980px){.hubft .hero{grid-template-columns:1fr;gap:28px}.hubft .band{grid-template-columns:1fr;gap:24px}.hubft .spot{grid-template-columns:1fr;gap:24px}.hubft .an3{grid-template-columns:1fr 1fr}.hubft .decon .in{grid-template-columns:1fr;gap:22px}}
@media(max-width:680px){.hubft .g4{grid-template-columns:1fr 1fr}.hubft .an3{grid-template-columns:1fr}.hubft .crit{grid-template-columns:1fr}.hubft .sh.l{flex-wrap:wrap}.hubft .sh.l .more{margin-left:auto}.hubft .sh h2{white-space:normal}}
@media(max-width:460px){.hubft .g4{grid-template-columns:1fr}}
`;

function HubStyles() {
  useEffect(() => {
    if (document.getElementById("attacked-fonts")) return;
    const l = document.createElement("link");
    l.id = "attacked-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
  }, []);
  return <style>{HUB_CSS}</style>;
}

// Category-themed image with a severity-gradient fallback. Height is explicit
// so the fallback box matches the photo it replaces.
function NewsImage({ a, height, lead }) {
  const [failed, setFailed] = useState(false);
  const sev = SEV_C[a.severity] || GOLD;
  if (failed) {
    return (
      <div style={{
        height, width: "100%", background: `linear-gradient(135deg, ${sev}33, ${OB} 70%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: sev, fontWeight: 800, fontSize: 20, letterSpacing: "0.12em",
      }}>{a.primary_category || "OPS"}</div>
    );
  }
  return <img src={lead ? imLead(a) : imVaried(a)} alt="" loading="lazy" onError={() => setFailed(true)} style={{ height }} />;
}

const SevChip = ({ a }) => (
  <span className="sev" style={{ background: `${SEV_C[a.severity]}1c`, color: SEV_C[a.severity], borderColor: `${SEV_C[a.severity]}55` }}>
    {SEV_L[a.severity] || "—"}
  </span>
);
const Kick = ({ children }) => <span className="kick">{children}</span>;

// ── In-hub reader ──────────────────────────────────────────────────────────
function ArticleView({ article, onBack, onMap, user }) {
  const [full, setFull] = useState(article);
  const [expanded, setExpanded] = useState(false);
  // Load this article's rich `data` jsonb on open (the feed list omits it to
  // stay fast). Merge the narrative/standfirst + detail fields into the article.
  useEffect(() => {
    let cancelled = false;
    setFull(article);
    (async () => {
      try {
        const { data: rows } = await supabaseHub
          .from("incidents").select("data,subtitle").eq("id", article.id).limit(1);
        const r = rows && rows[0];
        if (!r || cancelled) return;
        const d = r.data || {};
        const narrative = Array.isArray(d.narrative) ? d.narrative.filter(Boolean).join("\n\n")
          : (typeof d.narrative === "string" ? d.narrative : "");
        const richBody = [d.standfirst, narrative].filter(Boolean).join("\n\n");
        setFull(prev => ({
          ...prev,
          article_body: richBody || prev.article_body,
          primary_subcategory_name: d.kicker || d.subhead || prev.primary_subcategory_name,
          entity: d.entity || d.org || d.company || prev.entity,
          country: d.country || prev.country,
          location_name: d.location || d.country || prev.location_name,
          severity_rationale: typeof d.takeaway === "string" ? d.takeaway : prev.severity_rationale,
          threat_actor: typeof d.causeTag === "string" ? d.causeTag : prev.threat_actor,
          data: d,
        }));
      } catch { /* keep the lightweight version */ }
    })();
    return () => { cancelled = true; };
  }, [article && article.id]);
  const a = full;
  const meta = [a.entity, a.location_name || a.country, a.industry || a.sector].filter(Boolean).join("   ·   ");
  const body = a.article_body || a.summary || "";
  const longBody = body.length > 360;
  const Block = ({ label, children }) => !children ? null : (
    <section style={{ marginTop: 30 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: GOLD_D, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#3D3A33" }}>{children}</div>
    </section>
  );
  return (
    <main className="r-pad" style={{ padding: "44px 36px 80px", background: "#fff", color: "#14130F", fontFamily: "Inter, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: "#6E6A60", fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>← Back to the feed</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <SevChip a={a} />
          <span className="kick" style={{ color: GOLD_D }}>{a.primary_subcategory_name || catName(a)}</span>
          <span style={{ fontSize: 11.5, color: "#6E6A60", fontWeight: 600 }}>{fmtDay(a.incident_day)}</span>
        </div>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(30px, 4vw, 46px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{a.headline}</h1>
        {meta && <div style={{ marginTop: 14, fontSize: 12.5, color: "#6E6A60", fontWeight: 600 }}>{meta}</div>}
        <div style={{ margin: "24px 0 0", overflow: "hidden", border: "1px solid #E6E3DB" }}>
          <div style={{ width: "100%", overflow: "hidden" }}><NewsImage a={a} height={340} lead /></div>
        </div>
        {body && (
          <p style={{ margin: "26px 0 0", fontSize: 16.5, lineHeight: 1.78, color: "#14130F", whiteSpace: "pre-line",
            ...(longBody && !expanded ? { display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>{body}</p>
        )}
        {(longBody || a.severity_rationale || a.threat_actor || a.if_you_operate_x_then_y || a.financial_impact_disclosed) && (
          <button onClick={() => setExpanded(v => !v)} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 4, cursor: "pointer", background: "transparent", border: `1px solid rgba(245,184,0,0.3)`, color: GOLD_D, fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{expanded ? "Read less ↑" : "Read more ↓"}</button>
        )}
        {expanded && (
          <>
            <Block label="Why this severity">{a.severity_rationale}</Block>
            <Block label="Threat actor">{a.threat_actor}</Block>
            <Block label="If you operate this, then">{a.if_you_operate_x_then_y}</Block>
            <Block label="Disclosed financial impact">{a.financial_impact_disclosed}</Block>
          </>
        )}
        <div style={{ marginTop: 44, padding: "32px 26px", textAlign: "center", background: OB, borderRadius: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>See the blast radius on the map.</div>
          <p style={{ margin: "10px auto 0", maxWidth: 440, fontSize: 13, color: "#A8A8A8", lineHeight: 1.6 }}>Blast radius, adaptive controls and vendor Defence Ratings for this incident — live on the Attack Map.</p>
          <button onClick={onMap} style={{ marginTop: 18, padding: "12px 26px", background: GOLD, color: OB, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{user ? "Open on the map →" : "Sign up to open the map →"}</button>
        </div>
      </div>
    </main>
  );
}

export function AttackHub() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("ALL");
  const [indFilter, setIndFilter] = useState("ALL");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The Attacked Hub reads from the dedicated incident-reporting DB
        // (supabaseHub), NOT the map's primary DB. Its schema differs
        // (title/subtitle + a rich `data` jsonb), so we map each row into the
        // article shape the hub renders.
        // Feed list = LIGHTWEIGHT (no `data` jsonb). The `data` column is large
        // (narrative arrays, dossier, scenarios…); selecting it for every row
        // hits the anon statement-timeout. The list omits it; each article's full
        // `data` is loaded on open (see ArticleView).
        const [incRes, indRes] = await Promise.all([
          supabaseHub.from("incidents")
            .select("id,industry_slug,title,subtitle,severity,confidence,primary_category,categories,event_date,reporter,status,created_at,image_url")
            .limit(5000),
          supabaseHub.from("industries").select("slug,name").limit(500),
        ]);
        const indName = new Map();
        for (const i of indRes.data || []) if (i && i.slug) indName.set(i.slug, i.name);

        // Parse the human event_date ("27 Jun 2026") to an ISO day. Built from
        // the string parts directly — NOT Date.parse, which interprets in the
        // local timezone and then UTC-shifts the day (e.g. "30 Jun" → "29 Jun"
        // in IST). Falls back to created_at only if event_date is missing.
        const MON = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        const toISODay = (s, createdAt) => {
          if (typeof s === "string" && s.trim()) {
            const t = s.trim();
            const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
            const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
            if (m && MON[m[2].slice(0, 3).toLowerCase()]) {
              return `${m[3]}-${MON[m[2].slice(0, 3).toLowerCase()]}-${String(m[1]).padStart(2, "0")}`;
            }
          }
          return typeof createdAt === "string" ? createdAt.slice(0, 10) : null;
        };

        const mapped = (incRes.data || []).map(r => {
          const day = toISODay(r.event_date, r.created_at);
          return {
            id: r.id,
            _key: `h-${r.id}`,
            headline: r.title,
            summary: r.subtitle || "",
            article_body: r.subtitle || "",   // full body loads on open
            severity: r.severity,
            primary_category: r.primary_category,
            primary_subcategory_name: null,
            image_url: r.image_url || null,
            industry: indName.get(r.industry_slug) || r.industry_slug || null,
            sector: indName.get(r.industry_slug) || null,
            entity: null,
            country: null,
            location_name: null,
            reporter: r.reporter,
            confidence: r.confidence,
            status: r.status,
            incident_day: day,
            event_date: day,
            data: null,
          };
        });
        const sorted = mapped
          .filter(a => a.headline)
          .sort((a, b) => (a.incident_day || "") < (b.incident_day || "") ? 1 : (a.incident_day || "") > (b.incident_day || "") ? -1 : (b.severity || 0) - (a.severity || 0));
        if (!cancelled) setArticles(sorted);
      } catch { /* graceful empty */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Deep-link: /?hub&open=<id> opens that briefing directly.
  const didDeepOpen = React.useRef(false);
  useEffect(() => {
    if (didDeepOpen.current || !articles.length) return;
    let openId = null;
    try { openId = new URLSearchParams(window.location.search).get("open"); } catch { /* noop */ }
    if (!openId) { didDeepOpen.current = true; return; }
    const a = articles.find(x => String(x.id) === String(openId) || x._key === `i-${openId}` || x._key === `v-${openId}`);
    if (a) { didDeepOpen.current = true; setSelected(a); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch { window.scrollTo(0, 0); } }
  }, [articles]);

  const cats = ["ALL", ...Array.from(new Set(articles.map(a => a.primary_category).filter(Boolean)))];
  const inds = ["ALL", ...Array.from(new Set(articles.map(a => a.industry).filter(Boolean))).sort()];
  const days = ["ALL", ...Array.from(new Set(articles.map(a => a.incident_day).filter(Boolean)))];
  const visible = articles
    .filter(a => catFilter === "ALL" || a.primary_category === catFilter)
    .filter(a => indFilter === "ALL" || a.industry === indFilter)
    .filter(a => dayFilter === "ALL" || a.incident_day === dayFilter);

  const isFiltered = catFilter !== "ALL" || indFilter !== "ALL" || dayFilter !== "ALL";
  const latestDay = articles[0]?.incident_day;

  // Editorial zoning (unfiltered, page 0). All derived from `visible`, so it scales.
  const featured = visible[0] || null;
  const leftLeads = visible.slice(1, 3);
  const picks = visible.slice(3, 8);
  const top = visible.slice(8, 12);
  const spotMain = visible[12], spotSide = visible.slice(13, 15);
  const byCat = {};
  for (const a of visible) (byCat[a.primary_category] = byCat[a.primary_category] || []).push(a);
  const bandCats = cats.filter(c => c !== "ALL" && (byCat[c] || []).length >= 4).slice(0, 4);
  const analysis = visible.filter(a => a.if_you_operate_x_then_y || a.severity_rationale).slice(0, 3);
  const decon = visible.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0))[0];
  const mostCritical = visible.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 5);

  // Paginated grid — filtered view paginates everything; editorial paginates the tail.
  const gridAll = isFiltered ? visible.slice(5) : visible.slice(15);
  const pageCount = Math.max(1, Math.ceil(gridAll.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const gridPage = gridAll.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const pageWindow = (() => { let s = Math.max(0, safePage - 2); const e = Math.min(pageCount, s + 5); s = Math.max(0, e - 5); const w = []; for (let p = s; p < e; p++) w.push(p); return w; })();

  useEffect(() => { setPage(0); }, [catFilter, indFilter, dayFilter]);

  function goToPage(p) { setPage(Math.max(0, Math.min(p, pageCount - 1))); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0, 0); } }
  function openMap() { if (user) window.location.href = "/"; else setAuthOpen(true); }
  function openArticle(a) { setSelected(a); try { window.scrollTo({ top: 0, behavior: "instant" }); } catch { window.scrollTo(0, 0); } }

  // ── card/rail builders (close over openArticle) ──
  const Card = (a) => (
    <article key={a._key || a.id} className="card" onClick={() => openArticle(a)}
      style={{ borderTop: `3px solid ${SEV_C[a.severity] || GOLD}` }}>
      <div className="img"><NewsImage a={a} height={165} /></div>
      <div className="bd">
        <div className="crow"><SevChip a={a} /><Kick>{catName(a)}</Kick><span className="day">{fmtShort(a.incident_day)}</span></div>
        <h3>{a.headline}</h3>
        <div className="by">{place(a)}</div>
        {a.summary && <p>{a.summary}</p>}
      </div>
    </article>
  );
  const Story = (a) => (
    <article key={a._key || a.id} className="story" onClick={() => openArticle(a)}>
      <div className="img"><NewsImage a={a} height={150} /></div>
      <div className="row"><SevChip a={a} /><Kick>{catName(a)}</Kick></div>
      <h3>{a.headline}</h3>
      <div className="by" style={{ marginTop: 6 }}>{place(a)}</div>
    </article>
  );
  const RailItem = (a, num) => (
    <div key={a._key || a.id} className="ri" onClick={() => openArticle(a)}>
      {num != null && <span className="num">{num}</span>}
      <div style={{ minWidth: 0 }}>
        <div className="mrow"><SevChip a={a} /><Kick>{catName(a)}</Kick></div>
        <h4>{a.headline}</h4>
        <div className="by" style={{ marginTop: 4 }}>{place(a)}</div>
      </div>
    </div>
  );
  const MoreItem = (a) => (
    <div key={a._key || a.id} className="moreitem" onClick={() => openArticle(a)}>
      <div className="mrow" style={{ marginBottom: 4 }}><SevChip a={a} /><span className="by">{fmtShort(a.incident_day)}</span></div>
      <h4>{a.headline}</h4>
      <div className="by" style={{ marginTop: 4 }}>{place(a)}</div>
    </div>
  );
  const SideLead = (a) => (
    <div key={a._key || a.id} className="side" onClick={() => openArticle(a)}>
      <div className="row"><SevChip a={a} /><Kick>{catName(a)}</Kick></div>
      <h3>{a.headline}</h3>
      {a.summary && <div className="dek">{a.summary}</div>}
      <div className="by" style={{ marginTop: 9 }}>{place(a)} · {fmtShort(a.incident_day)}</div>
    </div>
  );
  const OpCard = (a) => (
    <div key={a._key || a.id} className="opc" onClick={() => openArticle(a)}>
      <div className="q">“</div>
      <h3>{a.headline}</h3>
      <p>{a.if_you_operate_x_then_y || a.severity_rationale || a.summary}</p>
      <div className="auth"><span className="av">{(a.primary_category || "G").slice(0, 3)}</span>
        <div><div className="an">GUARD Analysis</div><div className="ad">{catName(a)} desk · {fmtShort(a.incident_day)}</div></div>
      </div>
    </div>
  );
  const SecHead = ({ children }) => (
    <div className="sh"><span className="ln" /><h2>{children}</h2><span className="ln" /></div>
  );

  const Pager = () => pageCount <= 1 ? null : (
    <div className="pager">
      <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 0}>← Prev</button>
      {pageWindow[0] > 0 && <><button onClick={() => goToPage(0)}>1</button><span style={{ color: "#9A9A98" }}>…</span></>}
      {pageWindow.map(p => <button key={p} className={p === safePage ? "on" : ""} onClick={() => goToPage(p)}>{p + 1}</button>)}
      {pageWindow[pageWindow.length - 1] < pageCount - 1 && <><span style={{ color: "#9A9A98" }}>…</span><button onClick={() => goToPage(pageCount - 1)}>{pageCount}</button></>}
      <button onClick={() => goToPage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next →</button>
    </div>
  );

  return (
    <div className="hubft" style={{ minHeight: "100vh" }}>
      <HubStyles />
      <SiteNav active="hub" />

      {selected ? (
        <ArticleView article={selected} onBack={() => setSelected(null)} onMap={openMap} user={user} />
      ) : (
        <>
          {/* CATEGORY NAV (filter) */}
          <nav className="catnav">
            <div className="wrap r-pad">
              {cats.map(c => (
                <button key={c} className={catFilter === c ? "on" : ""} onClick={() => setCatFilter(c)}>
                  {c === "ALL" ? "All" : (CAT_SHORT[c] || CAT_NAME[c] || c)}
                </button>
              ))}
            </div>
          </nav>

          {/* BODY */}
          <main className="wrap r-pad" style={{ paddingBottom: 64 }}>
            {/* Secondary filters */}
            <div className="filterbar">
              <span className="cnt">{visible.length} briefings{catFilter !== "ALL" ? ` · ${CAT_NAME[catFilter] || catFilter}` : ""}</span>
              <select className={indFilter !== "ALL" ? "act" : ""} value={indFilter} onChange={e => setIndFilter(e.target.value)}>
                {inds.map(i => <option key={i} value={i}>{i === "ALL" ? "All industries" : i}</option>)}
              </select>
              <select className={dayFilter !== "ALL" ? "act" : ""} value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
                {days.map(d => <option key={d} value={d}>{d === "ALL" ? "All days" : fmtDay(d).slice(0, 16)}</option>)}
              </select>
              {isFiltered && <button className="clr" onClick={() => { setCatFilter("ALL"); setIndFilter("ALL"); setDayFilter("ALL"); }}>Clear ✕</button>}
            </div>

            {loading ? (
              <div className="empty">Loading the feed…</div>
            ) : !featured ? (
              <div className="empty">No briefings in this category yet.</div>
            ) : isFiltered ? (
              /* ── Filtered category view: editorial lead + rail, then grid ── */
              <section className="sec" style={{ paddingTop: 26 }}>
                <div className="sh l"><span className="sq" style={{ background: catFilter !== "ALL" ? (SEV_C[visible[0]?.severity] || GOLD) : GOLD }} /><h2>{catFilter !== "ALL" ? (CAT_NAME[catFilter] || catFilter) : "Filtered briefings"}</h2><span className="more" style={{ cursor: "default" }}>{visible.length} briefings</span></div>
                {safePage === 0 && visible[0] && (
                  <div className="band" style={{ marginBottom: 40 }}>
                    <div className="feat" onClick={() => openArticle(visible[0])}>
                      <div className="img"><NewsImage a={visible[0]} height={300} lead /></div>
                      <div className="row"><SevChip a={visible[0]} /><Kick>{catName(visible[0])}</Kick><span className="by">{fmtShort(visible[0].incident_day)}</span></div>
                      <h3>{visible[0].headline}</h3>
                      {visible[0].summary && <div className="dek">{visible[0].summary}</div>}
                      <div className="rm" style={{ marginTop: 12 }}>Read full briefing →</div>
                    </div>
                    {visible.length > 1 && (
                      <div><div className="morehead">Latest in {catFilter !== "ALL" ? (CAT_NAME[catFilter] || catFilter) : "this view"}</div>{visible.slice(1, 5).map(MoreItem)}</div>
                    )}
                  </div>
                )}
                {gridPage.length > 0 && <div className="latest">{gridPage.map(Card)}</div>}
                <Pager />
              </section>
            ) : (
              /* ── Full editorial front page ── */
              <>
                {safePage === 0 && (
                  <>
                    <section className="hero">
                      <div className="col">{leftLeads.map(SideLead)}</div>
                      <div className="lead col" onClick={() => openArticle(featured)}>
                        <div className="img"><NewsImage a={featured} height={320} lead /></div>
                        <div className="row"><Kick>Lead briefing</Kick><SevChip a={featured} /><span className="by">{fmtDay(featured.incident_day)}</span></div>
                        <h2>{featured.headline}</h2>
                        <div className="by" style={{ marginTop: 10 }}>{[featured.entity, featured.country, featured.industry || featured.sector].filter(Boolean).join("   ·   ")}</div>
                        {featured.summary && <p className="dek">{featured.summary}</p>}
                        <div className="rm" style={{ marginTop: 13 }}>Read full briefing →</div>
                      </div>
                      {picks.length > 0 && (
                        <aside className="col"><div className="picks-h">Editor's picks</div><div className="rail">{picks.map(a => RailItem(a))}</div></aside>
                      )}
                    </section>

                    {top.length > 0 && (
                      <section className="sec"><SecHead>Top Stories</SecHead><div className="g4">{top.map(Story)}</div></section>
                    )}

                    {spotMain && (
                      <section className="sec"><SecHead>Spotlight</SecHead>
                        <div className="spot">
                          <div className="big" onClick={() => openArticle(spotMain)}>
                            <div className="img"><NewsImage a={spotMain} height={300} lead /></div>
                            <div className="row"><SevChip a={spotMain} /><Kick>{catName(spotMain)}</Kick><span className="by">{fmtShort(spotMain.incident_day)}</span></div>
                            <h3>{spotMain.headline}</h3>
                            {spotMain.summary && <div className="dek">{spotMain.summary}</div>}
                          </div>
                          <div>{spotSide.map(a => (
                            <div key={a._key || a.id} className="aside" onClick={() => openArticle(a)}>
                              <div className="img"><NewsImage a={a} height={170} /></div>
                              <div className="row"><SevChip a={a} /><Kick>{catName(a)}</Kick></div>
                              <h3>{a.headline}</h3>
                            </div>
                          ))}</div>
                        </div>
                      </section>
                    )}

                    {bandCats.map(c => {
                      const list = byCat[c] || [];
                      const lead = list[0]; const more = list.slice(1, 6);
                      return (
                        <section className="sec" key={c}>
                          <div className="sh l"><span className="sq" style={{ background: SEV_C[lead.severity] || GOLD }} /><h2>{CAT_NAME[c] || c}</h2><button className="more" onClick={() => setCatFilter(c)}>More in {CAT_NAME[c] || c} ›</button></div>
                          <div className="band">
                            <div className="feat" onClick={() => openArticle(lead)}>
                              <div className="img"><NewsImage a={lead} height={240} lead /></div>
                              <div className="row"><SevChip a={lead} /><Kick>{catName(lead)}</Kick><span className="by">{fmtShort(lead.incident_day)}</span></div>
                              <h3>{lead.headline}</h3>
                              {lead.summary && <div className="dek">{lead.summary}</div>}
                              <div className="rm" style={{ marginTop: 12 }}>Read full briefing →</div>
                            </div>
                            <div><div className="morehead">More in {CAT_NAME[c] || c}</div>{more.map(MoreItem)}</div>
                          </div>
                        </section>
                      );
                    })}

                    {analysis.length > 0 && (
                      <section className="analysis sec" style={{ marginTop: 48, padding: "42px 0" }}>
                        <div className="wrap"><div className="sh l"><span className="sq" style={{ background: GOLD }} /><h2>GUARD Analysis</h2><span className="more" style={{ cursor: "default" }}>Operator takeaways</span></div>
                          <div className="an3">{analysis.map(OpCard)}</div>
                        </div>
                      </section>
                    )}

                    {decon && (
                      <section className="decon sec" style={{ padding: "48px 0" }}>
                        <div className="wrap"><div className="sh l" style={{ borderBottomColor: "#333" }}><span className="sq" style={{ background: GOLD }} /><h2 style={{ color: "#fff" }}>Deconstructed · one incident, traced</h2></div>
                          <div className="in">
                            <div className="img" onClick={() => openArticle(decon)}><NewsImage a={decon} height={330} lead /><span className="tag">Blast radius</span></div>
                            <div>
                              <div className="row" style={{ marginBottom: 10 }}><SevChip a={decon} /><span className="kick" style={{ color: GOLD }}>{catName(decon)}</span></div>
                              <h2>{decon.headline}</h2>
                              <p>{(decon.severity_rationale || decon.summary || "").slice(0, 280)}</p>
                              <div className="steps"><span className="step"><b>1</b> Entry</span><span className="step"><b>2</b> Spread</span><span className="step"><b>3</b> Impact</span><span className="step"><b>4</b> Blast radius</span></div>
                              <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button className="btn" onClick={openMap}>Trace it on the map →</button>
                                <button className="btn gh" onClick={() => openArticle(decon)}>Read briefing</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {mostCritical.length > 0 && (
                      <section className="sec"><SecHead>Most Critical Today</SecHead>
                        <div className="crit">
                          <div className="rail">{mostCritical.slice(0, 3).map((a, i) => RailItem(a, i + 1))}</div>
                          <div className="rail">{mostCritical.slice(3, 5).map((a, i) => RailItem(a, i + 4))}</div>
                        </div>
                      </section>
                    )}
                  </>
                )}

                {gridAll.length > 0 && (
                  <section className="sec"><SecHead>{safePage === 0 ? "Latest Intelligence" : `Latest Intelligence · Page ${safePage + 1}`}</SecHead>
                    <div className="latest">{gridPage.map(Card)}</div>
                    <Pager />
                  </section>
                )}

                <div className="cta">
                  <h3>The full picture lives on the map.</h3>
                  <p>Blast radius, adaptive controls and vendor Defence Ratings for every briefing above — free to enter, thirty seconds to sign up.</p>
                  <button className="btn" style={{ marginTop: 20 }} onClick={openMap}>{user ? "Open the map →" : "Sign up free →"}</button>
                </div>
              </>
            )}
          </main>
        </>
      )}

      <SiteFooter />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
