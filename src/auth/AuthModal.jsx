// ─────────────────────────────────────────────────────────────────────────
// AuthModal — McKinsey-style "Create an account" flow (LIGHT / white theme).
//
//   signup  → email, name, job title, company, industry, consent, "I'm not a
//             robot" → signInWithOtp (no password: the emailed code IS the
//             proof). Kept to what the product personalises on.
//   code    → "Enter your code" → 6-digit email code → verifyOtp(type email).
//   signin  → returning user: email → code (password only as an option, for
//             accounts that set one before 2026-09-22).
//   social  → Continue with Google / LinkedIn / GitHub / Microsoft on both
//             screens (Supabase OAuth; providers enabled in the dashboard).
//
// The 6-digit code is emailed via Supabase's "Confirm signup" / "Magic Link"
// templates — both must include {{ .Token }} (see supabase_email_templates/
// otp_code.html). No magic link / redirect, so it sidesteps the Site-URL bug.
//
// NOTE: the "I'm not a robot" checkbox is a client-side gate matching the
// reference; real bot protection needs Supabase Auth captcha config.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { SECTORS, ROLES } from "../lib/taxonomy";

// Light / paper palette — white + ink + strong gold brand accent.
const C = {
  paper: "#FFFFFF",
  paper2: "#FBFAF6",
  ink: "#101010",
  ink2: "#3A3A3A",
  ink3: "#6A6A6A",
  ink4: "#9A9A98",
  line: "#E7E5DE",
  line2: "#CFCDC4",
  gold: "#F5B800",
  goldDeep: "#8A6D00", // text-safe gold on white
  err: "#C0341D",
  ok: "#1E7A3D",
};

// Job titles come from src/lib/taxonomy.js (ROLES) so the dashboard, the
// alerts page and the profile all show the same strings.


// Field MUST be defined at module scope. If it lives inside AuthModal it is a
// brand-new component type on every keystroke, so React unmounts/remounts the
// inputs each render and they lose focus after a single character (the
// "can't type in the password box" bug).
const Field = ({ children }) => <div style={{ marginBottom: 10 }}>{children}</div>;

// Supabase provider id, label, brand mark. Which of these are SHOWN comes from
// VITE_AUTH_PROVIDERS (comma-separated ids, e.g. "google,linkedin_oidc"); unset
// shows all four. A provider that is not switched on in Supabase
// (Authentication → Providers) sends the reader to a raw "provider is not
// enabled" page, so list only the ones that are.
const ALL_PROVIDERS = [
  ["google", "Google", '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.4-4.7 7.1l7.3 5.7c4.3-3.9 7.2-9.8 7.2-16.8z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2.1 1.4-4.9 2.3-8.6 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>'],
  ["linkedin_oidc", "LinkedIn", '<svg viewBox="0 0 24 24" width="18" height="18"><rect width="24" height="24" rx="3" fill="#0A66C2"/><path fill="#fff" d="M7.1 9.5H4.6V19h2.5V9.5zM5.9 5.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM19.4 13.2c0-2.9-1.5-4.1-3.6-4.1-1.5 0-2.3.8-2.7 1.4V9.5h-2.5V19h2.5v-4.7c0-1.3.3-2.5 1.8-2.5 1.5 0 1.6 1.4 1.6 2.6V19h2.9v-5.8z"/></svg>'],
  ["github", "GitHub", '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#181717" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>'],
  ["azure", "Microsoft", '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="2" width="9" height="9" fill="#F25022"/><rect x="13" y="2" width="9" height="9" fill="#7FBA00"/><rect x="2" y="13" width="9" height="9" fill="#00A4EF"/><rect x="13" y="13" width="9" height="9" fill="#FFB900"/></svg>'],
];
const ENABLED = String((typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_AUTH_PROVIDERS) || "").split(",").map((s) => s.trim()).filter(Boolean);
const PROVIDERS = ENABLED.length ? ALL_PROVIDERS.filter(([id]) => ENABLED.includes(id)) : ALL_PROVIDERS;

