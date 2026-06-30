// Enhanced Attack Hub — OUR brand: Inter font, gold/obsidian, existing card
// style — better hierarchy, no empty gaps, no Bloomberg/serif. Real data.
const fs = require("fs"), path = require("path");
const env = {};
for (const l of fs.readFileSync(path.resolve(".env"),"utf8").split(/\r?\n/)) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim(); }
const SB_URL=env.VITE_SUPABASE_URL, SB_KEY=env.VITE_SUPABASE_ANON_KEY;
const SEV_C={5:"#FF3B30",4:"#FF8C5A",3:"#F5B800",2:"#34C759",1:"#8E8E93"};
const SEV_L={5:"CRITICAL",4:"HIGH",3:"MEDIUM",2:"LOW",1:"MINIMAL"};
const CAT_IMG={CYB:"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format&fit=crop",DAT:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=70&auto=format&fit=crop",FIN:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format&fit=crop",GEO:"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format&fit=crop",REG:"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=70&auto=format&fit=crop",PHY:"https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=900&q=70&auto=format&fit=crop",PPL:"https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=70&auto=format&fit=crop",TEC:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70&auto=format&fit=crop",STR:"https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=900&q=70&auto=format&fit=crop",REP:"https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900&q=70&auto=format&fit=crop",TPR:"https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70&auto=format&fit=crop",OPS:"https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&q=70&auto=format&fit=crop",ENV:"https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=900&q=70&auto=format&fit=crop",_d:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=70&auto=format&fit=crop"};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const img=a=>CAT_IMG[a.primary_category]||CAT_IMG._d;
const meta=a=>[a.entity,a.country,a.industry||a.sector].filter(Boolean).join("  ·  ");
const fmtDay=iso=>{try{return new Date(iso+"T00:00:00Z").toUTCString().slice(0,16);}catch{return iso||"";}};
const dk={"#FF3B30":"#A32D2D","#FF8C5A":"#993C1D","#F5B800":"#8A6D00","#34C759":"#1E6B33","#8E8E93":"#55555A"};
const sev=(s,light)=>{const c=SEV_C[s]||"#F5B800";return `<span style="font-family:Inter,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.07em;padding:3px 8px;border-radius:3px;background:${c}1f;color:${light?dk[c]:c};border:1px solid ${c}44;text-transform:uppercase;">${SEV_L[s]||"—"}</span>`;};
const catPill=c=>`<span style="font-family:Inter,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.07em;color:#52525B;padding:3px 8px;border-radius:3px;background:#f1f1f3;border:1px solid #e0e0e2;text-transform:uppercase;">${esc(c||"OPS")}</span>`;

function header(){const link=(k,l,on)=>`<a href="https://attackedmap.vercel.app/${k}" style="color:${on?'#F5B800':'#A8A8A8'};text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">${l}</a>`;
return `<div style="height:3px;background:#F5B800;"></div>
<nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,40px);height:64px;background:rgba(26,26,26,.96);backdrop-filter:blur(12px);border-bottom:1px solid #333;">
  <a href="https://attackedmap.vercel.app/?home" style="text-decoration:none;display:flex;align-items:center;gap:9px;"><span style="color:#F5B800;display:inline-flex;"><i class="ti ti-shield-half-filled" style="font-size:24px;"></i></span><span style="font-size:17px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span></a>
  <div style="display:flex;align-items:center;gap:26px;">${link("?map","ATTACK MAP")}${link("?hub","ATTACKED HUB",true)}${link("?pricing","PRICING")}<a href="https://attackedmap.vercel.app/?home" style="background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:4px;">Sign in</a></div>
</nav>`;}

