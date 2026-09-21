// Dashboard — the signed-in home. Personalised to profiles.industry.
//
// Ported from dashboard-industry/template.html (the approved prototype). Four
// views inside one shell: Your Industry, Attack Hub (the reading room),
// Configure Alerts (writes the real profile fields), and an article view.
//
// Tiering: free readers see every incident in their industry, classified, plus
// the COUNT of blast-radius entities / GUARD controls / peers per incident.
// Subscribers (profiles.tier = 'enterprise' | 'admin') see the rows. There is
// no application step any more — "Subscribe" flips the tier through
// set_own_subscription() (supabase/migrations/20260921_set_own_subscription.sql).
//
// ?preview=free|subscriber renders it without an account (industry defaults to
// Automotive & EV) so QA can click through.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { SubscribeModal } from "../auth/SubscribeModal";
import { CATEGORIES, CATEGORY_NAME, INDUSTRIES, ROLES, SECTORS, SEVERITY, isSubscriber, tierLabel } from "../lib/taxonomy";
import { loadCorpus, loadCounts, loadIncidentDetail, loadIndustry, loadIndustryExtras, savePrefs } from "./data";
import "./dashboard.css";

const DEFAULT_INDUSTRY = "Automotive & EV";
const SEV_ORDER = [5, 4, 3, 2, 1];
const fmtDay = (iso) => iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
const shortDay = (iso) => iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
const previewParam = () => { try { return new URLSearchParams(window.location.search).get("preview"); } catch { return null; } };

// ── icons ──────────────────────────────────────────────────────────────────
const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  pulse: <path d="M3 12h4l2.2-6 4.2 12 2.4-6H21" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12l6-6" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /><path d="M9 12h6M9 16h5" /></>,
  bars: <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  industry: <><path d="M3 21V9l6 4V9l6 4V4h6v17z" /><path d="M7 17h2M11 17h2M15 17h2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  pin: <><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12Z" /><circle cx="12" cy="10" r="2.5" /></>,
  book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23z" /><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>,
};
const Icon = ({ name, style }) => <span className="icon" style={style}><svg viewBox="0 0 24 24">{ICONS[name]}</svg></span>;

// ── small pieces ───────────────────────────────────────────────────────────
const Sev = ({ i, small }) => <span className={`sev s${i.severity}`} style={small ? { padding: "2px 6px" } : undefined}><i />S{i.severity} {i.sevLabel || SEVERITY[i.severity]}</span>;
const Cat = ({ i }) => <span className="cat"><b>{i.cat}</b> · {i.subcat || i.catName}</span>;
const Teaser = ({ i }) => i.n && (
  <div className="teaser">
    <span className="lk"><Icon name="lock" style={{ width: 10, height: 10, flexBasis: 10 }} /><b>{i.n.blast}</b> in blast radius</span>
    <span className="lk"><b>{i.n.controls}</b> GUARD controls</span>
    {i.n.peers ? <span className="lk"><b>{i.n.peers}</b> peers</span> : null}
    <span><b>{i.n.sources}</b> sources</span>
  </div>
);

function IncidentCard({ i, onOpen, onSubscribe, subscriber }) {
  return (
    <article className="incident">
      <div className="topline"><div className="meta"><Sev i={i} /><span>{shortDay(i.day)}</span></div><Cat i={i} /></div>
      <h3>{i.headline}</h3><p>{i.summary}</p>
      <div className="who"><b>{i.entity || "—"}</b><span>·</span><span>{i.country || ""}</span></div>
      <Teaser i={i} />
      <div className="card-actions">
        <button className="btn btn-dark" onClick={() => onOpen(i)}>{i.body ? "Read the briefing" : "Open"} →</button>
        <a className="btn" href={`/?map&incident=${i.id}`} target="_blank" rel="noopener"><Icon name="pin" style={{ width: 13, height: 13, flexBasis: 13 }} /> On map</a>
      </div>
      {!subscriber && (
        <button className="sub-q" onClick={onSubscribe}><span className="mini"><Icon name="lock" style={{ width: 10, height: 10, flexBasis: 10 }} /></span><span>Who is exposed, and what should we do?</span><span className="end">Subscribe</span></button>
      )}
    </article>
  );
}

// Deterministic scatter of incidents on a faint graticule (masthead + map card).
function ArtCanvas({ points, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const draw = () => {
      const r = c.getBoundingClientRect(); if (r.width < 16 || r.height < 16) return;
      const dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr;
      const g = c.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, r.width, r.height);
      g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1;
      for (let k = 0; k <= 8; k++) { const x = k * r.width / 8; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, r.height); g.stroke(); }
      for (let k = 0; k <= 4; k++) { const y = k * r.height / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(r.width, y); g.stroke(); }
      for (const i of points.slice(0, 60)) {
        const s = Math.sin(i.id * 12.9898) * 43758.5453, t = Math.sin(i.id * 78.233) * 43758.5453;
        const x = 20 + (s - Math.floor(s)) * (r.width - 40), y = 20 + (t - Math.floor(t)) * (r.height - 40);
        const rad = 1.5 + i.severity * 0.7;
        g.fillStyle = i.severity >= 4 ? "rgba(245,184,0,.95)" : "rgba(245,184,0,.45)";
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        if (i.severity >= 4) { g.strokeStyle = "rgba(245,184,0,.25)"; g.beginPath(); g.arc(x, y, rad + 6, 0, Math.PI * 2); g.stroke(); }
      }
    };
    draw(); window.addEventListener("resize", draw); return () => window.removeEventListener("resize", draw);
  }, [points]);
  return <canvas ref={ref} className={className} />;
}