// intent="subscribe": the reader pressed Subscribe while signed out. Once the
// session exists we send them back to the subscription page with
// ?activate=subscriber, which finishes the switch for them.
export function AuthModal({ open, onClose, intent = null }) {
  const { signInWithPassword, signIn, signInWithProvider, verifyCode, saveProfileBasics } = useAuth();

  const [view, setView] = useState("signup"); // "signup" | "signin" | "code"
  const [from, setFrom] = useState("signup");  // which screen sent the code
  const [usePw, setUsePw] = useState(false);   // sign-in: password instead of a code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [resent, setResent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [consent, setConsent] = useState(false);
  const [robot, setRobot] = useState(false);
  const [code, setCode] = useState("");

  if (!open) return null;

  const cleanEmail = email.trim().toLowerCase();
  // Accept whatever length the Supabase email-OTP is configured to (6–10).
  const codeReady = (() => { const n = code.replace(/\D/g, "").length; return n >= 6 && n <= 10; })();

  // What we copy from the registration form onto profiles after the account
  // exists. industry is the string the dashboard and the daily brief key on.
  function profileFields() {
    return {
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || null,
      role: jobTitle || null,
      company: company.trim() || null,
      industry: industry || null,
    };
  }

  function close(signedIn = false) {
    setView("signup"); setError(null); setResent(false); setCode("");
    if (signedIn && intent === "subscribe") { window.location.href = "/?subscribe&activate=subscriber"; return; }
    onClose();
  }

  // Sign-up: no password. The form rides along as user metadata, Supabase
  // creates the account and emails the code; the code IS the verification.
  // An address that already has an account simply gets a sign-in code.
  async function submitSignup(e) {
    e?.preventDefault();
    setError(null);
    if (!industry) { setError("Please choose your industry — it decides what your dashboard and daily brief lead with."); return; }
    if (!robot) { setError("Please confirm you're not a robot."); return; }
    setBusy(true);
    try {
      const full_name = `${firstName.trim()} ${lastName.trim()}`.trim();
      await signIn(cleanEmail, {
        first_name: firstName.trim(), last_name: lastName.trim(), full_name,
        job_title: jobTitle, company: company.trim(), industry, marketing_opt_in: consent,
      });
      setFrom("signup"); setCode(""); setResent(false); setView("code");
    } catch (err) {
      setError(err?.message || "Could not send the code.");
    } finally { setBusy(false); }
  }

  // Sign-in: email → code by default; a password only for accounts that set one.
  async function submitSignin(e) {
    e?.preventDefault();
    setError(null); setBusy(true);
    try {
      if (usePw) { await signInWithPassword(cleanEmail, password); close(true); return; }
      await signIn(cleanEmail); setFrom("signin"); setCode(""); setResent(false); setView("code");
    }
    catch (err) { setError(err?.message || (usePw ? "Wrong email or password." : "Could not email a code.")); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError(null); setResent(false); setBusy(true);
    try { await signIn(cleanEmail); setResent(true); }
    catch (err) { setError(err?.message || "Could not resend the code."); }
    finally { setBusy(false); }
  }

  async function submitCode(e) {
    e?.preventDefault();
    if (!codeReady) return;
    setError(null); setBusy(true);
    try {
      await verifyCode(cleanEmail, code, "email");
      if (from === "signup") await saveProfileBasics(profileFields());
      close(true); // session set; app re-renders signed in and lands on the dashboard
    } catch (err) {
      setError(err?.message || "That code didn't work — check it and try again.");
    } finally { setBusy(false); }
  }

  // Social sign-in. Comes back to the dashboard, or to the subscription page
  // when the reader pressed Subscribe first.
  async function social(provider, label) {
    setError(null); setBusy(true);
    try {
      const back = `${window.location.origin}/${intent === "subscribe" ? "?subscribe&activate=subscriber" : "?dashboard"}`;
      await signInWithProvider(provider, back);
      // the browser is now leaving for the provider; nothing more to do here
    } catch (err) {
      const m = err?.message || "";
      setError(/not enabled|unsupported provider/i.test(m) ? `${label} sign-in is not switched on yet.` : (m || `Could not continue with ${label}.`));
      setBusy(false);
    }
  }

  // ── shared styles (light) ──
  const label = { display: "block", fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.ink, fontWeight: 600, marginBottom: 4 };
  const sub = { fontSize: 11, color: C.ink4, fontWeight: 400, marginLeft: 6 };
  const field = {
    width: "100%", padding: "9px 12px", background: C.paper, color: C.ink,
    border: `1px solid ${C.line2}`, borderRadius: 4, boxSizing: "border-box",
    fontFamily: "Inter, sans-serif", fontSize: 13.5, outline: "none",
  };
  const sel = { ...field, appearance: "none", cursor: "pointer" };
  const opt = { color: C.ink, background: C.paper };
  const goldBtn = (disabled) => ({
    width: "100%", padding: "12px 16px",
    background: disabled ? "rgba(245,184,0,0.55)" : C.gold, color: "#1A1A1A",
    border: "none", borderRadius: 4, fontFamily: "Inter, sans-serif", fontSize: 13.5,
    fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
  });
  const linkBtn = { background: "none", border: "none", color: C.goldDeep, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" };
  const onFocus = (e) => (e.target.style.borderColor = C.gold);
  const onBlur = (e) => (e.target.style.borderColor = C.line2);

  // "Continue with …" — under the email form on both screens: an "Or" rule,
  // then the enabled providers.
  const Social = () => PROVIDERS.length === 0 ? null : (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 10px", color: C.ink3, fontSize: 11.5, fontFamily: "Inter, sans-serif" }}>
        <span style={{ flex: 1, height: 1, background: C.line }} />Or continue with<span style={{ flex: 1, height: 1, background: C.line }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {PROVIDERS.map(([id, label, icon]) => (
          <button key={id} type="button" disabled={busy} onClick={() => social(id, label)} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minWidth: 0,
            padding: "9px 8px", background: C.paper, color: C.ink, border: `1px solid ${C.line2}`, borderRadius: 4,
            fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap",
          }}><span style={{ width: 16, height: 16, display: "inline-flex", flex: "none" }} dangerouslySetInnerHTML={{ __html: icon }} />Continue with {label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div onClick={close} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,15,15,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: "3vh 18px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(500px, 100%)", background: C.paper,
        border: `1px solid ${C.line}`, borderRadius: 10,
        padding: "20px 24px 22px", boxShadow: "0 24px 70px rgba(16,16,16,0.28)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.goldDeep, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
            Attacked.ai™ · Intelligence Inbox
          </div>
          <button onClick={close} aria-label="Close" style={{ background: "none", border: "none", color: C.ink3, fontSize: 18, cursor: "pointer", padding: 4 }}>×</button>
        </div>

        {/* ───────── SIGN UP ───────── */}
        {view === "signup" && (
          <>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 22, color: C.ink, lineHeight: 1.2, marginTop: 8, letterSpacing: "-0.015em" }}>Create an account</h2>
            <p style={{ marginTop: 6, marginBottom: 14, fontSize: 12.5, color: C.ink3, fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
              Already have an account?{" "}
              <button type="button" onClick={() => { setView("signin"); setError(null); }} style={linkBtn}>Sign in</button>
            </p>

            <form onSubmit={submitSignup}>
              <Field>
                <label style={label}>Email <span style={sub}>Work email preferred</span></label>
                <input type="email" required autoFocus placeholder="you@company.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); error && setError(null); }} style={field} onFocus={onFocus} onBlur={onBlur} />
              </Field>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}><Field>
                  <label style={label}>First name</label>
                  <input type="text" required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={field} onFocus={onFocus} onBlur={onBlur} />
                </Field></div>
                <div style={{ flex: 1, minWidth: 0 }}><Field>
                  <label style={label}>Last name</label>
                  <input type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={field} onFocus={onFocus} onBlur={onBlur} />
                </Field></div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}><Field>
                  <label style={label}>Job title</label>
                  <select required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={{ ...sel, color: jobTitle ? C.ink : C.ink4 }} onFocus={onFocus} onBlur={onBlur}>
                    <option value="" disabled style={opt}>Select</option>
                    {ROLES.map(j => <option key={j} value={j} style={opt}>{j}</option>)}
                  </select>
                </Field></div>
                <div style={{ flex: 1, minWidth: 0 }}><Field>
                  <label style={label}>Company</label>
                  <input type="text" required placeholder="Your organisation" value={company} onChange={(e) => setCompany(e.target.value)} style={field} onFocus={onFocus} onBlur={onBlur} autoComplete="organization" />
                </Field></div>
              </div>

              {/* Industry decides what the dashboard and the daily brief lead
                  with, so it is required. Grouped by GICS sector, strings
                  identical to incidents.industry (src/lib/taxonomy.js).
                  Company was added back on 2026-09-21 (owner's call); it is
                  saved to profiles.company. Country stays on Profile. */}
              <Field>
                <label style={label}>Industry <span style={sub}>drives your dashboard and daily brief</span></label>
                <select required value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...sel, color: industry ? C.ink : C.ink4 }} onFocus={onFocus} onBlur={onBlur}>
                  <option value="" disabled style={opt}>Select your industry</option>
                  {SECTORS.map(([sector, list]) => (
                    <optgroup key={sector} label={sector}>
                      {list.map(i => <option key={i} value={i} style={opt}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>

              <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "2px 0 10px", cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, accentColor: C.gold }} />
                <span style={{ fontSize: 11, color: C.ink2, lineHeight: 1.45, fontFamily: "Inter, sans-serif" }}>
                  Occasional emails about Attacked.ai, including account notifications. Unsubscribe any time.
                </span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px", padding: "8px 12px", border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper2, cursor: "pointer", maxWidth: 220 }}>
                <input type="checkbox" checked={robot} onChange={(e) => setRobot(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.gold }} />
                <span style={{ fontSize: 12, color: C.ink, fontFamily: "Inter, sans-serif" }}>I'm not a robot</span>
              </label>

              {error && <div style={{ marginBottom: 12, fontSize: 12, color: C.err }}>{error}</div>}
              <button type="submit" disabled={busy} style={goldBtn(busy)}>{busy ? "Sending your code…" : "Create your account →"}</button>
            </form>
            <Social />
          </>
        )}

        {/* ───────── SIGN IN ───────── */}
        {view === "signin" && (
          <>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 22, color: C.ink, lineHeight: 1.2, marginTop: 8, letterSpacing: "-0.015em" }}>Sign in</h2>
            <p style={{ marginTop: 6, marginBottom: 14, fontSize: 12.5, color: C.ink3, fontFamily: "Inter, sans-serif" }}>
              New here?{" "}
              <button type="button" onClick={() => { setView("signup"); setError(null); }} style={linkBtn}>Create an account</button>
            </p>
            <form onSubmit={submitSignin}>
              <Field>
                <label style={label}>Email</label>
                <input type="email" required autoFocus placeholder="you@company.com" value={email} onChange={(e) => { setEmail(e.target.value); error && setError(null); }} style={field} onFocus={onFocus} onBlur={onBlur} />
              </Field>
              {usePw && <Field>
                <label style={label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} required placeholder="Your password" value={password} onChange={(e) => { setPassword(e.target.value); error && setError(null); }} style={{ ...field, paddingRight: 52 }} onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.ink3, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 4 }}>{showPw ? "Hide" : "Show"}</button>
                </div>
              </Field>}
              {error && <div style={{ marginBottom: 12, fontSize: 12, color: C.err }}>{error}</div>}
              <button type="submit" disabled={busy} style={goldBtn(busy)}>{busy ? (usePw ? "Signing in…" : "Sending your code…") : (usePw ? "Sign in" : "Email me a code →")}</button>
            </form>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, textAlign: "center" }}>
              <button type="button" onClick={() => { setUsePw(v => !v); setError(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.ink3 }}>
                {usePw ? <>Prefer a code? <span style={{ color: C.goldDeep, textDecoration: "underline", fontWeight: 600 }}>Email me a code instead</span></>
                       : <>Set a password earlier? <span style={{ color: C.goldDeep, textDecoration: "underline", fontWeight: 600 }}>Sign in with it</span></>}
              </button>
            </div>
            <Social />
          </>
        )}

        {/* ───────── CODE ───────── */}
        {view === "code" && (
          <>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 22, color: C.ink, lineHeight: 1.2, marginTop: 8, letterSpacing: "-0.015em" }}>Enter your code.</h2>
            <p style={{ marginTop: 12, marginBottom: 20, fontSize: 13.5, color: C.ink3, lineHeight: 1.55 }}>
              We emailed your code to <b style={{ color: C.ink }}>{cleanEmail}</b>. Enter it below — it expires in an hour.
              {/* Until the Magic Link template in Supabase carries {{ .Token }}, a
                  reader whose address already has an account receives a link
                  instead of a code. Say so, and make the link useful. */}
              <span style={{ display: "block", marginTop: 8, fontSize: 12, color: C.ink4 }}>Got a sign-in link instead of a code? That means this address already has an account — the link signs you in too and opens your dashboard.</span>
            </p>
            <form onSubmit={submitCode}>
              <label style={label}>Verification code</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} placeholder="••••••••"
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 10)); error && setError(null); }}
                style={{ ...field, textAlign: "center", fontSize: 24, fontWeight: 700, letterSpacing: "0.35em", padding: 14, marginBottom: 6 }} onFocus={onFocus} onBlur={onBlur} />
              {error && <div style={{ margin: "8px 0", fontSize: 12, color: C.err }}>{error}</div>}
              {resent && !error && <div style={{ margin: "8px 0", fontSize: 12, color: C.ok }}>New code sent — check your inbox.</div>}
              <div style={{ marginTop: 12 }}>
                <button type="submit" disabled={busy || !codeReady} style={goldBtn(busy || !codeReady)}>{busy ? "Verifying…" : "Continue →"}</button>
              </div>
            </form>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
              <button type="button" onClick={resend} disabled={busy} style={{ ...linkBtn, textDecoration: "none" }}>Resend code</button>
              <button type="button" onClick={() => { setView(from); setError(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: C.ink3, padding: 0 }}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