function footer(){const nl=(l,h)=>`<a href="${h}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;">${l}</a>`;
const soc=["brand-linkedin","brand-x","brand-facebook","brand-youtube","brand-instagram"].map(i=>`<span style="width:40px;height:40px;border-radius:50%;border:1px solid #fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;"><i class="ti ti-${i}" style="font-size:17px;"></i></span>`).join("");
return `<footer style="background:#080808;border-top:1px solid #333;"><div style="max-width:1640px;margin:0 auto;padding:56px clamp(28px,5vw,72px) 48px;">
  <span style="font-size:20px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span>
  <div style="margin-top:40px;display:flex;justify-content:space-between;gap:clamp(40px,8vw,140px);flex-wrap:wrap;">
    <div style="flex:1 1 360px;max-width:440px;"><div style="font-size:22px;font-weight:800;color:#fff;">Subscribe</div><div style="margin-top:10px;font-size:14px;color:#A8A8A8;line-height:1.55;max-width:360px;">Select topics and stay current with our latest intelligence briefs</div>
      <div style="margin-top:18px;display:flex;gap:14px;max-width:480px;"><input placeholder="Email address" style="flex:1;min-width:0;padding:13px 16px;border-radius:4px;background:transparent;color:#fff;border:1px solid #4B5563;font-size:14px;"/><button style="padding:13px 32px;background:#F5B800;color:#1A1A1A;border:none;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Submit</button></div>
      <div style="margin-top:28px;font-size:13px;color:#585858;">© 2026 Attacked<span style="color:#F5B800;">.ai</span></div></div>
    <div style="flex:1 1 600px;max-width:740px;"><div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;">${nl("Contact us","mailto:hello@attacked.ai")}${nl("Scam warning","#")}${nl("FAQ","#")}${nl("Privacy policy","#")}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;margin-top:14px;">${nl("Cookie preferences","#")}${nl("Terms of use","#")}${nl("Local language information","#")}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">${nl("Accessibility statement","#")}</div>
      <div style="margin-top:36px;display:flex;gap:12px;justify-content:flex-end;">${soc}</div></div>
  </div></div></footer>`;}

