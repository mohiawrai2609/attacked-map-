// reportTemplate.js — renders a CMS-authored intelligence report into the SAME
// standalone HTML shell as the 310 baked briefings in public/reports/, so a
// report written in the admin console looks like one that came out of the
// pipeline: same stylesheet (reportShellCss.js, extracted verbatim), same
// section ids — which is also what keeps the free-reader lock working
// (src/lib/reportLock.js locks #r-blast, #r-ctrl and #r-vend).
//
// The editor writes each section in Markdown; empty sections are left out.
// Brand controls (accent colour, light/dark, typeface, heading weight) become
// CSS-variable overrides on top of the shell stylesheet, so a client-branded
// edition is a handful of variables, not a second template.

import { marked } from "marked";
import { REPORT_SHELL_CSS } from "./reportShellCss";

export const REPORT_SECTIONS = [
  { id: "r-sum",     num: "",   eyebrow: "Executive summary",                         title: "",                                     key: "summary",     hint: "The bottom line. 3–6 short paragraphs or bullets. Always shown first." },
  { id: "r-sev",     num: "01", eyebrow: "Severity assessment",                       title: "How serious, and on what axis",        key: "severity",    hint: "Which dimensions carry the weight — financial, operational, regulatory, reputational, human." },
  { id: "r-fcam",    num: "02", eyebrow: "F-CAM · Forensic Causal Analysis",          title: "What drove the outcome",               key: "causes",      hint: "Ranked causes. Say which are on the record and which are inferred." },
  { id: "r-comp",    num: "03", eyebrow: "Comparables & precedent",                   title: "Where we have seen this before",       key: "comparables", hint: "Named precedent cases, year, what happened, why it matters here." },
  { id: "r-frame",   num: "04", eyebrow: "Frameworks triggered",                      title: "The statutory machinery in play",      key: "frameworks",  hint: "Regulations, standards and statutory duties engaged." },
  { id: "r-blast",   num: "05", eyebrow: "Blast radius",                              title: "Who else is exposed",                  key: "blast",       hint: "Named organisations and how the exposure reaches them. Subscriber-only on the Hub.", locked: true },
  { id: "r-ctrl",    num: "06", eyebrow: "Control analysis · GUARD layer",            title: "GUARD controls against the scenario",  key: "controls",    hint: "The GUARD controls this incident surfaces, with owner and evidence. Subscriber-only.", locked: true },
  { id: "r-vend",    num: "07", eyebrow: "Mitigation",                                title: "Vendor intelligence",                  key: "vendors",     hint: "Products and services mapped to the controls above. Subscriber-only.", locked: true },
  { id: "r-out",     num: "08", eyebrow: "Outlook · 6–12 months",                     title: "What to watch next",                   key: "outlook",     hint: "Lanes to watch and the signal in each." },
  { id: "r-scen",    num: "09", eyebrow: "Scenario simulation · Attacked.ai wargame", title: "How this could play out",              key: "scenarios",   hint: "Forward scenarios with likelihood, horizon, trigger and how the room reacts." },
  { id: "r-verdict", num: "10", eyebrow: "Analyst commentary · Attacked.ai house view", title: "Our read",                           key: "verdict",     hint: "The house view, in the analyst's voice." },
  { id: "r-src",     num: "—",  eyebrow: "Sources",                                   title: "What this is built on",                key: "sources",     hint: "One source per line: title — publisher, or a link." },
];

