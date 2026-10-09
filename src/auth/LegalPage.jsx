// ─────────────────────────────────────────────────────────────────────────
// LegalPage — lightweight content pages behind the footer links.
//
// Routed via ?legal=<key> from main.jsx. One component renders Privacy,
// Terms, Cookie preferences, Accessibility, Scam warning and FAQ so the
// footer links all resolve to a real, branded page instead of a dead anchor.
//
// Content is concise and honest (a plain-language statement + a contact
// route), not fabricated legalese. Swap in finalised copy when ready.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import { supabase } from "../lib/supabaseClient";
import { clearSiteStorage, sessionWindow, SESSION_DAYS } from "../lib/cookieStorage";
import { GCP } from "../lib/backend";
import * as gcpAuth from "../lib/gcpAuth";
import { useAuth } from "./AuthProvider";

const fmtWhen = (d) => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// "Your privacy choices": shows the current sign-in window and deletes
// everything this site keeps in the browser (signing out this device first,
// which also revokes its refresh token on the server). On the Google Cloud
// backend the sign-in is an HttpOnly cookie the page cannot read: the API says
// when it began and ends, and signing out there revokes it and deletes it.
function CookieControls() {
  const { signOut } = useAuth();
  const [win, setWin] = useState(() => (GCP ? null : sessionWindow()));
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!GCP) return undefined;
    let live = true;
    gcpAuth.me()
      .then((m) => { if (live && m?.session) setWin({ since: new Date(m.session.created_at), until: new Date(m.session.expires_at) }); })
      .catch(() => { /* signed out or offline: nothing to show */ });
    return () => { live = false; };
  }, []);
  async function clearAll() {
    setBusy(true);
    try { if (GCP) await signOut(); else await supabase.auth.signOut({ scope: "local" }); }
    catch { /* offline: storage is cleared anyway */ }
    clearSiteStorage();
    setWin(null); setDone(true); setBusy(false);
  }
  return (
    <section id="choices" style={{ marginTop: 34, scrollMarginTop: "calc(var(--nav-h, 64px) + 16px)", padding: "20px 22px", border: "1px solid rgba(14,17,22,.12)", borderRadius: 6, background: "#F5F2E9" }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0E1116" }}>Your privacy choices</h2>
      <p style={{ margin: "10px 0 0", fontSize: 14.5, lineHeight: 1.65, color: "#5B5F66" }}>
        {win
          ? <>You are signed in on this device since <b style={{ color: "#1A1A1A" }}>{fmtWhen(win.since)}</b>. This sign-in ends on <b style={{ color: "#1A1A1A" }}>{fmtWhen(win.until)}</b> ({SESSION_DAYS} days).</>
          : done ? "Done. Everything this site stored in your browser has been deleted and you are signed out on this device."
          : "You are not signed in on this device, so no sign-in cookies are stored."}
      </p>
      <button type="button" onClick={clearAll} disabled={busy} style={{
        marginTop: 14, padding: "10px 18px", background: "#0E1116", color: "#FFFFFF", border: 0, borderRadius: 3,
        fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", cursor: busy ? "default" : "pointer",
      }}>{busy ? "Clearing…" : "Delete stored data and sign out"}</button>
    </section>
  );
}

// A body entry is [heading, paragraph] or [heading, rows] where rows are
// [name, type, purpose, duration] — rendered as a list of stored items.
function StoredItems({ rows }) {
  return (
    <div style={{ marginTop: 12, border: "1px solid rgba(14,17,22,.12)", borderRadius: 6, overflow: "hidden" }}>
      {rows.map(([name, type, purpose, duration], i) => (
        <div key={name} style={{ padding: "14px 16px", borderTop: i ? "1px solid rgba(14,17,22,.12)" : 0, background: "#FFFFFF" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, color: "#0E1116" }}>{name}</code>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A7E86" }}>{type}</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5B5F66" }}>{purpose}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: "#1A1A1A" }}><b>Kept:</b> {duration}</p>
        </div>
      ))}
    </div>
  );
}

const BRAND = {
  gold: "#FCBD00", obsidian: "#1A1A1A", deep: "#0E1116",
  white: "#FFFFFF", t2: "#A6A8AD", tmuted: "#8E9198", border: "#383838",
  borderGold: "rgba(252,189,0,0.3)",
};
const CONTACT_EMAIL = "hello@attacked.ai";

