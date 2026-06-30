// ─────────────────────────────────────────────────────────────────────────
// PartnerApplicationModal — Gate 2 entry.
//
// 4-field form: full name, company, role, sector, LinkedIn, why interested.
// Posts to public.partner_applications with status='pending'. The backend
// trigger flips the user's tier to 'partner' the moment an admin sets the
// row's status to 'approved'.
//
// Two entry surfaces:
//   1. PublicWall — anonymous visitor clicks the PARTNER · GATE 2 card
//      → applies with email; gets a confirmation; later signs up with
//      the same email and lands on partner tier automatically.
//   2. GateBlock inside the map — signed-in free user clicks "Request
//      Design Partner access" → application includes their user_id.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthProvider";

const BRAND = {
  gold: "#F5B800",
  obsidian: "#1A1A1A",
  obsidianDeep: "#080808",
  obsidianCard: "#242424",
  obsidianElevated: "#2E2E2E",
  white: "#FFFFFF",
  textSecondary: "#A8A8A8",
  textMuted: "#585858",
  borderSubtle: "#333333",
  borderGold: "rgba(245,184,0,0.3)",
  red: "#FF6B6B",
  green: "#34C759",
};

const SECTORS = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Technology",
  "Manufacturing", "Retail", "Transportation & Logistics", "Government",
  "Defence & Aerospace", "Telecommunications", "Insurance", "Media",
  "Education", "Consulting / Advisory", "Other",
];

const inputStyle = {
  width: "100%", padding: "11px 14px",
  background: BRAND.obsidianDeep, color: BRAND.white,
  border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
  fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none",
  transition: "border-color 160ms ease",
};

