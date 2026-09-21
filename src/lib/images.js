// images.js — one place for the editorial photo pool the Hub page and the
// dashboard share. Keyed by GUARD category so a Cyber incident and a
// Geopolitical one never wear the same picture, with a hashed pick from the
// whole pool for lists that would otherwise repeat one photo per category.
//
// Unsplash hotlinks, sized for cards. Swap for owned assets when they exist.

export const CATEGORY_IMG = {
  CYB: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=900&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=900&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=900&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=900&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=900&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=900&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=900&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=900&q=70&auto=format&fit=crop",
  _default: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900&q=70&auto=format&fit=crop",
};

// Second-choice photos per category so a single-category grid varies.
const ALT_IMG = {
  CYB: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=900&q=70&auto=format&fit=crop",
  DAT: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=900&q=70&auto=format&fit=crop",
  FIN: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&q=70&auto=format&fit=crop",
  GEO: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=900&q=70&auto=format&fit=crop",
  REG: "https://images.unsplash.com/photo-1450101499163-c8f4ea0b7e2d?w=900&q=70&auto=format&fit=crop",
  PHY: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=70&auto=format&fit=crop",
  PPL: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=70&auto=format&fit=crop",
  TEC: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=70&auto=format&fit=crop",
  STR: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&q=70&auto=format&fit=crop",
  REP: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900&q=70&auto=format&fit=crop",
  TPR: "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=900&q=70&auto=format&fit=crop",
  OPS: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=900&q=70&auto=format&fit=crop",
  ENV: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900&q=70&auto=format&fit=crop",
};

const hash = (v) => { let h = 5381; const s = String(v); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };

// Stable per incident: alternates between the category's two photos by id.
export function incidentImage(i) {
  const cat = i?.cat || i?.primary_category;
  const primary = CATEGORY_IMG[cat] || CATEGORY_IMG._default;
  const alt = ALT_IMG[cat];
  return alt && hash(i?.id) % 2 ? alt : primary;
}
