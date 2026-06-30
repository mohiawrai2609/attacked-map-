// ─────────────────────────────────────────────────────────────────────────
// PricingPage — public marketing surface showing all revenue lines.
// Accessible via /?pricing or from the account menu.
//
// Per access_model_v2.html §2 (Life of an incident) — one sweep monetises
// FOUR ways: enterprise subscription, design partner program, vendor
// promotion, media licence. Plus reports as standalone premium artefacts.
//
// All prices here are PLACEHOLDERS — edit PLANS below as the team decides
// final pricing. CTA wiring is real; checkout / payment will land in a
// later phase once pricing is locked.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { AuthModal } from "./AuthModal";
import { PartnerApplicationModal } from "./PartnerApplicationModal";
import { VendorApplicationModal } from "./VendorApplicationModal";
import { supabase } from "../lib/supabaseClient";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

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
  green: "#34C759",
  cyan: "#4FC3D7",
  violet: "#9D7BEC",
  orange: "#FF8C5A",
};

// ─────────────────────────────────────────────────────────────────────────
// PLANS — edit prices/features here when finalising. Frontend reads from
// this single source of truth.
// ─────────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free",
    eyebrow: "📧 Gate 1",
    name: "Intelligence Inbox",
    pitch: "The daily habit.",
    price: { amount: 0, currency: "₹", period: "free forever" },
    accent: BRAND.cyan,
    features: [
      "Daily summary email of every disclosed incident",
      "Map access with category & severity filters",
      "Geolocated incidents, classified against GUARD",
      "Public blast-radius shape — count, channels",
    ],
    locked: [
      "Source URLs · article-grade write-ups",
      "Named blast radius + recommended actions",
      "Adaptive control mappings",
      "Vendor Defence Ratings",
    ],
    cta: { label: "Sign up — free", kind: "signup" },
  },
  {
    id: "partner",
    eyebrow: "🤝 Gate 2 · Founding cohort · Limited seats",
    name: "Design Partner",
    pitch: "Preview of the priced product — at founding-cohort terms.",
    price: {
      amount: 0,
      currency: "₹",
      period: "during founding cohort",
      note: "Then locked at ₹4,999/month — grandfathered forever when cohort closes (target Q4 2026)",
    },
    accent: BRAND.gold,
    highlight: true,
    features: [
      "Everything in the Inbox",
      "Source URLs + full article-grade write-ups",
      "Named blast radius + recommended actions per entity",
      "Adaptive controls — Objectives → Master → Recommended",
      "Vendor Defence Ratings + capability claims",
      "First look at every new module before public release",
      "Grandfathered ₹4,999/month forever when cohort closes (vs ₹14,999 Enterprise)",
    ],
    locked: [],
    commitment: "~30 minutes of feedback when we ask · reference logo when you're ready",
    cta: { label: "Apply for design partner", kind: "partner" },
  },
  {
    id: "enterprise",
    eyebrow: "✦ Priced tier",
    name: "Enterprise",
    pitch: "Operational intelligence for your security org.",
    price: { amount: 14999, currency: "₹", period: "per month", note: "Per organisation · 3 user seats included · multi-seat available" },
    accent: BRAND.violet,
    features: [
      "Everything in Design Partner",
      "3 user seats (additional seats on request)",
      "Sector-filtered daily intelligence stream",
      "Dedicated analyst desk for clarifications",
      "Risk register integration (custom controls)",
      "Priority sweeps on entities you watchlist",
      "Quarterly sector briefings",
    ],
    locked: [],
    commitment: "Multi-seat available · SSO on request",
    cta: { label: "Subscribe", kind: "checkout", planId: "enterprise" },
  },
  {
    id: "reports",
    eyebrow: "§ Premium artefact",
    name: "Sector Reports",
    pitch: "The standalone deep dive.",
    price: { amount: 9999, currency: "₹", period: "per report", note: "Quarterly · annual sub available" },
    accent: BRAND.orange,
    features: [
      "Sector-specific quarterly deep dive",
      "Full findings · control mappings · vendor breakdowns",
      "Boilerplate detection + absence signals",
      "Citable PDF + interactive companion",
    ],
    locked: [],
    cta: { label: "Browse upcoming reports", kind: "contact", subject: "Sector reports — interest" },
  },
  {
    id: "vendor",
    eyebrow: "◈ Vendor channel",
    name: "Vendor Promotion",
    pitch: "Get named where you can defend.",
    price: { amount: 4999, currency: "₹", period: "per month", note: "Featured listing · multi-tier available" },
    accent: BRAND.green,
    features: [
      "Profile page (open access — drives leads)",
      "Featured in incident vendor sections",
      "Capability tags + control coverage",
      "Verified badge after submission review",
    ],
    locked: [
      "Defence Rating + analysis stays editorial",
      "We don't sell scores — we sell visibility",
    ],
    cta: { label: "List your company", kind: "vendor", subject: "Vendor listing — application" },
  },
  {
    id: "media",
    eyebrow: "✦ Media · Carve-out",
    name: "Media Licence",
    pitch: "Causal narrative for publication.",
    price: { amount: null, currency: "", period: "Custom · per slice", note: "Names by agreement" },
    accent: BRAND.cyan,
    features: [
      "On-demand causal analysis of a specific incident",
      "Transmission mechanism + chain breakdown",
      "Publishable findings — defined slice",
      "Named entities by mutual agreement",
    ],
    locked: [],
    cta: { label: "Discuss a licence", kind: "contact", subject: "Media licence enquiry" },
  },
];

