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
import React, { useEffect } from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

const BRAND = {
  gold: "#F5B800", obsidian: "#1A1A1A", deep: "#080808",
  white: "#FFFFFF", t2: "#A8A8A8", tmuted: "#585858", border: "#333333",
  borderGold: "rgba(245,184,0,0.3)",
};
const CONTACT_EMAIL = "hello@attacked.ai";

const PAGES = {
  privacy: {
    title: "Privacy policy",
    body: [
      ["What we collect", "When you sign up we store your email address and the access tier you hold. When you use the map we record basic, non-identifying usage so we can keep the service reliable. We do not sell your data."],
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
  cookies: {
    title: "Cookie preferences",
    body: [
      ["What we use", "We use a small number of essential cookies to keep you signed in and to remember your session. We do not run third-party advertising cookies."],
      ["Managing them", "You can clear or block cookies in your browser settings. Blocking essential cookies will sign you out and may break parts of the map."],
      ["Contact", `Questions? Email ${CONTACT_EMAIL}.`],
    ],
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
      ["Is it free?", "Yes — the map and the Daily Brief are free. Deeper operational detail is available on the Design Partner and Enterprise tiers. See the pricing page."],
      ["Where does the data come from?", "Daily sweeps of public reporting and disclosures, enriched and classified by our analysts and the GUARD pipeline."],
      ["How do I get full access?", `Sign up free to open the map, or email ${CONTACT_EMAIL} about partner and enterprise access.`],
    ],
  },
};

export function LegalPage({ pageKey }) {
  const page = PAGES[pageKey] || PAGES.privacy;
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* noop */ } }, [pageKey]);

  return (
    <div style={{
      minHeight: "100vh", background: "#FFFFFF", color: "#101010",
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
          <div style={{ marginTop: 8, fontSize: 12.5, color: BRAND.t2 }}>Last updated · 2026</div>
        </div>
      </section>

      <main className="r-pad" style={{ maxWidth: 760, margin: "0 auto", padding: "44px 36px 80px" }}>
        <div style={{ marginTop: 0 }}>
          {page.body.map(([h, p], i) => (
            <section key={i} style={{ marginTop: i === 0 ? 0 : 30 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#101010" }}>{h}</h2>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.72, color: "#52525B" }}>{p}</p>
            </section>
          ))}
        </div>

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
