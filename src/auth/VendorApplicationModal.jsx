// ─────────────────────────────────────────────────────────────────────────
// VendorApplicationModal — Phase 6.3.
//
// Vendor product: companies pay for VISIBILITY (being named where they
// can defend), not for scores. Three listing tiers — basic, featured,
// premium — actual price + slot picked by admin once approved.
//
// Mirrors PartnerApplicationModal: anonymous submission via
// submit_vendor_application RPC (SECURITY DEFINER). user_id populated
// when a signed-in user clicks from inside the app.
//
// Entry surfaces:
//   1. PricingPage "Vendor Promotion" card → "List your company" CTA
//   2. PublicWall vendor tile (optional, future)
//   3. Account dropdown for signed-in users (future)
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
  vendorGreen: "#34C759",
};

// Common security capability categories — vendors pick which ones apply.
// Kept short and recognisable; "Other" lets people write their own.
const CATEGORIES = [
  "EDR / XDR", "SIEM", "SOAR", "Identity & Access (IAM)",
  "Email Security", "Cloud Security (CNAPP/CSPM)", "Network Security",
  "DLP / Data Security", "Vulnerability Management", "GRC / Compliance",
  "Threat Intelligence", "Backup & Recovery", "Application Security",
  "Penetration Testing", "Managed Security (MSSP)", "OT / ICS Security",
  "Privacy & Consent", "Other",
];

