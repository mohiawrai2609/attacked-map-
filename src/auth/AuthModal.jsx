// ─────────────────────────────────────────────────────────────────────────
// AuthModal — McKinsey-style "Create an account" flow (LIGHT / white theme).
//
//   signup  → full form (email, password, name, job title, function, country,
//             consent, "I'm not a robot") → Supabase signUp(password).
//   code    → "Enter your signup code" → 6-digit email code → verifyOtp.
//   signin  → returning user: email + password (+ "email me a code" fallback).
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

const JOB_TITLES = [
  "CEO / Founder", "CISO / Head of Security", "CIO / CTO",
  "Risk / Compliance Lead", "Security Analyst", "IT Manager",
  "Consultant / Advisor", "Board Member / Director", "Student", "Other",
];
const FUNCTIONS = [
  "Security", "Risk & Compliance", "IT / Engineering",
  "Executive / Leadership", "Finance", "Legal", "Operations", "Other",
];
const COUNTRIES = [
  "India", "United States", "United Kingdom", "United Arab Emirates",
  "Singapore", "Australia", "Canada", "Germany", "France", "Japan",
  "Saudi Arabia", "South Africa", "Brazil", "Other",
];

// Field MUST be defined at module scope. If it lives inside AuthModal it is a
// brand-new component type on every keystroke, so React unmounts/remounts the
// inputs each render and they lose focus after a single character (the
// "can't type in the password box" bug).
const Field = ({ children }) => <div style={{ marginBottom: 14 }}>{children}</div>;