const labelStyle = {
  display: "block", fontFamily: "Inter, sans-serif", fontSize: 9.5,
  color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase",
  marginBottom: 6, marginTop: 12,
};

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: BRAND.gold }}> *</span>}
      </label>
      {children}
      {hint && (
        <div style={{ marginTop: 4, fontSize: 11, color: BRAND.textMuted, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  );
}

export function PartnerApplicationModal({ open, onClose, defaultEmail }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: "", company: "", role: "", sector: "",
    linkedin_url: "", why_interested: "",
    email: defaultEmail || user?.email || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [error, setError] = useState(null);

  // Reset form whenever modal opens with a new default email
  React.useEffect(() => {
    if (open) {
      setForm(prev => ({ ...prev, email: defaultEmail || user?.email || prev.email }));
      setSubmittedId(null);
      setError(null);
    }
  }, [open, defaultEmail, user?.email]);

  if (!open) return null;

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const required = ["email", "full_name", "company", "role", "why_interested"];
    for (const f of required) {
      if (!String(form[f] || "").trim()) {
        setError(`Please fill in ${f.replace("_", " ")}.`);
        return;
      }
    }
    if (form.why_interested.trim().length < 30) {
      setError("Please give us a bit more detail on why you're interested (at least 30 characters).");
      return;
    }
    // LinkedIn URL — auto-prepend https:// if missing; reject obviously broken
    // values but accept the common "linkedin.com/in/…" shorthand.
    let normalizedLinkedIn = form.linkedin_url.trim();
    if (normalizedLinkedIn) {
      if (!/^https?:\/\//i.test(normalizedLinkedIn)) {
        normalizedLinkedIn = "https://" + normalizedLinkedIn.replace(/^\/+/, "");
      }
      if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(normalizedLinkedIn)) {
        setError("LinkedIn URL doesn't look right. Example: linkedin.com/in/your-name");
        return;
      }
    }

    setSubmitting(true);
    try {
      // RPC bypasses the SELECT-after-INSERT RLS check that blocks anonymous
      // submitters (anon has no SELECT policy on partner_applications by design).
      // The function runs SECURITY DEFINER and returns just the new row's id.
      const { data, error: rpcError } = await supabase.rpc("submit_partner_application", {
        p_email: form.email,
        p_full_name: form.full_name,
        p_company: form.company,
        p_role: form.role,
        p_why_interested: form.why_interested,
        p_sector: form.sector || null,
        p_linkedin_url: normalizedLinkedIn || null,
        p_user_id: user?.id || null,
      });
      if (rpcError) throw rpcError;
      setSubmittedId(data);
    } catch (err) {
      setError(err?.message || "Could not submit. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(8,8,8,0.82)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: BRAND.obsidianCard,
          border: `1px solid ${BRAND.borderGold}`,
          borderRadius: 8,
          padding: "32px 32px 24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, color: BRAND.gold,
            letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
          }}>
            🤝 Gate 2 · Design Partner Application
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: "none", border: "none", color: BRAND.textSecondary,
            fontSize: 22, cursor: "pointer", padding: 4, lineHeight: 1,
          }}>×</button>
        </div>

        {submittedId ? (
          <>
            <h2 style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 30,
              color: BRAND.white, lineHeight: 1.2, marginTop: 14, letterSpacing: "-0.01em",
            }}>
              Application received.
            </h2>
            <div style={{
              display: "inline-block",
              padding: "4px 10px", marginTop: 14,
              background: "rgba(52,199,89,0.10)", border: `1px solid ${BRAND.green}66`,
              borderRadius: 3,
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: BRAND.green, letterSpacing: "0.10em",
            }}>
              REF #{String(submittedId).padStart(5, "0")}  ·  STATUS: PENDING
            </div>
            <p style={{ marginTop: 16, fontSize: 14, color: BRAND.textSecondary, lineHeight: 1.6 }}>
              We review applications within <b style={{ color: BRAND.white }}>48 hours</b>.
              When you're approved, your account unlocks to the partner tier automatically — the
              full map appears on your next page refresh.
            </p>
            <div style={{
              marginTop: 22, padding: "12px 14px",
              background: "rgba(245,184,0,0.06)", borderRadius: 4,
              borderLeft: `2px solid ${BRAND.gold}`,
              fontSize: 12.5, color: BRAND.white, lineHeight: 1.55,
            }}>
              <b>What's next:</b> sign in (or stay signed in) with this same email
              (<b>{form.email}</b>). Bookmark <b>attackedmap.vercel.app</b> and check back in 24-48h —
              your tier flips on refresh, no extra step needed.
            </div>
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: "rgba(255,140,90,0.08)", borderRadius: 4,
              border: "1px solid rgba(255,140,90,0.25)",
              fontSize: 11.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.5,
            }}>
              <b style={{ color: "#FF8C5A" }}>⚠ Private beta notice:</b> email notifications
              are temporarily limited during our beta. The cleanest way to know you're approved
              is to refresh the app and look for the <b style={{ color: BRAND.gold }}>🤝 PARTNER</b>
              chip in the top-right.
            </div>

            {/* Pricing recap on success screen — reinforces the value they */}
            {/* just locked in by applying, while billing is still deferred. */}
            <div style={{
              marginTop: 12, padding: "12px 14px",
              background: `linear-gradient(180deg, rgba(245,184,0,0.08), rgba(245,184,0,0.02))`,
              borderRadius: 4,
              border: `1px solid ${BRAND.borderGold}`,
              fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.6,
            }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 9.5,
                color: BRAND.gold, letterSpacing: "0.14em",
                textTransform: "uppercase", fontWeight: 600, marginBottom: 6,
              }}>
                ★ Your founding partner rate is reserved
              </div>
              Once approved, you're locked at <b style={{ color: BRAND.gold }}>₹4,999/mo</b>
              {" "}forever (vs ₹14,999/mo Enterprise). Free during private beta — billing starts
              when we go public (Q4 2026). No payment details needed today.
            </div>
            <button type="button" onClick={onClose} style={{
              marginTop: 22, width: "100%", padding: "12px 16px",
              background: BRAND.gold, color: BRAND.obsidian,
              border: "none", borderRadius: 4,
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}>Close</button>
          </>
        ) : (
          <>
            <h2 style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 28,
              color: BRAND.white, lineHeight: 1.2, marginTop: 14, letterSpacing: "-0.01em",
            }}>
              Apply for full operational access.
            </h2>
            <p style={{ marginTop: 12, fontSize: 13.5, color: BRAND.textSecondary, lineHeight: 1.55 }}>
              Design partners get the unlocked map — named blast radius, adaptive controls, vendor
              Defence Ratings, full article-grade write-ups. ~30 min/month: light feedback when we
              ask, first look at new modules.
            </p>

            {/* FOUNDING PARTNER PRICING BANNER — sets expectation up-front. */}
            {/* Partners need to know: this is paid (not free forever), but    */}
            {/* the founding rate is locked in forever — strong scarcity + value. */}
            <div style={{
              marginTop: 18,
              padding: "16px 18px",
              background: `linear-gradient(180deg, rgba(245,184,0,0.10), rgba(245,184,0,0.04) 90%)`,
              border: `1px solid ${BRAND.gold}`,
              borderRadius: 6,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -10, left: 14,
                padding: "2px 10px",
                background: BRAND.obsidianCard,
                fontFamily: "Inter, sans-serif", fontSize: 9.5,
                color: BRAND.gold, letterSpacing: "0.16em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                ★ Founding Partner Rate
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif", fontWeight: 700,
                  fontSize: 32, color: BRAND.white, lineHeight: 1,
                }}>
                  ₹4,999<span style={{ fontSize: 14, color: BRAND.textSecondary, fontWeight: 400, fontFamily: "Inter, sans-serif", marginLeft: 4 }}>/month</span>
                </div>
                <div style={{
                  fontSize: 13, color: BRAND.textMuted,
                  textDecoration: "line-through",
                  fontFamily: "Inter, sans-serif",
                }}>
                  ₹14,999/mo Enterprise
                </div>
                <div style={{
                  padding: "2px 8px",
                  background: "rgba(52,199,89,0.15)",
                  border: `1px solid ${BRAND.green}55`,
                  borderRadius: 3,
                  fontFamily: "Inter, sans-serif", fontSize: 9.5,
                  color: BRAND.green, letterSpacing: "0.10em",
                  textTransform: "uppercase", fontWeight: 600,
                }}>
                  Save ₹1.2L/year
                </div>
              </div>

              <ul style={{
                margin: "12px 0 0", padding: 0, listStyle: "none",
                fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.7,
              }}>
                <li>◇ <b style={{ color: BRAND.gold }}>Locked forever</b> — your rate never increases</li>
                <li>◇ First <b style={{ color: BRAND.white }}>50 seats only</b> — Enterprise rate kicks in after</li>
                <li>◇ Free during private beta — billing starts when we launch public (Q4 2026)</li>
              </ul>
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
              <Field label="Work email" required>
                <input type="email" required value={form.email} disabled={!!user?.email}
                  onChange={(e) => update("email", e.target.value)}
                  style={{ ...inputStyle, opacity: user?.email ? 0.7 : 1 }}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
              </Field>

              <Field label="Full name" required>
                <input required value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
              </Field>

              <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Company" required>
                  <input required value={form.company}
                    onChange={(e) => update("company", e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
                </Field>
                <Field label="Role" required>
                  <input required placeholder="e.g. CISO, Head of Risk"
                    value={form.role}
                    onChange={(e) => update("role", e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
                </Field>
              </div>

              <Field label="Sector">
                <select value={form.sector}
                  onChange={(e) => update("sector", e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)}>
                  <option value="">— Select —</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="LinkedIn URL" hint="Optional — paste full URL or just 'linkedin.com/in/your-name', we'll handle the rest.">
                <input type="text" placeholder="linkedin.com/in/your-name"
                  value={form.linkedin_url}
                  onChange={(e) => update("linkedin_url", e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
              </Field>

              <Field label="Why are you interested?" required
                hint="One paragraph — what would full access let you do that you can't do today?">
                <textarea required rows={4} value={form.why_interested}
                  onChange={(e) => update("why_interested", e.target.value)}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 90, fontFamily: "Inter, sans-serif" }}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)} />
              </Field>

              {error && (
                <div style={{
                  marginTop: 12, padding: "10px 12px",
                  background: "rgba(255,107,107,0.08)",
                  border: `1px solid ${BRAND.red}55`, borderRadius: 4,
                  fontSize: 12.5, color: BRAND.red, lineHeight: 1.5,
                }}>{error}</div>
              )}

              <button type="submit" disabled={submitting} style={{
                marginTop: 22, width: "100%", padding: "13px 16px",
                background: submitting ? "rgba(245,184,0,0.4)" : BRAND.gold,
                color: BRAND.obsidian, border: "none", borderRadius: 4,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: submitting ? "wait" : "pointer",
              }}>
                {submitting ? "Submitting…" : "Submit application →"}
              </button>

              <div style={{
                marginTop: 14, fontSize: 11, color: BRAND.textMuted,
                lineHeight: 1.55, textAlign: "center",
              }}>
                Reviewed within 48 hours. We don't share applications externally.
              </div>

              {/* Pricing acceptance reminder — partners must understand they're */}
              {/* accepting the founding rate (₹4,999/mo grandfathered), not    */}
              {/* "free forever." Beta period is free; billing starts at launch. */}
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "rgba(245,184,0,0.05)",
                border: `1px solid ${BRAND.borderGold}`,
                borderRadius: 3,
                fontSize: 10.5, color: "rgba(255,255,255,0.72)",
                lineHeight: 1.55, textAlign: "center",
                fontFamily: "Inter, sans-serif", letterSpacing: "0.03em",
              }}>
                By applying, you accept the founding partner rate
                (<b style={{ color: BRAND.gold }}>₹4,999/mo</b>) once approved.
                Free during private beta · billing starts Q4 2026.
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
