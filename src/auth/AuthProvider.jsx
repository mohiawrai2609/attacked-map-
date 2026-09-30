// ─────────────────────────────────────────────────────────────────────────
// AuthProvider — single source of truth for the current user's identity
// and access tier. Wraps the entire app in main.jsx.
//
// Exposes via useAuth():
//   • user      — Supabase auth user object, or null
//   • tier      — 'public' | 'free' | 'enterprise' (= Subscriber) | 'admin'
//                 (anonymous = 'public'; signed-in defaults to 'free' until
//                  the profile row is loaded; flips to whatever profiles.tier
//                  says)
//   • loading   — true while we resolve session + profile on mount
//   • signIn    — (email) => sends magic link
//   • signOut   — () => sign out
//
// Tier-aware rendering in the map reads from useAuth().tier. A ?preview=
// URL param overrides the tier for dev testing without real signup.
// ─────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { SUBSCRIBER_TIER, isSubscriber } from "../lib/taxonomy";
import { sendCode, setSubscription } from "../lib/api";

// Testing mode: on `npm run dev` sign-in skips the email code (owner,
// 2026-09-30). Set VITE_DIRECT_SIGNIN=0 in .env.local to test the real code flow
// locally. Always false in `npm run build`, so the live site keeps the code.
export const DIRECT_SIGNIN = import.meta.env.DEV && import.meta.env.VITE_DIRECT_SIGNIN !== "0";

