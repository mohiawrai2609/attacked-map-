// ─────────────────────────────────────────────────────────────────────────
// Attacked.ai design system — SINGLE SOURCE OF TRUTH
//
// Before this file, `const BRAND = {...}` was copy-pasted into 18 separate
// components. They happened to agree on gold today, but any redesign would
// have drifted immediately. Import from here instead; never re-declare BRAND.
//
// The token set is deliberately a SUPERSET of every key the old per-file
// copies used (obsidian/deep/card/elevated/t2/tmuted/border/... alongside
// obsidianDeep/obsidianCard/textSecondary/borderSubtle/...), so a component
// can switch to this module without touching a single call site.
//
// VISUAL DIRECTION (2026-07-27) — editorial intelligence.
// Derived from the Grey Teamer 001 reference: magazine-scale display type,
// sharp corners, alternating dark / cream "paper" bands, Inter throughout.
// Accent stays the official Attacked.ai gold #F5B800 — the reference's
// #FCBD00 is Wargaming.ai's yellow and must not leak across sub-brands.
// ─────────────────────────────────────────────────────────────────────────

export const BRAND = {
  // ── Accent — official Attacked.ai gold ──────────────────────────────────
  gold:       "#F5B800",
  goldSoft:   "#FFD75A",   // hover lift / luminous edge
  goldDim:    "#D4A000",   // pressed state
  goldDeep:   "#8A6D00",   // on-paper accent text (passes contrast on cream)
  goldTint:   "rgba(245,184,0,0.12)",

  // ── Dark surfaces ───────────────────────────────────────────────────────
  // Blue-black, not neutral black: the reference's #0E1116 reads colder and
  // more cinematic than the old #1A1A1A, and makes gold sit forward.
  black:      "#0E1116",   // page ground
  black2:     "#13171D",   // raised band
  black3:     "#1A1A1A",   // legacy obsidian value, kept for continuity
  card:       "#242424",
  elevated:   "#2E2E2E",
  deep:       "#080808",

  // Legacy aliases → same values, so existing call sites keep working.
  obsidian:         "#0E1116",
  obsidianDeep:     "#080808",
  obsidianCard:     "#242424",
  obsidianElevated: "#2E2E2E",

  // ── Paper (light editorial bands) ───────────────────────────────────────
  // The signature move of the reference: long-form sections drop to warm
  // cream so reading passages feel like print, then back to black.
  paper:      "#F5F3ED",
  paper2:     "#ECE9E1",
  paperWarm:  "#F4F1EA",
  ink:        "#17191D",   // body text on paper
  inkSoft:    "#24272B",   // lead paragraph on paper

  // ── Text on dark ────────────────────────────────────────────────────────
  white:      "#FFFFFF",
  text:       "#EDEFF1",
  muted:      "#9EA3A9",
  t2:         "#A8A8A8",
  tmuted:     "#585858",
  textSecondary: "#A8A8A8",
  textMuted:     "#585858",

  // ── Lines ───────────────────────────────────────────────────────────────
  line:         "rgba(255,255,255,.13)",
  lineDark:     "rgba(14,17,22,.14)",
  border:       "#333333",
  borderSubtle: "#333333",
  borderGold:   "rgba(245,184,0,0.3)",

  // ── Semantic (NOT decorative — never reuse these as accents) ────────────
  // Broadcast-red for the pulsing LIVE badge only. This is a functional
  // signal in the newsroom sense (FT/BBC use the same convention), which is
  // why it is exempt from the gold-only accent rule. It must never appear on
  // a button, heading, border or anything that is not a liveness indicator.
  live: "#E0091C",
  ok:   "#34C759",   // success / confirmed states
  blue: "#2D5BFF",   // footer link accent (legacy)

  // Warm neutrals used by the Attacked Hub's newspaper layout.
  newsprint:     "#14130F",
  newsprintEdge: "#3D3A33",
  newsprintText: "#E6E3DB",
  newsprintMute: "#6E6A60",
};

// ── 5-tier risk scale (Attacked.ai standard — NOT the 3-tier RPI scale) ────
export const SEVERITY = {
  5: { label: "CRITICAL", color: "#FF3B30", glow: "rgba(255,59,48,0.4)" },
  4: { label: "HIGH",     color: "#FF6B35", glow: "rgba(255,107,53,0.35)" },
  3: { label: "MEDIUM",   color: "#F5B800", glow: "rgba(245,184,0,0.35)" },
  2: { label: "LOW",      color: "#34C759", glow: "rgba(52,199,89,0.30)" },
  1: { label: "MINIMAL",  color: "#8E8E93", glow: "rgba(142,142,147,0.25)" },
};

// Severity colours are tuned for DARK surfaces. Used as text on white — as
// the Attacked Hub's newspaper layout does — they fail badly: gold #F5B800 on
// white measures 1.79:1, well under the 4.5:1 minimum, which is why MEDIUM
// badges were barely legible. These are the same hues darkened to pass on
// paper. Use SEVERITY[n].color for fills, dots and rules on any background;
// use SEVERITY_INK[n] only for TEXT sitting on a light background.
// Measured on the live page: the MEDIUM badge goes from 1.79:1 (unreadable)
// to 4.92:1 against white with these values. An earlier attempt darkened them
// further, but that was chasing numbers polluted by the dark LIVE ticker,
// which had wrongly been switched to this ramp — on a dark ground these read
// worse, not better. Light grounds only.
export const SEVERITY_INK = {
  5: "#B01F16",
  4: "#A03D12",
  3: "#7A6000",
  2: "#1A7430",
  1: "#57575C",
};

