// workos.js — WorkOS sign-in for the Supabase site, through the workos-auth
// Edge Function (supabase/functions/workos-auth).
//
// Switched on per build with VITE_AUTH_PROVIDER=workos. Off (the default), the
// site signs in exactly as before (Supabase codes and Supabase OAuth).
//
//   emailStart(email)            WorkOS makes a 6-digit code; the function emails it
//   emailVerify(email, code)     -> { token_hash, type } for supabase.auth.verifyOtp
//   startProvider(id, back)      full-page trip: Google / Microsoft / GitHub / LinkedIn
//   takeReturn()                 the token a provider trip brought back (#wos_token=…)
//   liveProviders()              which providers WorkOS has switched on (hides the rest)
//   savePending / takePending    sign-up form details kept across a provider trip

export const WORKOS = import.meta.env.VITE_AUTH_PROVIDER === "workos";

const BRIDGE = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/workos-auth`;

// The modal's provider ids (kept from the Supabase days) -> WorkOS providers.
export const WORKOS_PROVIDER = {
  google: "GoogleOAuth",
  azure: "MicrosoftOAuth",
  github: "GitHubOAuth",
  linkedin_oidc: "LinkedInOAuth",
};

async function post(path, body) {
  let r;
  try {
    r = await fetch(`${BRIDGE}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Sign-in can't be reached right now. Check your connection and try again.");
  }
  let j = {};
  try { j = await r.json(); } catch { /* empty body */ }
  if (!r.ok) { const e = new Error(j.error || `Sign-in failed (${r.status}).`); e.status = r.status; throw e; }
  return j;
}

// The providers switched on in WorkOS right now (WorkOS names), asked once per
// page load; null if the question could not be answered (then show them all).
let live = null;
export function liveProviders() {
  if (!live) {
    live = fetch(`${BRIDGE}/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && Array.isArray(j.providers) ? j.providers : null))
      .catch(() => null);
  }
  return live;
}

export const emailStart = (email) => post("/email/start", { email });
export const emailVerify = (email, code) => post("/email/verify", { email, code });

export function startProvider(id, back) {
  const provider = WORKOS_PROVIDER[id];
  if (!provider) throw new Error("That sign-in option is not switched on.");
  const q = new URLSearchParams({ provider, redirect: back || `${window.location.origin}/?dashboard` });
  window.location.href = `${BRIDGE}/start?${q}`;
}

// A provider trip lands on the page with #wos_token=…&wos_type=…. Take it off
// the address straight away (so it is not left in history or copied in a link)
// and hand it back once.
export function takeReturn() {
  if (typeof window === "undefined") return null;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token_hash = h.get("wos_token");
  if (!token_hash) return null;
  const type = h.get("wos_type") || "magiclink";
  h.delete("wos_token"); h.delete("wos_type");
  const rest = h.toString();
  window.history.replaceState(null, "", window.location.pathname + window.location.search + (rest ? `#${rest}` : ""));
  return { token_hash, type };
}

// The sign-up form's answers, kept for the length of a provider trip (this tab
// only, 30 minutes), so someone who filled the form and then chose Google does
// not have to answer again.
const PENDING = "attacked.pendingSignup";
export function savePending(fields) {
  try { sessionStorage.setItem(PENDING, JSON.stringify({ fields, at: Date.now() })); } catch { /* storage blocked */ }
}
export function takePending() {
  try {
    const raw = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    const p = raw ? JSON.parse(raw) : null;
    return p && p.fields && Date.now() - p.at < 30 * 60_000 ? p.fields : null;
  } catch { return null; }
}
