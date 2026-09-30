// ─────────────────────────────────────────────────────────────────────────
// Supabase client — single instance shared across the app.
// Used for:
//   • Auth (magic-link sign-in, session persistence)
//   • Profile read (tier resolution)
//   • Future: partner application submission, admin actions
//
// Data fetching (incidents, blast_radius, etc.) still uses raw fetch with
// pagination in GlobalAttackMap.jsx — those paths are unchanged.
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { cookieStorage, enforceSessionLimit, SESSION_STORAGE_KEY } from "./cookieStorage";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — auth will be disabled."
  );
}

// The session lives in first-party cookies for SESSION_DAYS (3) from sign-in,
// not in localStorage forever — see cookieStorage.js. The access token itself
// stays 1 hour (the Supabase JWT setting) and is renewed silently.
export const supabase = createClient(url || "", key || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles magic-link redirect
    storageKey: SESSION_STORAGE_KEY,
    storage: cookieStorage,
  },
});
enforceSessionLimit(supabase);

// ─────────────────────────────────────────────────────────────────────────
// Hub data client — the Attacked Hub (?hub) reads its incidents from a
// SEPARATE Supabase project (the dedicated incident-reporting DB), while the
// rest of the app (auth, the Attack Map, admin) stays on the primary project
// above. Data-only: no auth/session, so it never collides with the main
// client. The anon key is public by design (shipped in every Supabase web app).
// ─────────────────────────────────────────────────────────────────────────
const HUB_URL = "https://wfnvwtmpvzuxjmebqffq.supabase.co";
const HUB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbnZ3dG1wdnp1eGptZWJxZmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MDc2MjAsImV4cCI6MjA5ODI4MzYyMH0.9aEyzqLdjf8Wt25kH-n6iw8dwMP-1ifLyuOmePU7OWs";

export const supabaseHub = createClient(HUB_URL, HUB_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
