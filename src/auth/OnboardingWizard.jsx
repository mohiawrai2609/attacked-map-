// ─────────────────────────────────────────────────────────────────────────
// OnboardingWizard — first-run "briefing calibration" for a newly signed-in
// user. Shown once (profiles.onboarded_at NULL); routed from main.jsx before
// the map. Skippable at every step.
//
// Reference: McKinsey Insights account + subscription flow — full-screen
// canvas, one question per screen, big editorial type, large clickable chips,
// a quiet step marker, and a "do this later" escape. Re-skinned entirely in
// Attacked.ai branding (obsidian + gold #F5B800 + Inter).
//
// What it captures (drives personalization later — digest, map, hub):
//   1  Welcome
//   2  Identity        — name + role
//   3  Organisation    — company + your industry + headcount
//   4  Watchlist       — which industries you track (or "everything")
//   5  Risk lens       — which GUARD categories matter
//   6  Cadence + done  — daily/weekly + summary + enter the map
//
// Saved via the save_onboarding RPC (SECURITY DEFINER, scoped to auth.uid()).
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthProvider";

// The wizard can mount immediately after the magic-link redirect, before any
// other page has loaded the Inter webfont — so it loads its own. Without this
// the whole flow falls back to a system sans-serif (the "not Inter" look).
function FontLoader() {
  useEffect(() => {
    if (document.getElementById("attacked-fonts")) return;
    const link = document.createElement("link");
    link.id = "attacked-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,800&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
}

const BRAND = {
  gold:       "#F5B800",
  obsidian:   "#1A1A1A",
  deep:       "#080808",
  card:       "#1E1E1E",
  white:      "#FFFFFF",
  t2:         "#A8A8A8",
  tmuted:     "#585858",
  border:     "#333333",
  borderGold: "rgba(245,184,0,0.35)",
};

const FONT = "Inter, sans-serif";

// Roles — short, recognisable seats at the table.
const ROLES = [
  "CISO / Security", "Risk / Compliance", "Operations",
  "Executive / Board", "Analyst", "Advisor / Consultant",
  "Investor", "Other",
];

const SIZES = ["Under 50", "50 – 500", "500 – 5,000", "5,000+"];

// GUARD risk categories (13) — code + label, mirrors the map.
const CATEGORIES = [
  ["CYB", "Cyber"], ["DAT", "Data"], ["TEC", "Technology"], ["GEO", "Geopolitical"],
  ["PHY", "Physical"], ["OPS", "Operations"], ["TPR", "Third Party"], ["REG", "Regulatory"],
  ["FIN", "Financial"], ["STR", "Strategic"], ["REP", "Reputation"], ["PPL", "People"],
  ["ENV", "Environment"],
];

// 43 industries grouped by GICS sector (stable structure from the industries
// table). Kept inline so the wizard paints instantly with no fetch/loading flash.
const SECTORS = [
  ["Communication Services", ["Advertising & Marketing Services", "Media & Entertainment", "Telecommunications"]],
  ["Consumer Discretionary", ["Apparel, Luxury & Sporting Goods", "Automotive & EV", "Broadline & Specialty Retail", "Hotels, Restaurants & Leisure"]],
  ["Consumer Staples", ["Food & Beverage", "Food & Drug Retail", "Household & Personal Care"]],
  ["Defence & National Security", ["Armed Forces & Defence Ministries"]],
  ["Energy", ["Oil & Gas (Integrated & E&P)", "Oil & Gas Services & Midstream", "Renewable Energy & Clean Tech", "Utilities (Electric, Gas, Water)"]],
  ["Financials", ["Banking (Diversified & Universal)", "Capital Markets & Asset Management", "Consumer Finance & Lending", "Insurance", "Payments & Financial Infrastructure"]],
  ["Healthcare", ["Health Insurance & Managed Care", "Healthcare Facilities & Providers", "Life Sciences & Biotech Tools", "Medical Devices & Equipment", "Pharmaceuticals"]],
  ["Industrials", ["Aerospace & Defence", "Airlines & Aviation", "Construction & Engineering", "Industrial Machinery & Equipment", "Transportation & Logistics", "Waste Management & Environmental Services"]],
  ["Information Technology", ["Cybersecurity", "Hardware & Networking", "Internet & Digital Platforms", "IT Services & Consulting", "Semiconductors & Equipment", "Software & Cloud Infrastructure"]],
  ["Materials", ["Chemicals (Diversified & Specialty)", "Metals, Mining & Building Materials"]],
  ["Public Administration", ["Government (National / Federal)"]],
  ["Public Health & Social Care", ["Public Hospitals & National Health Systems"]],
  ["Real Estate", ["Real Estate Development & Services", "REITs (All Subsectors)"]],
];
const ALL_INDUSTRIES = SECTORS.flatMap(([, list]) => list);

const TOTAL_STEPS = 6;

// ── Shared atoms ──────────────────────────────────────────────────────────
function StepMarker({ n }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 700, color: BRAND.gold,
        letterSpacing: "0.18em",
      }}>{String(n).padStart(2, "0")} — {String(TOTAL_STEPS).padStart(2, "0")}</span>
      <span style={{ flex: 1, height: 1, background: BRAND.border, position: "relative", maxWidth: 220 }}>
        <span style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${(n / TOTAL_STEPS) * 100}%`, background: BRAND.gold,
          transition: "width 320ms ease",
        }} />
      </span>
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div style={{
      fontFamily: FONT, fontSize: 11, fontWeight: 700, color: BRAND.tmuted,
      letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14,
    }}>{children}</div>
  );
}

function Title({ children }) {
  return (
    <h1 style={{
      fontFamily: FONT, margin: 0, fontWeight: 800,
      fontSize: "clamp(30px, 4vw, 48px)", lineHeight: 1.1, letterSpacing: "-0.02em",
      color: BRAND.white,
    }}>{children}</h1>
  );
}

function Sub({ children }) {
  return (
    <p style={{
      fontFamily: FONT, margin: "16px 0 0", maxWidth: 560,
      fontSize: 16, lineHeight: 1.6, color: BRAND.t2,
    }}>{children}</p>
  );
}

function Chip({ active, onClick, children, small }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: small ? "8px 14px" : "11px 18px",
      background: active ? BRAND.gold : "transparent",
      color: active ? BRAND.obsidian : BRAND.t2,
      border: `1px solid ${active ? BRAND.gold : BRAND.border}`,
      borderRadius: 6, cursor: "pointer",
      fontFamily: FONT, fontSize: small ? 12.5 : 14, fontWeight: 600,
      letterSpacing: "0.01em", transition: "all 140ms ease",
    }}>{children}</button>
  );
}

const inputStyle = {
  width: "100%", maxWidth: 480, padding: "14px 0",
  background: "transparent", color: BRAND.white,
  border: "none", borderBottom: `2px solid ${BRAND.border}`,
  fontFamily: FONT, fontSize: 22, fontWeight: 600, outline: "none",
  letterSpacing: "-0.01em",
};

const primaryBtn = {
  padding: "14px 30px", background: BRAND.gold, color: BRAND.obsidian,
  border: "none", borderRadius: 6, cursor: "pointer",
  fontFamily: FONT, fontSize: 14, fontWeight: 700,
  letterSpacing: "0.06em", textTransform: "uppercase",
};
const ghostNav = {
  padding: "14px 24px", background: "transparent", color: BRAND.t2,
  border: `1px solid ${BRAND.border}`, borderRadius: 6, cursor: "pointer",
  fontFamily: FONT, fontSize: 13, fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase",
};

export function OnboardingWizard() {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    fullName: profile?.full_name || "",
    role: profile?.role || "",
    company: profile?.company || "",
    industry: "",
    country: "",
    companySize: "",
    watchIndustries: [],      // [] = watch all
    watchCategories: [],      // [] = all risks
    digestFrequency: "daily",
    watchAll: true,
    allRisks: true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleIn = (k, val) => setForm(f => {
    const list = f[k];
    return { ...f, [k]: list.includes(val) ? list.filter(x => x !== val) : [...list, val] };
  });

  const next = () => setStep(s => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  async function finish(skip = false) {
    setSaving(true);
    setError(null);
    try {
      const watchInd = form.watchAll ? ALL_INDUSTRIES : form.watchIndustries;
      const watchCat = form.allRisks ? CATEGORIES.map(c => c[0]) : form.watchCategories;
      const { error: rpcErr } = await supabase.rpc("save_onboarding", {
        p_full_name: form.fullName,
        p_company: form.company,
        p_role: form.role,
        p_industry: form.industry,
        p_country: form.country,
        p_company_size: form.companySize,
        p_watch_industries: watchInd,
        p_watch_categories: watchCat,
        p_digest_frequency: form.digestFrequency,
        p_email_subscribed: true,
      });
      if (rpcErr) throw rpcErr;
      await refreshProfile();
      // refreshProfile sets onboarded_at → main.jsx stops rendering the wizard.
    } catch (e) {
      setError(e?.message || "Could not save. Try again.");
      setSaving(false);
    }
  }

  // Skip writes onboarded_at too (so we never nag), but leaves preferences open.
  async function skipAll() {
    set("watchAll", true); set("allRisks", true);
    await finish(true);
  }

  const STEP_LABELS = ["Welcome", "Who you are", "Organisation", "Watchlist", "Risk lens", "Cadence"];

  return (
    <div style={{
      minHeight: "100vh", background: BRAND.deep, color: BRAND.white,
      fontFamily: FONT, display: "flex", WebkitFontSmoothing: "antialiased",
    }}>
      <FontLoader />
      <style>{`
        @keyframes ob-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .ob-rail { display: none; }
        @media (min-width: 920px) { .ob-rail { display: flex; } }
      `}</style>

      {/* ── LEFT BRAND RAIL (desktop) — persistent context + step tracker ── */}
      <aside className="ob-rail" style={{
        width: 320, flexShrink: 0, flexDirection: "column",
        padding: "36px 32px",
        background: `radial-gradient(ellipse 120% 60% at 0% 0%, rgba(245,184,0,0.08), transparent 55%), ${BRAND.obsidian}`,
        borderRight: `1px solid ${BRAND.border}`,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <img src="/attacked-ai-logo.svg" alt="" width={30} height={30} style={{ display: "block" }} />
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
            Attacked<span style={{ color: BRAND.gold }}>.ai</span>
          </span>
        </div>

        <div style={{ marginTop: 46 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: BRAND.tmuted,
            letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 20,
          }}>Calibration</div>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = n < step, active = n === step;
            return (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "9px 0",
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10.5, fontWeight: 700,
                  background: active ? BRAND.gold : (done ? "rgba(245,184,0,0.14)" : "transparent"),
                  color: active ? BRAND.obsidian : (done ? BRAND.gold : BRAND.tmuted),
                  border: `1px solid ${active || done ? BRAND.borderGold : BRAND.border}`,
                  transition: "all 200ms ease",
                }}>{done ? "✓" : n}</span>
                <span style={{
                  fontSize: 13.5, fontWeight: active ? 700 : 500,
                  color: active ? BRAND.white : (done ? BRAND.t2 : BRAND.tmuted),
                  letterSpacing: "0.01em", transition: "color 200ms ease",
                }}>{label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto" }}>
          <p style={{
            fontSize: 13, lineHeight: 1.7, color: BRAND.t2, fontStyle: "italic",
            paddingLeft: 14, margin: 0,
          }}>
            "We don't send you everything. We send you what's yours —
            your industry, your risks, every day."
          </p>
        </div>
      </aside>

      {/* ── RIGHT CONTENT PANEL ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Slim top bar — mobile logo + step marker + skip */}
        <header style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 32px", borderBottom: `1px solid ${BRAND.border}`,
        }}>
          <div className="ob-mobilelogo" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <img src="/attacked-ai-logo.svg" alt="" width={24} height={24} style={{ display: "block" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              Attacked<span style={{ color: BRAND.gold }}>.ai</span>
            </span>
          </div>
          <StepMarker n={step} />
          <button onClick={skipAll} disabled={saving} style={{
            background: "none", border: "none", color: BRAND.tmuted, cursor: "pointer",
            fontFamily: FONT, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>Complete later</button>
        </header>

        {/* Body — one question per screen */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "48px 40px" }}>
        <div key={step} style={{
          maxWidth: 640, margin: "0 auto", width: "100%",
          animation: "ob-fade 360ms ease",
        }}>

          {/* STEP 1 — WELCOME */}
          {step === 1 && (
            <div>
              <Eyebrow>Welcome to Attacked.ai</Eyebrow>
              <Title>Let's calibrate your<br />intelligence briefing.</Title>
              <Sub>
                Six quick questions. We tune what you see on the map — and what
                lands in your inbox — to your industry and the risks you actually
                care about. Thirty seconds.
              </Sub>
              <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={next} style={primaryBtn}>Begin →</button>
              </div>
            </div>
          )}

          {/* STEP 2 — IDENTITY */}
          {step === 2 && (
            <div>
              <Eyebrow>Who is reading</Eyebrow>
              <Title>First, your name.</Title>
              <input
                autoFocus value={form.fullName}
                onChange={e => set("fullName", e.target.value)}
                placeholder="Type your name…"
                onKeyDown={e => { if (e.key === "Enter" && form.fullName.trim()) next(); }}
                style={{ ...inputStyle, marginTop: 24 }}
                onFocus={e => (e.target.style.borderBottomColor = BRAND.gold)}
                onBlur={e => (e.target.style.borderBottomColor = BRAND.border)}
              />
              <div style={{ marginTop: 36, fontSize: 13, fontWeight: 700, color: BRAND.tmuted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                And your seat at the table
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ROLES.map(r => (
                  <Chip key={r} active={form.role === r} onClick={() => set("role", r)}>{r}</Chip>
                ))}
              </div>
              <NavRow onBack={back} onNext={next} canNext />
            </div>
          )}

          {/* STEP 3 — ORGANISATION */}
          {step === 3 && (
            <div>
              <Eyebrow>Your organisation</Eyebrow>
              <Title>Where do you watch from?</Title>
              <input
                autoFocus value={form.company}
                onChange={e => set("company", e.target.value)}
                placeholder="Company or organisation…"
                style={{ ...inputStyle, marginTop: 24, fontSize: 20 }}
                onFocus={e => (e.target.style.borderBottomColor = BRAND.gold)}
                onBlur={e => (e.target.style.borderBottomColor = BRAND.border)}
              />
              <div className="r-grid" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 620 }}>
                <div>
                  <Label>Your industry</Label>
                  <select value={form.industry} onChange={e => set("industry", e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {SECTORS.map(([sector, list]) => (
                      <optgroup key={sector} label={sector}>
                        {list.map(i => <option key={i} value={i}>{i}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Country</Label>
                  <input value={form.country} onChange={e => set("country", e.target.value)}
                    placeholder="e.g. India"
                    style={{ ...selectStyle, padding: "10px 12px" }} />
                </div>
              </div>
              <div style={{ marginTop: 26 }}>
                <Label>Headcount</Label>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SIZES.map(s => (
                    <Chip key={s} small active={form.companySize === s} onClick={() => set("companySize", s)}>{s}</Chip>
                  ))}
                </div>
              </div>
              <NavRow onBack={back} onNext={next} canNext />
            </div>
          )}

          {/* STEP 4 — WATCHLIST (industries) */}
          {step === 4 && (
            <div>
              <Eyebrow>Your watchlist</Eyebrow>
              <Title>Which industries do<br />you actually watch?</Title>
              <Sub>Pick the sectors that matter to you — your feed and daily brief
                will lead with these. Or keep watching everything.</Sub>

              <div style={{ marginTop: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Chip active={form.watchAll} onClick={() => set("watchAll", true)}>◎ Watch everything</Chip>
                <Chip active={!form.watchAll} onClick={() => set("watchAll", false)}>Choose specific industries</Chip>
              </div>

              {!form.watchAll && (
                <div style={{
                  marginTop: 22, maxHeight: 300, overflowY: "auto", paddingRight: 8,
                  borderTop: `1px solid ${BRAND.border}`, paddingTop: 18,
                }}>
                  {SECTORS.map(([sector, list]) => (
                    <div key={sector} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: BRAND.tmuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{sector}</div>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {list.map(i => (
                          <Chip key={i} small
                            active={form.watchIndustries.includes(i)}
                            onClick={() => toggleIn("watchIndustries", i)}>{i}</Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <NavRow onBack={back} onNext={next} canNext />
            </div>
          )}

          {/* STEP 5 — RISK LENS (GUARD categories) */}
          {step === 5 && (
            <div>
              <Eyebrow>Your risk lens</Eyebrow>
              <Title>Which exposures keep<br />you up at night?</Title>
              <Sub>The GUARD framework classifies every incident across thirteen
                risk categories. Choose the ones you track — or keep all of them.</Sub>

              <div style={{ marginTop: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Chip active={form.allRisks} onClick={() => set("allRisks", true)}>◎ All risks</Chip>
                <Chip active={!form.allRisks} onClick={() => set("allRisks", false)}>Choose specific risks</Chip>
              </div>

              {!form.allRisks && (
                <div style={{ marginTop: 22, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 640 }}>
                  {CATEGORIES.map(([code, label]) => (
                    <Chip key={code} small
                      active={form.watchCategories.includes(code)}
                      onClick={() => toggleIn("watchCategories", code)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              )}
              <NavRow onBack={back} onNext={next} canNext />
            </div>
          )}

          {/* STEP 6 — CADENCE + DONE */}
          {step === 6 && (
            <div>
              <Eyebrow>Briefing cadence</Eyebrow>
              <Title>How often should we<br />reach you?</Title>
              <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip active={form.digestFrequency === "daily"} onClick={() => set("digestFrequency", "daily")}>Daily brief</Chip>
                <Chip active={form.digestFrequency === "weekly"} onClick={() => set("digestFrequency", "weekly")}>Weekly roundup</Chip>
              </div>

              {/* Summary card */}
              <div style={{
                marginTop: 30, padding: "20px 22px", maxWidth: 560,
                background: BRAND.obsidian, border: `1px solid ${BRAND.borderGold}`, borderRadius: 10,
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: BRAND.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
                  ✓ Briefing calibrated
                </div>
                <SummaryRow k="Reading as" v={[form.fullName, form.role].filter(Boolean).join(" · ") || "—"} />
                <SummaryRow k="Watching" v={form.watchAll ? "All industries" : (form.watchIndustries.length ? `${form.watchIndustries.length} industries` : "All industries")} />
                <SummaryRow k="Risk lens" v={form.allRisks ? "All 13 categories" : (form.watchCategories.length ? `${form.watchCategories.length} categories` : "All categories")} />
                <SummaryRow k="Daily brief" v={form.digestFrequency === "daily" ? "Daily · to your inbox" : "Weekly · to your inbox"} />
              </div>

              {error && (
                <div style={{ marginTop: 16, color: "#FF6B6B", fontSize: 13 }}>{error}</div>
              )}

              <div style={{ marginTop: 30, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={back} disabled={saving} style={ghostNav}>← Back</button>
                <button onClick={() => finish(false)} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Enter the map →"}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 700, color: BRAND.tmuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

const selectStyle = {
  width: "100%", padding: "11px 12px",
  background: BRAND.obsidian, color: BRAND.white,
  border: `1px solid ${BRAND.border}`, borderRadius: 6,
  fontFamily: FONT, fontSize: 14, fontWeight: 500, outline: "none",
};

function SummaryRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 13.5 }}>
      <span style={{ color: BRAND.tmuted }}>{k}</span>
      <span style={{ color: BRAND.white, fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

function NavRow({ onBack, onNext, canNext }) {
  return (
    <div style={{ marginTop: 40, display: "flex", gap: 12, alignItems: "center" }}>
      <button onClick={onBack} style={ghostNav}>← Back</button>
      <button onClick={onNext} disabled={!canNext} style={{ ...primaryBtn, opacity: canNext ? 1 : 0.5 }}>Continue →</button>
    </div>
  );
}
