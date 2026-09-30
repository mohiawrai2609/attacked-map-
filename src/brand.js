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
// ACCENT (2026-09-29) — Signal Gold #FCBD00, per the Attacked.ai World Class
// Brand Guidelines v1.0. This file used to warn that #FCBD00 was Wargaming.ai's
// yellow and must not cross sub-brands; the guidelines have since made it
// Attacked.ai's own accent, and the owner confirmed the roll-out from #F5B800.
//
// src/styles/tokens.css is the source of truth for anything CSS can reach.
// This module exists only for components that style in JS — prefer var(--gold)
// in a stylesheet over importing BRAND into a new component.
// ─────────────────────────────────────────────────────────────────────────

// Every value below is a brand token from src/styles/tokens.css, named in the
// trailing comment (2026-09-30 alignment: this object had drifted — its
// greys, creams and near-blacks were all a shade off the tokens, so pages
// styled from here never quite matched the dashboard, which reads the tokens).
export const BRAND = {
  // ── Accent — Signal Gold ────────────────────────────────────────────────
  gold:       "#FCBD00",   // --gold
  goldSoft:   "#FFD75A",   // hover lift (not a token; hover only)
  goldDim:    "#E0A800",   // --gold-press
  goldDeep:   "#8A6D00",   // --gold-text — gold for TEXT on white / canvas
  goldTint:   "rgba(252,189,0,0.12)",

  // ── Dark surfaces, layered (brand: do not flood every surface with black)
  black:      "#0E1116",   // --ink        Command Ink — page ground
  black2:     "#1A1A1A",   // --ink-2      Operational Black — raised band, hero panels
  black3:     "#1A1A1A",   // --ink-2
  card:       "#242424",   // --charcoal   Card Charcoal
  elevated:   "#2E2E2E",   // --raised     Raised Grey — inputs, chips
  deep:       "#0E1116",   // --ink (the old #080808 is not a brand value)

  // Legacy aliases → same values, so existing call sites keep working.
  obsidian:         "#0E1116",   // --ink
  obsidianDeep:     "#0E1116",   // --ink
  obsidianCard:     "#242424",   // --charcoal
  obsidianElevated: "#2E2E2E",   // --raised

  // ── Canvas (light editorial bands, warm off-white) ──────────────────────
  paper:      "#F5F2E9",   // --canvas
  paper2:     "#EDE8DB",   // --canvas-2
  paperWarm:  "#F5F2E9",   // --canvas
  ink:        "#1A1A1A",   // --body-text  copy on canvas
  inkSoft:    "#1A1A1A",   // --body-text

  // ── Text on dark ────────────────────────────────────────────────────────
  white:      "#FFFFFF",   // --white
  text:       "#EDEDED",   // --mist
  muted:      "#A6A8AD",   // --muted
  t2:         "#A6A8AD",   // --muted
  tmuted:     "#8E9198",   // --muted-2
  textSecondary: "#A6A8AD",   // --muted
  textMuted:     "#8E9198",   // --muted-2

  // ── Lines ───────────────────────────────────────────────────────────────
  line:         "rgba(255,255,255,.16)",   // --line-2
  lineDark:     "rgba(14,17,22,.12)",      // --line-l
  border:       "#383838",   // --raised-2 (solid, because some call sites use it as a fill)
  borderSubtle: "#383838",   // --raised-2
  borderGold:   "rgba(252,189,0,0.3)",

  // ── Semantic (NOT decorative — never reuse these as accents) ────────────
  // Broadcast-red for the pulsing LIVE badge only. This is a functional
  // signal in the newsroom sense (FT/BBC use the same convention), which is
  // why it is exempt from the gold-only accent rule. It must never appear on
  // a button, heading, border or anything that is not a liveness indicator.
  live: "#E0091C",
  ok:   "#34C759",   // --s2 — success / confirmed states

  // The Attacked Hub's dark newspaper bands, on the same tokens as every
  // other dark surface (they used to be a warm brown-black of their own).
  newsprint:     "#1A1A1A",   // --ink-2
  newsprintEdge: "#383838",   // --raised-2
  newsprintText: "#EDEDED",   // --mist
  newsprintMute: "#8E9198",   // --muted-2
};

// ── 5-tier risk scale (Attacked.ai standard — NOT the 3-tier RPI scale) ────
export const SEVERITY = {
  5: { label: "CRITICAL", color: "#FF3B30", glow: "rgba(255,59,48,0.4)" },
  4: { label: "HIGH",     color: "#FF6B35", glow: "rgba(255,107,53,0.35)" },
  3: { label: "MEDIUM",   color: "#FCBD00", glow: "rgba(252,189,0,0.35)" },
  2: { label: "LOW",      color: "#34C759", glow: "rgba(52,199,89,0.30)" },
  1: { label: "MINIMAL",  color: "#8E8E93", glow: "rgba(142,142,147,0.25)" },
};

// Severity colours are tuned for DARK surfaces. Used as text on white — as
// the Attacked Hub's newspaper layout does — they fail badly: gold #FCBD00 on
// white measures 1.79:1, well under the 4.5:1 minimum, which is why MEDIUM
// badges were barely legible. These are the same hues darkened to pass on
// paper. Use SEVERITY[n].color for fills, dots and rules on any background;
// use SEVERITY_INK[n] only for TEXT sitting on a light background.
// Measured on the live page: the MEDIUM badge goes from 1.79:1 (unreadable)
// to 4.92:1 against white with these values. An earlier attempt darkened them
// further, but that was chasing numbers polluted by the dark LIVE ticker,
// which had wrongly been switched to this ramp — on a dark ground these read
// worse, not better. Light grounds only.
// Taken from the impact-assessment reference's light-mode ramp
// (--crit / --hi / --gold-text / --lo / --min) rather than hand-derived.
// Now the tokens' own AA-deepened ramp (--s5-tx … --s1-tx), so a severity
// label on paper reads the same on the Hub as on the dashboard.
export const SEVERITY_INK = {
  5: "#B21F31",
  4: "#A94B0F",
  3: "#7A6000",
  2: "#1E7A3D",
  1: "#55565A",
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
// Brand: JetBrains Mono is reserved for time, scores, identifiers, evidence
// codes and system metadata (self-hosted since 2026-09-29, see fonts.css).
export const MONO = "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace";

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
    color: "#0E1116",   // --on-gold
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
  color: "#A6A8AD",   // --muted
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
