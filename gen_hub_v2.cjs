// Enhanced Attack Hub — BBC magazine bones, but designed for risk intelligence.
// Severity rails, map-consistent category colours, live intel strip, a real
// Blast-Radius band (USP), desk bands, dark Attack-O-Gram, desk columns.
// OUR brand: Inter + gold + obsidian. Real data (incidents + blast_radius).
const fs=require("fs"),path=require("path");
const env={};for(const l of fs.readFileSync(path.resolve(".env"),"utf8").split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim();}
const SB_URL=env.VITE_SUPABASE_URL,SB_KEY=env.VITE_SUPABASE_ANON_KEY;
const SEV_C={5:"#FF3B30",4:"#FF8C5A",3:"#F5B800",2:"#34C759",1:"#8E8E93"},SEV_L={5:"CRITICAL",4:"HIGH",3:"MEDIUM",2:"LOW",1:"MINIMAL"};
const CAT_C={CYB:"#F5B800",DAT:"#FFD166",TEC:"#FFE99A",GEO:"#FF8C5A",PHY:"#FF6B35",OPS:"#34C759",TPR:"#7BD693",REG:"#D4A000",FIN:"#B89A00",STR:"#9D7BEC",REP:"#BFA2F0",PPL:"#4FC3D7",ENV:"#7DDAEA"};
const CAT_NAME={CYB:"Cyber",DAT:"Data & Privacy",FIN:"Financial",GEO:"Geopolitical",REG:"Regulatory",PHY:"Physical",PPL:"People",TEC:"Technology",STR:"Strategic",REP:"Reputation",TPR:"Third Party",OPS:"Operations",ENV:"Environmental"};
const CAT_IMG={CYB:"https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format&fit=crop",DAT:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=70&auto=format&fit=crop",FIN:"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format&fit=crop",GEO:"https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format&fit=crop",REG:"https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=70&auto=format&fit=crop",PHY:"https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=900&q=70&auto=format&fit=crop",PPL:"https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=70&auto=format&fit=crop",TEC:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70&auto=format&fit=crop",STR:"https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=900&q=70&auto=format&fit=crop",REP:"https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900&q=70&auto=format&fit=crop",TPR:"https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70&auto=format&fit=crop",OPS:"https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&q=70&auto=format&fit=crop",ENV:"https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=900&q=70&auto=format&fit=crop",_d:"https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=70&auto=format&fit=crop"};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const img=a=>CAT_IMG[a.primary_category]||CAT_IMG._d;
const cc=a=>CAT_C[a.primary_category]||"#F5B800";
const fmtDay=iso=>{try{return new Date(iso+"T00:00:00Z").toUTCString().slice(5,11);}catch{return iso||"";}};
const dot=c=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:6px;vertical-align:1px;"></span>`;
const meta=a=>`<span style="font-size:10.5px;color:#888;font-weight:600;">${esc(fmtDay(a.incident_day))} · ${dot(cc(a))}<span style="color:#52525B;">${esc(CAT_NAME[a.primary_category]||a.primary_category||"")}</span></span>`;
const place=a=>[a.entity,a.country].filter(Boolean).join(" · ");

