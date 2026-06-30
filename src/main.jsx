import React from "react";
import ReactDOM from "react-dom/client";
import "./responsive.css";
import GlobalAttackMap from "./GlobalAttackMap.jsx";
import { AuthProvider, useAuth } from "./auth/AuthProvider.jsx";
import { LandingPage } from "./auth/LandingPage.jsx";
import { UnsubscribePage } from "./auth/UnsubscribePage.jsx";
import { PricingPage } from "./auth/PricingPage.jsx";
import { AttackHub } from "./auth/AttackHub.jsx";
import { SubscriptionsPage } from "./auth/SubscriptionsPage.jsx";
import { LegalPage } from "./auth/LegalPage.jsx";
import { ProfilePage } from "./auth/ProfilePage.jsx";
import { AdminDashboard } from "./admin/AdminDashboard.jsx";

// ─────────────────────────────────────────────────────────────────────────
// AppShell — decides what the visitor sees based on auth state.
//   • loading              → small spinner (avoids landing-page flash)
//   • anonymous + no preview override → LandingPage (editorial front page)
//   • signed-in OR preview → the full map (gating happens inside per tier)
//
// The preview override (?preview=public|free|partner|admin) bypasses the
// wall so QA can land directly on the gated/unlocked map without a real
// signup. Useful for demos and screenshots.
// ─────────────────────────────────────────────────────────────────────────
// Tiny shared loading placeholder so the admin tier-check + main loader
// don't drift visually.
function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#080808", color: "#A8A8A8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.12em",
      textTransform: "uppercase", fontWeight: 600,
    }}>
      ◇ Loading…
    </div>
  );
}

function AppShell() {
  const { user, loading, tier } = useAuth();

  // Detect ?unsubscribe=<token> in URL — handle BEFORE auth resolution so
  // anyone clicking from email lands on the unsubscribe page without being
  // blocked by the auth wall.
  const unsubscribeToken = (() => {
    if (typeof window === "undefined") return null;
    try {
      return new URLSearchParams(window.location.search).get("unsubscribe");
    } catch { return null; }
  })();
  if (unsubscribeToken) {
    return <UnsubscribePage token={unsubscribeToken} />;
  }

  // ?home — the editorial landing page, forced regardless of auth. Without
  // this, a signed-in visitor lands on the map at "/" and has no way back to
  // the front page (since "/" only shows LandingPage to anonymous users).
  // The map's logo links here so signed-in users can return home.
  const showHome = (() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).has("home");
    } catch { return false; }
  })();
  if (showHome) {
    return <LandingPage />;
  }

  // ?legal=<key> — footer pages (privacy / terms / cookies / accessibility /
  // scam / faq). Public, no auth.
  const legalKey = (() => {
    if (typeof window === "undefined") return null;
    try { return new URLSearchParams(window.location.search).get("legal"); } catch { return null; }
  })();
  if (legalKey) {
    return <LegalPage pageKey={legalKey} />;
  }

  // ?pricing — public marketing page. Accessible without auth.
  const showPricing = (() => {
    if (typeof window === "undefined") return false;
    try {
      const p = new URLSearchParams(window.location.search);
      return p.has("pricing");
    } catch { return false; }
  })();
  if (showPricing) {
    return <PricingPage />;
  }

  // ?hub — the Attacked Hub editorial feed. Public marketing surface like
  // pricing: readable without auth, depth gated behind sign-up inside.
  const showHub = (() => {
    if (typeof window === "undefined") return false;
    try {
      return new URLSearchParams(window.location.search).has("hub");
    } catch { return false; }
  })();
  if (showHub) {
    return <AttackHub />;
  }

  // ?subscriptions — the "Manage subscription" preference centre. Requires a
  // signed-in user; the page itself bounces anonymous visitors to the landing.
  const showSubscriptions = (() => {
    if (typeof window === "undefined") return false;
    try { return new URLSearchParams(window.location.search).has("subscriptions"); } catch { return false; }
  })();
  if (showSubscriptions) {
    return <SubscriptionsPage />;
  }

  // ?profile — the signed-in user's account profile (from the nav account menu).
  // Replaces the old onboarding wizard. The page itself bounces anonymous users.
  const showProfile = (() => {
    if (typeof window === "undefined") return false;
    try { return new URLSearchParams(window.location.search).has("profile"); } catch { return false; }
  })();
  if (showProfile) {
    return <ProfilePage />;
  }

  // ?admin — admin dashboard. Tier-gated: only tier='admin' may enter.
  // Anyone else who tries hits a polite "not authorised" message instead
  // of seeing the page chrome. This is UI-layer gating only; the actual
  // RPCs check _is_admin() server-side as a second line of defence.
  const showAdmin = (() => {
    if (typeof window === "undefined") return false;
    try {
      const p = new URLSearchParams(window.location.search);
      return p.has("admin");
    } catch { return false; }
  })();
  if (showAdmin) {
    if (loading) return <LoadingScreen />;
    if (!user) return <LandingPage />;
    if (tier !== "admin") {
      return (
        <div style={{
          minHeight: "100vh", background: "#080808", color: "#A8A8A8",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          fontFamily: "Inter, sans-serif", padding: 32, textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 18 }}>🔒</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFF", marginBottom: 8 }}>Admin only</div>
          <div style={{ fontSize: 13, marginBottom: 20, maxWidth: 380 }}>
            This page is restricted to the internal team. Your current tier is <b>{tier || "free"}</b>.
          </div>
          <a href="/" style={{
            padding: "10px 20px", background: "#F5B800", color: "#1A1A1A",
            textDecoration: "none", borderRadius: 4, fontSize: 12,
            fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
          }}>← Back to map</a>
        </div>
      );
    }
    return <AdminDashboard />;
  }

  // Detect ?preview= in URL — same heuristic the AuthProvider uses.
  const hasPreviewOverride = (() => {
    if (typeof window === "undefined") return false;
    try {
      const p = new URLSearchParams(window.location.search).get("preview");
      return p === "public" || p === "free" || p === "partner" || p === "admin";
    } catch { return false; }
  })();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !hasPreviewOverride) {
    return <LandingPage />;
  }

  // The onboarding wizard has been removed entirely. Signed-in users land on the
  // editorial landing page (account state in the nav) and manage their identity
  // via "Profile" (?profile) and "Manage subscription" (?subscriptions).

  // Signed-in users land on the editorial landing page by default — sign-in
  // no longer dumps them straight into the map. The map opens explicitly:
  //   • ?map         → the live map (the landing "Attack Map" button + CTAs)
  //   • ?preview=…   → demo/QA override, lands on the map directly
  const showMap = (() => {
    if (typeof window === "undefined") return false;
    try { return new URLSearchParams(window.location.search).has("map"); } catch { return false; }
  })();
  if (showMap || hasPreviewOverride) {
    return <GlobalAttackMap />;
  }

  return <LandingPage />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
