// ─────────────────────────────────────────────────────────────────────────
// AuthProvider — single source of truth for the current user's identity
// and access tier. Wraps the entire app in main.jsx.
//
// Exposes via useAuth():
//   • user      — Supabase auth user object, or null
//   • tier      — 'public' | 'free' | 'partner' | 'admin'
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

const AuthContext = createContext({
  user: null,
  tier: "public",
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

// Honour ?preview=partner / ?preview=free / ?preview=public for dev testing.
function getPreviewTier() {
  if (typeof window === "undefined") return null;
  try {
    const p = new URLSearchParams(window.location.search).get("preview");
    if (p === "public" || p === "free" || p === "partner" || p === "admin") return p;
  } catch { /* noop */ }
  return null;
}

async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("tier, company, role, approved_at, email_subscribed, unsubscribe_token, full_name, industry, country, company_size, watch_industries, watch_categories, digest_frequency, onboarded_at, avatar_url")
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

  // Passwordless fallback — email a 6-digit code (no magic link, no redirect →
  // immune to the Site-URL / link-prefetch problems that broke the old flow).
  const signIn = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: String(email || "").trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }, []);

  // Create an account with a password (McKinsey-style signup). The form fields
  // ride along as user metadata; the basics are copied to `profiles` after the
  // email code is verified. Supabase then emails a 6-digit "Confirm signup" code.
  const signUpWithPassword = useCallback(async (email, password, meta = {}) => {
    const { error } = await supabase.auth.signUp({
      email: String(email || "").trim().toLowerCase(),
      password,
      options: { data: meta },
    });
    if (error) throw error;
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
  const verifyCode = useCallback(async (email, token, type = "email") => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: String(email || "").trim().toLowerCase(),
      token: String(token || "").replace(/\D/g, ""),
      type,
    });
    if (error) throw error;
    return data;
  }, []);

  // Persist the signup form basics onto the profile row (RLS disabled on this
  // project). Best-effort — never blocks the sign-in.
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
    <AuthContext.Provider value={{ user, tier, loading, signIn, signUpWithPassword, signInWithPassword, verifyCode, saveProfileBasics, uploadAvatar, signOut, profile, setEmailSubscribed, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