// Opaque pale grounds for severity chips. A chip that uses a TRANSLUCENT tint
// inherits whatever is behind it, so the same badge composites light on the
// newspaper and dark in the article view — which is how CRITICAL ended up at
// 2.53:1. Pairing an opaque pale ground with SEVERITY_INK makes the chip
// self-contained and legible on any background, light or dark.
export const SEVERITY_CHIP = {
  5: "#FBE7E5",
  4: "#FBEBE2",
  3: "#FBF1D9",
  2: "#E4F6E9",
  1: "#EEEEEF",
};

// ── Layout rails ──────────────────────────────────────────────────────────
export const LAYOUT = {
  max:     1320,   // full content width
  reading:  820,   // long-form measure — never set prose wider than this
  gutter:    48,
};

// ── Type ──────────────────────────────────────────────────────────────────
// Inter only. The old stack loaded Cormorant Garamond and JetBrains Mono but
// used them 1× and 2× respectively across the whole app — the product has
// always effectively been Inter, and the reference confirms that direction.
export const FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Editorial type scale. Display sizes are fluid and deliberately tight:
// negative tracking + sub-1 line-height is what makes the reference read as
// a magazine rather than a dashboard.
export const TYPE = {
  // Hero headline. Sized DOWN from the reference on purpose: the reference is
  // a single-article page where a 110px masthead is the whole view, but the
  // landing hero sits beside a globe and a live incident card, and at that
  // scale it swamped them. Keeps the editorial character (tight tracking,
  // sub-1 leading, weight 600) at a size that sits in the composition.
  hero: {
    fontSize: "clamp(36px, 4.2vw, 58px)",
    lineHeight: 1.0,
    letterSpacing: "-0.04em",
    fontWeight: 600,
    textWrap: "balance",
  },
  // Section headline.
  display: {
    fontSize: "clamp(38px, 5vw, 76px)",
    lineHeight: 0.99,
    letterSpacing: "-0.06em",
    fontWeight: 600,
    textWrap: "balance",
  },
  // Sub-section / card headline.
  title: {
    fontSize: "clamp(24px, 2.6vw, 38px)",
    lineHeight: 1.06,
    letterSpacing: "-0.04em",
    fontWeight: 600,
  },
  // Standfirst — the sentence under a hero.
  standfirst: {
    fontSize: "clamp(18px, 1.9vw, 27px)",
    lineHeight: 1.45,
    letterSpacing: "-0.015em",
    fontWeight: 400,
  },
  // Long-form body.
  body: {
    fontSize: 17,
    lineHeight: 1.65,
    letterSpacing: "-0.01em",
  },
  // Eyebrow / kicker / metadata — the wide-tracked uppercase micro-label
  // that appears above almost every section in the reference.
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
};

// ── Motion ────────────────────────────────────────────────────────────────
export const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

// ── Component recipes ─────────────────────────────────────────────────────
// Sharp corners everywhere: the reference uses no border-radius on structural
// elements, which is what separates "intelligence dossier" from "SaaS card".

export const btn = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: "14px 22px",
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    border: "1px solid transparent",
    borderRadius: 0,
    cursor: "pointer",
    textDecoration: "none",
    transition: `all 180ms ${EASE}`,
  },
  primary: {
    background: BRAND.gold,
    color: "#111",
    borderColor: BRAND.gold,
  },
  ghost: {
    background: "rgba(14,17,22,.48)",
    color: BRAND.white,
    borderColor: "rgba(255,255,255,.25)",
  },
  // On cream sections a gold button needs a darker edge to hold its shape.
  onPaper: {
    background: BRAND.ink,
    color: BRAND.white,
    borderColor: BRAND.ink,
  },
};

// Bordered metadata chip with glass blur — used over imagery in the hero.
export const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 12px",
  fontFamily: FONT,
  fontSize: 11,
  color: "#C8CCD0",
  background: "rgba(14,17,22,.64)",
  border: "1px solid rgba(255,255,255,.18)",
  borderRadius: 0,
  backdropFilter: "blur(12px)",
};

// Editorial pull-quote: heavy gold rule above, oversized tight text.
export const pullquote = {
  margin: "54px 0",
  paddingTop: 24,
  borderTop: `5px solid ${BRAND.gold}`,
  fontSize: "clamp(24px, 2.4vw, 34px)",
  lineHeight: 1.23,
  letterSpacing: "-0.035em",
  fontWeight: 600,
};

// Content rail — centres a band's contents at the layout max width.
export const shell = {
  width: `min(${LAYOUT.max}px, calc(100% - ${LAYOUT.gutter}px))`,
  marginInline: "auto",
};

// Band backgrounds. Alternating these is the page rhythm.
export const band = {
  dark:  { background: BRAND.black,  color: BRAND.text },
  dark2: { background: BRAND.black2, color: BRAND.text },
  deep:  { background: BRAND.deep,   color: BRAND.text },
  paper: { background: BRAND.paper,  color: BRAND.ink },
  paperWarm: { background: BRAND.paperWarm, color: BRAND.ink },
};

export default BRAND;
