// ─────────────────────────────────────────────────────────────────────────
// Logo — canonical Attacked.ai™ wordmark.
//
// Renders: [shield icon] Attacked.ai™
//   • shield: /attacked-ai-logo.svg (white shield + monogram crest)
//   • wordmark: Inter 700
//   • "Attacked" → WHITE by default, GOLD on hover (link-like)
//   • ".ai"      → GOLD always (brand accent — kept solid)
//   • "™"        → WHITE always (legal mark, subtle)
//
// HIDDEN ADMIN ENTRY: triple-click anywhere on the logo within 600ms
// opens /?admin. Only navigates the URL — actual access still gated by
// tier check in main.jsx (non-admins get the "Forbidden" page). Free
// users who happen to triple-click see no visible effect change in the
// header, just a quick navigation that bounces them back if they're not
// admin. Discoverable by anyone, useful only to admins.
//
// Use everywhere the wordmark is needed — header, footer, modal titles, etc.
// Accepts `size` ('sm' | 'md' | 'lg') to tune for different surfaces.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useRef } from "react";

const GOLD = "#F5B800";
const WHITE = "#FFFFFF";

const SIZES = {
  sm: { icon: 32, fontSize: 20, gap: 10, tm: 11 },
  md: { icon: 40, fontSize: 24, gap: 12, tm: 12 },
  lg: { icon: 52, fontSize: 34, gap: 14, tm: 14 },
};

export function Logo({ size = "sm", asLink = false, href = "/", style = {} }) {
  const s = SIZES[size] || SIZES.sm;
  const [hovered, setHovered] = useState(false);
  // Hover effect is a clean COLOR SWAP — not "everything turns gold". Default
  // state contrasts "Attacked" (white) against ".ai" (gold). On hover the two
  // swap so the wordmark stays bicolor and the user sees the change:
  //   default → Attacked white · .ai gold · ™ white
  //   hover   → Attacked gold  · .ai white · ™ white
  const attackedColor = hovered ? GOLD : WHITE;
  const aiColor       = hovered ? WHITE : GOLD;

  // Hidden admin shortcut — 3 clicks within 600ms navigates to /?admin.
  // Tier gate in main.jsx blocks non-admins; the hidden trigger keeps
  // the entry undiscoverable to anyone who doesn't already know.
  const clickTimes = useRef([]);
  function handleClick(e) {
    const now = Date.now();
    clickTimes.current = [...clickTimes.current, now].filter(t => now - t < 600);
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      if (typeof window !== "undefined") {
        window.location.href = "/?admin";
      }
    }
  }

  const inner = (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: s.fontSize,
        color: attackedColor,
        lineHeight: 1,
        letterSpacing: "-0.01em",
        cursor: asLink ? "pointer" : "default",
        transition: "color 180ms ease",
        userSelect: "none",  // triple-click won't accidentally select text
        ...style,
      }}>
      <img
        src="/attacked-ai-logo.svg"
        alt="Attacked.ai logo"
        width={s.icon}
        height={s.icon}
        style={{ display: "block", borderRadius: 4 }}
      />
      <span>
        Attacked<span style={{ color: aiColor, transition: "color 180ms ease" }}>.ai</span>
        <sup style={{
          color: WHITE,
          fontSize: s.tm,
          fontWeight: 600,
          marginLeft: 1,
          top: "-0.6em",
          position: "relative",
        }}>™</sup>
      </span>
    </span>
  );
  if (asLink) {
    return <a href={href} style={{ textDecoration: "none", display: "inline-flex" }}>{inner}</a>;
  }
  return inner;
}
