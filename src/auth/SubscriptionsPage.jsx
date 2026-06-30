// ─────────────────────────────────────────────────────────────────────────
// SubscriptionsPage — "Manage subscription" (?subscriptions).
//
// Renders the design file shipped at
//   public/subscriptions-v3.html   (source: attacked-subscriptions-v3.html)
// inside the app's real chrome: the dark SiteNav on top and SiteFooter at the
// bottom. The HTML file's OWN nav + footer were stripped out (see the
// "removed" comments in that file) so there is exactly one nav and one footer.
//
// The file is served same-origin, so we measure its content height on load /
// resize and grow the iframe to match — that gives a single natural page
// scroll with the app footer sitting at the true bottom (no inner scrollbar).
//
// Anonymous visitors bounce to the landing page, matching the rest of the
// signed-in account surface.
//
// NOTE: the previous React composer (with live update_subscription_prefs
// wiring) is preserved at SubscriptionsPage.react-backup.jsx.bak.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

// Bump ?v= whenever public/subscriptions-v3.html changes — the file is large
// and gets cached hard by the browser/CDN, so without this the iframe keeps
// loading a stale copy after a redeploy.
const PAGE_SRC = "/subscriptions-v3.html?v=7";

export function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(900);

  // Bounce anonymous visitors to the landing page once auth resolves.
  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [loading, user]);

  // Size the iframe to the page's real content height. The ONLY signal is the
  // height the page posts via postMessage ({ __subsHeight }) — it measures its
  // own content from inside (invariant to iframe height). We deliberately do
  // NOT read the iframe's document from here: a parent-side read returns the
  // iframe's own box height, which both clips the page and fights the message.
  useEffect(() => {
    const onMessage = (e) => {
      const h = e && e.data && e.data.__subsHeight;
      if (h && Number.isFinite(Number(h)) && Number(h) > 200) {
        const next = Math.ceil(Number(h));
        // 3px threshold so sub-pixel reflow churn doesn't thrash React state.
        setHeight((prev) => (Math.abs(next - prev) > 3 ? next : prev));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (loading || !user) {
    return (
      <div style={{
        minHeight: "100vh", background: "#FFFFFF", color: "#707070",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.12em",
        textTransform: "uppercase", fontWeight: 600,
      }}>
        ◇ Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF" }}>
      <div style={{ background: "#080808" }}>
        <SiteNav active="subscriptions" />
      </div>

      {/* No inner scrollbar — the iframe grows to its exact content height
          (measured at ~6084px) so the whole page is one clean scroll: app nav,
          composer, app footer. */}
      <iframe
        ref={iframeRef}
        src={PAGE_SRC}
        title="Manage subscription — Compose your intelligence"
        scrolling="no"
        style={{
          display: "block",
          border: "none",
          width: "100%",
          height: `${height}px`,
          flex: "0 0 auto",
        }}
      />

      <SiteFooter />
    </div>
  );
}

export default SubscriptionsPage;
