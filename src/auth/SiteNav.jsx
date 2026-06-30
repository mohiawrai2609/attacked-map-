// ─────────────────────────────────────────────────────────────────────────
// SiteNav — the shared site-wide top navigation (Attacked.ai branding).
//
// One component dropped into every public page (landing, hub, pricing, legal,
// subscriptions, unsubscribe) so the navbar is identical everywhere. It is
// fully self-contained:
//   • manages its own sign-in modal (AuthModal)
//   • "Attack Map"  — signed-in → /?map, anonymous → sign-in wall
//   • "Attacked Hub" / "Pricing" — real in-app routes
//   • signed-in → tier badge + "Open the map" + "Sign out"
//   • anonymous → "Sign in" + "Subscribe" (both open the modal)
//
// Pass `active` ("map" | "hub" | "pricing") to highlight the current page.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Logo } from "./Logo";
import { AuthModal } from "./AuthModal";

const BRAND = {
  gold: "#F5B800",
  obsidian: "#1A1A1A",
  deep: "#080808",
  white: "#FFFFFF",
  t2: "#A8A8A8",
  border: "#333333",
  borderGold: "rgba(245,184,0,0.3)",
};

export function SiteNav({ active }) {
  const { user, tier, profile, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // account dropdown (signed-in)
  const [navOpen, setNavOpen] = useState(false);    // mobile hamburger panel

  // "Attack Map": signed-in users open the live map at ?map (the bare "/"
  // keeps them on the landing page); anonymous visitors hit the sign-in wall.
  function enterMap() {
    if (user) window.location.href = "/?map";
    else setAuthOpen(true);
  }

  const linkBase = {
    padding: "8px 14px", textDecoration: "none",
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "Inter, sans-serif",
    fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  };
  const linkColor = (key) => ({
    ...linkBase,
    color: active === key ? BRAND.gold : BRAND.t2,
    cursor: active === key ? "default" : "pointer",
  });

  return (
    <>
      <header role="banner" className="r-pad" style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 36px",
        background: "#000000",
        borderBottom: `1px solid ${BRAND.border}`,
      }}>
        <a href="/" aria-label="Attacked.ai home" style={{ textDecoration: "none", display: "inline-flex" }}>
          <Logo size="sm" />
        </a>
        {/* Hamburger — visible only on phones (CSS-toggled); opens the link panel. */}
        <button
          className="site-nav-burger"
          aria-label="Menu" aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{navOpen ? "✕" : "☰"}</span>
        </button>
        <nav aria-label="Primary" className={`site-nav-links${navOpen ? " open" : ""}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={enterMap} style={linkColor("map")}>Attack Map</button>
          {active === "hub" ? (
            <span style={{ ...linkColor("hub") }}>Attacked Hub</span>
          ) : (
            <a href="/?hub" style={linkColor("hub")}>Attacked Hub</a>
          )}
          {active === "pricing" ? (
            <span style={{ ...linkColor("pricing") }}>Pricing</span>
          ) : (
            <a href="/?pricing" style={linkColor("pricing")}>Pricing</a>
          )}
          {user ? (
            // Signed in — McKinsey-style account dropdown (avatar → menu).
            <div style={{ position: "relative", marginLeft: 8 }}>
              <style>{`
                .acct-menu a, .acct-menu button {
                  display: block; width: 100%; text-align: left; box-sizing: border-box;
                  padding: 11px 16px; text-decoration: none; background: none; border: none;
                  cursor: pointer; font-family: Inter, sans-serif; font-size: 13px;
                  font-weight: 500; color: #101010;
                }
                .acct-menu a:hover, .acct-menu button:hover { background: #FAF7EC; }
              `}</style>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu" aria-expanded={menuOpen}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 9px 4px 4px", borderRadius: 999, cursor: "pointer",
                  background: "rgba(245,184,0,0.08)", border: `1px solid ${BRAND.borderGold}`,
                }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: BRAND.gold,
                  color: BRAND.obsidian, display: "inline-flex", alignItems: "center", overflow: "hidden",
                  justifyContent: "center", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 800,
                }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : (user.email || "?").charAt(0).toUpperCase()}
                </span>
                <span style={{ color: BRAND.t2, fontSize: 8 }}>{menuOpen ? "▲" : "▼"}</span>
              </button>

              {menuOpen && (
                <>
                  {/* click-away backdrop */}
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                  <div className="acct-menu" style={{
                    position: "absolute", top: "calc(100% + 12px)", right: 0, zIndex: 61,
                    width: 248, background: "#FFFFFF", borderRadius: 10,
                    border: "1px solid #E7E7E9", boxShadow: "0 18px 50px rgba(0,0,0,0.40)",
                    overflow: "hidden",
                  }}>
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid #EEEEEE" }}>
                      <div style={{ fontSize: 9.5, color: "#8A6D00", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Inter, sans-serif" }}>Signed in</div>
                      <div style={{ fontSize: 12.5, color: "#101010", fontWeight: 600, marginTop: 4, fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                    </div>
                    <a href="/?profile">Profile</a>
                    <a href="/?subscriptions">Manage subscription</a>
                    <button onClick={() => { setMenuOpen(false); enterMap(); }}>Open the live map</button>
                    <a href="/?hub">The Attacked Hub</a>
                    {tier === "admin" && (
                      <a href="/?admin" style={{ color: "#8A6D00", fontWeight: 700 }}>★ Admin dashboard</a>
                    )}
                    <div style={{ borderTop: "1px solid #EEEEEE" }} />
                    <button onClick={async () => { await signOut(); window.location.href = "/"; }} style={{ color: "#C0341D" }}>Sign out</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => setAuthOpen(true)} style={{
                padding: "8px 16px", background: "transparent", color: BRAND.white,
                border: `1px solid ${BRAND.border}`, borderRadius: 4, cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 6,
              }}>Sign in</button>
              <button onClick={() => setAuthOpen(true)} style={{
                padding: "8px 18px", background: BRAND.gold, color: BRAND.obsidian,
                border: "none", borderRadius: 4, cursor: "pointer",
                fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 4,
              }}>Subscribe</button>
            </>
          )}
        </nav>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