// What the browser keeps, per backend. Google Cloud: the API's HttpOnly
// __session cookie (api/app/gcp/deps.py, 30 days); sign-in itself happens on
// WorkOS's hosted page. Supabase: src/lib/cookieStorage.js.
const STORED = GCP ? [
  ["__session", "Cookie", "Keeps you signed in. It holds a random value that only our server can read (page scripts cannot see it), not your account details.", "30 days from when you sign in, then deleted. Removed at once when you sign out."],
  ["attacked_welcome_seen", "Local storage", "Remembers that you closed the welcome message, so it does not appear on every visit. Holds only the value “1”.", "Until you clear this site’s data."],
] : [
  ["attackmap.auth.0, attackmap.auth.1", "Cookie", "Keeps you signed in: your sign-in tokens and basic account details (email, name, organisation, industry).", "3 days from when you sign in, then deleted. Removed at once when you sign out."],
  ["attackmap.session_start", "Cookie", "Records when you signed in, so the 3-day limit applies even while you keep using the site.", "Up to 30 days. Removed when you sign out."],
  ["attacked_welcome_seen", "Local storage", "Remembers that you closed the welcome message, so it does not appear on every visit. Holds only the value “1”.", "Until you clear this site’s data."],
];

const THIRD_PARTY_FILES = "To draw the map and pictures, your browser fetches files directly from a few providers: satellite imagery from Esri (ArcGIS), the 3D map engine from Cloudflare (cdnjs), some incident pictures from Unsplash, and, only when an incident carries a video, YouTube’s privacy-enhanced player (youtube-nocookie.com). These providers see your IP address when they send a file, as any website would.";

const PAGES = {
  privacy: {
    title: "Privacy policy",
    body: [
      ["What we collect", GCP
        ? "When you sign up we store your email address, the profile details you give us and the access tier you hold. Signing in runs through WorkOS, our sign-in provider, which handles your email address and the way you sign in on our behalf. When you use the map we record basic, non-identifying usage so we can keep the service reliable. We do not sell your data."
        : "When you sign up we store your email address and the access tier you hold. When you use the map we record basic, non-identifying usage so we can keep the service reliable. We do not sell your data."],
      ["How we use it", "To deliver the Daily Brief and product updates you ask for, to operate and secure the platform, and to respond when you contact us."],
      ["Your control", "You can unsubscribe from any email using the link in its footer, and you can ask us to delete your account and associated data at any time."],
      ["Contact", `Questions about your data? Email ${CONTACT_EMAIL} and we'll respond.`],
    ],
  },
  terms: {
    title: "Terms of use",
    body: [
      ["The service", "Attacked.ai provides cyber-incident intelligence mapped to the GUARD framework. The intelligence is provided for situational awareness and does not constitute legal, financial or security advice."],
      ["Acceptable use", "You agree not to scrape, resell or redistribute the intelligence beyond your licensed access tier, and not to attempt to disrupt or reverse-engineer the platform."],
      ["Accounts", "You are responsible for activity under your account. Paid tiers are billed as described on the pricing page; founding rates may change for new sign-ups."],
      ["Contact", `For licensing or enterprise terms, email ${CONTACT_EMAIL}.`],
    ],
  },
  // Matches what the site actually stores (STORED above: the API's cookie on
  // Google Cloud, src/lib/cookieStorage.js on Supabase, LandingPage's welcome
  // flag). Update them together.
  cookies: {
    title: "Cookie policy",
    updated: GCP ? "8 October 2026" : "30 September 2026",
    body: [
      ["In short", `Attacked.ai uses ${GCP ? "one first-party cookie that keeps" : "a few first-party cookies that keep"} you signed in, and nothing else. There are no advertising, analytics or tracking cookies, and nothing is shared with other websites. Because every item below is strictly necessary for the service you asked for, we do not show a consent banner.`],
      ["What we store in your browser", STORED],
      ["How long you stay signed in", GCP
        ? "A sign-in lasts 30 days. Behind the scenes a short-lived access token is renewed about every hour while you use the site; after 30 days you are asked to sign in again. Signing out ends the sign-in immediately on this device."
        : "A sign-in lasts 3 days. Behind the scenes a short-lived access token is renewed about every hour while you use the site; after 3 days you are asked to sign in again with a new code. Signing out ends the sign-in immediately on this device."],
      ["Third-party services", GCP
        ? `Signing in happens on a page run by WorkOS, our sign-in provider, at its own address; WorkOS may use its own cookies there to keep the sign-in secure. ${THIRD_PARTY_FILES} None of these providers set cookies on this site; YouTube may use its own storage on its own domain if you play a video.`
        : `${THIRD_PARTY_FILES} They do not set cookies on attackedmap.vercel.app; YouTube may use its own storage on its own domain if you play a video.`],
      ["Your choices", "Use the control below to see your current sign-in and to delete everything this site keeps in your browser. You can also clear or block cookies in your browser settings. Blocking our cookies means you cannot stay signed in."],
      ["Contact", `Questions about cookies or your data? Email ${CONTACT_EMAIL}.`],
    ],
    manage: true,
  },
  accessibility: {
    title: "Accessibility statement",
    body: [
      ["Our commitment", "We want Attacked.ai to be usable by everyone. We aim for clear contrast, keyboard-reachable controls and readable typography across the product."],
      ["Known gaps", "The interactive map is highly visual; we are progressively improving its non-visual experience. If something blocks you, tell us and we'll prioritise a fix."],
      ["Contact", `Report an accessibility issue at ${CONTACT_EMAIL}.`],
    ],
  },
  scam: {
    title: "Scam warning",
    body: [
      ["Beware impersonation", "Attacked.ai will never ask for your password, payment details over email, or remote access to your machine. We only message you from @attacked.ai addresses."],
      ["If in doubt", "Don't click links in suspicious messages claiming to be from us. Navigate to the site directly and check with us first."],
      ["Report it", `Forward suspected impersonation to ${CONTACT_EMAIL}.`],
    ],
  },
  faq: {
    title: "Frequently asked questions",
    body: [
      ["What is Attacked.ai?", "A daily-updated map of corporate cyber and operational incidents, each classified through the GUARD framework with blast radius, controls and vendor Defence Ratings."],
      ["Is it free?", "Yes — the map and the Daily Brief are free. Deeper operational detail — named blast radius, GUARD controls, peer watchlist — is for subscribers. See the pricing page."],
      ["Where does the data come from?", "Daily sweeps of public reporting and disclosures, enriched and classified by our analysts and the GUARD pipeline."],
      ["How do I get full access?", `Sign up free to open the map and your industry dashboard, then subscribe from the dashboard for full access.`],
    ],
  },
};