// ── views ──────────────────────────────────────────────────────────────────
function YourIndustry({ P, corpus, name, subscriber, query, onOpen, onSubscribe, go }) {
  const [filter, setFilter] = useState("all");
  useEffect(() => { setFilter("all"); }, [P.industry]);
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const top = P.cats[0];
  const q = query.trim().toLowerCase();
  const cards = P.incidents.filter((i) => (filter === "all" || i.cat === filter) && (!q || `${i.headline} ${i.summary} ${i.entity} ${i.country}`.toLowerCase().includes(q)));
  const latest = P.latest.filter((i) => i.industry !== P.industry).slice(0, 6);
  const max = Math.max(...P.cats.map((c) => c.n), 1);
  const gridRef = useRef(null);
  return (
    <div className="content">
      <section className="masthead">
        <div className="mast-copy">
          <div className="mast-eyebrow"><span className="live" />Your industry · {subscriber ? "subscriber" : "free"} intelligence · <span className="mono">{fmtDay(P.latestDay)}</span></div>
          <h1>{greeting}, {name}<strong>{P.industry}</strong></h1>
          <p><b>{P.total} incidents</b> in {P.industry} sit in the Attacked.ai corpus, <b>{P.week} of them this week</b> and <b>{P.critical} rated High or Critical</b>. {top ? <>The category landing hardest on your industry right now is <b>{top.name}</b> ({top.n}).</> : null} Every one is classified through the GUARD framework, geolocated, and traced to the companies in its blast radius.</p>
          <div className="mast-actions">
            <a className="btn btn-dark" href="/?map" target="_blank" rel="noopener">Open on the Attack Map →</a>
            <button className="btn" onClick={() => go("alerts")}><Icon name="bell" /> Configure alerts</button>
            <div className="mast-meta"><b>{subscriber ? "SUBSCRIBER" : "FREE"}</b><span>·</span><span>{subscriber ? "full operational view" : "industry-level view"}</span></div>
          </div>
        </div>
        <div className="mast-art" aria-hidden="true">
          <ArtCanvas points={P.incidents} />
          <div className="art-label"><div className="tiny">Live sector context</div><b>{P.industry}</b></div>
          <div className="art-foot"><span><b>{P.total}</b> in your industry</span><span><b>{INDUSTRIES.length}</b> industries tracked</span><span><b>{P.countries}</b> countries</span></div>
        </div>
      </section>

      <div className="strip">
        <div className="stat"><div className="stat-icon"><Icon name="file" /></div><div><b>{P.today}</b><small>in latest sweep</small></div></div>
        <div className="stat"><div className="stat-icon"><Icon name="bars" /></div><div><b>{P.week}</b><small>last 7 sweep days</small></div></div>
        <button className="stat" onClick={() => go("hub")}><div className="stat-icon"><Icon name="database" /></div><div><b>{P.total}</b><small>in your archive →</small></div></button>
        <div className="stat"><div className="stat-icon"><Icon name="industry" /></div><div><b className="txt" title={P.industry}>{P.industry}</b><small>selected industry</small></div></div>
        <div className="stat"><div className="stat-icon"><Icon name="user" /></div><div><b className="txt">{subscriber ? "Subscriber" : "Free"}</b><small>access level</small></div></div>
        {subscriber
          ? <div className="strip-sub" style={{ cursor: "default" }}><div className="lock"><Icon name="shield" /></div><div><strong>Full operational layer unlocked</strong><span>Named blast radius, GUARD controls and peers on every incident.</span></div></div>
          : <button className="strip-sub" onClick={onSubscribe}><div className="lock"><Icon name="lock" /></div><div><strong>Unlock who is exposed</strong><span>Named blast radius, GUARD controls and peers on every incident.</span></div><div className="arrow">→</div></button>}
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panel-head">
            <div><h2>Latest in {P.industry}</h2><p>Every incident in your industry, classified through the 13 GUARD categories. Newest first.</p></div>
            <div className="section-actions"><span className="archive-link"><b>{P.total}</b> in archive</span><button className="link-btn" onClick={() => go("hub")}>Read the briefings →</button></div>
          </div>
          <div className="filter-row">
            <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All <span className="n">{P.total}</span></button>
            {P.cats.map((c) => <button key={c.code} className={`chip ${filter === c.code ? "active" : ""}`} title={c.name} onClick={() => setFilter(c.code)}>{c.name} <span className="n">{c.n}</span></button>)}
          </div>
          <div className="incident-grid" ref={gridRef}>
            {cards.length ? cards.map((i) => <IncidentCard key={i.id} i={i} onOpen={onOpen} onSubscribe={onSubscribe} subscriber={subscriber} />)
              : <div className="empty">No {filter === "all" ? "" : filter + " "}incidents match{q ? ` “${q}”` : ""}.</div>}
          </div>
        </section>

        <aside className="right">
          <section className="panel today">
            <h2>Latest across all sectors</h2>
            <p>The most recent high-severity incidents beyond your industry.</p>
            <div>{latest.map((i) => <div key={i.id} className="feed-item" onClick={() => onOpen(i)}><Sev i={i} /><div className="feed-title">{i.headline}<small>{i.industry || i.sector || ""} · {i.country || ""}</small></div></div>)}</div>
            <button className="wide-btn" onClick={() => go("hub")}>Open the Attack Hub →</button>
          </section>

          <section className="panel map-card">
            <div className="map-visual">
              <ArtCanvas points={P.latest.concat(P.incidents)} />
              <div className="map-title"><h3>Attack Map</h3><p>Every incident, geolocated.</p></div>
              <div className="map-stats"><div><b>{corpus ? corpus.incidents.toLocaleString("en-GB") : "…"}</b><span>incidents classified</span></div><div><b>{corpus?.countries ?? "…"}</b><span>countries</span></div><div><b>{corpus?.days ?? "…"}</b><span>days of sweeps</span></div></div>
            </div>
            <a className="map-cta" href="/?map" target="_blank" rel="noopener">Open the live map →</a>
          </section>

          {!subscriber && (
            <section className="panel tiers">
              <h3>What free shows. What subscribing adds.</h3>
              <p>Free keeps you current at industry level. Subscribing opens the operational layer behind every incident.</p>
              <div className="split">
                <div className="mini-tier"><b>Free</b><ul><li>Every incident, GUARD-classified</li><li>Severity and rationale</li><li>Daily brief to your inbox</li><li>Live map and Attack Hub</li></ul></div>
                <div className="mini-tier sub"><b>Subscriber</b><ul><li>Named blast radius</li><li>Adaptive GUARD controls</li><li>Peer watchlist</li><li>Historical analogues</li><li>Vendor defence ratings</li></ul></div>
              </div>
            </section>
          )}
        </aside>
      </div>

      <section className="panel sector">
        <div className="panel-head">
          <div><h2>Your industry through the GUARD lens</h2><p>{P.total} incidents across {P.cats.length} of the 13 GUARD categories.</p></div>
          <button className="link-btn" onClick={() => go("hub")}>All briefings →</button>
        </div>
        <div className="sector-wrap">
          <div className="cat-bars"><h3>Where the risk is landing</h3><p>Incidents in your industry by primary GUARD category. Click a bar to filter the cards above.</p>
            <div>{P.cats.map((c) => <div key={c.code} className="bar" onClick={() => { setFilter(c.code); gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span className="code">{c.code}</span><div className="track"><div className="fill" style={{ width: `${Math.max(3, c.n / max * 100)}%` }} /><span className="lbl">{c.name}</span></div><span className="n">{c.n}</span></div>)}</div>
          </div>
          <section className="briefs">
            <div className="briefs-head"><div><h3>Latest long-form briefings</h3><p>Full analyst write-ups for incidents in your industry.</p></div><span className="briefs-count">{P.briefings} available</span></div>
            <div>{P.briefs.length ? P.briefs.slice(0, 5).map((i) => <button key={i.id} className="brief-row" onClick={() => onOpen(i)}><Icon name="book" style={{ color: "#6A6A6A" }} /><span><b>{i.headline}</b><span>{i.entity || ""} · {i.catName}</span></span><span className="brief-date">{shortDay(i.day)} →</span></button>)
              : <div className="empty" style={{ textAlign: "center" }}>No long-form briefings yet for this industry. The incident cards above are live.</div>}</div>
          </section>
        </div>
        <div className="sector-note">Everything on this page is live data from the Attacked.ai corpus, filtered to the industry you gave us at sign-up. Change it any time under Configure alerts.</div>
      </section>
    </div>
  );
}

function AttackHub({ P, query, onOpen, go }) {
  const [scope, setScope] = useState("mine");
  const [sev, setSev] = useState(new Set([5, 4, 3]));
  const [cats, setCats] = useState(new Set(CATEGORIES.map(([c]) => c)));
  const toggle = (set, setter, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n); };
  const q = query.trim().toLowerCase();
  const ok = (i) => sev.has(i.severity) && cats.has(i.cat) && (!q || `${i.headline} ${i.summary} ${i.entity}`.toLowerCase().includes(q));
  const seen = new Set();
  const mine = [...P.briefs, ...P.incidents.filter((i) => i.body)].filter((i) => !seen.has(i.id) && seen.add(i.id) && ok(i));
  const others = P.hub.filter((i) => i.industry !== P.industry && ok(i));
  const lead = (scope === "mine" ? mine : [...mine, ...others].sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : b.severity - a.severity)))[0];
  const Row = ({ i }) => (
    <article className="panel hub-item" onClick={() => onOpen(i)}>
      <div><Sev i={i} /><div className="hub-date">{shortDay(i.day)}</div></div>
      <div><h3>{i.headline}</h3><p>{i.summary}</p><div className="h-meta"><span>{i.cat} · {i.subcat || i.catName}</span><span>{i.entity || ""}</span><span>{i.industry || ""}</span></div></div>
      <button className="btn btn-dark">Read →</button>
    </article>
  );
  const mineRest = mine.filter((i) => i !== lead);
  return (
    <div className="content subpage">
      <div className="subpage-header">
        <div><h1>Attack Hub</h1><p>The reading room. Long-form analyst briefings on the incidents that matter, led by your industry, then the rest of the world.</p></div>
        <button className="primary" onClick={() => go("alerts")}>Tune my alerts</button>
      </div>
      <div className="hub-layout">
        <aside className="panel filter-panel">
          <h3>Filter briefings</h3>
          <div className="filter-section"><span className="fs-title">Scope</span>
            <label><input type="radio" name="hubScope" checked={scope === "mine"} onChange={() => setScope("mine")} /> {P.industry}</label>
            <label><input type="radio" name="hubScope" checked={scope === "all"} onChange={() => setScope("all")} /> All industries</label>
          </div>
          <div className="filter-section"><span className="fs-title">Severity</span>
            {SEV_ORDER.map((s) => <label key={s}><input type="checkbox" checked={sev.has(s)} onChange={() => toggle(sev, setSev, s)} /> <span className={`sev s${s}`} style={{ padding: "2px 6px" }}><i />S{s} {SEVERITY[s]}</span></label>)}
          </div>
          <div className="filter-section"><span className="fs-title">GUARD category</span>
            {CATEGORIES.map(([code, name]) => <label key={code}><input type="checkbox" checked={cats.has(code)} onChange={() => toggle(cats, setCats, code)} /> {name} <span className="n">{code}</span></label>)}
          </div>
        </aside>
        <section>
          <div className="edition-head"><h2>Today's edition</h2><span className="mono">{fmtDay(P.latestDay)}</span></div>
          {lead ? (
            <article className="panel lead" onClick={() => onOpen(lead)}>
              <div className="lead-copy"><div className="kicker"><Sev i={lead} /><span>{lead.catName}</span><span>·</span><span>{lead.industry || ""}</span></div><h3>{lead.headline}</h3><p>{lead.body || lead.summary}</p><button className="btn btn-dark">Read the full briefing →</button></div>
              <div className="lead-side"><div className="fact"><span>Entity</span><b>{lead.entity || "—"}</b></div><div className="fact"><span>Where</span><b>{lead.place || lead.country || "—"}</b></div>{lead.n ? <><div className="fact"><span>Blast radius</span><b className="gold">{lead.n.blast} named entities</b></div><div className="fact"><span>GUARD controls</span><b className="gold">{lead.n.controls} mapped</b></div><div className="fact"><span>Sources</span><b>{lead.n.sources}</b></div></> : <div className="fact"><span>Category</span><b>{lead.cat} · {lead.subcat || lead.catName}</b></div>}</div>
            </article>
          ) : <div className="panel empty">No briefing matches these filters.</div>}
          <div className="hub-section"><h4>For {P.industry}</h4><div className="hub-list">{mineRest.length ? mineRest.map((i) => <Row key={i.id} i={i} />) : <div className="empty">{mine.length ? "That is the only briefing in your industry matching these filters." : "No long-form briefings in your industry match. Widen the filters."}</div>}</div></div>
          <div className="hub-section"><h4>Across all sectors</h4><div className="hub-list">{(scope === "mine" ? others.slice(0, 6) : others.filter((i) => i !== lead)).map((i) => <Row key={i.id} i={i} />)}</div></div>
        </section>
      </div>
    </div>
  );
}

