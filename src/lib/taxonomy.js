// taxonomy.js — the one place the product's classification vocabulary lives.
//
// Sign-up, the signed-in dashboard, Configure Alerts and the daily brief all
// read from here, so the industry a reader picks at registration is the exact
// string the sweeper writes on incidents.industry and the digest partitions
// on. (Previously this list lived inline in the retired OnboardingWizard.)

// 43 industries grouped by GICS sector — mirrors the sweeper's controlled
// vocabulary. Keep the strings byte-identical to incidents.industry values.
export const SECTORS = [
  ["Communication Services", ["Advertising & Marketing Services", "Media & Entertainment", "Telecommunications"]],
  ["Consumer Discretionary", ["Apparel, Luxury & Sporting Goods", "Automotive & EV", "Broadline & Specialty Retail", "Hotels, Restaurants & Leisure"]],
  ["Consumer Staples", ["Food & Beverage", "Food & Drug Retail", "Household & Personal Care"]],
  ["Defence & National Security", ["Armed Forces & Defence Ministries"]],
  ["Energy", ["Oil & Gas (Integrated & E&P)", "Oil & Gas Services & Midstream", "Renewable Energy & Clean Tech", "Utilities (Electric, Gas, Water)"]],
  ["Financials", ["Banking (Diversified & Universal)", "Capital Markets & Asset Management", "Consumer Finance & Lending", "Insurance", "Payments & Financial Infrastructure"]],
  ["Healthcare", ["Health Insurance & Managed Care", "Healthcare Facilities & Providers", "Life Sciences & Biotech Tools", "Medical Devices & Equipment", "Pharmaceuticals"]],
  ["Industrials", ["Aerospace & Defence", "Airlines & Aviation", "Construction & Engineering", "Industrial Machinery & Equipment", "Transportation & Logistics", "Waste Management & Environmental Services"]],
  ["Information Technology", ["Cybersecurity", "Hardware & Networking", "Internet & Digital Platforms", "IT Services & Consulting", "Semiconductors & Equipment", "Software & Cloud Infrastructure"]],
  ["Materials", ["Chemicals (Diversified & Specialty)", "Metals, Mining & Building Materials"]],
  ["Public Administration", ["Government (National / Federal)"]],
  ["Public Health & Social Care", ["Public Hospitals & National Health Systems"]],
  ["Real Estate", ["Real Estate Development & Services", "REITs (All Subsectors)"]],
];
export const INDUSTRIES = SECTORS.flatMap(([, list]) => list);

// Job roles offered at sign-up. Stored verbatim in profiles.role.
export const ROLES = [
  "CISO / Head of Security", "CIO / CTO", "CEO / Founder", "Risk / Compliance Lead",
  "Board Member / Director", "Security Analyst", "Operations / Resilience",
  "Consultant / Advisor", "Investor", "Student", "Other",
];

// The 13 GUARD risk categories. Code is what incidents.primary_category holds.
export const CATEGORIES = [
  ["CYB", "Cyber Security"], ["DAT", "Data & Privacy"], ["TEC", "Technology"],
  ["GEO", "Geopolitical"], ["PHY", "Physical Security"], ["OPS", "Operational"],
  ["TPR", "Third-Party Risk"], ["REG", "Regulatory"], ["FIN", "Financial"],
  ["STR", "Strategic"], ["REP", "Reputational"], ["PPL", "People & Human Capital"],
  ["ENV", "Environmental"],
];
export const CATEGORY_NAME = Object.fromEntries(CATEGORIES);

// Attacked.ai 5-tier severity (never the 3-tier RPI scale).
export const SEVERITY = { 5: "Critical", 4: "High", 3: "Medium", 2: "Low", 1: "Minimal" };
export const SEVERITY_COLOR = { 5: "#FF3B30", 4: "#FF6B35", 3: "#F5B800", 2: "#34C759", 1: "#8E8E93" };

// ── Access tiers ─────────────────────────────────────────────────────────
// profiles.tier ∈ free | enterprise | vendor | admin (partner is retired).
// "Subscriber" in the UI is the 'enterprise' row value: it already exists in
// the CHECK constraint and is what sync_subscription_tier() promotes to when a
// paid plan activates, so no schema change was needed to retire Design Partner.
export const SUBSCRIBER_TIER = "enterprise";
export const isSubscriber = (tier) => tier === SUBSCRIBER_TIER || tier === "admin";
export const tierLabel = (tier) =>
  tier === "admin" ? "Admin" : isSubscriber(tier) ? "Subscriber" : tier === "vendor" ? "Vendor" : tier === "free" ? "Free" : "Public";