function page(items,cats){
  const lead=items[0], secondary=items.slice(1,4), latest=items.slice(4,12), grid=items.slice(12,30);
  const chip=c=>`<span style="font-family:Inter,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:6px 14px;border-radius:4px;border:1px solid ${c==='ALL'?'rgba(245,184,0,.3)':'#333'};color:${c==='ALL'?'#F5B800':'#A8A8A8'};background:${c==='ALL'?'rgba(245,184,0,.1)':'transparent'};">${esc(c)}</span>`;
  const secCard=a=>`<article style="background:#fafafa;border:1px solid #e7e7e9;display:flex;flex-direction:column;"><div style="height:160px;background:url('${img(a)}') center/cover;"></div><div style="padding:16px;display:flex;flex-direction:column;flex:1;"><div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;">${sev(a.severity,true)}${catPill(a.primary_category)}<span style="margin-left:auto;font-size:10.5px;color:#9a9a9a;font-weight:600;">${esc(fmtDay(a.incident_day).slice(0,11))}</span></div><h3 style="font-family:Inter,sans-serif;font-size:18px;font-weight:700;line-height:1.28;letter-spacing:-.01em;color:#101010;margin:0;">${esc(a.headline)}</h3><div style="font-size:11px;color:#888;font-weight:600;margin-top:8px;">${esc(meta(a))}</div></div></article>`;
  const latestItem=a=>`<a style="display:flex;gap:13px;padding:14px 0;border-top:1px solid #ececec;text-decoration:none;cursor:pointer;"><span style="font-family:Inter,sans-serif;font-size:10.5px;color:#9a9a9a;font-weight:700;white-space:nowrap;padding-top:2px;">${esc((fmtDay(a.incident_day)||'').slice(0,11))}</span><div><div style="font-family:Inter,sans-serif;font-size:15px;font-weight:700;line-height:1.3;letter-spacing:-.01em;color:#101010;">${esc(a.headline)}</div><div style="margin-top:5px;">${sev(a.severity,true)} <span style="font-size:9.5px;color:#999;font-weight:700;letter-spacing:.06em;">${esc(a.primary_category||'')}</span></div></div></a>`;
  const gridCard=a=>`<article style="background:#fafafa;border:1px solid #e7e7e9;display:flex;flex-direction:column;"><div style="height:150px;background:url('${img(a)}') center/cover;"></div><div style="padding:18px;display:flex;flex-direction:column;flex:1;"><div style="display:flex;gap:7px;align-items:center;margin-bottom:11px;">${sev(a.severity,true)}${catPill(a.primary_category)}</div><h3 style="font-family:Inter,sans-serif;font-size:16.5px;font-weight:700;line-height:1.32;color:#101010;margin:0;">${esc(a.headline)}</h3><div style="font-size:11px;color:#888;font-weight:600;margin-top:7px;">${esc(meta(a))}</div><p style="font-size:12.5px;line-height:1.6;color:#52525B;margin:11px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;flex:1;">${esc(a.summary||"")}</p><div style="margin-top:14px;padding-top:11px;border-top:1px solid rgba(0,0,0,.07);font-size:10.5px;font-weight:700;color:#8A6D00;letter-spacing:.08em;text-transform:uppercase;">Read briefing →</div></div></article>`;

  const body=`
  <section style="padding:44px 0 30px;background:radial-gradient(ellipse 70% 120% at 50% 0%,rgba(245,184,0,.06),transparent 60%);border-bottom:1px solid #333;"><div class="wrap">
    <div style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:#F5B800;letter-spacing:.22em;text-transform:uppercase;">◇ The intelligence feed · updated daily</div>
    <h1 style="font-family:Inter,sans-serif;font-size:clamp(34px,4.4vw,54px);font-weight:800;line-height:1.02;letter-spacing:-.022em;margin:14px 0 0;">The Attacked <span style="color:#F5B800;font-style:italic;">Hub.</span></h1>
    <p style="margin:14px 0 0;max-width:560px;font-size:15px;line-height:1.6;color:#A8A8A8;">Every incident, GUARD-classified and written for operators. Latest incidents — ${esc(fmtDay(lead&&lead.incident_day))}.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:22px;">${["ALL",...cats].slice(0,12).map(chip).join("")}</div>
  </div></section>

  <main style="background:#fff;color:#101010;padding:40px 0 0;"><div class="wrap">
    <article style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:30px;align-items:center;border:1px solid rgba(245,184,0,.3);padding:30px;box-shadow:0 14px 40px rgba(16,16,16,.07);">
      <div>
        <div style="display:flex;gap:9px;align-items:center;margin-bottom:13px;"><span style="font-family:Inter,sans-serif;font-size:10px;font-weight:700;color:#8A6D00;letter-spacing:.16em;text-transform:uppercase;">Lead briefing</span>${sev(lead.severity,true)}${catPill(lead.primary_category)}<span style="font-size:11px;color:#9a9a9a;font-weight:600;">${esc(fmtDay(lead.incident_day))}</span></div>
        <h2 style="font-family:Inter,sans-serif;font-size:clamp(24px,2.8vw,34px);font-weight:800;line-height:1.14;letter-spacing:-.018em;margin:0;color:#101010;">${esc(lead.headline)}</h2>
        <div style="margin-top:11px;font-size:12px;color:#888;font-weight:600;">${esc(meta(lead))}</div>
        <p style="margin:16px 0 0;font-size:14.5px;line-height:1.65;color:#52525B;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">${esc(lead.summary||"")}</p>
        <div style="margin-top:18px;font-family:Inter,sans-serif;font-size:12px;font-weight:700;color:#8A6D00;letter-spacing:.08em;text-transform:uppercase;">Read full briefing →</div>
      </div>
      <div style="height:300px;background:url('${img(lead)}') center/cover;border:1px solid #e3e3e3;"></div>
    </article>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:30px;">${secondary.map(secCard).join("")}</div>

    <section style="margin-top:44px;">
      <div style="display:flex;align-items:center;gap:14px;border-bottom:2px solid #101010;padding-bottom:10px;"><span style="font-family:Inter,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.01em;">Latest across the desks</span><span style="font-family:Inter,sans-serif;font-size:11px;font-weight:700;color:#8A6D00;letter-spacing:.08em;text-transform:uppercase;margin-left:auto;">See all →</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 40px;">${latest.map(latestItem).join("")}</div>
    </section>

    <section style="margin-top:44px;">
      <div style="font-family:Inter,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.01em;border-bottom:2px solid #101010;padding-bottom:10px;margin-bottom:20px;">More briefings</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;">${grid.map(gridCard).join("")}</div>
    </section>

    <div style="margin:46px 0 56px;padding:36px;text-align:center;background:#1A1A1A;color:#fff;border:1px solid #333;border-radius:12px;">
      <div style="font-family:Inter,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.01em;">The full picture lives on the map.</div>
      <p style="margin:10px auto 0;max-width:460px;font-size:13.5px;color:#A8A8A8;line-height:1.6;">Blast radius, adaptive controls and vendor Defence Ratings for every briefing above — free to enter.</p>
      <a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:20px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-family:Inter,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:13px 28px;border-radius:4px;">Sign up free →</a>
    </div>
  </div></main>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>The Attacked Hub · enhanced preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#080808;color:#fff;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(20px,4vw,40px)}.previewbar{background:#F5B800;color:#1A1A1A;text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px;font-family:Inter,sans-serif}</style></head>
<body><div class="previewbar">Preview · Enhanced Attacked.ai Hub · our brand · real data</div>${header()}${body}${footer()}</body></html>`;
}

(async()=>{
  const sel="id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,incident_day,event_date";
  const url=`${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=60`;
  const r=await fetch(url,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});
  let items=await r.json();
  if(!Array.isArray(items)){console.error("fetch failed",items);process.exit(1);}
  items=items.filter(a=>a.headline);
  const cats=Array.from(new Set(items.map(a=>a.primary_category).filter(Boolean)));
  fs.writeFileSync(path.resolve("public","hub-enhanced.html"),page(items,cats));
  console.log(`OK — enhanced hub, ${items.length} real incidents, Inter + brand.`);
})();