export const REPORT_FONTS = [
  { id: "Inter", label: "Inter (brand)", css: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", gf: "Inter:wght@400;500;600;700;800;900" },
  { id: "Inter Tight", label: "Inter Tight", css: "'Inter Tight', Inter, sans-serif", gf: "Inter+Tight:wght@400;500;600;700;800" },
  { id: "IBM Plex Sans", label: "IBM Plex Sans", css: "'IBM Plex Sans', Inter, sans-serif", gf: "IBM+Plex+Sans:wght@400;500;600;700" },
  { id: "Source Serif 4", label: "Source Serif (editorial)", css: "'Source Serif 4', Georgia, serif", gf: "Source+Serif+4:wght@400;600;700" },
];

export const DEFAULT_BRAND = { accent: "#F5B800", theme: "light", font: "Inter", headingWeight: 800, kicker: "Confidential Intelligence", showBrandFooter: true };

export const CATEGORY_NAME = {
  CYB: "Cyber Security", DAT: "Data & Privacy", ENV: "Environmental", FIN: "Financial", GEO: "Geopolitical",
  OPS: "Operations", PHY: "Physical Security", PPL: "People", REG: "Regulatory", REP: "Reputation",
  STR: "Strategic", TEC: "Technology", TPR: "Third Party",
};
const SEV = { 5: "Critical", 4: "High", 3: "Medium", 2: "Low", 1: "Minimal" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (s) => (s && String(s).trim() ? marked.parse(String(s), { breaks: false, gfm: true }) : "");

function hexToRgb(hex) {
  const m = String(hex || "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [245, 184, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const darken = (hex, k = 0.55) => { const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * k)); return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`; };
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Words → minutes, like the baked shell's readTime.
function readTime(data) {
  const words = REPORT_SECTIONS.map((s) => String(data.sections?.[s.key] || "")).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 210));
}

function brandCss(brand) {
  const b = { ...DEFAULT_BRAND, ...(brand || {}) };
  const font = REPORT_FONTS.find((f) => f.id === b.font) || REPORT_FONTS[0];
  const dark = b.theme === "dark";
  return `
:root{--gold:${b.accent};--gold-dim:${darken(b.accent, 0.62)};--gold-tint:${rgba(b.accent, 0.12)};--gold-text:${darken(b.accent, 0.56)};--border-gold:${rgba(b.accent, 0.55)};}
${dark ? `:root{--obsidian:#0F0F11;--obsidian-deep:#080808;--obsidian-card:#161618;--obsidian-elevated:#1F1F23;--white:#FFFFFF;--text-secondary:#B4B4BA;--text-muted:#7A7A80;--border-subtle:#2A2A2E;--shadow-1:0 1px 3px rgba(0,0,0,.5);--shadow-2:0 8px 24px rgba(0,0,0,.5);--gold-text:${b.accent};}` : ""}
body,.reader,.r-doc,.r-read,.r-rail{font-family:${font.css} !important;}
.r-title{font-weight:${Number(b.headingWeight) || 800} !important;}
.r-hero{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:8px;margin:18px 0 26px;border:1px solid var(--border-subtle);}
.r-md h3{font-size:16px;font-weight:700;margin:22px 0 8px;color:var(--white);}
.r-md h4{font-size:13.5px;font-weight:700;margin:18px 0 6px;color:var(--white);}
.r-md p,.r-md li{font-size:15px;line-height:1.7;color:var(--text-secondary);}
.r-md p{margin:0 0 14px;}
.r-md ul,.r-md ol{margin:0 0 16px 20px;padding:0;}
.r-md li{margin:0 0 6px;}
.r-md strong{color:var(--white);font-weight:700;}
.r-md a{color:var(--gold-text);text-decoration:underline;}
.r-md blockquote{margin:16px 0;padding:12px 18px;border-left:3px solid var(--gold);background:var(--gold-tint);color:var(--white);font-size:15px;line-height:1.6;}
.r-md table{border-collapse:collapse;width:100%;margin:0 0 16px;font-size:13.5px;}
.r-md th,.r-md td{border:1px solid var(--border-subtle);padding:8px 10px;text-align:left;vertical-align:top;color:var(--text-secondary);}
.r-md th{color:var(--white);font-weight:700;background:var(--obsidian-deep);}
.r-md hr{border:0;border-top:1px solid var(--border-subtle);margin:22px 0;}
.r-md code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12.5px;background:var(--obsidian-deep);padding:1px 5px;border-radius:3px;}
`;
}

// The reader chrome the baked shell drives with JS: progress bar, contents
// nav, Back inside the portal iframe, print. Kept tiny and dependency-free.
const SHELL_JS = `
(function(){
  var sc=document.getElementById('readerScroll'), prog=document.getElementById('rProgress');
  if(window.top!==window.self) document.body.classList.add('embedded');
  var btns=Array.prototype.slice.call(document.querySelectorAll('.r-nav-item'));
  var secs=btns.map(function(b){return {btn:b, el:document.getElementById(b.getAttribute('data-target'))};}).filter(function(x){return x.el;});
  btns.forEach(function(b){ b.addEventListener('click', function(){ var el=document.getElementById(b.getAttribute('data-target')); if(el&&sc) sc.scrollTo({top:el.offsetTop-18,behavior:'smooth'}); }); });
  function onScroll(){ if(!sc) return; var max=sc.scrollHeight-sc.clientHeight; if(prog) prog.style.width=(max>0?Math.min(100,sc.scrollTop/max*100):0)+'%';
    var cur=null; secs.forEach(function(s){ if(s.el.offsetTop-40<=sc.scrollTop) cur=s; }); secs.forEach(function(s){ s.btn.classList.toggle('active', s===cur); }); }
  if(sc){ sc.addEventListener('scroll', onScroll, {passive:true}); onScroll(); }
  var back=document.getElementById('rBack'); if(back) back.addEventListener('click', function(){ try{ window.top.history.back(); }catch(e){} });
  Array.prototype.slice.call(document.querySelectorAll('[data-print]')).forEach(function(b){ b.addEventListener('click', function(){ window.print(); }); });
})();`;

// data: { ref, title, subtitle, dek, author, authorTitle, assessedAt, severity, confidence,
//         industry, category, status, takeaway, heroImageUrl, sections: { summary, severity, ... } }
export function renderReport(data = {}, brand = {}) {
  const b = { ...DEFAULT_BRAND, ...(brand || {}) };
  const font = REPORT_FONTS.find((f) => f.id === b.font) || REPORT_FONTS[0];
  const sev = Number(data.severity) || 3;
  const sections = data.sections || {};
  const present = REPORT_SECTIONS.filter((s) => String(sections[s.key] || "").trim());
  const initials = String(data.author || "AI").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "AI";
  const catName = CATEGORY_NAME[data.category] || data.category || "";
  const vitals = [
    ["Industry", data.industry], ["Category", catName ? `${data.category} · ${catName}` : ""], ["Confidence", data.confidence],
    ["Reference", data.ref], ["As of", data.assessedAt], ["Status", data.status || "Assessment v1 · point-in-time"],
  ].filter(([, v]) => v).map(([k, v]) => `<div class="r-vital"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
  const navItems = present.map((s) => `<button class="r-nav-item" data-target="${s.id}">${esc(s.title || s.eyebrow)}</button>`).join("");

  const sectionHtml = present.map((s) => {
    const body = `<div class="r-body r-md">${md(sections[s.key])}</div>`;
    if (s.id === "r-sum") return `<section id="r-sum">${body}</section>`;
    return `<section class="r-sec" id="${s.id}">
      <div class="r-sec-head"><span class="r-sec-num">${esc(s.num)}</span><span class="r-sec-eyebrow">${esc(s.eyebrow)}</span></div>
      <h2 class="r-sec-title">${esc(s.title)}</h2>
      ${body}
    </section>`;
  }).join("\n");

  const railLeft = `<aside class="r-rail r-rail-left">
    <div class="r-rail-block"><span class="r-sevpill"><span class="d"></span>SEV ${sev} · ${esc(SEV[sev] || "")}</span><span class="r-status"><span class="d"></span>${esc(data.status || "Assessment v1")}</span></div>
    <div class="r-rail-block"><div class="r-rail-h">Dossier</div><div class="r-vitals">${vitals}</div></div>
    <div class="r-rail-cta"><p>${b.showBrandFooter ? "An Attacked.ai intelligence briefing — point-in-time, subject to revision as facts emerge." : "Point-in-time intelligence briefing."}</p><button class="r-btn primary" data-print>↓ Download PDF</button></div>
  </aside>`;
  const railRight = `<aside class="r-rail r-rail-right"><div class="r-rail-block"><div class="r-rail-h">Contents</div><div class="r-nav">${navItems}</div></div></aside>`;

  const article = `<article class="r-read">
    <div class="r-eyebrow-strip"><span class="r-conf-tag">${esc(b.kicker || "Confidential Intelligence")}</span><span class="r-ref">${esc(data.ref || "")}${data.status ? " · " + esc(String(data.status).toUpperCase()) : ""}</span></div>
    ${data.kicker ? `<div class="r-kicker">${esc(String(data.kicker).toUpperCase())}</div>` : ""}
    <h1 class="r-title">${esc(data.title || "Untitled report")}</h1>
    ${data.subtitle ? `<p class="r-subtitle">${esc(data.subtitle)}</p>` : ""}
    ${data.dek ? `<p class="r-dek">${esc(data.dek)}</p>` : ""}
    <div class="r-byline">
      <div class="r-byline-l"><div class="r-avatar">${esc(initials)}</div><div><div class="r-author">${esc(data.author || "Attacked.ai Intelligence")}</div><div class="r-author-meta">${esc(data.authorTitle || "GUARD framework analysis")}</div></div></div>
      <div class="r-byline-r"><span class="r-readtime">${readTime(data)} min read</span></div>
    </div>
    <p class="r-assessment">As of ${esc(data.assessedAt || new Date().toUTCString().slice(5, 16))} · Point-in-time, subject to revision as facts emerge · Change-controlled</p>
    ${data.heroImageUrl ? `<img class="r-hero" src="${esc(data.heroImageUrl)}" alt="">` : ""}
    ${sectionHtml}
    ${data.takeaway ? `<section class="r-sec" id="r-board" style="border-top:0;padding-top:0;margin-top:44px"><div class="r-takeaway"><div class="r-takeaway-h">Board takeaway</div><p>${esc(data.takeaway)}</p></div></section>` : ""}
    <div class="r-end"><div class="r-end-eyebrow">${esc(data.ref || "")}</div><h3>${esc(b.kicker || "Confidential intelligence briefing")}</h3><p>This briefing is a point-in-time assessment. Blast radius, GUARD controls and vendor intelligence are subscriber sections on the Attacked Hub.</p><button class="r-btn" data-print>↓ Download PDF</button></div>
    ${b.showBrandFooter ? `<div class="r-foot">Attacked<span class="ai">.ai</span> — ${esc(b.kicker || "Confidential Intelligence")} · Filed by ${esc(data.author || "Attacked.ai Intelligence")} · ${esc(data.assessedAt || "")}</div>` : ""}
  </article>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Attacked.ai · Intelligence Briefing — ${esc(data.title || "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${font.gf}&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${REPORT_SHELL_CSS}</style>
<style>${brandCss(b)}</style>
</head>
<body>
<div class="reader open" id="reader" aria-label="Intelligence briefing — ${esc(data.title || "")}">
  <div class="r-progress" id="rProgress"></div>
  <div class="reader-bar">
    <button class="r-bar-back" id="rBack">← Back</button>
    <div class="reader-actions"><button class="r-btn ghost" data-print>↓ Download PDF</button></div>
  </div>
  <div class="reader-scroll" id="readerScroll">
    <div class="r-doc" id="readerArticle">${railLeft}${article}${railRight}</div>
  </div>
</div>
<script>${SHELL_JS}</script>
</body>
</html>`;
}

// For an UPLOADED baked report: inject the brand overrides without touching
// the file otherwise. Returns the html unchanged when it has no </head>.
export function applyBrandToHtml(html, brand = {}) {
  const i = String(html || "").lastIndexOf("</head>");
  if (i < 0) return html;
  const b = { ...DEFAULT_BRAND, ...(brand || {}) };
  const font = REPORT_FONTS.find((f) => f.id === b.font) || REPORT_FONTS[0];
  const inject = `<link href="https://fonts.googleapis.com/css2?family=${font.gf}&display=swap" rel="stylesheet"><style data-cms-brand>${brandCss(b)}</style>`;
  return html.slice(0, i) + inject + html.slice(i);
}
