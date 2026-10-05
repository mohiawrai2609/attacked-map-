// ─────────────────────────────────────────────────────────────────────────
// Data client — single instance shared across the app.
//
// Supabase backend (default): auth + data from Supabase. The session lives in
// first-party cookies for SESSION_DAYS (30) from sign-in (cookieStorage.js);
// the access token itself stays 1 hour and is renewed silently.
//
// GCP backend (VITE_BACKEND=gcp): the same supabase-js data calls
// (.from / .rpc) go to OUR PostgREST on this site's origin (/rest/v1), and the
// reader's 1-hour token comes from our API (lib/gcpAuth.js, HttpOnly cookie
// session). supabase.auth is not used there: sign-in goes through gcpAuth.
//
// Data fetching for the map still uses raw fetch with pagination in
// GlobalAttackMap.jsx against the same /rest/v1 base.
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { cookieStorage, enforceSessionLimit, beginSignIn, SESSION_STORAGE_KEY } from "./cookieStorage";
import { GCP } from "./backend";
import { getAccessToken } from "./gcpAuth";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // createClient("") throws while this module loads and the whole app would
  // render a blank page. Keep the page up and say what is missing.
  console.error("[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set for this build — data and sign-in will fail.");
}
const safeUrl = url || "https://missing-config.invalid";
const safeKey = key || "missing-key";

export const supabase = GCP
  ? createClient(safeUrl, safeKey, {
      accessToken: getAccessToken,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : createClient(safeUrl, safeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // handles magic-link redirect
        storageKey: SESSION_STORAGE_KEY,
        storage: cookieStorage,
      },
    });
if (!GCP) enforceSessionLimit(supabase);

// A sign-in link (the emailed-link fallback, or a provider coming back) lands
// with the new session in the URL; supabase-js stores it on load. Start a fresh
// window for it, as the code and password paths do, so a stale start time from
// an earlier sign-in in this browser cannot refuse or shorten it.
if (!GCP && typeof window !== "undefined") {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const q = new URLSearchParams(window.location.search);
    if (h.get("access_token") || q.get("code")) beginSignIn();
  } catch { /* noop */ }
}