function header(){const k=(h,l,on)=>`<a href="https://attackedmap.vercel.app/${h}" style="color:${on?'#F5B800':'#A8A8A8'};text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">${l}</a>`;
return `<div style="height:3px;background:#F5B800;"></div><nav style="position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,4vw,44px);height:64px;background:rgba(26,26,26,.96);backdrop-filter:blur(12px);border-bottom:1px solid #333;"><a href="https://attackedmap.vercel.app/?home" style="text-decoration:none;display:flex;align-items:center;gap:9px;"><span style="color:#F5B800;display:inline-flex;"><i class="ti ti-shield-half-filled" style="font-size:24px;"></i></span><span style="font-size:17px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span></a><div style="display:flex;align-items:center;gap:26px;">${k("?map","ATTACK MAP")}${k("?hub","ATTACKED HUB",1)}${k("?pricing","PRICING")}<a href="https://attackedmap.vercel.app/?home" style="background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:4px;">Sign in</a></div></nav>`;}
function footer(){const nl=(l,h)=>`<a href="${h}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;">${l}</a>`;const soc=["brand-linkedin","brand-x","brand-facebook","brand-youtube","brand-instagram"].map(i=>`<span style="width:40px;height:40px;border-radius:50%;border:1px solid #fff;color:#fff;display:inline-flex;align-items:center;justify-content:center;"><i class="ti ti-${i}" style="font-size:17px;"></i></span>`).join("");
return `<footer style="background:#080808;border-top:1px solid #333;"><div style="max-width:1640px;margin:0 auto;padding:56px clamp(28px,5vw,72px) 48px;"><span style="font-size:20px;font-weight:700;color:#fff;">Attacked<span style="color:#F5B800;">.ai</span></span><div style="margin-top:40px;display:flex;justify-content:space-between;gap:clamp(40px,8vw,140px);flex-wrap:wrap;"><div style="flex:1 1 360px;max-width:440px;"><div style="font-size:22px;font-weight:800;color:#fff;">Subscribe</div><div style="margin-top:10px;font-size:14px;color:#A8A8A8;line-height:1.55;max-width:360px;">Select topics and stay current with our latest intelligence briefs</div><div style="margin-top:18px;display:flex;gap:14px;max-width:480px;"><input placeholder="Email address" style="flex:1;min-width:0;padding:13px 16px;border-radius:4px;background:transparent;color:#fff;border:1px solid #4B5563;font-size:14px;"/><button style="padding:13px 32px;background:#F5B800;color:#1A1A1A;border:none;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Submit</button></div><div style="margin-top:28px;font-size:13px;color:#585858;">© 2026 Attacked<span style="color:#F5B800;">.ai</span></div></div><div style="flex:1 1 600px;max-width:740px;"><div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;">${nl("Contact us","mailto:hello@attacked.ai")}${nl("Scam warning","#")}${nl("FAQ","#")}${nl("Privacy policy","#")}</div><div style="display:flex;flex-wrap:wrap;justify-content:flex-end;column-gap:28px;row-gap:14px;margin-top:14px;">${nl("Cookie preferences","#")}${nl("Terms of use","#")}${nl("Local language information","#")}</div><div style="margin-top:36px;display:flex;gap:12px;justify-content:flex-end;">${soc}</div></div></div></div></footer>`;}

const secHead=(t,c,light)=>`<div style="display:flex;align-items:center;gap:10px;border-bottom:1px solid ${light?'#e3e3e3':'#333'};padding-bottom:9px;margin:0 0 18px;"><span style="width:10px;height:10px;background:${c||'#F5B800'};border-radius:2px;"></span><span style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${light?'#101010':'#fff'};">${esc(t)}</span><span style="color:#F5B800;font-weight:800;margin-left:2px;">›</span></div>`;