export function LegalPage({ pageKey }) {
  const page = PAGES[pageKey] || PAGES.privacy;
  useEffect(() => {
    try {
      // The footer's "Your privacy choices" link lands on #choices.
      const el = window.location.hash === "#choices" ? document.getElementById("choices") : null;
      if (el) el.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
    } catch { /* noop */ }
  }, [pageKey]);

  return (
    <div style={{
      minHeight: "100vh", background: "#FFFFFF", color: "#0E1116",
      fontFamily: "Inter, sans-serif", WebkitFontSmoothing: "antialiased",
    }}>
      <SiteNav />

      {/* Header — dark band (chrome); the content below is light */}
      <section style={{
        background: BRAND.deep, color: BRAND.white,
        borderBottom: `1px solid ${BRAND.border}`,
      }}>
        <div className="r-pad" style={{ maxWidth: 760, margin: "0 auto", padding: "52px 36px 44px" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: BRAND.gold,
            letterSpacing: "0.2em", textTransform: "uppercase",
          }}>Attacked.ai</div>
          <h1 style={{
            margin: "12px 0 0", fontSize: "clamp(28px, 3.4vw, 42px)", fontWeight: 800,
            letterSpacing: "-0.02em", color: BRAND.white,
          }}>{page.title}</h1>
          <div style={{ marginTop: 8, fontSize: 12.5, color: BRAND.t2 }}>Last updated · {page.updated || "2026"}</div>
        </div>
      </section>

      <main className="r-pad" style={{ maxWidth: 760, margin: "0 auto", padding: "44px 36px 80px" }}>
        <div style={{ marginTop: 0 }}>
          {page.body.map(([h, p], i) => (
            <section key={i} style={{ marginTop: i === 0 ? 0 : 30 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0E1116" }}>{h}</h2>
              {Array.isArray(p)
                ? <StoredItems rows={p} />
                : <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.72, color: "#5B5F66" }}>{p}</p>}
            </section>
          ))}
        </div>
        {page.manage && <CookieControls />}

        <div style={{ marginTop: 44 }}>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{
            display: "inline-block", padding: "12px 24px", background: BRAND.gold,
            color: BRAND.obsidian, textDecoration: "none", borderRadius: 4,
            fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          }}>Contact us →</a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