export function AuthModal({ open, onClose }) {
  const { signUpWithPassword, signInWithPassword, signIn, verifyCode, saveProfileBasics } = useAuth();

  const [view, setView] = useState("signup"); // "signup" | "signin" | "code"
  const [codeType, setCodeType] = useState("signup"); // "signup" | "email"
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
  const [jobFunction, setJobFunction] = useState("");
  const [country, setCountry] = useState("");
  const [consent, setConsent] = useState(false);
  const [robot, setRobot] = useState(false);
  const [code, setCode] = useState("");

  if (!open) return null;

  const cleanEmail = email.trim().toLowerCase();
  // Accept whatever length the Supabase email-OTP is configured to (6–10).
  const codeReady = (() => { const n = code.replace(/\D/g, "").length; return n >= 6 && n <= 10; })();
  const pwOk = password.length >= 8;

  function close() {
    setView("signup"); setError(null); setResent(false); setCode("");
    onClose();
  }

  async function submitSignup(e) {
    e?.preventDefault();
    setError(null);
    if (!pwOk) { setError("Password must be at least 8 characters."); return; }
    if (!robot) { setError("Please confirm you're not a robot."); return; }
    setBusy(true);
    try {
      const full_name = `${firstName.trim()} ${lastName.trim()}`.trim();
      await signUpWithPassword(cleanEmail, password, {
        first_name: firstName.trim(), last_name: lastName.trim(), full_name,
        job_title: jobTitle, job_function: jobFunction, country, marketing_opt_in: consent,
      });
      setCodeType("signup"); setCode(""); setResent(false); setView("code");
    } catch (err) {
      const m = err?.message || "Could not create the account.";
      setError(/already registered/i.test(m) ? "That email already has an account — sign in instead." : m);
    } finally { setBusy(false); }
  }

  async function submitSignin(e) {
    e?.preventDefault();
    setError(null); setBusy(true);
    try { await signInWithPassword(cleanEmail, password); close(); }
    catch (err) { setError(err?.message || "Wrong email or password."); }
    finally { setBusy(false); }
  }

  async function emailMeACode() {
    setError(null); setBusy(true);
    try { await signIn(cleanEmail); setCodeType("email"); setCode(""); setResent(false); setView("code"); }
    catch (err) { setError(err?.message || "Could not email a code."); }
    finally { setBusy(false); }
  }

  async function resend() {
    setError(null); setResent(false); setBusy(true);
    try {
      if (codeType === "signup") await supabase.auth.resend({ type: "signup", email: cleanEmail });
      else await signIn(cleanEmail);
      setResent(true);
    } catch (err) { setError(err?.message || "Could not resend the code."); }
    finally { setBusy(false); }
  }

  async function submitCode(e) {
    e?.preventDefault();
    if (!codeReady) return;
    setError(null); setBusy(true);
    try {
      await verifyCode(cleanEmail, code, codeType);
      if (codeType === "signup") {
        await saveProfileBasics({
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim() || null,
          role: jobTitle || null,
          country: country || null,
        });
      }
      close(); // session set; app re-renders signed in
    } catch (err) {
      setError(err?.message || "That code didn't work — check it and try again.");
    } finally { setBusy(false); }
  }

  // ── shared styles (light) ──
  const label = { display: "block", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.ink, fontWeight: 600, marginBottom: 6 };
  const sub = { fontSize: 11, color: C.ink4, fontWeight: 400, marginLeft: 6 };
  const field = {
    width: "100%", padding: "11px 13px", background: C.paper, color: C.ink,
    border: `1px solid ${C.line2}`, borderRadius: 4, boxSizing: "border-box",
    fontFamily: "Inter, sans-serif", fontSize: 14, outline: "none",
  };
  const sel = { ...field, appearance: "none", cursor: "pointer" };
  const opt = { color: C.ink, background: C.paper };
  const goldBtn = (disabled) => ({
    width: "100%", padding: "13px 16px",
    background: disabled ? "rgba(245,184,0,0.55)" : C.gold, color: "#1A1A1A",
    border: "none", borderRadius: 4, fontFamily: "Inter, sans-serif", fontSize: 13.5,
    fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
  });
  const linkBtn = { background: "none", border: "none", color: C.goldDeep, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, padding: 0, textDecoration: "underline" };
  const onFocus = (e) => (e.target.style.borderColor = C.gold);
  const onBlur = (e) => (e.target.style.borderColor = C.line2);

  return (
    <div onClick={close} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,15,15,0.55)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: "5vh 18px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(480px, 100%)", background: C.paper,
        border: `1px solid ${C.line}`, borderRadius: 10,
        padding: "26px 26px 28px", boxShadow: "0 24px 70px rgba(16,16,16,0.28)",
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
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 26, color: C.ink, lineHeight: 1.2, marginTop: 12, letterSpacing: "-0.015em" }}>Create an account</h2>
            <p style={{ marginTop: 8, marginBottom: 20, fontSize: 13, color: C.ink3 }}>
              Already have an account?{" "}
              <button type="button" onClick={() => { setView("signin"); setError(null); }} style={linkBtn}>Sign in</button>
            </p>

            <form onSubmit={submitSignup}>
              <Field>
                <label style={label}>Email <span style={sub}>Work email preferred</span></label>
                <input type="email" required autoFocus placeholder="you@company.com" value={email}
                  onChange={(e) => { setEmail(e.target.value); error && setError(null); }} style={field} onFocus={onFocus} onBlur={onBlur} />
              </Field>

              <Field>
                <label style={label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} required placeholder="At least 8 characters" value={password}
                    onChange={(e) => { setPassword(e.target.value); error && setError(null); }}
                    style={{ ...field, paddingRight: 52 }} onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password"
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.ink3, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 4 }}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>

              <div style={{ display: "flex", gap: 12 }}>
                <Field><div style={{ flex: 1 }}>
                  <label style={label}>First name</label>
                  <input type="text" required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={field} onFocus={onFocus} onBlur={onBlur} />
                </div></Field>
                <Field><div style={{ flex: 1 }}>
                  <label style={label}>Last name</label>
                  <input type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={field} onFocus={onFocus} onBlur={onBlur} />
                </div></Field>
              </div>

              <Field>
                <label style={label}>Job title</label>
                <select required value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={{ ...sel, color: jobTitle ? C.ink : C.ink4 }} onFocus={onFocus} onBlur={onBlur}>
                  <option value="" disabled style={opt}>Select your job title</option>
                  {JOB_TITLES.map(j => <option key={j} value={j} style={opt}>{j}</option>)}
                </select>
              </Field>

              <div style={{ display: "flex", gap: 12 }}>
                <Field><div style={{ flex: 1 }}>
                  <label style={label}>Function</label>
                  <select required value={jobFunction} onChange={(e) => setJobFunction(e.target.value)} style={{ ...sel, color: jobFunction ? C.ink : C.ink4 }} onFocus={onFocus} onBlur={onBlur}>
                    <option value="" disabled style={opt}>Select your function</option>
                    {FUNCTIONS.map(f => <option key={f} value={f} style={opt}>{f}</option>)}
                  </select>
                </div></Field>
                <Field><div style={{ flex: 1 }}>
                  <label style={label}>Country</label>
                  <select required value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...sel, color: country ? C.ink : C.ink4 }} onFocus={onFocus} onBlur={onBlur}>
                    <option value="" disabled style={opt}>Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c} style={opt}>{c}</option>)}
                  </select>
                </div></Field>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "6px 0 14px", cursor: "pointer" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, accentColor: C.gold }} />
                <span style={{ fontSize: 11.5, color: C.ink2, lineHeight: 1.5 }}>
                  Receive occasional informational emails about Attacked.ai, including account notifications and updates. You can unsubscribe at any time.
                </span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 16px", padding: "12px 14px", border: `1px solid ${C.line2}`, borderRadius: 4, background: C.paper2, cursor: "pointer", maxWidth: 220 }}>
                <input type="checkbox" checked={robot} onChange={(e) => setRobot(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.gold }} />
                <span style={{ fontSize: 12.5, color: C.ink }}>I'm not a robot</span>
              </label>

              {error && <div style={{ marginBottom: 12, fontSize: 12, color: C.err }}>{error}</div>}
              <button type="submit" disabled={busy} style={goldBtn(busy)}>{busy ? "Creating…" : "Create your account"}</button>
            </form>
          </>
        )}

        {/* ───────── SIGN IN ───────── */}
        {view === "signin" && (
          <>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 26, color: C.ink, lineHeight: 1.2, marginTop: 12, letterSpacing: "-0.015em" }}>Sign in</h2>
            <p style={{ marginTop: 8, marginBottom: 20, fontSize: 13, color: C.ink3 }}>
              New here?{" "}
              <button type="button" onClick={() => { setView("signup"); setError(null); }} style={linkBtn}>Create an account</button>
            </p>
            <form onSubmit={submitSignin}>
              <Field>
                <label style={label}>Email</label>
                <input type="email" required autoFocus placeholder="you@company.com" value={email} onChange={(e) => { setEmail(e.target.value); error && setError(null); }} style={field} onFocus={onFocus} onBlur={onBlur} />
              </Field>
              <Field>
                <label style={label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} required placeholder="Your password" value={password} onChange={(e) => { setPassword(e.target.value); error && setError(null); }} style={{ ...field, paddingRight: 52 }} onFocus={onFocus} onBlur={onBlur} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.ink3, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 4 }}>{showPw ? "Hide" : "Show"}</button>
                </div>
              </Field>
              {error && <div style={{ marginBottom: 12, fontSize: 12, color: C.err }}>{error}</div>}
              <button type="submit" disabled={busy} style={goldBtn(busy)}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, textAlign: "center" }}>
              <button type="button" onClick={emailMeACode} disabled={busy || !email} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, color: C.ink3, padding: 0 }}>
                Forgot password? <span style={{ color: C.goldDeep, textDecoration: "underline", fontWeight: 600 }}>Email me a login code instead</span>
              </button>
            </div>
          </>
        )}

        {/* ───────── CODE ───────── */}
        {view === "code" && (
          <>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 26, color: C.ink, lineHeight: 1.2, marginTop: 12, letterSpacing: "-0.015em" }}>Enter your code.</h2>
            <p style={{ marginTop: 12, marginBottom: 20, fontSize: 13.5, color: C.ink3, lineHeight: 1.55 }}>
              We emailed your code to <b style={{ color: C.ink }}>{cleanEmail}</b>. Enter it below — it expires in an hour.
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
              <button type="button" onClick={() => { setView(codeType === "signup" ? "signup" : "signin"); setError(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: C.ink3, padding: 0 }}>Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
