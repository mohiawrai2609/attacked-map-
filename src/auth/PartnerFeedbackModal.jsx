// ─────────────────────────────────────────────────────────────────────────
// PartnerFeedbackModal — the 6 questions from access_model_v2 §7.
//
// Triggered from AccountChip when a partner/admin clicks "Share feedback".
// Submits into partner_feedback table. Light validation, optimistic UX.
//
// Partners can submit multiple times — we store every submission so we can
// see how thinking evolves across the design-partner cohort.
// ─────────────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthProvider";
import { supabase } from "../lib/supabaseClient";

const BRAND = {
  gold: "#F5B800",
  obsidian: "#1A1A1A",
  obsidianDeep: "#080808",
  obsidianCard: "#242424",
  white: "#FFFFFF",
  textSecondary: "#A8A8A8",
  textMuted: "#585858",
  borderSubtle: "#333333",
  borderGold: "rgba(245,184,0,0.3)",
  green: "#34C759",
  red: "#FF6B6B",
};

const QUESTIONS = [
  { key: "q_one_thing_pay",
    label: "Of everything gated, what's the ONE thing you'd actually pay for?",
    hint: "The single feature that crosses the line from 'nice to have' to 'budget for it.'" },
  { key: "q_killer_feature",
    label: "Killer feature — named blast radius, or adaptive controls?",
    hint: "Or something else? Tell us why." },
  { key: "q_free_inbox",
    label: "Does the free inbox make you want the full version — or is it enough on its own?",
    hint: "This is the cannibalisation question. Be honest." },
  { key: "q_report_tease_stop",
    label: "Where should the report tease stop before it gives the product away?",
    hint: "What's the last thing we can show before it starts being the product?" },
  { key: "q_vendor_signposting",
    label: "Vendors named openly — useful signposting, or feels like advertising?",
    hint: "This is the tone line we have to walk. Your read matters." },
  { key: "q_firehose_volume",
    label: "Is 10–20 incidents/day the right firehose, or should it filter to your sector?",
    hint: "Volume vs relevance. Where's the right balance for you?" },
];

export function PartnerFeedbackModal({ open, onClose }) {
  const { user, profile, tier } = useAuth();
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  function update(key, val) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    // At least one question must be answered
    const anyFilled = Object.values(answers).some((v) => v && v.trim().length > 0) || notes.trim().length > 0;
    if (!anyFilled) {
      setError("Tell us at least one thing — even one answer helps.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: user?.id,
        email: user?.email,
        tier_at_submission: tier,
        additional_notes: notes.trim() || null,
        ...QUESTIONS.reduce((acc, q) => {
          const v = (answers[q.key] || "").trim();
          acc[q.key] = v.length > 0 ? v : null;
          return acc;
        }, {}),
      };
      const { error: insertErr } = await supabase
        .from("partner_feedback")
        .insert(payload);
      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 2147483647,
        background: "rgba(8,8,8,0.85)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: 24, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 100%)",
          background: BRAND.obsidianCard,
          border: `1px solid ${BRAND.borderGold}`,
          borderRadius: 8,
          padding: "32px 32px 28px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          margin: "32px auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 11, color: BRAND.gold,
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
          }}>
            🤝 Design Partner · Feedback
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: BRAND.textSecondary,
            fontSize: 20, cursor: "pointer", padding: 4,
          }}>×</button>
        </div>

        {submitted ? (
          <>
            <h2 style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 32,
              color: BRAND.white, lineHeight: 1.15, marginTop: 14, letterSpacing: "-0.01em",
            }}>Thanks — that's gold.</h2>
            <p style={{ marginTop: 14, fontSize: 14, color: BRAND.textSecondary, lineHeight: 1.6 }}>
              Your feedback is in. We read every word — partner input directly drives what we
              build next quarter. Expect to see your thinking reflected in the next module
              release.
            </p>
            <p style={{ marginTop: 12, fontSize: 12.5, color: BRAND.textMuted, lineHeight: 1.5 }}>
              You can come back and submit again any time as your thinking evolves. We track
              the history.
            </p>
            <button onClick={onClose} style={{
              marginTop: 22, width: "100%", padding: "12px 16px",
              background: BRAND.gold, color: BRAND.obsidian,
              border: "none", borderRadius: 4,
              fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}>Close</button>
          </>
        ) : (
          <>
            <h2 style={{
              fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 30,
              color: BRAND.white, lineHeight: 1.15, marginTop: 14, letterSpacing: "-0.01em",
            }}>
              What you tell us shapes what we build.
            </h2>
            <p style={{ marginTop: 12, fontSize: 13.5, color: BRAND.textSecondary, lineHeight: 1.6 }}>
              Six questions. Answer any — leave blank if you don't have a view yet.
              {profile?.company && (
                <> Signed in as <b style={{ color: BRAND.white }}>{user?.email}</b>
                  {profile.company && <> · {profile.company}</>}
                  {profile.role && <> · {profile.role}</>}.
                </>
              )}
            </p>

            <form onSubmit={onSubmit} style={{ marginTop: 22 }}>
              {QUESTIONS.map((q, idx) => (
                <div key={q.key} style={{ marginBottom: 20 }}>
                  <label style={{
                    display: "block",
                    fontSize: 13.5, color: BRAND.white, fontWeight: 600,
                    lineHeight: 1.45,
                  }}>
                    <span style={{
                      color: BRAND.gold, fontFamily: "Inter, sans-serif",
                      fontSize: 12, marginRight: 8, fontWeight: 700,
                    }}>{String(idx + 1).padStart(2, "0")}</span>
                    {q.label}
                  </label>
                  {q.hint && (
                    <div style={{ marginTop: 4, fontSize: 11.5, color: BRAND.textMuted, fontStyle: "italic" }}>
                      {q.hint}
                    </div>
                  )}
                  <textarea
                    rows={2}
                    value={answers[q.key] || ""}
                    onChange={(e) => update(q.key, e.target.value)}
                    style={{
                      marginTop: 8, width: "100%", padding: "10px 12px",
                      background: BRAND.obsidianDeep, color: BRAND.white,
                      border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
                      fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.5,
                      outline: "none", resize: "vertical",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)}
                  />
                </div>
              ))}

              <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${BRAND.borderSubtle}` }}>
                <label style={{
                  display: "block", fontFamily: "Inter, sans-serif", fontSize: 11,
                  color: BRAND.textMuted, letterSpacing: "0.10em", textTransform: "uppercase",
                  marginBottom: 6, fontWeight: 600,
                }}>
                  Anything else
                </label>
                <textarea
                  rows={3}
                  placeholder="Anything not covered above. Feature requests, bugs, pricing thoughts, anything."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: BRAND.obsidianDeep, color: BRAND.white,
                    border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
                    fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.5,
                    outline: "none", resize: "vertical",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
                  onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)}
                />
              </div>

              {error && (
                <div style={{ marginTop: 14, fontSize: 12, color: BRAND.red }}>{error}</div>
              )}

              <button type="submit" disabled={submitting} style={{
                marginTop: 22, width: "100%", padding: "13px 16px",
                background: submitting ? "rgba(245,184,0,0.4)" : BRAND.gold,
                color: BRAND.obsidian, border: "none", borderRadius: 4,
                fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                cursor: submitting ? "wait" : "pointer",
              }}>
                {submitting ? "Sending…" : "Send feedback →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
