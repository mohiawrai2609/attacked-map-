// THE flagship Attack Hub — mixes Bloomberg hero+rail, BBC section bands, TOI
// density, ops-console KPIs + our blast radius. Real CSS system: hover lift,
// image zoom, depth, rhythm. Our brand (Inter + gold + obsidian). Real data.
const fs=require("fs"),path=require("path");
const env={};for(const l of fs.readFileSync(path.resolve(".env"),"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim();}
const SB_URL=env.VITE_SUPABASE_URL,SB_KEY=env.VITE_SUPABASE_ANON_KEY;
const SEV_C={5:"#FF3B30",4:"#FF8C5A",3:"#F5B800",2:"#34C759",1:"#8E8E93"},SEV_L={5:"CRITICAL",4:"HIGH",3:"MEDIUM",2:"LOW",1:"MINIMAL"};
const CAT_C={CYB:"#F5B800",DAT:"#FFD166",TEC:"#FFE99A",GEO:"#FF8C5A",PHY:"#FF6B35",OPS:"#34C759",TPR:"#7BD693",REG:"#D4A000",FIN:"#B89A00",STR:"#9D7BEC",REP:"#BFA2F0",PPL:"#4FC3D7",ENV:"#7DDAEA"};
const CAT_NAME={CYB:"Cyber",DAT:"Data & Privacy",FIN:"Financial",GEO:"Geopolitical",REG:"Regulatory",PHY:"Physical",PPL:"People",TEC:"Technology",STR:"Strategic",REP:"Reputation",TPR:"Third Party",OPS:"Operations",ENV:"Environmental"};
const CAT_IMG={CYB:"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=72&auto=format&fit=crop",DAT:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=72&auto=format&fit=crop",FIN:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=72&auto=format&fit=crop",GEO:"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=72&auto=format&fit=crop",REG:"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=72&auto=format&fit=crop",PHY:"https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200&q=72&auto=format&fit=crop",PPL:"https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=72&auto=format&fit=crop",TEC:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&q=72&auto=format&fit=crop",STR:"https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1200&q=72&auto=format&fit=crop",REP:"https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&q=72&auto=format&fit=crop",TPR:"https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=72&auto=format&fit=crop",OPS:"https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=72&auto=format&fit=crop",ENV:"https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1200&q=72&auto=format&fit=crop",_d:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=72&auto=format&fit=crop"};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const im=a=>CAT_IMG[a.primary_category]||CAT_IMG._d;
const cc=a=>CAT_C[a.primary_category]||"#F5B800";
const fmtDay=iso=>{try{return new Date(iso+"T00:00:00Z").toUTCString().slice(5,11);}catch{return iso||"";}};
const place=a=>[a.entity,a.country].filter(Boolean).join(" · ");
const subs=L=>Array.from(new Set(L.map(a=>a.primary_subcategory_name).filter(Boolean))).slice(0,4);
const dotc=c=>`<span class="cdot" style="background:${c}"></span>`;
const metaline=a=>`<span class="meta">${esc(fmtDay(a.incident_day))} ${dotc(cc(a))}${esc(CAT_NAME[a.primary_category]||a.primary_category||"")}</span>`;

const CSS=`
:root{--gold:#F5B800;--gold-d:#8A6D00;--ink:#0E0E0E;--sub:#55555c;--mut:#8c8c8c;--line:#e7e7e3;--deep:#0B0B0B;--deep2:#141414;--card:#fff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:var(--ink);font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5}
img{display:block}a{color:inherit;text-decoration:none}
.wrap{max-width:1320px;margin:0 auto;padding:0 clamp(20px,4vw,52px)}
.mono{font-family:'JetBrains Mono',monospace}
.cdot{display:inline-block;width:7px;height:7px;border-radius:50%;margin:0 5px 0 2px;vertical-align:1px}
.meta{font-size:10.5px;color:var(--mut);font-weight:600}
.kick{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-d)}
.btn{display:inline-block;background:var(--gold);color:#1A1A1A;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:12px 22px;border-radius:4px;transition:transform .15s,background .15s}
.btn:hover{transform:translateY(-2px);background:#ffca28}
.previewbar{background:#F5B800;color:#1A1A1A;text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px}
/* ticker + kpi */
.tick{background:var(--deep);color:#A8A8A8;border-bottom:1px solid #2a2a2a;font-size:10.5px;letter-spacing:.05em;font-weight:600}
.tick .wrap{padding:9px clamp(20px,4vw,52px)}
.kpibar{background:var(--deep);border-bottom:1px solid #222}
.kpis{display:grid;grid-template-columns:repeat(5,1fr)}
.kpi{padding:16px clamp(14px,2vw,24px);border-right:1px solid #1d1d1d}
.kpi:last-child{border-right:none}
.kpi .l{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#6a6a6a;letter-spacing:.12em}
.kpi .v{font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:600;margin-top:3px;line-height:1}
/* hero */
.hero{background:var(--deep);color:#fff;padding:34px 0 44px}
.hero-grid{display:grid;grid-template-columns:1.25fr 1.1fr 0.75fr;gap:34px;align-items:stretch}
.hero h1{font-size:clamp(30px,3.6vw,50px);font-weight:900;line-height:1.02;letter-spacing:-.025em;margin:12px 0 0}
.hero .dek{font-size:16px;color:#c8c8c8;line-height:1.6;margin:16px 0 0;max-width:46ch}
.hero .meta{color:#8a8a8a;margin-top:14px;display:block}
.heroimg{position:relative;min-height:320px;border-radius:6px;overflow:hidden}
.heroimg img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;transition:transform .5s}
.heroimg:hover img{transform:scale(1.04)}
.heroimg .bar{position:absolute;top:0;left:0;right:0;height:4px;z-index:2}
.heroimg .scrim{position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45))}
.rail-h{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gold);letter-spacing:.14em;margin-bottom:8px}
.wrow{display:flex;gap:9px;padding:11px 0;border-top:1px solid #1f1f1f}
.wrow .t{width:6px;height:6px;border-radius:50%;margin-top:6px;flex:0 0 6px}
.wrow .h{font-size:13px;font-weight:600;line-height:1.3;color:#e8e8e8}
.wrow:hover .h{color:var(--gold)}
/* sections */
.sec{padding:46px 0 0}
.sechead{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:9px;margin-bottom:22px}
.sechead .sq{width:10px;height:10px;border-radius:2px;align-self:center}
.sechead .nm{font-size:17px;font-weight:900;letter-spacing:-.01em}
.sechead .sub{font-size:12px;color:var(--mut);font-weight:600}
.sechead .more{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gold-d);font-weight:600;letter-spacing:.08em}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.card{border:1px solid var(--line);background:#fff;transition:transform .18s,box-shadow .18s,border-color .18s;display:flex;flex-direction:column}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(14,14,14,.10);border-color:#d8d8d2}
.thumb{position:relative;overflow:hidden;height:150px}
.thumb img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.card:hover .thumb img{transform:scale(1.06)}
.thumb .bar{position:absolute;top:0;left:0;right:0;height:4px}
.card .bd{padding:15px 16px;display:flex;flex-direction:column;flex:1}
.card h3{font-size:17px;font-weight:800;line-height:1.18;letter-spacing:-.01em}
.card p{font-size:12.5px;color:var(--sub);line-height:1.55;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
/* desk section grid */
.desk{display:grid;grid-template-columns:1.5fr 1fr 0.85fr;gap:28px;align-items:start}
.feat .fi{position:relative;height:230px;overflow:hidden}
.feat .fi img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.feat:hover .fi img{transform:scale(1.05)}
.feat .bar{position:absolute;top:0;left:0;right:0;height:4px}
.feat h2{font-size:25px;font-weight:800;line-height:1.1;letter-spacing:-.015em;margin-top:13px}
.feat:hover h2{color:var(--gold-d)}
.feat .dek{font-size:13px;color:var(--sub);line-height:1.6;margin-top:10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.box{border:1px solid var(--line);border-left:3px solid;padding:13px 15px;margin-bottom:13px;transition:border-color .15s,transform .15s}
.box:hover{transform:translateX(2px)}
.box .h{font-size:15px;font-weight:700;line-height:1.25}
.lrail{border-left:1px solid var(--line);padding-left:18px}
.lrow{display:flex;gap:11px;padding:12px 0;border-top:1px solid var(--line)}
.lrow .t{width:7px;height:7px;border-radius:50%;margin-top:6px;flex:0 0 7px}
.lrow .h{font-size:14px;font-weight:700;line-height:1.25}
.lrow:hover .h{color:var(--gold-d)}
/* blast */
.blast{background:#faf7ec;border-top:1px solid #ece3c2;border-bottom:1px solid #ece3c2;padding:38px 0;margin-top:48px}
.echip{flex:0 0 auto;min-width:172px;background:#fff;border:1px solid #e3ddc6;border-left:3px solid var(--gold);padding:12px 14px;transition:transform .15s,box-shadow .15s}
.echip:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(140,109,0,.12)}
/* aog dark */
.aog{background:var(--deep);color:#fff;padding:48px 0}
.aog .ai{position:relative;height:330px;overflow:hidden}
.aog .ai img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
.aog:hover .ai img{transform:scale(1.05)}
.aog h2{font-size:32px;font-weight:900;line-height:1.05;letter-spacing:-.02em}
/* follow */
.follow{background:#111;color:#fff;padding:44px 0;border-top:1px solid #222}
.fcol{border-left:1px solid #262626;padding-left:16px}
.fpill{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#1A1A1A;background:var(--gold);padding:4px 9px;border-radius:3px}
/* index */
.cols{display:grid;grid-template-columns:repeat(4,1fr);gap:30px}
.coli{display:block;padding:11px 0 11px 11px;border-top:1px solid var(--line);border-left:3px solid}
.coli .h{font-size:14px;font-weight:700;line-height:1.28}
.coli:hover .h{color:var(--gold-d)}
.cta{margin:46px 0 60px;padding:40px;text-align:center;background:var(--deep);color:#fff;border-radius:14px}
.cta h3{font-size:24px;font-weight:900;letter-spacing:-.01em}
.cta p{font-size:13.5px;color:#A8A8A8;max-width:460px;margin:10px auto 0;line-height:1.6}
@media(max-width:1080px){.hero-grid{grid-template-columns:1fr}.desk{grid-template-columns:1fr}.g4{grid-template-columns:repeat(2,1fr)}.kpis{grid-template-columns:repeat(3,1fr)}.cols{grid-template-columns:repeat(2,1fr)}.lrail{border-left:none;padding-left:0}}
@media(max-width:560px){.g4,.cols{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}}
`;

function nav(){const k=(h,l,on)=>`<a href="https://attackedmap.vercel.app/${h}" style="color:${on?'#F5B800':'#A8A8A8'};font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase">${l}</a>`;
return `<div style="height:3px;background:#F5B800"></div><nav style="position:sticky;top:0;z-index:60;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,52px);height:62px;background:rgba(26,26,26,.97);backdrop-filter:blur(12px);border-bottom:1px solid #333"><a href="https://attackedmap.vercel.app/?home" style="display:flex;align-items:center;gap:9px"><span style="color:#F5B800;display:inline-flex"><i class="ti ti-shield-half-filled" style="font-size:23px"></i></span><span style="font-size:17px;font-weight:700;color:#fff">Attacked<span style="color:#F5B800">.ai</span></span></a><div style="display:flex;align-items:center;gap:24px">${k("?map","ATTACK MAP")}${k("?hub","ATTACKED HUB",1)}${k("?pricing","PRICING")}<a class="btn" href="https://attackedmap.vercel.app/?home" style="padding:9px 18px">Sign in</a></div></nav>`;}
function foot(){const soc=["brand-linkedin","brand-x","brand-facebook","brand-youtube","brand-instagram"].map(i=>`<span style="width:38px;height:38px;border-radius:50%;border:1px solid #fff;color:#fff;display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-${i}" style="font-size:16px"></i></span>`).join("");
return `<footer style="background:#080808;border-top:1px solid #333;color:#fff"><div style="max-width:1640px;margin:0 auto;padding:46px clamp(28px,5vw,72px);display:flex;justify-content:space-between;flex-wrap:wrap;gap:28px;align-items:center"><div><span style="font-size:20px;font-weight:700">Attacked<span style="color:#F5B800">.ai</span></span><div style="margin-top:8px;font-size:12px;color:#585858">© 2026 Attacked.ai · GUARD-classified intelligence</div></div><div style="display:flex;gap:10px">${soc}</div></div></footer>`;}

function build(items,cats,blast){
  const byCat={};for(const a of items){(byCat[a.primary_category]=byCat[a.primary_category]||[]).push(a);}
  const total=items.length,crit=items.filter(a=>a.severity>=5).length,high=items.filter(a=>a.severity===4).length;
  const countries=new Set(items.map(a=>a.country).filter(Boolean)).size,sectors=new Set(items.map(a=>a.industry||a.sector).filter(Boolean)).size;
  const lead=items[0],wire=items.slice(1,8),critRow=items.filter(a=>a.severity>=4).slice(0,4),aog=items.find(a=>a.severity>=5)||lead;
  const deskCats=cats.slice(0,3),colCats=cats.slice(0,4);
  let blastRows=[],blastFor=null;for(const a of items.slice(0,10)){const r=blast.filter(b=>String(b.incident_id)===String(a.id));if(r.length>blastRows.length){blastRows=r;blastFor=a;}}

  const card=a=>`<a class="card"><div class="thumb"><span class="bar" style="background:${SEV_C[a.severity]}"></span><img src="${im(a)}" loading="lazy" alt=""></div><div class="bd"><h3>${esc(a.headline)}</h3><p>${esc(a.summary||"")}</p><div style="margin-top:10px">${metaline(a)}</div></div></a>`;
  const wrow=a=>`<a class="wrow"><span class="t" style="background:${SEV_C[a.severity]}"></span><div><div class="h">${esc(a.headline)}</div><div class="mono" style="font-size:9px;color:#6a6a6a;margin-top:4px">${esc(fmtDay(a.incident_day))} · ${esc(a.primary_category||"")}</div></div></a>`;
  const box=a=>`<a class="box" style="border-left-color:${SEV_C[a.severity]}"><div class="h">${esc(a.headline)}</div><div style="margin-top:6px">${metaline(a)}</div></a>`;
  const lrow=a=>`<a class="lrow"><span class="t" style="background:${SEV_C[a.severity]}"></span><div><div class="h">${esc(a.headline)}</div><div style="margin-top:4px">${metaline(a)}</div></div></a>`;
  const coli=a=>`<a class="coli" style="border-left-color:${SEV_C[a.severity]}"><div class="h">${esc(a.headline)}</div><div style="margin-top:4px">${metaline(a)}</div></a>`;
  const deskSection=c=>{const L=byCat[c]||[];const f=L[0];if(!f)return"";return `<section class="sec"><div class="sechead"><span class="sq" style="background:${CAT_C[c]}"></span><span class="nm">${esc(CAT_NAME[c]||c)}</span>${subs(L).map(s=>`<span class="sub">${esc(s)}</span>`).join('<span class="sub">·</span>')}<span class="more">VIEW ALL ›</span></div>
    <div class="desk"><a class="feat"><div class="fi"><span class="bar" style="background:${SEV_C[f.severity]}"></span><img src="${im(f)}" loading="lazy" alt=""></div><h2>${esc(f.headline)}</h2><div class="dek">${esc(f.summary||"")}</div><div style="margin-top:9px">${metaline(f)}</div></a><div>${L.slice(1,4).map(box).join("")}</div><div class="lrail">${(L.slice(4,8).length?L.slice(4,8):L.slice(1,5)).map(lrow).join("")}</div></div></section>`;};
  const exposed=blastRows.slice(0,6).map(b=>`<div class="echip"><div style="font-size:13.5px;font-weight:700;line-height:1.2">${esc(b.name||b.entity||"Linked entity")}</div><div class="mono" style="font-size:9.5px;color:#8c7a3a;margin-top:5px;text-transform:uppercase;letter-spacing:.04em">${esc(b.channel||b.bucket||b.kind||b.relationship||"exposure")}${b.impact_score!=null?" · impact "+esc(b.impact_score):""}</div></div>`).join("");
  const fcol=c=>{const L=byCat[c]||[];return `<div class="fcol"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#fff">${dotc(CAT_C[c])}${esc(CAT_NAME[c]||c)}</span><span class="fpill">＋ Follow</span></div>${L.slice(0,3).map(a=>`<div style="padding:9px 0;border-top:1px solid #1f1f1f;font-size:13px;font-weight:600;color:#d6d6d6;line-height:1.3">${esc(a.headline)}</div>`).join("")}</div>`;};

  const body=`
  <div class="tick"><div class="wrap"><span style="color:#F5B800">●</span> LIVE · ${esc(fmtDay(lead.incident_day))} · ${total} RECENT INCIDENTS · ${crit} CRITICAL · ${high} HIGH · ${countries} COUNTRIES · GUARD-CLASSIFIED</div></div>
  <div class="kpibar"><div class="wrap"><div class="kpis">
    <div class="kpi"><div class="l">INCIDENTS</div><div class="v" style="color:#fff">${total}</div></div>
    <div class="kpi"><div class="l">CRITICAL</div><div class="v" style="color:#FF3B30">${crit}</div></div>
    <div class="kpi"><div class="l">HIGH</div><div class="v" style="color:#FF8C5A">${high}</div></div>
    <div class="kpi"><div class="l">SECTORS</div><div class="v" style="color:#F5B800">${sectors}</div></div>
    <div class="kpi"><div class="l">COUNTRIES</div><div class="v" style="color:#fff">${countries}</div></div>
  </div></div></div>

  <section class="hero"><div class="wrap"><div class="hero-grid">
    <div style="display:flex;flex-direction:column;justify-content:center">
      <span class="kick" style="color:#F5B800">◆ Lead briefing · <span style="color:${SEV_C[lead.severity]}">${SEV_L[lead.severity]}</span></span>
      <h1>${esc(lead.headline)}</h1>
      <div class="dek">${esc((lead.summary||"").slice(0,210))}</div>
      <span class="meta">${esc(place(lead))} · ${esc(fmtDay(lead.incident_day))}</span>
      <div style="margin-top:22px"><a class="btn" href="https://attackedmap.vercel.app/?home">Read full briefing →</a></div>
    </div>
    <a class="heroimg"><span class="bar" style="background:${SEV_C[lead.severity]}"></span><img src="${im(lead)}" alt=""><span class="scrim"></span></a>
    <div><div class="rail-h">● LIVE WIRE</div>${wire.map(wrow).join("")}</div>
  </div></div></section>

  <div class="wrap"><section class="sec"><div class="sechead"><span class="sq" style="background:#FF3B30"></span><span class="nm">Critical today</span><span class="sub">Severity 4 +</span><span class="more">ALL CRITICAL ›</span></div><div class="g4">${critRow.map(card).join("")}</div></section></div>

  <div class="wrap">${deskCats.map(deskSection).join("")}</div>

  ${blastFor?`<section class="blast"><div class="wrap"><div class="sechead" style="border-bottom-color:#101010"><span class="sq" style="background:#F5B800"></span><span class="nm">Blast radius · who else is exposed</span><span class="more">TRACE ›</span></div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:30px;align-items:center"><div><div style="font-size:25px;font-weight:800;line-height:1.1">${esc(blastFor.headline)}</div><div style="margin-top:8px">${metaline(blastFor)} · <span class="meta">${esc(place(blastFor))}</span></div><p style="font-size:13.5px;color:var(--sub);line-height:1.6;margin:12px 0 0;max-width:520px">The incident's blast radius traced to named suppliers, customers, peers and regulators — the exposure most feeds never show.</p><a class="btn" href="https://attackedmap.vercel.app/?home" style="margin-top:16px;background:#1A1A1A;color:#fff">Trace it on the map →</a></div><div style="display:flex;flex-wrap:wrap;gap:12px">${exposed}</div></div>
  </div></section>`:""}

  <section class="aog"><div class="wrap"><div class="sechead" style="border-bottom-color:#333"><span class="sq" style="background:#F5B800"></span><span class="nm" style="color:#fff">Attack-O-Gram · one attack, deconstructed</span></div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:30px;align-items:center"><a class="ai"><img src="${im(aog)}" alt=""><span style="position:absolute;left:16px;bottom:16px;background:#F5B800;color:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:.08em;padding:5px 10px;text-transform:uppercase">Kill chain</span></a><div><h2>${esc(aog.headline)}</h2><p style="font-size:13.5px;color:#A8A8A8;line-height:1.65;margin-top:14px">${esc((aog.summary||"").slice(0,240))}</p><a class="btn" href="https://attackedmap.vercel.app/?home" style="margin-top:18px">See the controls →</a></div></div>
  </div></section>

  <section class="follow"><div class="wrap"><div style="display:grid;grid-template-columns:0.8fr 2.4fr;gap:30px;align-items:start"><div style="background:#1A1A1A;border:1px solid #333;padding:20px"><div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#F5B800"><i class="ti ti-bell" style="font-size:18px"></i> Follow your desks</div><p style="font-size:13px;color:#A8A8A8;line-height:1.55;margin-top:10px">Choose up to 13 GUARD desks to shape your daily brief and on-map alerts.</p><a class="btn" href="https://attackedmap.vercel.app/?subscriptions" style="margin-top:14px">Compose your edition →</a></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0">${colCats.map(fcol).join("")}</div></div></div></section>

  <div class="wrap"><section class="sec"><div class="sechead"><span class="sq" style="background:#F5B800"></span><span class="nm">Across the desks</span><span class="more">THE WIRE ›</span></div><div class="cols">${colCats.map(c=>`<div><div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid var(--ink);padding-bottom:7px;margin-bottom:4px">${dotc(CAT_C[c])}<span style="font-size:14px;font-weight:800">${esc(CAT_NAME[c]||c)}</span></div>${(byCat[c]||[]).slice(0,5).map(coli).join("")}</div>`).join("")}</div></section>
  <div class="cta"><h3>The full picture lives on the map.</h3><p>Blast radius, adaptive controls and vendor Defence Ratings for every briefing — free to enter.</p><div style="margin-top:20px"><a class="btn" href="https://attackedmap.vercel.app/?home">Sign up free →</a></div></div></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>The Attacked Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
<style>${CSS}</style></head>
<body><div class="previewbar">Final · The Attacked Hub · world-class build · real data · our brand</div>${nav()}${body}${foot()}</body></html>`;
}

(async()=>{
  const sel="id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,incident_day,event_date";
  const r=await fetch(`${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=90`,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});
  let items=await r.json();if(!Array.isArray(items)){console.error("fail",items);process.exit(1);}
  items=items.filter(a=>a.headline);
  const ids=items.slice(0,10).map(a=>a.id).join(",");
  let blast=[];try{const br=await fetch(`${SB_URL}/rest/v1/blast_radius?select=*&incident_id=in.(${ids})&limit=120`,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});const j=await br.json();if(Array.isArray(j))blast=j;}catch(e){}
  const cats=Array.from(new Set(items.map(a=>a.primary_category).filter(Boolean)));
  fs.writeFileSync(path.resolve("public","hub-final.html"),build(items,cats,blast));
  console.log(`OK — flagship hub, ${items.length} incidents, ${blast.length} blast rows.`);
})();