const AuthContext = createContext({
  user: null,
  tier: "public",
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// Honour ?preview=subscriber / ?preview=free / ?preview=public / ?preview=admin
// for QA without a real account. 'partner' is accepted as an alias of
// 'subscriber' so old links keep working; Design Partner itself is retired.
function getPreviewTier() {
  if (typeof window === "undefined") return null;
  try {
    const p = new URLSearchParams(window.location.search).get("preview");
    if (p === "subscriber" || p === "partner") return SUBSCRIBER_TIER;
    if (p === "public" || p === "free" || p === "admin") return p;
  } catch { /* noop */ }
  return null;
}

async function fetchProfile(userId) {
  if (!userId) return null;
  // select("*"), deliberately: public.profiles is a security_invoker view with
  // an own-row policy, so this returns exactly the reader's row and nothing
  // else — and it cannot break when a column is added (min_severity for the
  // daily brief, 2026-09-22) or renamed. A named list that mentions one column
  // the view lacks makes PostgREST reject the WHOLE select, this returns null,
  // and every reader silently drops to the free tier. Never go back to a list.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[Auth] profile fetch failed:", error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Boot: read existing session + listen for changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const sessionUser = data?.session?.user || null;
      setUser(sessionUser);
      if (sessionUser) {
        const p = await fetchProfile(sessionUser.id);
        if (!cancelled) setProfile(p);
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      if (sessionUser) {
        const p = await fetchProfile(sessionUser.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Passwordless — email a 6-digit code (no magic link, no redirect → immune
  // to the Site-URL / link-prefetch problems that broke the old flow). This is
  // the ONLY email path now: sign-up and sign-in both go email → code. A new
  // address is created on the spot; `meta` (name, role, company, industry)
  // rides along as user metadata and is copied to profiles after the code.
  // emailRedirectTo: the app never wants a link — the reader types the code —
  // but if the Magic Link template in Supabase still prints a link (it must
  // contain {{ .Token }} to print the code), clicking it must at least land on
  // THIS site's dashboard, not the Supabase Site URL (which points at the old
  // production build with no dashboard). The origin must be allow-listed under
  // Authentication → URL configuration → Redirect URLs.
  const signIn = useCallback(async (email, meta = null) => {
    // The API sends the code itself (always a code, never a link, any
    // address) when VITE_API_URL is set and the API is reachable. A real
    // refusal from the API (bad address, mail failure) is surfaced; only an
    // unreachable API falls through to Supabase's own email.
    try { const r = await sendCode(String(email || "").trim().toLowerCase(), meta, true); if (r && r.sent) return; }
    catch (e) { if (e && e.status) throw new Error(e.message); }
    const { error } = await supabase.auth.signInWithOtp({
      email: String(email || "").trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        ...(meta ? { data: meta } : {}),
        ...(typeof window !== "undefined" ? { emailRedirectTo: `${window.location.origin}/?dashboard` } : {}),
      },
    });
    if (error) throw error;
  }, []);

  // TESTING MODE (localhost only): sign in with just the email, no code. The
  // dev server mints a one-time token (scripts/dev-direct-signin.mjs) and it is
  // exchanged here, so the session is the same as after a code. DIRECT_SIGNIN is
  // false in every production build, which drops this path from the bundle.
  const directSignIn = useCallback(async (email, meta = null) => {
    if (!DIRECT_SIGNIN) throw new Error("Direct sign-in is only available on the local dev server.");
    const r = await fetch("/__dev/direct-signin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim().toLowerCase(), meta }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token_hash) throw new Error(j.error || `Direct sign-in failed (${r.status}).`);
    const { error } = await supabase.auth.verifyOtp({ token_hash: j.token_hash, type: j.type || "magiclink" });
    if (error) throw error;
  }, []);

  // Social sign-in — Google / LinkedIn / GitHub / Microsoft through Supabase
  // OAuth. The provider must be switched on in the Supabase dashboard
  // (Authentication → Providers) and redirectTo allow-listed (Authentication
  // → URL configuration); until then Supabase answers "provider is not
  // enabled" and the modal says so. Supabase redirects back with ?code=,
  // supabase-js exchanges it for a session on load, and onAuthStateChange
  // above picks it up like any other sign-in.
  const signInWithProvider = useCallback(async (provider, redirectTo) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo || (typeof window !== "undefined" ? `${window.location.origin}/?dashboard` : undefined) },
    });
    if (error) throw error;
  }, []);

  // Create an account with a password (McKinsey-style signup). The form fields
  // ride along as user metadata; the basics are copied to `profiles` after the
  // email code is verified. Supabase then emails a 6-digit "Confirm signup" code.
  //
  // When the email already exists AND is confirmed, GoTrue does NOT error: to
  // stop attackers enumerating registered addresses it returns 200 with a decoy
  // user, logs user_repeated_signup, and sends NO email. The documented tell is
  // an empty identities array. Surface it as a typed error so the modal can
  // route to sign-in instead of stranding the reader on an empty code screen.
  const signUpWithPassword = useCallback(async (email, password, meta = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email: String(email || "").trim().toLowerCase(),
      password,
      options: { data: meta },
    });
    if (error) throw error;
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const err = new Error("That email already has an account — sign in instead.");
      err.code = "user_already_exists";
      throw err;
    }
    return data;
  }, []);

  // Returning user — email + password.
  const signInWithPassword = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  // Verify the 6-digit code. type="signup" right after creating an account,
  // type="email" for the passwordless code fallback. On success the session is
  // created and onAuthStateChange picks it up automatically.
  // Supabase issues the code as type "signup" for a brand-new address (the
  // Confirm-signup email) and as type "email" for an existing one (the Magic
  // Link email), and verifyOtp checks the type. The app cannot know which
  // the address was when the code was sent, so try the requested type first
  // and the other on a type mismatch. Only a genuine expiry/mismatch on both
  // is reported.
  //
  // Leading zeros: this project issues 8-digit codes and a code such as
  // 05339579 loses its zero somewhere between the inbox and the box often
  // enough (mail clients, copy, autofill) that a 7-digit entry is almost always
  // that code minus its zero. So every candidate is also tried zero-padded to
  // the configured length. scripts/set-auth-templates.mjs sets the length to 6.
  const OTP_LENGTHS = [8, 6];
  const verifyCode = useCallback(async (email, token, type = "email") => {
    const em = String(email || "").trim().toLowerCase();
    const raw = String(token || "").replace(/\D/g, "");
    const tokens = [raw, ...OTP_LENGTHS.filter((n) => raw.length < n).map((n) => raw.padStart(n, "0"))];
    const types = [type, type === "signup" ? "email" : "signup"];
    let firstError = null;
    for (const tk of tokens) {
      for (const ty of types) {
        const { data, error } = await supabase.auth.verifyOtp({ email: em, token: tk, type: ty });
        if (!error) return data;
        firstError = firstError || error;
      }
    }
    throw firstError;
  }, []);

  // Persist the signup form basics onto the profile row. identity.profiles has
  // an own-row UPDATE policy, so this writes only the caller's row. Best-effort
  // — never blocks the sign-in.
  const saveProfileBasics = useCallback(async (fields) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;
      await supabase.from("profiles").update(fields).eq("id", uid);
      const fresh = await fetchProfile(uid);
      setProfile(fresh);
    } catch (err) { console.warn("[Auth] profile basics save failed:", err?.message); }
  }, []);

  // Upload a profile picture to the `avatars` storage bucket, then persist its
  // public URL on profiles.avatar_url. Returns { url } on success or { error }.
  const uploadAvatar = useCallback(async (file) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return { error: "You're not signed in." };
      if (!file) return { error: "No file selected." };
      if (!/^image\//.test(file.type)) return { error: "Please choose an image file." };
      if (file.size > 5 * 1024 * 1024) return { error: "Image must be under 5 MB." };

      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${uid}.${ext || "png"}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) return { error: upErr.message };

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so a re-upload to the same path shows immediately.
      const url = pub?.publicUrl ? `${pub.publicUrl}?t=${Date.now()}` : null;

      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
      if (dbErr) return { error: dbErr.message };

      const fresh = await fetchProfile(uid);
      setProfile(fresh);
      return { url };
    } catch (err) {
      return { error: err?.message || "Upload failed." };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Email preferences — flip the digest subscription on/off. Returns true on
  // success, false on failure. UI shows optimistic state while this runs.
  const setEmailSubscribed = useCallback(async (subscribed) => {
    if (!user) return false;
    const { error } = await supabase
      .from("profiles")
      .update({ email_subscribed: !!subscribed })
      .eq("id", user.id);
    if (error) {
      console.warn("[Auth] email subscription update failed:", error.message);
      return false;
    }
    // Refresh local profile state so the AccountChip reflects the new value
    const fresh = await fetchProfile(user.id);
    setProfile(fresh);
    return true;
  }, [user]);

  // Subscriber self-service: flips profiles.tier free <-> enterprise through
  // set_own_subscription() (supabase/migrations/20260921_set_own_subscription.sql).
  // Returns the resulting tier, or throws with a readable message.
  const setSubscribed = useCallback(async (on) => {
    if (!user) throw new Error("Sign in first.");
    // Through the API when VITE_API_URL is set; the SQL function directly
    // otherwise, or when the API cannot be reached.
    let data = null;
    try { data = await setSubscription(!!on); }
    catch (e) { if (e && e.status) throw new Error(e.message); }
    if (data == null) {
      const res = await supabase.rpc("set_own_subscription", { p_on: !!on });
      if (res.error) {
        if (/set_own_subscription|not find the function|42883/i.test(res.error.message)) {
          throw new Error("Subscribe is not switched on in the database yet. Owner: run supabase/migrations/20260921_set_own_subscription.sql once in the Supabase SQL editor.");
        }
        throw res.error;
      }
      data = res.data;
    }
    const fresh = await fetchProfile(user.id);
    setProfile(fresh);
    return data;
  }, [user]);

  // Re-pull the profile row — used after the onboarding wizard saves, so the
  // app immediately stops showing the wizard and reflects the new preferences.
  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const fresh = await fetchProfile(user.id);
    setProfile(fresh);
    return fresh;
  }, [user]);

  // Tier resolution: preview > profile.tier > 'free' (signed-in default) > 'public'.
  const previewTier = getPreviewTier();
  let tier = "public";
  if (previewTier) tier = previewTier;
  else if (user) tier = profile?.tier || "free";

  return (
    <AuthContext.Provider value={{ user, tier, subscriber: isSubscriber(tier), loading, signIn, directSignIn, signInWithProvider, signUpWithPassword, signInWithPassword, verifyCode, saveProfileBasics, uploadAvatar, signOut, profile, setEmailSubscribed, setSubscribed, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