function page(items,cats,blast){
  const lead=items[0], crit=items.filter(a=>a.severity>=4), latest=items.slice(1,7);
  const critStack=crit.slice(0,3), critRow=crit.slice(0,4);
  const related=items.slice(7,9);
  const byCat={};for(const a of items){(byCat[a.primary_category]=byCat[a.primary_category]||[]).push(a);}
  const deskCats=cats.slice(0,3), colCats=cats.slice(0,4);
  const aog=items.find(a=>a.severity>=5)||lead;
  // blast band: incident with the most blast rows
  let blastFor=null,blastRows=[];
  for(const a of items.slice(0,10)){const r=blast.filter(b=>String(b.incident_id)===String(a.id));if(r.length>blastRows.length){blastRows=r;blastFor=a;}}

  const railItem=a=>`<a style="display:block;padding:13px 0 13px 13px;border-top:1px solid #ececec;border-left:3px solid ${SEV_C[a.severity]};text-decoration:none;"><div style="font-size:15px;font-weight:700;line-height:1.25;color:#101010;">${esc(a.headline)}</div><div style="margin-top:5px;">${meta(a)}</div></a>`;
  const fourCard=a=>`<a style="display:block;text-decoration:none;"><div style="height:148px;background:url('${img(a)}') center/cover;border-top:3px solid ${SEV_C[a.severity]};"></div><div style="font-size:17px;font-weight:700;line-height:1.2;color:#101010;margin-top:10px;">${esc(a.headline)}</div><p style="font-size:12px;line-height:1.5;color:#52525B;margin:7px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(a.summary||"")}</p><div style="margin-top:7px;">${meta(a)}</div></a>`;
  const colItem=a=>`<a style="display:block;padding:11px 0 11px 11px;border-top:1px solid #ececec;border-left:3px solid ${SEV_C[a.severity]};text-decoration:none;"><div style="font-size:14px;font-weight:700;line-height:1.28;color:#101010;">${esc(a.headline)}</div><div style="margin-top:4px;">${meta(a)}</div></a>`;

  const deskBand=c=>{const L=byCat[c]||[];const f=L[0];if(!f)return"";return `<section style="margin-top:46px;">${secHead((CAT_NAME[c]||c)+" desk",CAT_C[c],1)}
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:28px;align-items:start;margin-bottom:22px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center;">
        <div><div style="font-size:25px;font-weight:800;line-height:1.08;color:#101010;border-bottom:3px solid ${CAT_C[c]};display:inline;padding-bottom:2px;">${esc(f.headline)}</div><p style="font-size:13px;line-height:1.6;color:#52525B;margin:13px 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${esc(f.summary||"")}</p><div style="margin-top:9px;">${meta(f)}</div></div>
        <div style="height:200px;background:url('${img(f)}') center/cover;border-top:3px solid ${SEV_C[f.severity]};"></div>
      </div>
      <div>${L.slice(1,5).map(railItem).join("")}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">${L.slice(5,9).map(fourCard).join("")}</div>
  </section>`;};

  const exposed=blastRows.slice(0,6).map(b=>{const nm=esc(b.name||b.entity||"Linked entity");const ch=esc(b.channel||b.bucket||b.kind||b.relationship||"exposure");const im=b.impact_score!=null?` · impact ${esc(b.impact_score)}`:"";
    return `<div style="flex:0 0 auto;min-width:170px;background:#fff;border:1px solid #e3e3e3;border-left:3px solid #F5B800;padding:12px 14px;"><div style="font-size:13.5px;font-weight:700;color:#101010;line-height:1.2;">${nm}</div><div style="font-size:10px;color:#888;font-weight:600;margin-top:5px;text-transform:uppercase;letter-spacing:.04em;">${ch}${im}</div></div>`;}).join("");

  const body=`
  <div style="background:#0d0d0d;border-bottom:1px solid #333;padding:8px 0;"><div class="wrap" style="font-size:10.5px;color:#A8A8A8;letter-spacing:.06em;font-weight:600;"><span style="color:#F5B800;">●</span> LIVE · ${esc(fmtDay(lead.incident_day))} · ${items.length} RECENT INCIDENTS · ${crit.length} CRITICAL/HIGH · ${new Set(items.map(a=>a.country).filter(Boolean)).size} COUNTRIES · GUARD-CLASSIFIED</div></div>

  <section style="padding:30px 0 22px;background:#fff;color:#101010;"><div class="wrap">
    <div style="font-size:11px;font-weight:700;color:#8A6D00;letter-spacing:.22em;text-transform:uppercase;">◇ The intelligence feed · updated daily</div>
    <h1 style="font-size:clamp(32px,4vw,50px);font-weight:800;line-height:1.02;letter-spacing:-.022em;margin:12px 0 0;">The Attacked <span style="color:#F5B800;font-style:italic;">Hub.</span></h1>
  </div></section>

  <section style="padding:6px 0 30px;background:#fff;color:#101010;"><div class="wrap">
    <div style="display:grid;grid-template-columns:0.85fr 1.5fr 0.85fr;gap:30px;">
      <div><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#A32D2D;margin-bottom:4px;">Critical now</div>${critStack.map(railItem).join("")}</div>
      <div style="padding:0 4px;">
        <div style="height:300px;background:url('${img(lead)}') center/cover;border-top:3px solid ${SEV_C[lead.severity]};"></div>
        <div style="font-size:clamp(25px,3vw,35px);font-weight:800;line-height:1.08;color:#101010;margin-top:14px;text-decoration:underline;text-decoration-color:#F5B800;text-decoration-thickness:3px;text-underline-offset:5px;">${esc(lead.headline)}</div>
        <p style="font-size:14.5px;line-height:1.6;color:#52525B;margin:12px 0 0;">${esc((lead.summary||"").slice(0,220))}</p>
        <div style="margin-top:9px;">${meta(lead)} · <span style="font-size:10.5px;color:#888;font-weight:600;">${esc(place(lead))}</span></div>
        <div style="margin-top:14px;border-top:1px solid #ececec;">${related.map(a=>`<div style="display:flex;gap:8px;padding:9px 0;border-bottom:1px solid #f1f1f1;"><span style="color:#F5B800;font-weight:800;">•</span><span style="font-size:14px;font-weight:700;color:#101010;line-height:1.25;">${esc(a.headline)}</span></div>`).join("")}</div>
      </div>
      <div><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#101010;margin-bottom:4px;">Latest</div>${latest.map(railItem).join("")}</div>
    </div>
  </div></section>

  ${blastFor?`<section style="background:#faf7ec;border-top:1px solid #ece3c2;border-bottom:1px solid #ece3c2;padding:34px 0;"><div class="wrap">
    ${secHead("Blast radius · who else is exposed",'#F5B800',1)}
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:center;">
      <div><div style="font-size:24px;font-weight:800;line-height:1.1;color:#101010;">${esc(blastFor.headline)}</div><div style="margin-top:8px;">${meta(blastFor)} · <span style="font-size:10.5px;color:#888;font-weight:600;">${esc(place(blastFor))}</span></div><p style="font-size:13px;line-height:1.6;color:#52525B;margin:12px 0 0;max-width:520px;">The incident's blast radius traced to named suppliers, customers, peers and regulators — the exposure most feeds never show.</p><a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:16px;background:#1A1A1A;color:#fff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:11px 20px;border-radius:4px;">Trace it on the map →</a></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;">${exposed}</div>
    </div>
  </div></section>`:""}

  <section style="background:#fff;color:#101010;padding:30px 0 0;"><div class="wrap">${secHead("Critical today",'#FF3B30',1)}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">${critRow.map(fourCard).join("")}</div></div></section>

  <div style="background:#fff;color:#101010;padding-bottom:8px;"><div class="wrap">${deskCats.map(deskBand).join("")}</div></div>

  <section style="background:#0d0d0d;color:#fff;padding:42px 0;margin-top:24px;"><div class="wrap">${secHead("Attack-O-Gram · one attack, deconstructed",'#F5B800',0)}
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:28px;align-items:center;">
      <div style="height:300px;background:url('${img(aog)}') center/cover;position:relative;"><span style="position:absolute;left:16px;bottom:16px;background:#F5B800;color:#1A1A1A;font-size:10px;font-weight:700;letter-spacing:.08em;padding:5px 10px;text-transform:uppercase;">Kill chain</span></div>
      <div><div style="font-size:30px;font-weight:800;line-height:1.06;">${esc(aog.headline)}</div><p style="font-size:13.5px;line-height:1.65;color:#A8A8A8;margin:14px 0 0;">${esc((aog.summary||"").slice(0,240))}</p><a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:18px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:11px 22px;border-radius:4px;">See the controls →</a></div>
    </div>
  </div></section>

  <section style="background:#fff;color:#101010;padding:44px 0;"><div class="wrap"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:30px;">
    ${colCats.map(c=>`<div>${secHead(CAT_NAME[c]||c,CAT_C[c],1)}${(byCat[c]||[]).slice(0,5).map(colItem).join("")}</div>`).join("")}
  </div></div></section>

  <div style="background:#fff;"><div class="wrap" style="padding-bottom:56px;"><div style="padding:36px;text-align:center;background:#1A1A1A;color:#fff;border:1px solid #333;border-radius:12px;"><div style="font-size:22px;font-weight:800;">The full picture lives on the map.</div><p style="margin:10px auto 0;max-width:460px;font-size:13.5px;color:#A8A8A8;line-height:1.6;">Blast radius, adaptive controls and vendor Defence Ratings for every briefing — free to enter.</p><a href="https://attackedmap.vercel.app/?home" style="display:inline-block;margin-top:20px;background:#F5B800;color:#1A1A1A;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:13px 28px;border-radius:4px;">Sign up free →</a></div></div></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>The Attacked Hub · enhanced</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/dist/tabler-icons.min.css">
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff;color:#101010;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}.wrap{max-width:1240px;margin:0 auto;padding:0 clamp(20px,4vw,44px)}.previewbar{background:#F5B800;color:#1A1A1A;text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px}a{color:inherit}</style></head>
<body><div class="previewbar">Preview · Enhanced Attacked.ai Hub · severity rails + blast radius · real data</div>${header()}${body}${footer()}</body></html>`;
}

(async()=>{
  const sel="id,headline,summary,entity,country,sector,industry,severity,primary_category,primary_subcategory_name,incident_day,event_date";
  const url=`${SB_URL}/rest/v1/incidents?select=${sel}&incident_day=not.is.null&order=incident_day.desc,severity.desc&limit=80`;
  const r=await fetch(url,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});
  let items=await r.json();if(!Array.isArray(items)){console.error("fetch failed",items);process.exit(1);}
  items=items.filter(a=>a.headline);
  const ids=items.slice(0,10).map(a=>a.id).join(",");
  let blast=[];
  try{const br=await fetch(`${SB_URL}/rest/v1/blast_radius?select=*&incident_id=in.(${ids})&limit=120`,{headers:{apikey:SB_KEY,authorization:`Bearer ${SB_KEY}`}});const j=await br.json();if(Array.isArray(j))blast=j;}catch(e){}
  const cats=Array.from(new Set(items.map(a=>a.primary_category).filter(Boolean)));
  fs.writeFileSync(path.resolve("public","hub-v2.html"),page(items,cats,blast));
  console.log(`OK — enhanced hub, ${items.length} incidents, ${blast.length} blast rows.`);
})();