const CONTACT_EMAIL = "hello@attacked.ai"; // placeholder — change to real address

function FontLoader() {
  useEffect(() => {
    if (document.getElementById("attacked-fonts")) return;
    const link = document.createElement("link");
    link.id = "attacked-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
}

function formatPrice(p) {
  if (p.amount === null) return p.period;
  if (p.amount === 0) return p.period;
  return `${p.currency}${p.amount.toLocaleString("en-IN")} ${p.period}`;
}

export function PricingPage() {
  const { user, tier } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);

  async function startCheckout(planId) {
    setCheckoutError(null);
    if (!user) { setAuthOpen(true); return; }
    setCheckoutBusy(planId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan_id: planId, mode: "subscription" },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data?.error || "Could not start checkout.");
    } catch (e) {
      setCheckoutError(e?.message || "Checkout failed. Stripe may not be configured yet.");
    } finally {
      setCheckoutBusy(null);
    }
  }

  function ctaFor(plan) {
    const { kind, label, subject, planId } = plan.cta;

    if (kind === "signup") {
      if (user) return { label: "✓ You're on the inbox", action: null, disabled: true, tone: "current" };
      return { label, action: () => setAuthOpen(true), disabled: false, tone: "primary" };
    }

    if (kind === "partner") {
      if (tier === "partner" || tier === "admin") return { label: "✓ Active partner", action: null, disabled: true, tone: "current" };
      // Anonymous submission is supported (submit_partner_application RPC
      // accepts null user_id; the trigger binds the account to the
      // application on later signin by email match). Open the modal
      // directly — same UX as the PublicWall partner card.
      return { label, action: () => setPartnerOpen(true), disabled: false, tone: "primary" };
    }

    if (kind === "checkout") {
      if (tier === "enterprise") return { label: "✓ Active enterprise", action: null, disabled: true, tone: "current" };
      const busy = checkoutBusy === planId;
      return { label: busy ? "Loading…" : label, action: () => startCheckout(planId), disabled: busy, tone: "primary" };
    }

    if (kind === "vendor") {
      // If they're already approved on the vendor tier, show ✓ state.
      // Otherwise open the listing modal (anyone can submit; user_id is
      // captured automatically when signed in).
      if (tier === "vendor") return { label: "✓ Active vendor listing", action: null, disabled: true, tone: "current" };
      return { label, action: () => setVendorOpen(true), disabled: false, tone: "primary" };
    }

    if (kind === "contact") {
      const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject || label)}`;
      return { label, action: () => { window.location.href = mailto; }, disabled: false, tone: "secondary" };
    }
    return { label, action: null, disabled: true, tone: "secondary" };
  }

  // Clean eyebrow text — strip decorative emoji/symbols for an editorial,
  // non-templated feel.
  const cleanEyebrow = (s) => s.replace(/[📧🤝✦§◈◇]/g, "").replace(/^[\s·]+/, "").trim();

  const PRIMARY = ["free", "partner", "enterprise"];
  const primaryPlans = PLANS.filter((p) => PRIMARY.includes(p.id));
  const secondaryPlans = PLANS.filter((p) => !PRIMARY.includes(p.id));

  const priceNode = (plan, big) => {
    const sz = big ? 34 : 22;
    if (plan.price.amount === null) {
      return <span style={{ fontSize: big ? 26 : 20, color: "#101010", fontWeight: 700 }}>{plan.price.period}</span>;
    }
    if (plan.price.amount === 0) {
      return (
        <span style={{ fontSize: sz, color: "#101010", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Free<span style={{ fontSize: 13, color: "#52525B", fontWeight: 500, marginLeft: 7 }}>{plan.price.period}</span>
        </span>
      );
    }
    return (
      <span style={{ fontSize: sz, color: "#101010", fontWeight: 800, letterSpacing: "-0.02em" }}>
        {plan.price.currency}{plan.price.amount.toLocaleString("en-IN")}
        <span style={{ fontSize: 13, color: "#52525B", fontWeight: 500, marginLeft: 5 }}>/ {plan.price.period.replace(/^per\s+/, "")}</span>
      </span>
    );
  };

  const featureRow = (f, i) => (
    <li key={i} style={{
      fontSize: 13, color: "#3F3F46", lineHeight: 1.5,
      padding: "7px 0 7px 26px", position: "relative",
      borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
    }}>
      <span style={{
        position: "absolute", left: 0, top: 7, color: "#8A6D00",
        fontSize: 13, fontWeight: 800, lineHeight: 1.2,
      }}>✓</span>
      {f}
    </li>
  );

  const ctaButton = (plan, cta, { filled }) => (
    <button
      onClick={cta.action || (() => {})}
      disabled={cta.disabled}
      style={{
        marginTop: 18, width: "100%", padding: "13px 18px",
        background: cta.tone === "current" ? "rgba(30,122,61,0.10)"
          : filled ? BRAND.gold : "#101010",
        color: cta.tone === "current" ? "#1E7A3D"
          : filled ? BRAND.obsidian : "#FFFFFF",
        border: cta.tone === "current" ? `1px solid #1E7A3D55`
          : filled ? "none" : `1px solid #101010`,
        borderRadius: 6,
        fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 700,
        letterSpacing: "0.04em",
        cursor: cta.disabled ? "default" : "pointer",
        opacity: cta.disabled ? 0.85 : 1,
        transition: "background 160ms ease, border-color 160ms ease",
      }}>
      {cta.label}
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FFFFFF",
      color: "#101010",
      fontFamily: "Inter, sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>
      <FontLoader />

      <SiteNav active="pricing" />

      {/* HERO — dark band (chrome); the body below is light */}
      <section style={{
        background: BRAND.obsidianDeep, color: BRAND.white,
        borderBottom: `1px solid ${BRAND.borderSubtle}`,
      }}>
        <div className="r-pad" style={{ maxWidth: 1080, margin: "0 auto", padding: "68px 32px 60px" }}>
          <div style={{ maxWidth: 680 }}>
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 11.5,
              color: BRAND.gold, letterSpacing: "0.14em", textTransform: "uppercase",
              marginBottom: 16, fontWeight: 700,
            }}>
              ◇ Pricing
            </div>
            <h1 style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 800,
              fontSize: "clamp(34px, 5vw, 52px)",
              color: BRAND.white, lineHeight: 1.08, letterSpacing: "-0.025em",
              margin: 0,
            }}>
              Start free. Go deep when it matters.
            </h1>
            <p style={{
              fontSize: 16.5, color: BRAND.textSecondary, marginTop: 20, lineHeight: 1.6, maxWidth: 600,
            }}>
              The public map and daily inbox are free, forever. Join the founding design-partner
              cohort for the fully unlocked product at grandfathered terms — or move to Enterprise
              when your team is ready.
            </p>
          </div>
        </div>
      </section>

      <main className="r-pad" style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 32px 40px" }}>
        {/* PRIMARY TIERS */}
        <div style={{
          marginTop: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 18,
          alignItems: "stretch",
        }}>
          {primaryPlans.map((plan) => {
            const cta = ctaFor(plan);
            const hi = !!plan.highlight;
            return (
              <div key={plan.id} style={{
                background: hi ? "#FFFDF5" : "#FFFFFF",
                border: `1px solid ${hi ? BRAND.gold : "#E7E7E9"}`,
                borderRadius: 12,
                padding: hi ? "30px 26px" : "26px 24px",
                display: "flex", flexDirection: "column",
                position: "relative",
                boxShadow: hi ? "0 16px 48px rgba(245,184,0,0.16)" : "0 10px 30px rgba(16,16,16,0.06)",
              }}>
                {hi && (
                  <div style={{
                    position: "absolute", top: -11, right: 20,
                    padding: "4px 12px", background: BRAND.gold, color: BRAND.obsidian,
                    fontFamily: "Inter, sans-serif", fontSize: 9.5,
                    letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800,
                    borderRadius: 999,
                  }}>Most popular</div>
                )}

                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 10.5,
                  color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase",
                  fontWeight: 700, marginBottom: 10,
                }}>{cleanEyebrow(plan.eyebrow)}</div>

                <h2 style={{
                  fontFamily: "'Inter', sans-serif", fontWeight: 800,
                  fontSize: 23, color: "#101010", lineHeight: 1.15, margin: "0 0 6px",
                  letterSpacing: "-0.02em",
                }}>{plan.name}</h2>

                <p style={{ fontSize: 13, color: "#52525B", margin: "0 0 20px", lineHeight: 1.45 }}>
                  {plan.pitch}
                </p>

                <div style={{ paddingBottom: 18, marginBottom: 4, borderBottom: `1px solid #E7E7E9` }}>
                  <div style={{ lineHeight: 1.1 }}>{priceNode(plan, true)}</div>
                  {plan.price.note && (
                    <div style={{ fontSize: 11.5, color: BRAND.textMuted, marginTop: 8, lineHeight: 1.45 }}>
                      {plan.price.note}
                    </div>
                  )}
                </div>

                <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, flex: 1 }}>
                  {plan.features.map(featureRow)}
                  {plan.locked.length > 0 && (
                    <li style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid #E7E7E9` }}>
                      <div style={{ fontSize: 9.5, color: "#9A9A98", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                        Not included
                      </div>
                      {plan.locked.map((f, i) => (
                        <div key={`l${i}`} style={{
                          fontSize: 12, color: "#9A9A98", lineHeight: 1.5,
                          padding: "3px 0 3px 18px", position: "relative",
                        }}>
                          <span style={{ position: "absolute", left: 0, top: 0, color: "#C4C4C0" }}>—</span>
                          {f}
                        </div>
                      ))}
                    </li>
                  )}
                </ul>

                {plan.commitment && (
                  <div style={{
                    marginTop: 16, padding: "10px 12px",
                    background: "#FFF7DE", border: "1px solid rgba(245,184,0,0.55)",
                    borderRadius: 6, fontSize: 11.5, color: "#3F3F46", lineHeight: 1.5,
                  }}>
                    <b style={{ color: "#8A6D00" }}>In return:</b> {plan.commitment}
                  </div>
                )}

                {ctaButton(plan, cta, { filled: hi })}
              </div>
            );
          })}
        </div>

        {/* SECONDARY — other ways to work with us */}
        <div style={{ marginTop: 64 }}>
          <h3 style={{
            fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 800,
            color: "#101010", letterSpacing: "-0.015em", margin: "0 0 4px",
          }}>
            Other ways to work with us
          </h3>
          <p style={{ fontSize: 13.5, color: "#52525B", margin: "0 0 24px" }}>
            Standalone artefacts and channels — buy a report, get listed, or licence a story.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {secondaryPlans.map((plan) => {
              const cta = ctaFor(plan);
              return (
                <div key={plan.id} style={{
                  background: "#FAFAFA",
                  border: `1px solid #E7E7E9`,
                  borderRadius: 10,
                  padding: "22px 22px",
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    fontFamily: "Inter, sans-serif", fontSize: 10,
                    color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase",
                    fontWeight: 700, marginBottom: 8,
                  }}>{cleanEyebrow(plan.eyebrow)}</div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                    <h2 style={{
                      fontFamily: "'Inter', sans-serif", fontWeight: 800,
                      fontSize: 18, color: "#101010", lineHeight: 1.2, margin: 0, letterSpacing: "-0.015em",
                    }}>{plan.name}</h2>
                    <div style={{ whiteSpace: "nowrap" }}>{priceNode(plan, false)}</div>
                  </div>

                  <p style={{ fontSize: 12.5, color: "#52525B", margin: "8px 0 14px", lineHeight: 1.5 }}>
                    {plan.pitch}
                  </p>

                  <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1 }}>
                    {plan.features.slice(0, 4).map(featureRow)}
                  </ul>

                  {ctaButton(plan, cta, { filled: false })}
                </div>
              );
            })}
          </div>
        </div>

        {/* PRINCIPLES */}
        <div style={{
          marginTop: 64, paddingTop: 40, borderTop: `1px solid #E7E7E9`,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32, fontSize: 13.5, color: "#52525B", lineHeight: 1.65 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#101010", marginBottom: 6 }}>Charge for depth, never the shape</div>
              The public map stays free. We charge for the answer — names, controls, vendor analysis, source articles.
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#101010", marginBottom: 6 }}>Partners are grandfathered</div>
              Sign up during the founding cohort and your access stays at preview-tier terms. We don't backstab partners.
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#101010", marginBottom: 6 }}>Four revenue lines, not one bundle</div>
              Enterprises pay for daily access. Reports are premium artefacts. Vendors pay for visibility. Media licence the causal slice.
            </div>
          </div>
        </div>

        {checkoutError && (
          <div style={{
            marginTop: 28, padding: "12px 16px", maxWidth: 700, margin: "28px auto 0",
            background: "rgba(255,107,107,0.10)", border: "1px solid rgba(255,107,107,0.3)",
            borderRadius: 6, color: "#FF6B6B", fontSize: 13, lineHeight: 1.5,
          }}>
            {checkoutError}
          </div>
        )}

        <div style={{
          marginTop: 40, fontSize: 12.5, color: BRAND.textMuted,
          fontFamily: "Inter, sans-serif", lineHeight: 1.6,
        }}>
          Pricing is finalising during the founding cohort — prices shown are indicative.
          Questions? <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "#8A6D00", fontWeight: 600 }}>{CONTACT_EMAIL}</a>
        </div>
      </main>

      <SiteFooter />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <PartnerApplicationModal open={partnerOpen} onClose={() => setPartnerOpen(false)} />
      <VendorApplicationModal open={vendorOpen} onClose={() => setVendorOpen(false)} />
    </div>
  );
}
