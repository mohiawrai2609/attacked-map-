// Three STRUCTURALLY different hub designs (not recolours). Our brand.
// 1 Situation Room (dark command center) · 2 Broadsheet (photo magazine) · 3 Wire (dense index)
const fs=require("fs"),path=require("path");
const env={};for(const l of fs.readFileSync(path.resolve(".env"),"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim();}
const SB_URL=env.VITE_SUPABASE_URL,SB_KEY=env.VITE_SUPABASE_ANON_KEY;
const SEV_C={5:"#FF3B30",4:"#FF8C5A",3:"#F5B800",2:"#34C759",1:"#8E8E93"},SEV_L={5:"CRITICAL",4:"HIGH",3:"MEDIUM",2:"LOW",1:"MINIMAL"};
const CAT_C={CYB:"#F5B800",DAT:"#FFD166",TEC:"#FFE99A",GEO:"#FF8C5A",PHY:"#FF6B35",OPS:"#34C759",TPR:"#7BD693",REG:"#D4A000",FIN:"#B89A00",STR:"#9D7BEC",REP:"#BFA2F0",PPL:"#4FC3D7",ENV:"#7DDAEA"};
const CAT_NAME={CYB:"Cyber",DAT:"Data & Privacy",FIN:"Financial",GEO:"Geopolitical",REG:"Regulatory",PHY:"Physical",PPL:"People",TEC:"Technology",STR:"Strategic",REP:"Reputation",TPR:"Third Party",OPS:"Operations",ENV:"Environmental"};
const CAT_IMG={CYB:"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1100&q=72&auto=format&fit=crop",DAT:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1100&q=72&auto=format&fit=crop",FIN:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1100&q=72&auto=format&fit=crop",GEO:"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1100&q=72&auto=format&fit=crop",REG:"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1100&q=72&auto=format&fit=crop",PHY:"https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1100&q=72&auto=format&fit=crop",PPL:"https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1100&q=72&auto=format&fit=crop",TEC:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1100&q=72&auto=format&fit=crop",STR:"https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=1100&q=72&auto=format&fit=crop",REP:"https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1100&q=72&auto=format&fit=crop",TPR:"https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1100&q=72&auto=format&fit=crop",OPS:"https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1100&q=72&auto=format&fit=crop",ENV:"https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=1100&q=72&auto=format&fit=crop",_d:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1100&q=72&auto=format&fit=crop"};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const img=a=>CAT_IMG[a.primary_category]||CAT_IMG._d;
const cc=a=>CAT_C[a.primary_category]||"#F5B800";
const fmtDay=iso=>{try{return new Date(iso+"T00:00:00Z").toUTCString().slice(5,11);}catch{return iso||"";}};
const place=a=>[a.entity,a.country].filter(Boolean).join(" · ");
const dot=c=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:6px;vertical-align:1px;"></span>`;

function header(){const k=(h,l,on)=>`<a href="https://attackedmap.vercel.app/${h}" style="color:${on?'#F5B800':'#A8A8A8'};text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">${l}</a>`;
return `<div style="height:3px;background:#F5B800;"></div><nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,48px);height:62px;background:rgba(26,26,26,.97);backdrop-filter:blur(12px);border-bottom:1px solid #333;"><a href="https://attackedmap.vercel.app/?home" style="text-decoration:none;display:flex;align-items:center;gap:9px;"><span style="color:#F5B800;display:inline-flex;"><i class="ti ti-shield-half-filled" style="font-size:23px;"></i></span><span style="font-size:17px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span></a><div style="display:flex;align-items:center;gap:24px;">${k("?map","ATTACK MAP")}${k("?hub","ATTACKED HUB",1)}${k("?pricing","PRICING")}<a href="https://attackedmap.vercel.app/?home" style="background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:4px;">Sign in</a></div></nav>`;}
function footer(){const soc=["brand-linkedin","brand-x","brand-facebook","brand-youtube","brand-instagram"].map(i=>`<span style="width:38px;height:38px;border-radius:50%;border:1px solid #fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;"><i class="ti ti-${i}" style="font-size:16px;"></i></span>`).join("");
return `<footer style="background:#080808;border-top:1px solid #333;color:#fff;"><div style="max-width:1640px;margin:0 auto;padding:48px clamp(28px,5vw,72px);display:flex;justify-content:space-between;flex-wrap:wrap;gap:30px;align-items:center;"><div><span style="font-size:20px;font-weight:700;">Attacked<span style="color:#F5B800;">.ai</span></span><div style="margin-top:8px;font-size:12px;color:#585858;">© 2026 Attacked.ai · GUARD-classified intelligence</div></div><div style="display:flex;gap:10px;">${soc}</div></div></footer>`;}
const shell=(title,bar,bg,fg,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:${bg};color:${fg};font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}.wrap{max-width:1320px;margin:0 auto;padding:0 clamp(20px,4vw,48px)}.mono{font-family:'JetBrains Mono',monospace}.previewbar{background:#F5B800;color:#1A1A1A;text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px}a{color:inherit}img{display:block}</style></head>
<body><div class="previewbar">${esc(bar)} · real data · our brand</div>${header()}${body}${footer()}</body></html>`;

// ========================= SAMPLE 1 — SITUATION ROOM (dark command center) =========================
function situationRoom(items,cats,blast){
  const total=items.length, crit=items.filter(a=>a.severity>=5).length, high=items.filter(a=>a.severity===4).length;
  const countries=new Set(items.map(a=>a.country).filter(Boolean)).size, sectors=new Set(items.map(a=>a.industry||a.sector).filter(Boolean)).size;
  const sevCount=s=>items.filter(a=>a.severity===s).length;
  const lead=items[0], feed=items.slice(1,11), wire=items.slice(0,12), watch=items.filter(a=>a.severity>=4).slice(0,6);
  let blastRows=[],blastFor=null;for(const a of items.slice(0,10)){const r=blast.filter(b=>String(b.incident_id)===String(a.id));if(r.length>blastRows.length){blastRows=r;blastFor=a;}}
  const tile=(l,v,c)=>`<div style="background:#161616;border:1px solid #2a2a2a;border-top:2px solid ${c||'#F5B800'};padding:14px 16px;"><div class="mono" style="font-size:9.5px;color:#6a6a6a;letter-spacing:.1em;">${l}</div><div class="mono" style="font-size:26px;font-weight:600;color:${c||'#fff'};margin-top:4px;">${v}</div></div>`;
  const feedRow=a=>`<a style="display:flex;gap:14px;padding:14px 0;border-top:1px solid #1c1c1c;text-decoration:none;align-items:flex-start;"><div style="width:96px;height:64px;flex:0 0 96px;background:url('${img(a)}') center/cover;border-left:3px solid ${SEV_C[a.severity]};"></div><div><div style="font-size:16px;font-weight:700;line-height:1.25;color:#fff;">${esc(a.headline)}</div><p style="font-size:12px;color:#9a9a9a;line-height:1.5;margin:5px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(a.summary||"")}</p><div class="mono" style="font-size:9.5px;color:#6a6a6a;margin-top:6px;">${esc(fmtDay(a.incident_day))} · <span style="color:${SEV_C[a.severity]};">${SEV_L[a.severity]}</span> · ${esc(a.primary_category||"")} · ${esc(place(a))}</div></div></a>`;
  const wireRow=a=>`<div style="display:flex;gap:9px;padding:9px 0 9px 9px;border-bottom:1px solid #1a1a1a;border-left:3px solid ${SEV_C[a.severity]};"><span class="mono" style="font-size:9px;color:#5a5a5a;white-space:nowrap;">${esc((a.incident_day||'').slice(5))}</span><span style="font-size:12px;font-weight:600;line-height:1.25;color:#e6e6e6;">${esc(a.headline)}</span></div>`;
  const body=`
  <section style="background:#0d0d0d;padding:26px 0 0;"><div class="wrap">
    <div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.18em;">◇ SITUATION ROOM · LIVE · ${esc(fmtDay(lead.incident_day))}</div>
    <h1 style="font-size:clamp(28px,3.4vw,40px);font-weight:900;letter-spacing:-.02em;margin:8px 0 18px;color:#fff;">Today's risk picture</h1>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">${tile("INCIDENTS",total)}${tile("CRITICAL",crit,"#FF3B30")}${tile("HIGH",high,"#FF8C5A")}${tile("SECTORS",sectors,"#F5B800")}${tile("COUNTRIES",countries)}</div>
    <div style="margin-top:14px;background:#161616;border:1px solid #2a2a2a;padding:14px 16px;">
      <div class="mono" style="font-size:9.5px;color:#6a6a6a;letter-spacing:.1em;margin-bottom:8px;">SEVERITY DISTRIBUTION</div>
      <div style="display:flex;height:14px;border:1px solid #2a2a2a;overflow:hidden;">${[5,4,3,2,1].map(s=>`<div title="${SEV_L[s]}" style="width:${total?Math.round(sevCount(s)/total*100):0}%;background:${SEV_C[s]};"></div>`).join("")}</div>
      <div class="mono" style="display:flex;gap:16px;margin-top:8px;font-size:9.5px;color:#8a8a8a;flex-wrap:wrap;">${[5,4,3,2,1].map(s=>`<span><span style="color:${SEV_C[s]};">■</span> ${SEV_L[s]} ${sevCount(s)}</span>`).join("")}</div>
    </div>
  </div></section>

  <section style="background:#0d0d0d;padding:28px 0 50px;"><div class="wrap">
    <div style="display:grid;grid-template-columns:1fr 360px;gap:30px;align-items:start;">
      <div>
        <div style="background:#161616;border:1px solid #2a2a2a;overflow:hidden;">
          <div style="height:230px;background:url('${img(lead)}') center/cover;border-bottom:3px solid ${SEV_C[lead.severity]};"></div>
          <div style="padding:18px 20px;"><div class="mono" style="font-size:9.5px;color:#F5B800;letter-spacing:.12em;">LEAD BRIEFING · <span style="color:${SEV_C[lead.severity]};">${SEV_L[lead.severity]}</span></div><div style="font-size:25px;font-weight:800;line-height:1.1;color:#fff;margin-top:8px;">${esc(lead.headline)}</div><p style="font-size:13.5px;color:#A8A8A8;line-height:1.6;margin:10px 0 0;">${esc((lead.summary||"").slice(0,220))}</p><div class="mono" style="font-size:10px;color:#6a6a6a;margin-top:10px;">${esc(place(lead))}</div></div>
        </div>
        <div style="margin-top:8px;">${feed.map(feedRow).join("")}</div>
      </div>
      <aside style="position:sticky;top:74px;display:flex;flex-direction:column;gap:18px;">
        <div style="background:#161616;border:1px solid #2a2a2a;padding:14px 16px;"><div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.14em;margin-bottom:8px;">● LIVE WIRE</div>${wire.map(wireRow).join("")}</div>
        <div style="background:#161616;border:1px solid #2a2a2a;padding:14px 16px;"><div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.14em;margin-bottom:10px;">▲ WATCHLIST · CRITICAL/HIGH</div>${watch.map(a=>`<div style="padding:9px 0;border-top:1px solid #1f1f1f;"><div style="font-size:13px;font-weight:700;color:#fff;line-height:1.25;">${esc(a.headline)}</div><div class="mono" style="font-size:9px;color:#6a6a6a;margin-top:3px;">${esc(a.entity||"")} · ${esc(a.country||"")}</div></div>`).join("")}</div>
        ${blastFor?`<div style="background:#141008;border:1px solid #3a3014;border-top:2px solid #F5B800;padding:14px 16px;"><div class="mono" style="font-size:10px;color:#F5B800;letter-spacing:.14em;">◎ BLAST RADIUS</div><div style="font-size:13px;font-weight:700;color:#fff;margin-top:8px;line-height:1.25;">${esc(blastFor.headline)}</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${blastRows.slice(0,5).map(b=>`<span class="mono" style="font-size:9.5px;color:#1A1A1A;background:#F5B800;padding:4px 8px;">${esc(b.name||b.entity||"entity")}</span>`).join("")}</div><a href="https://attackedmap.vercel.app/?home" class="mono" style="display:inline-block;margin-top:12px;font-size:10px;color:#F5B800;border:1px solid #F5B800;padding:8px 14px;text-decoration:none;letter-spacing:.08em;">TRACE ON MAP →</a></div>`:""}
      </aside>
    </div>
  </div></section>`;
  return shell("Attacked Hub · Situation Room","Sample 1 · Situation Room (command center)","#0d0d0d","#fff",body);
}

// ========================= SAMPLE 2 — BROADSHEET (photo magazine) =========================
function broadsheet(items,cats){
  const lead=items[0],big=items.slice(1,3),mid=items.slice(3,9),byCat={};for(const a of items){(byCat[a.primary_category]=byCat[a.primary_category]||[]).push(a);}
  const overlayHero=a=>`<a style="position:relative;display:block;min-height:520px;background:url('${img(a)}') center/cover;text-decoration:none;"><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.82));"></div><div style="position:absolute;left:0;right:0;bottom:0;padding:clamp(24px,4vw,48px);"><span class="mono" style="font-size:11px;font-weight:600;color:#F5B800;letter-spacing:.14em;text-transform:uppercase;">${dot(SEV_C[a.severity])}${SEV_L[a.severity]} · ${esc(CAT_NAME[a.primary_category]||a.primary_category||"")}</span><h1 style="font-size:clamp(30px,4.4vw,58px);font-weight:900;line-height:1.02;letter-spacing:-.025em;color:#fff;margin:12px 0 0;max-width:18ch;">${esc(a.headline)}</h1><p style="font-size:16px;color:#e0e0e0;line-height:1.55;margin:14px 0 0;max-width:62ch;">${esc((a.summary||"").slice(0,180))}</p><div class="mono" style="font-size:11px;color:#bdbdbd;margin-top:12px;">${esc(place(a))} · ${esc(fmtDay(a.incident_day))}</div></div></a>`;
  const bigCard=a=>`<a style="grid-column:span 2;display:block;text-decoration:none;border:1px solid #e7e7e9;background:#fff;"><div style="height:300px;background:url('${img(a)}') center/cover;border-top:4px solid ${SEV_C[a.severity]};"></div><div style="padding:20px 22px;"><span class="mono" style="font-size:10px;color:#8A6D00;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">${esc(CAT_NAME[a.primary_category]||"")}</span><h2 style="font-size:28px;font-weight:800;line-height:1.1;color:#101010;margin-top:6px;">${esc(a.headline)}</h2><p style="font-size:14px;color:#52525B;line-height:1.6;margin-top:10px;">${esc((a.summary||"").slice(0,200))}</p></div></a>`;
  const medCard=a=>`<a style="display:block;text-decoration:none;border:1px solid #e7e7e9;background:#fff;"><div style="height:160px;background:url('${img(a)}') center/cover;border-top:4px solid ${SEV_C[a.severity]};"></div><div style="padding:15px 16px;"><h3 style="font-size:18px;font-weight:800;line-height:1.15;color:#101010;">${esc(a.headline)}</h3><div class="mono" style="font-size:9.5px;color:#999;margin-top:7px;">${esc(fmtDay(a.incident_day))} · ${esc(a.primary_category||"")}</div></div></a>`;
  const featureBand=c=>{const L=byCat[c]||[];const f=L[0];if(!f)return"";return `<section style="margin-top:50px;"><div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #101010;padding-bottom:8px;margin-bottom:20px;"><span style="width:11px;height:11px;background:${CAT_C[c]};border-radius:2px;"></span><span style="font-size:22px;font-weight:900;letter-spacing:-.01em;">${esc(CAT_NAME[c]||c)}</span></div><div style="display:grid;grid-template-columns:1.4fr 1fr;gap:30px;align-items:center;"><a style="display:block;text-decoration:none;"><div style="height:340px;background:url('${img(f)}') center/cover;border-top:4px solid ${SEV_C[f.severity]};"></div></a><div><a style="text-decoration:none;"><h2 style="font-size:30px;font-weight:800;line-height:1.08;color:#101010;">${esc(f.headline)}</h2></a><p style="font-size:14.5px;color:#52525B;line-height:1.65;margin:12px 0 0;">${esc((f.summary||"").slice(0,240))}</p><div style="margin-top:16px;border-top:1px solid #e7e7e9;">${L.slice(1,4).map(a=>`<div style="padding:11px 0;border-bottom:1px solid #f1f1f1;font-size:16px;font-weight:700;color:#101010;line-height:1.2;">${esc(a.headline)}</div>`).join("")}</div></div></div></section>`;};
  const body=`
  ${overlayHero(lead)}
  <section style="background:#fff;color:#101010;padding:40px 0 0;"><div class="wrap">
    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #101010;padding-bottom:8px;margin-bottom:22px;"><span style="font-size:22px;font-weight:900;">Top stories</span><span class="mono" style="font-size:11px;color:#8A6D00;font-weight:600;margin-left:auto;letter-spacing:.08em;">UPDATED DAILY</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px;">${bigCard(big[0])}${big[1]?medCard(big[1]):""}${mid.slice(0,1).map(medCard).join("")}${mid.slice(1,5).map(medCard).join("")}</div>
  </div></section>
  <div style="background:#fff;color:#101010;"><div class="wrap" style="padding-bottom:20px;">${cats.slice(0,3).map(featureBand).join("")}</div></div>
  <div style="background:#fff;"><div class="wrap" style="padding:40px 0 60px;"><div style="padding:38px;text-align:center;background:#1A1A1A;color:#fff;border-radius:12px;"><div style="font-size:24px;font-weight:900;">The full picture lives on the map.</div><a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:18px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:13px 28px;border-radius:4px;">Sign up free →</a></div></div></div>`;
  return shell("Attacked Hub · Broadsheet","Sample 2 · Broadsheet (photo magazine)","#ffffff","#101010",body);
}

// ========================= SAMPLE 3 — THE WIRE (dense index) =========================
function wire(items,cats){
  const byCat={};for(const a of items){(byCat[a.primary_category]=byCat[a.primary_category]||[]).push(a);}
  const crit=items.filter(a=>a.severity>=4).slice(0,8), lead=items.slice(0,2);
  const jump=cats.map(c=>`<a href="#d-${c}" style="display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-left:3px solid ${CAT_C[c]};text-decoration:none;color:#101010;font-size:13px;font-weight:600;border-bottom:1px solid #eee;"><span>${esc(CAT_NAME[c]||c)}</span><span class="mono" style="font-size:10px;color:#999;">${(byCat[c]||[]).length}</span></a>`).join("");
  const wireItem=a=>`<a style="display:flex;gap:12px;align-items:baseline;padding:10px 0 10px 11px;border-top:1px solid #eee;border-left:3px solid ${SEV_C[a.severity]};text-decoration:none;"><span class="mono" style="font-size:10px;color:#aaa;white-space:nowrap;width:42px;flex:0 0 42px;">${esc((a.incident_day||'').slice(5))}</span><div><span style="font-size:15px;font-weight:700;color:#101010;line-height:1.3;">${esc(a.headline)}</span> <span class="mono" style="font-size:10px;color:#999;">· ${esc(a.entity||"")} · ${esc(a.country||"")}</span></div></a>`;
  const deskBlock=c=>{const L=byCat[c]||[];if(!L.length)return"";return `<section id="d-${c}" style="margin-top:30px;scroll-margin-top:80px;"><div style="display:flex;align-items:center;gap:10px;border-bottom:2px solid #101010;padding-bottom:7px;"><span style="width:9px;height:9px;background:${CAT_C[c]};border-radius:2px;"></span><span style="font-size:16px;font-weight:800;">${esc(CAT_NAME[c]||c)}</span><span class="mono" style="font-size:10px;color:#999;">${L.length} incidents</span></div>${L.slice(0,7).map(wireItem).join("")}</section>`;};
  const body=`
  <section style="background:#fff;color:#101010;padding:22px 0 12px;border-bottom:1px solid #e7e7e9;"><div class="wrap">
    <div class="mono" style="font-size:10px;color:#8A6D00;letter-spacing:.16em;">◇ THE WIRE · EVERY INCIDENT, SCANNABLE · ${esc(fmtDay(items[0].incident_day))}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:14px;">${lead.map(a=>`<a style="display:flex;gap:16px;text-decoration:none;"><div style="width:150px;height:96px;flex:0 0 150px;background:url('${img(a)}') center/cover;border-left:4px solid ${SEV_C[a.severity]};"></div><div><span class="mono" style="font-size:10px;color:${SEV_C[a.severity]};font-weight:600;">${SEV_L[a.severity]} · ${esc(a.primary_category||"")}</span><h2 style="font-size:21px;font-weight:800;line-height:1.12;color:#101010;margin-top:4px;">${esc(a.headline)}</h2><div class="mono" style="font-size:10px;color:#999;margin-top:6px;">${esc(place(a))}</div></div></a>`).join("")}</div>
  </div></section>
  <section style="background:#fff;color:#101010;padding:24px 0 56px;"><div class="wrap">
    <div style="display:grid;grid-template-columns:200px 1fr 300px;gap:30px;align-items:start;">
      <aside style="position:sticky;top:74px;"><div class="mono" style="font-size:10px;color:#999;letter-spacing:.12em;margin-bottom:8px;">DESKS</div><div style="border:1px solid #eee;">${jump}</div></aside>
      <div>${cats.slice(0,8).map(deskBlock).join("")}</div>
      <aside style="position:sticky;top:74px;display:flex;flex-direction:column;gap:20px;">
        <div><div style="font-size:14px;font-weight:800;border-bottom:2px solid #FF3B30;padding-bottom:6px;color:#101010;">▲ Most critical</div>${crit.map(a=>`<div style="padding:10px 0 10px 10px;border-bottom:1px solid #eee;border-left:3px solid ${SEV_C[a.severity]};"><div style="font-size:13.5px;font-weight:700;color:#101010;line-height:1.25;">${esc(a.headline)}</div><div class="mono" style="font-size:9.5px;color:#999;margin-top:3px;">${esc(a.entity||"")} · ${esc(a.country||"")}</div></div>`).join("")}</div>
        <div style="background:#1A1A1A;color:#fff;padding:18px;"><div style="font-size:14px;font-weight:800;color:#F5B800;">Trace any incident</div><p style="font-size:12.5px;color:#A8A8A8;line-height:1.55;margin-top:8px;">See blast radius + controls on the live map.</p><a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:12px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:10px 16px;border-radius:4px;">Open map →</a></div>
      </aside>
    </div>
  </div></section>`;
  return shell("Attacked Hub · The Wire","Sample 3 · The Wire (dense index)","#ffffff","#101010",body);
}

(async()=>{
  const sel="id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,incident_day,event_date";
  const r=await fetch(`${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=90`,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});
  let items=await r.json();if(!Array.isArray(items)){console.error("fail",items);process.exit(1);}
  items=items.filter(a=>a.headline);
  const ids=items.slice(0,10).map(a=>a.id).join(",");
  let blast=[];try{const br=await fetch(`${SB_URL}/rest/v1/blast_radius?select=*&incident_id=in.(${ids})&limit=120`,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});const j=await br.json();if(Array.isArray(j))blast=j;}catch(e){}
  const cats=Array.from(new Set(items.map(a=>a.primary_category).filter(Boolean)));
  fs.writeFileSync(path.resolve("public","hub-s1-situation.html"),situationRoom(items,cats,blast));
  fs.writeFileSync(path.resolve("public","hub-s2-broadsheet.html"),broadsheet(items,cats));
  fs.writeFileSync(path.resolve("public","hub-s3-wire.html"),wire(items,cats));
  console.log(`OK — 3 distinct samples, ${items.length} incidents, ${blast.length} blast rows.`);
})();
