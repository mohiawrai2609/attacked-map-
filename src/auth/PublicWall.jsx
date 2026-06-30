// ─────────────────────────────────────────────────────────────────────────
// PublicWall — full-screen landing for anonymous visitors.
//
// Hard gate: until they sign up (Gate 1), they don't see the map at all.
// Once signed in (free), they see the map with the 4 surfaces still gated.
// To reach the unlocked product they must request Design Partner access.
//
// Bypass: ?preview=public|free|partner|admin in the URL renders the map
// directly (for QA / demo). Handled in AuthProvider's getPreviewTier().
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { AuthModal } from "./AuthModal";
import { PartnerApplicationModal } from "./PartnerApplicationModal";
import { Logo } from "./Logo";
import { SiteFooter } from "./SiteFooter";

const BRAND = {
  gold:       "#F5B800",
  obsidian:   "#1A1A1A",
  deep:       "#080808",
  card:       "#242424",
  white:      "#FFFFFF",
  t2:         "#A8A8A8",
  tmuted:     "#585858",
  border:     "#333",
  borderGold: "rgba(245,184,0,0.3)",
};

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

export function PublicWall() {
  const [authOpen, setAuthOpen] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at center top, rgba(245,184,0,0.06), transparent 70%), ${BRAND.deep}`,
      color: BRAND.white,
      fontFamily: "Inter, sans-serif",
      display: "flex", flexDirection: "column",
      WebkitFontSmoothing: "antialiased",
    }}>
      <FontLoader />

      {/* HEADER */}
      <header className="r-pad" style={{
        padding: "20px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${BRAND.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Logo size="sm" />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/?pricing" style={{
            padding: "8px 14px",
            color: BRAND.t2, textDecoration: "none",
            fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 600,
          }}>
            Pricing
          </a>
          <button
            onClick={() => setAuthOpen(true)}
            style={{
              padding: "8px 18px",
              background: "transparent", color: BRAND.gold,
              border: `1px solid ${BRAND.borderGold}`, borderRadius: 4,
              fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em",
              cursor: "pointer", textTransform: "uppercase", fontWeight: 600,
            }}
          >
            Sign in
          </button>
        </div>
      </header>

      {/* HERO */}
      <main className="r-pad" style={{
        flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "64px 32px",
        textAlign: "center",
      }}>
        {/* eyebrow */}
        <div style={{
          fontFamily: "Inter, sans-serif", fontSize: 11,
          color: BRAND.gold, letterSpacing: "0.20em", textTransform: "uppercase",
          marginBottom: 18, fontWeight: 500,
        }}>
          ◇ Live · GUARD daily sweep · Sign in required
        </div>

        {/* heading */}
        <h1 style={{
          fontFamily: "'Inter', sans-serif", fontWeight: 700,
          fontSize: "clamp(40px, 6vw, 72px)",
          color: BRAND.white, lineHeight: 1.05, letterSpacing: "-0.015em",
          margin: 0, maxWidth: 900,
        }}>
          A live map of <span style={{ color: BRAND.gold, fontStyle: "italic" }}>corporate harm</span>.
        </h1>

        {/* sub */}
        <p style={{
          fontSize: 17, color: BRAND.t2, marginTop: 24, maxWidth: 640,
          lineHeight: 1.55,
        }}>
          Every disclosed cyber, supply-chain, financial, geopolitical, and physical
          incident — geolocated, classified against the GUARD framework, with the
          blast radius traced. Updated daily.
        </p>

        {/* primary CTA */}
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setAuthOpen(true)}
            style={{
              padding: "16px 32px",
              background: BRAND.gold, color: BRAND.obsidian,
              border: "none", borderRadius: 4,
              fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
              boxShadow: "0 8px 24px rgba(245,184,0,0.18)",
              transition: "transform 180ms ease, box-shadow 180ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(245,184,0,0.28)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(245,184,0,0.18)"; }}
          >
            Sign up to enter →
          </button>
          <div style={{ fontSize: 12, color: BRAND.tmuted }}>
            Free · email-only · no password
          </div>
        </div>

        {/* tiers preview — both cards are now clickable entry points */}
        <div className="r-grid" style={{
          marginTop: 64, width: "100%", maxWidth: 880,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
        }}>
          {/* FREE · GATE 1 — opens magic-link signup */}
          <button onClick={() => setAuthOpen(true)} style={{
            padding: "20px 22px", background: BRAND.card,
            border: `1px solid ${BRAND.border}`, borderRadius: 6,
            textAlign: "left", color: "inherit", cursor: "pointer",
            display: "flex", flexDirection: "column",
            transition: "border-color 180ms ease, transform 180ms ease",
            fontFamily: "Inter, sans-serif",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4FC3D7"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BRAND.border; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: "#4FC3D7", letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 6, fontWeight: 600,
            }}>📧 Free · Gate 1</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.white, marginBottom: 8 }}>
              Intelligence Inbox
            </div>
            <div style={{ fontSize: 13, color: BRAND.t2, lineHeight: 1.5, flex: 1 }}>
              Daily summary alert of every incident. See the breadth of what we catch.
              Map access included. Locked: source, named blast radius, controls, vendor analysis.
            </div>
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BRAND.border}`,
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: "#4FC3D7", letterSpacing: "0.10em", textTransform: "uppercase",
              fontWeight: 600,
            }}>
              Sign up free →
            </div>
          </button>

          {/* PARTNER · GATE 2 — opens application form */}
          <button onClick={() => setPartnerOpen(true)} style={{
            padding: "20px 22px",
            background: `linear-gradient(180deg, rgba(245,184,0,0.06), transparent 60%), ${BRAND.card}`,
            border: `1px solid ${BRAND.borderGold}`, borderRadius: 6,
            textAlign: "left", color: "inherit", cursor: "pointer",
            display: "flex", flexDirection: "column",
            transition: "border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
            fontFamily: "Inter, sans-serif",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = BRAND.gold; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(245,184,0,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = BRAND.borderGold; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: BRAND.gold, letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: 6, fontWeight: 600,
            }}>🤝 Partner · Gate 2</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: BRAND.white, marginBottom: 8 }}>
              Full operational depth
            </div>
            <div style={{ fontSize: 13, color: BRAND.t2, lineHeight: 1.5, flex: 1 }}>
              Source URLs, named blast radius with recommended actions, full adaptive
              controls, vendor Defence Ratings. ~30 min/month design-partner commitment.
            </div>
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BRAND.border}`,
              fontFamily: "Inter, sans-serif", fontSize: 10,
              color: BRAND.gold, letterSpacing: "0.10em", textTransform: "uppercase",
              fontWeight: 600,
            }}>
              Apply for access →
            </div>
          </button>
        </div>
      </main>

      {/* FOOTER — shared SiteFooter for consistency across all pages */}
      <SiteFooter />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <PartnerApplicationModal open={partnerOpen} onClose={() => setPartnerOpen(false)} />
    </div>
  );
}