const SECTORS = [
  "Financial Services", "Healthcare", "Energy & Utilities", "Technology",
  "Manufacturing", "Retail", "Transportation & Logistics", "Government",
  "Defence & Aerospace", "Telecommunications", "Insurance", "Media",
  "Education", "Consulting / Advisory", "All sectors",
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

// Multi-select chip group — same UX pattern as the category filter on
// the map. Click a chip to toggle, visual state mirrors selection.
function ChipGroup({ options, selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: "5px 10px",
              background: on ? BRAND.gold : "transparent",
              color: on ? BRAND.obsidian : BRAND.textSecondary,
              border: `1px solid ${on ? BRAND.gold : BRAND.borderSubtle}`,
              borderRadius: 3,
              fontFamily: "Inter, sans-serif", fontSize: 10,
              letterSpacing: "0.06em", cursor: "pointer", fontWeight: 600,
              transition: "all 140ms ease",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function VendorApplicationModal({ open, onClose, defaultEmail }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: defaultEmail || user?.email || "",
    company_name: "", contact_name: "", contact_role: "",
    website: "", linkedin_url: "",
    capability_summary: "",
    founded_year: "", headquarters_country: "",
  });
  const [categories, setCategories] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState(null);
  const [error, setError] = useState(null);

  // Reset form when modal opens
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
  function toggleIn(list, setList, val) {
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    // Validation
    const required = ["email", "company_name", "contact_name", "contact_role", "capability_summary"];
    for (const f of required) {
      if (!String(form[f] || "").trim()) {
        setError(`Please fill in ${f.replace(/_/g, " ")}.`);
        return;
      }
    }
    if (form.capability_summary.trim().length < 40) {
      setError("Capability summary needs a bit more detail (at least 40 characters).");
      return;
    }
    if (categories.length === 0) {
      setError("Pick at least one capability category.");
      return;
    }
    // Normalise website + linkedin
    let website = form.website.trim();
    if (website && !/^https?:\/\//i.test(website)) {
      website = "https://" + website.replace(/^\/+/, "");
    }
    let linkedin = form.linkedin_url.trim();
    if (linkedin && !/^https?:\/\//i.test(linkedin)) {
      linkedin = "https://" + linkedin.replace(/^\/+/, "");
    }
    const foundedYear = form.founded_year ? parseInt(form.founded_year, 10) : null;
    if (foundedYear && (foundedYear < 1900 || foundedYear > new Date().getFullYear())) {
      setError("Founded year looks off — check it.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("submit_vendor_application", {
        p_email: form.email,
        p_company_name: form.company_name,
        p_contact_name: form.contact_name,
        p_contact_role: form.contact_role,
        p_capability_summary: form.capability_summary,
        p_website: website || null,
        p_linkedin_url: linkedin || null,
        p_categories: categories,
        p_target_sectors: sectors.length > 0 ? sectors : null,
        p_founded_year: foundedYear,
        p_headquarters_country: form.headquarters_country.trim() || null,
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
          width: "min(620px, 100%)",
          background: BRAND.obsidianCard,
          border: `1px solid ${BRAND.vendorGreen}55`,
          borderRadius: 8,
          padding: "32px 32px 24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, color: BRAND.vendorGreen,
            letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
          }}>
            ◈ Vendor Channel · Listing Application
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
              Listing request received.
            </h2>
            <div style={{
              display: "inline-block",
              padding: "4px 10px", marginTop: 14,
              background: "rgba(52,199,89,0.10)", border: `1px solid ${BRAND.green}66`,
              borderRadius: 3,
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: BRAND.green, letterSpacing: "0.10em",
            }}>
              REF #V{String(submittedId).padStart(5, "0")}  ·  STATUS: PENDING
            </div>
            <p style={{ marginTop: 16, fontSize: 14, color: BRAND.textSecondary, lineHeight: 1.6 }}>
              We review every vendor listing personally — typically within{" "}
              <b style={{ color: BRAND.white }}>5 business days</b>. We'll come back with the
              tier we think fits ({" "}
              <b style={{ color: BRAND.vendorGreen }}>basic</b>,{" "}
              <b style={{ color: BRAND.vendorGreen }}>featured</b>, or{" "}
              <b style={{ color: BRAND.vendorGreen }}>premium</b>
              ), pricing, and the slot you'd fill on the map.
            </p>
            <div style={{
              marginTop: 18, padding: "12px 14px",
              background: "rgba(52,199,89,0.06)", borderRadius: 4,
              borderLeft: `2px solid ${BRAND.vendorGreen}`,
              fontSize: 12.5, color: BRAND.white, lineHeight: 1.55,
            }}>
              <b>Important:</b> we sell visibility, not scores. Your Defence Rating stays editorial —
              that's the whole point. If we list you, it's because the capability is real.
            </div>
            <button type="button" onClick={onClose} style={{
              marginTop: 22, width: "100%", padding: "12px 16px",
              background: BRAND.vendorGreen, color: BRAND.obsidian,
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
              Get named where you can defend.
            </h2>
            <p style={{ marginTop: 12, fontSize: 13.5, color: BRAND.textSecondary, lineHeight: 1.55 }}>
              We charge for visibility — not for scores. If you can defend against the controls an
              incident exposes, we want you named in that incident's vendor section. Editorial
              Defence Ratings stay independent.
            </p>

            {/* THREE-TIER PRICING — vendors need to know what they're signing up for. */}
            {/* Actual tier + price gets locked when we approve and pick the best fit. */}
            <div style={{
              marginTop: 18,
              padding: "16px 18px",
              background: `linear-gradient(180deg, rgba(52,199,89,0.08), rgba(52,199,89,0.02) 90%)`,
              border: `1px solid ${BRAND.vendorGreen}55`,
              borderRadius: 6,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -10, left: 14,
                padding: "2px 10px",
                background: BRAND.obsidianCard,
                fontFamily: "Inter, sans-serif", fontSize: 9.5,
                color: BRAND.vendorGreen, letterSpacing: "0.16em",
                textTransform: "uppercase", fontWeight: 600,
              }}>
                ◈ Listing Tiers
              </div>

              <div className="r-grid" style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10, marginTop: 4,
              }}>
                {[
                  { name: "Basic", price: "₹4,999", desc: "Directory profile + named in matching incidents" },
                  { name: "Featured", price: "₹9,999", desc: "Above + featured slot + sector-page placement" },
                  { name: "Premium", price: "₹19,999", desc: "Above + capability article + priority placement" },
                ].map((t) => (
                  <div key={t.name} style={{
                    padding: 10,
                    background: "rgba(8,8,8,0.4)",
                    border: `1px solid rgba(52,199,89,0.25)`,
                    borderRadius: 4,
                  }}>
                    <div style={{
                      fontFamily: "Inter, sans-serif", fontSize: 9.5,
                      color: BRAND.vendorGreen, letterSpacing: "0.12em",
                      textTransform: "uppercase", fontWeight: 600,
                    }}>{t.name}</div>
                    <div style={{
                      fontFamily: "'Inter', sans-serif", fontWeight: 700,
                      fontSize: 20, color: BRAND.white, marginTop: 4, lineHeight: 1,
                    }}>{t.price}<span style={{ fontSize: 10, color: BRAND.textMuted, fontWeight: 400, fontFamily: "Inter, sans-serif", marginLeft: 3 }}>/mo</span></div>
                    <div style={{
                      marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.65)",
                      lineHeight: 1.4,
                    }}>{t.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 12, fontSize: 11.5, color: "rgba(255,255,255,0.7)",
                lineHeight: 1.5,
              }}>
                We assign your tier after review — based on capability fit, not budget. Half the
                directory ends up on Basic. You don't pay until you accept the offer.
              </div>
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
              <Field label="Work email" required>
                <input type="email" required value={form.email} disabled={!!user?.email}
                  onChange={(e) => update("email", e.target.value)}
                  style={{ ...inputStyle, opacity: user?.email ? 0.7 : 1 }} />
              </Field>

              <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
                <Field label="Company name" required>
                  <input required value={form.company_name}
                    onChange={(e) => update("company_name", e.target.value)}
                    style={inputStyle} />
                </Field>
                <Field label="Website">
                  <input placeholder="company.com" value={form.website}
                    onChange={(e) => update("website", e.target.value)}
                    style={inputStyle} />
                </Field>
              </div>

              <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Your name" required>
                  <input required value={form.contact_name}
                    onChange={(e) => update("contact_name", e.target.value)}
                    style={inputStyle} />
                </Field>
                <Field label="Your role" required>
                  <input required placeholder="e.g. Head of Marketing, CEO"
                    value={form.contact_role}
                    onChange={(e) => update("contact_role", e.target.value)}
                    style={inputStyle} />
                </Field>
              </div>

              <Field label="LinkedIn URL" hint="Optional — company or your personal LinkedIn.">
                <input type="text" placeholder="linkedin.com/company/your-co"
                  value={form.linkedin_url}
                  onChange={(e) => update("linkedin_url", e.target.value)}
                  style={inputStyle} />
              </Field>

              <Field label="Capability categories" required
                hint="Pick all that apply. We'll only show your listing in matching incident sections.">
                <ChipGroup options={CATEGORIES} selected={categories}
                  onToggle={(v) => toggleIn(categories, setCategories, v)} />
              </Field>

              <Field label="Target sectors"
                hint="Leave blank if you serve all sectors equally.">
                <ChipGroup options={SECTORS} selected={sectors}
                  onToggle={(v) => toggleIn(sectors, setSectors, v)} />
              </Field>

              <Field label="Capability summary" required
                hint="One paragraph — what do you actually defend against? Be specific. Generic marketing copy gets the application declined.">
                <textarea required rows={4} value={form.capability_summary}
                  onChange={(e) => update("capability_summary", e.target.value)}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 90, fontFamily: "Inter, sans-serif" }} />
              </Field>

              <div className="r-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
                <Field label="Founded year">
                  <input type="number" placeholder="e.g. 2018" value={form.founded_year}
                    onChange={(e) => update("founded_year", e.target.value)}
                    style={inputStyle} />
                </Field>
                <Field label="Headquarters country">
                  <input placeholder="e.g. India, USA, UK" value={form.headquarters_country}
                    onChange={(e) => update("headquarters_country", e.target.value)}
                    style={inputStyle} />
                </Field>
              </div>

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
                background: submitting ? "rgba(52,199,89,0.4)" : BRAND.vendorGreen,
                color: BRAND.obsidian, border: "none", borderRadius: 4,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: submitting ? "wait" : "pointer",
              }}>
                {submitting ? "Submitting…" : "Submit listing application →"}
              </button>

              {/* Acceptance reminder — vendors need to understand: paid */}
              {/* product, but not pay-to-play. We control tone.          */}
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "rgba(52,199,89,0.05)",
                border: `1px solid rgba(52,199,89,0.3)`,
                borderRadius: 3,
                fontSize: 10.5, color: "rgba(255,255,255,0.72)",
                lineHeight: 1.55, textAlign: "center",
                fontFamily: "Inter, sans-serif", letterSpacing: "0.03em",
              }}>
                Editorial Defence Rating stays independent.
                {" "}We sell <b style={{ color: BRAND.vendorGreen }}>visibility</b>, not scores.
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