function ConfigureAlerts({ P, profile, subscriber, onSaved, onIndustryChange, go, toast }) {
  const [industry, setIndustry] = useState(P.industry);
  const [role, setRole] = useState(profile?.role || "");
  const [cats, setCats] = useState(() => new Set(Array.isArray(profile?.watch_categories) && profile.watch_categories.length ? profile.watch_categories : CATEGORIES.map(([c]) => c)));
  const [minSev, setMinSev] = useState(3);
  const [on, setOn] = useState(profile?.email_subscribed !== false);
  const [freq, setFreq] = useState(profile?.digest_frequency || "daily");
  const [busy, setBusy] = useState(false);
  const { saveProfileBasics, user } = useAuth();
  const lead = [...P.incidents].sort((a, b) => b.severity - a.severity).slice(0, 3);
  const toggleCat = (c) => { const n = new Set(cats); n.has(c) ? n.delete(c) : n.add(c); setCats(n); };
  async function save() {
    if (!user) { toast("Sign in to save preferences."); return; }
    setBusy(true);
    try {
      await saveProfileBasics({ industry, role: role || null });
      await savePrefs({ watchIndustries: [industry], watchCategories: [...cats], frequency: freq, subscribed: on });
      toast("Preferences saved to your profile");
      onSaved(); if (industry !== P.industry) onIndustryChange(industry);
    } catch (e) { toast(e?.message || "Could not save."); }
    finally { setBusy(false); }
  }
  return (
    <div className="content subpage">
      <div className="subpage-header">
        <div><h1>Configure alerts</h1><p>Choose what lands in your inbox. Your dashboard always keeps the full industry view.</p></div>
        <button className="secondary" onClick={() => { setCats(new Set(CATEGORIES.map(([c]) => c))); setMinSev(3); setOn(true); setFreq("daily"); toast("Defaults restored"); }}>Reset defaults</button>
      </div>
      <div className="settings-layout">
        <section className="panel settings-card">
          <h2>Your intelligence feed</h2>
          <p>These are the same fields you gave us at sign-up. They drive the dashboard, the daily brief and the map's default filter.</p>
          <div className="setting-group">
            <h3>Industry and role</h3><p className="hint">One primary industry. It decides what leads your dashboard and your brief.</p>
            <div className="select-row">
              <div className="field"><label>Primary industry</label><select value={industry} onChange={(e) => setIndustry(e.target.value)}>{SECTORS.map(([s, list]) => <optgroup key={s} label={s}>{list.map((i) => <option key={i} value={i}>{i}</option>)}</optgroup>)}</select></div>
              <div className="field"><label>Role</label><select value={role} onChange={(e) => setRole(e.target.value)}><option value="">Select your role</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
          </div>
          <div className="setting-group">
            <h3>GUARD categories</h3><p className="hint">Which of the 13 risk categories should reach your inbox. Leave all selected to receive the full industry brief.</p>
            <div className="choices">{CATEGORIES.map(([code, name]) => <label key={code} className={`choice ${cats.has(code) ? "selected" : ""}`} onClick={(e) => { e.preventDefault(); toggleCat(code); }}><span className="code">{code}</span>{name}</label>)}</div>
          </div>
          <div className="setting-group">
            <h3>Minimum severity</h3><p className="hint">Attacked.ai scores every incident 1 to 5. Only incidents at or above this level are emailed.</p>
            <div className="choices">{SEV_ORDER.map((s) => <label key={s} className={`choice ${minSev === s ? "selected" : ""}`} onClick={(e) => { e.preventDefault(); setMinSev(s); }}><span className={`sev s${s}`} style={{ padding: "2px 6px" }}><i />S{s}</span>{SEVERITY[s]} and above</label>)}</div>
          </div>
          <div className="setting-group">
            <h3>Email delivery</h3>
            <div className="switch-row"><div><strong>Daily intelligence brief</strong><span>Every incident in your industry from the latest sweep, led by your categories.</span></div><button className={`switch ${on ? "on" : ""}`} aria-label="toggle daily brief" onClick={() => setOn(!on)} /></div>
            <div className="select-row" style={{ marginTop: 6 }}>
              <div className="field"><label>Frequency</label><select value={freq} onChange={(e) => setFreq(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly (Monday)</option></select></div>
              <div className="field"><label>Sends at</label><input value="08:00 UTC · after the morning sweep" disabled /></div>
            </div>
          </div>
          <div className="save-row"><button className="secondary" onClick={() => go("dashboard")}>Cancel</button><button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save preferences"}</button></div>
        </section>
        <aside className="panel preview-card">
          <div className="preview-label">Inbox preview · {subscriber ? "subscriber" : "free"} brief</div>
          <h3>Your {industry} brief</h3>
          <p>Built from real incidents in your industry, exactly as the daily brief renders them.</p>
          <div className="email">
            <div className="email-head"><b>Attacked<i>.ai</i></b><span>{fmtDay(P.latestDay)}</span></div>
            <div className="email-body">
              <p className="greet">Hey there, <b>{P.today || P.week} incidents</b> hit {P.industry} {P.today ? "in the latest sweep" : "this week"}. Here is what moved.</p>
              {lead.map((i) => <div key={i.id} className="ti"><div className="sv" style={{ color: `var(--s${i.severity})` }}>S{i.severity} {SEVERITY[i.severity]} · {i.cat}</div><b>{i.headline}</b><span>{i.entity || ""} · {i.country || ""}</span></div>)}
              {!subscriber && <div className="locked">Named blast radius, recommended actions and vendor defence ratings are subscriber-only.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ArticleView({ i: incoming, subscriber, back, backLabel, onSubscribe }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState(null);
  // Rows from the Hub / cross-sector lists arrive without counts; fetch them
  // on open so the locked panel and the info strip are real, never zero.
  const [counts, setCounts] = useState(incoming.n);
  useEffect(() => { let dead = false; setCounts(incoming.n); if (!incoming.n) loadCounts(incoming.id).then((n) => { if (!dead) setCounts(n); }).catch(() => {}); return () => { dead = true; }; }, [incoming.id]); // eslint-disable-line
  const i = useMemo(() => ({ ...incoming, n: counts || { sources: 0, blast: 0, peers: 0, controls: 0, analogues: 0 } }), [incoming, counts]);
  useEffect(() => {
    let dead = false; setDetail(null); setErr(null);
    if (!subscriber) return;
    loadIncidentDetail(i.id).then((d) => { if (!dead) setDetail(d); }).catch((e) => { if (!dead) setErr(e.message); });
    return () => { dead = true; };
  }, [i.id, subscriber]);
  const paras = (i.body || "").split(/\n{2,}|\r?\n(?=\S)/).map((p) => p.trim()).filter(Boolean);
  const facts = [["Entity", i.entity], ["Where", i.place || i.country], ["Industry", i.industry], ["Sector", i.sector], ["Confidence", i.confidence], ["Sources", i.n.sources]].filter(([, v]) => v);
  return (
    <div className="content subpage article-wrap">
      <button className="back" onClick={back}>← {backLabel}</button>
      <article className="panel article">
        <div className="article-meta"><Sev i={i} /><span className="cat" style={{ fontSize: 10 }}>{i.cat} · {i.subcat || i.catName}</span><span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{fmtDay(i.day)}</span></div>
        <h1>{i.headline}</h1>
        <p className="dek">{i.summary}</p>
        <div className="article-info">{facts.map(([k, v]) => <span key={k}>{k} <b>{v}</b></span>)}</div>
        <div className="article-body">
          <div className="copy">
            {paras.length ? <><h2>The briefing</h2>{paras.map((p, k) => <p key={k}>{p}</p>)}</> : <><h2>What happened</h2><p>{i.summary}</p></>}
            {i.rationale ? <><h2>Why it is rated S{i.severity}</h2><p className="rationale">{i.rationale}</p></> : null}
            {i.secondary.length ? <><h2>Secondary GUARD mappings</h2><p>{i.secondary.map((s, k) => <span key={k} className="chip" style={{ height: 26, margin: "0 6px 6px 0" }}><span className="n">{s.cat}</span>{s.name}</span>)}</p></> : null}
            {subscriber && detail && (
              <>
                <h2>Named blast radius <span className="mono" style={{ fontSize: 12, color: "var(--gold-deep)" }}>{detail.blast.length}</span></h2>
                {detail.blast.length ? detail.blast.map((b) => <p key={b.id}><b>{b.name}</b>{b.country ? ` · ${b.country}` : ""}{b.exposure_group ? ` · ${b.exposure_group}` : ""}{b.reason ? <><br />{b.reason}</> : null}{b.recommended_action_for_them ? <><br /><span className="rationale" style={{ display: "inline-block", marginTop: 6 }}>{b.recommended_action_for_them}</span></> : null}</p>) : <p>No named entities recorded for this incident.</p>}
                <h2>Adaptive GUARD controls <span className="mono" style={{ fontSize: 12, color: "var(--gold-deep)" }}>{detail.controls.length}</span></h2>
                {detail.controls.length ? detail.controls.map((c) => <p key={c.id}><b className="mono" style={{ fontSize: 12 }}>{c.control_id}</b> {c.statement}{c.rationale ? <><br /><span style={{ color: "var(--ink-3)" }}>{c.rationale}</span></> : null}</p>) : <p>No controls mapped.</p>}
                <h2>Peer watchlist <span className="mono" style={{ fontSize: 12, color: "var(--gold-deep)" }}>{detail.peers.length}</span></h2>
                {detail.peers.length ? detail.peers.map((p) => <p key={p.id}><b>{p.name}</b>{p.country ? ` · ${p.country}` : ""}{p.exposure_reason ? <><br />{p.exposure_reason}</> : null}</p>) : <p>No peers flagged.</p>}
                <h2>Historical analogues <span className="mono" style={{ fontSize: 12, color: "var(--gold-deep)" }}>{detail.analogues.length}</span></h2>
                {detail.analogues.length ? detail.analogues.map((a) => <p key={a.id}><b>{a.event_name}</b>{a.entity ? ` · ${a.entity}` : ""}{a.year ? ` · ${a.year}` : ""}{a.summary ? <><br />{a.summary}</> : null}{a.outcome ? <><br /><span style={{ color: "var(--ink-3)" }}>Outcome: {a.outcome}</span></> : null}</p>) : <p>No analogues matched.</p>}
                {detail.sources.length ? <><h2>Sources</h2>{detail.sources.map((s) => <p key={s.id}><a href={s.url} target="_blank" rel="noopener" style={{ textDecoration: "underline" }}>{s.title || s.url}</a>{s.publisher ? <span style={{ color: "var(--ink-3)" }}> · {s.publisher}</span> : null}</p>)}</> : null}
              </>
            )}
            {subscriber && !detail && !err && <p className="mono" style={{ color: "var(--ink-3)" }}>Loading the subscriber layer…</p>}
            {err && <p style={{ color: "#B21F31" }}>{err}</p>}
          </div>
          <aside>
            <div className="facts"><h3>GUARD classification</h3><div className="fact"><span>Primary category</span><b>{i.cat} · {i.catName}</b></div><div className="fact"><span>Subcategory</span><b>{i.subcat || "—"}{i.subcode ? <> <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>{i.subcode}</span></> : null}</b></div><div className="fact"><span>Severity</span><b>S{i.severity} · {i.sevLabel}</b></div><div className="fact"><span>Access</span><b>{subscriber ? "Subscriber · full view" : "Free · industry view"}</b></div></div>
            {!subscriber && (
              <div className="locked"><div className="lk-head">Subscriber layer · locked</div>
                <div className="row"><span>Named blast radius</span><b>{i.n.blast}</b></div>
                {i.n.blast ? <div className="row"><span className="blur">{Array.from({ length: Math.min(i.n.blast, 3) }, () => "Exposed company · exposure channel").join(" · ")}</span><span /></div> : null}
                <div className="row"><span>Adaptive GUARD controls</span><b>{i.n.controls}</b></div>
                <div className="row"><span>Peer watchlist</span><b>{i.n.peers}</b></div>
                <div className="row"><span>Historical analogues</span><b>{i.n.analogues}</b></div>
                <button onClick={onSubscribe}>See who is exposed →</button>
              </div>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
}

// ── shell ──────────────────────────────────────────────────────────────────
export function Dashboard({ initialPage = "dashboard" }) {
  const { user, tier, profile, loading: authLoading, signOut, setSubscribed, saveProfileBasics } = useAuth();
  const preview = previewParam();
  const subscriber = isSubscriber(tier);
  const [industry, setIndustry] = useState(() => profile?.industry || (preview ? DEFAULT_INDUSTRY : null));
  useEffect(() => { if (profile?.industry && profile.industry !== industry) setIndustry(profile.industry); }, [profile?.industry]); // eslint-disable-line
  const [page, setPage] = useState(initialPage);
  const [lastPage, setLastPage] = useState("dashboard");
  const [article, setArticle] = useState(null);
  const [query, setQuery] = useState("");
  const [P, setP] = useState(null);
  const [err, setErr] = useState(null);
  const [corpus, setCorpus] = useState(null);
  const [subOpen, setSubOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2400); }, []);

  useEffect(() => {
    if (!industry) return;
    let dead = false; setP(null); setErr(null);
    loadIndustry(industry)
      .then((d) => { if (dead) return; setP(d); return loadIndustryExtras(industry).then((x) => { if (!dead) setP((p) => p && p.industry === industry ? { ...p, ...x } : p); }); })
      .catch((e) => { if (!dead) setErr(e.message || String(e)); });
    return () => { dead = true; };
  }, [industry]);
  useEffect(() => { loadCorpus().then(setCorpus).catch(() => {}); }, []);

  const go = useCallback((p) => { setPage(p); setSideOpen(false); setMenu(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const openArticle = useCallback((i) => { setLastPage(page); setArticle(i); go("article"); }, [page, go]);
  const name = useMemo(() => {
    const full = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.first_name || "";
    if (full) return full.split(" ")[0];
    return user?.email ? user.email.split("@")[0] : "there";
  }, [profile, user]);
  const initials = useMemo(() => (profile?.full_name || user?.email || "AI").split(/[\s@]/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "AI", [profile, user]);


  // First-run: an account with no industry yet (older sign-ups) picks one here.
  if (!industry) {
    return (
      <div className="dash"><div className="content" style={{ maxWidth: 620, paddingTop: 60 }}>
        <section className="panel settings-card">
          <h2>Which industry should your dashboard lead with?</h2>
          <p>Your account has no industry on file yet. Pick one and we will build your view around it. You can change it later under Configure alerts.</p>
          <div className="field"><label>Primary industry</label>
            <select defaultValue="" onChange={async (e) => { const v = e.target.value; if (!v) return; await saveProfileBasics({ industry: v }); setIndustry(v); }}>
              <option value="" disabled>Select your industry</option>
              {SECTORS.map(([s, list]) => <optgroup key={s} label={s}>{list.map((i) => <option key={i} value={i}>{i}</option>)}</optgroup>)}
            </select>
          </div>
          {authLoading ? <p className="mono" style={{ color: "var(--ink-3)" }}>Loading your profile…</p> : null}
        </section>
      </div></div>
    );
  }

  return (
    <div className="dash">
      <div className="app">
        <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
          <div className="brand">
            <img src="/attacked-ai-logo.svg" alt="" />
            <div><div className="brand-name">Attacked<i>.ai</i><sup style={{ fontSize: 8, marginLeft: 1 }}>™</sup></div><div className="brand-tag">Global risk intelligence</div></div>
          </div>
          <div className="side-label">Intelligence</div>
          <nav className="nav">
            <button className={`nav-btn ${page === "dashboard" || (page === "article" && lastPage === "dashboard") ? "active" : ""}`} onClick={() => go("dashboard")}><Icon name="home" />Your Industry</button>
            <button className={`nav-btn ${page === "hub" || (page === "article" && lastPage === "hub") ? "active" : ""}`} onClick={() => go("hub")}><Icon name="pulse" />Attack Hub</button>
            <a className="nav-btn" href="/?map" target="_blank" rel="noopener"><Icon name="globe" />Attack Map<Icon name="ext" style={{ marginLeft: "auto", width: 14, flexBasis: 14 }} /></a>
            <button className={`nav-btn ${page === "alerts" ? "active" : ""}`} onClick={() => go("alerts")}><Icon name="bell" />Configure Alerts</button>
          </nav>
          <div className="side-label">Subscriber</div>
          <nav className="nav">
            {[["radar", "Blast Radius"], ["shield", "GUARD Controls"], ["users", "Peer Watchlist"]].map(([ic, lbl]) => (
              <button key={lbl} className="nav-btn" onClick={() => subscriber ? go("hub") : setSubOpen(true)}><Icon name={ic} />{lbl}<span className="tag" style={subscriber ? { background: "rgba(52,199,89,.18)", color: "#34C759" } : undefined}>{subscriber ? "ON" : "LOCKED"}</span></button>
            ))}
          </nav>
          <div className="side-spacer" />
          {!subscriber && (
            <div className="upgrade-card">
              <div className="eyebrow">Subscribe</div>
              <h4>See who is exposed, not just what happened.</h4>
              <p>Named blast radius, adaptive GUARD controls and the peer watchlist on every incident in your industry.</p>
              <button onClick={() => setSubOpen(true)}>Subscribe →</button>
            </div>
          )}
          <div className="side-footer">Free: every incident in your industry, classified.<br />Subscriber: who it reaches and what to do.</div>
        </aside>

        <main className="main">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setSideOpen(!sideOpen)}>☰</button>
            <div className="search"><svg viewBox="0 0 24 24">{ICONS.search}</svg><input type="search" placeholder="Search incidents, companies or countries…" value={query} onChange={(e) => setQuery(e.target.value)} /><span className="shortcut">⌘ K</span></div>
            <div className="top-spacer" />
            {preview && <div className="persona"><span>Preview as</span><select value={industry} onChange={(e) => setIndustry(e.target.value)}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>}
            <div className="profile" onClick={() => setMenu(!menu)}>
              <div className="avatar">{initials}</div>
              <div className="profile-copy"><strong>{profile?.full_name || user?.email || "Preview"}</strong><span>{tierLabel(tier).toUpperCase()} · {industry}</span></div>
              <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
            </div>
          </header>

          {err && <div className="content"><div className="panel empty" style={{ color: "#B21F31" }}>Could not load your industry: {err}</div></div>}
          {!P && !err && <div className="content"><div className="panel empty mono">Loading {industry}…</div></div>}
          {P && page === "dashboard" && <YourIndustry P={P} corpus={corpus} name={name} subscriber={subscriber} query={query} onOpen={openArticle} onSubscribe={() => setSubOpen(true)} go={go} />}
          {P && page === "hub" && <AttackHub P={P} query={query} onOpen={openArticle} go={go} />}
          {P && page === "alerts" && <ConfigureAlerts P={P} profile={profile} subscriber={subscriber} onSaved={() => {}} onIndustryChange={setIndustry} go={go} toast={toast} />}
          {P && page === "article" && article && <ArticleView i={article} subscriber={subscriber} back={() => go(lastPage)} backLabel={lastPage === "hub" ? "Back to the Attack Hub" : "Back to your industry"} onSubscribe={() => setSubOpen(true)} />}
        </main>
      </div>

      <SubscribeModal open={subOpen} onClose={() => setSubOpen(false)} onDone={() => toast("You are now a subscriber.")} />
      {menu && (
        <div className="profile-menu open">
          <button onClick={() => go("alerts")}>Alert preferences</button>
          <a className="nav-btn" style={{ height: 36, color: "var(--ink-2)", fontSize: 11 }} href="/?profile">Profile</a>
          {subscriber && user && tier !== "admin" && <button onClick={async () => { try { await setSubscribed(false); toast("Subscription switched off."); } catch (e) { toast(e.message); } setMenu(false); }}>Switch off subscription</button>}
          {!subscriber && <button onClick={() => { setMenu(false); setSubOpen(true); }}>Subscribe</button>}
          <a className="nav-btn" style={{ height: 36, color: "var(--ink-2)", fontSize: 11 }} href="/?home">Landing page</a>
          <button onClick={() => { setMenu(false); user ? signOut() : (window.location.href = "/?home"); }}>{user ? "Sign out" : "Exit preview"}</button>
        </div>
      )}
      <div className={`toast ${toastMsg ? "show" : ""}`}><div className="tick">✓</div><span>{toastMsg || ""}</span></div>
    </div>
  );
}
