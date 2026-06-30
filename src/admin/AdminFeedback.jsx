// ─────────────────────────────────────────────────────────────────────────
// AdminFeedback — Phase 4 of /admin.
//
// Read every partner_feedback submission. 6 product questions per row.
// Layout: one collapsible card per submission, with all 6 answers
// inline + the "anything else" notes. Filter by tier and search by text.
// ─────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from "react";
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
  { key: "q_one_thing_pay",      label: "ONE thing you'd pay for" },
  { key: "q_killer_feature",     label: "Killer feature" },
  { key: "q_free_inbox",         label: "Free inbox — enough or hook?" },
  { key: "q_report_tease_stop",  label: "Where should report tease stop" },
  { key: "q_vendor_signposting", label: "Vendor signposting — useful or ad?" },
  { key: "q_firehose_volume",    label: "10-20/day right firehose?" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function AdminFeedback() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("admin_list_feedback");
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setError(e?.message || "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(item => {
    if (!query) return true;
    const q = query.toLowerCase();
    return Object.values(item).some(v =>
      typeof v === "string" && v.toLowerCase().includes(q)
    );
  });

  // Count how many people answered each question
  const answerCounts = QUESTIONS.reduce((acc, q) => {
    acc[q.key] = items.filter(i => i[q.key] && i[q.key].trim()).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 18,
      }}>
        <h1 style={{
          fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 28,
          letterSpacing: "-0.015em", color: BRAND.white, margin: 0,
        }}>
          Feedback
          <span style={{
            marginLeft: 12, fontSize: 14, fontWeight: 600,
            color: BRAND.gold, letterSpacing: "0.06em",
          }}>{items.length} submission{items.length !== 1 ? "s" : ""}</span>
        </h1>
        <button onClick={load} style={{
          padding: "7px 14px", background: "transparent", color: BRAND.textSecondary,
          border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
        }}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 4,
          background: "rgba(255,107,107,0.08)", border: `1px solid ${BRAND.red}55`,
          color: BRAND.red, fontSize: 13,
        }}>{error}</div>
      )}

      {/* Answer-rate breakdown */}
      {items.length > 0 && (
        <div style={{
          padding: "14px 16px",
          background: BRAND.obsidianCard,
          border: `1px solid ${BRAND.borderSubtle}`,
          borderRadius: 8,
          marginBottom: 18,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: BRAND.textMuted,
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
          }}>
            Answer rate — % of {items.length} submissions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {QUESTIONS.map(q => {
              const pct = Math.round((answerCounts[q.key] / Math.max(items.length, 1)) * 100);
              return (
                <div key={q.key} style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5, color: BRAND.white, marginBottom: 4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{q.label}</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{
                      flex: 1, height: 5, background: BRAND.obsidianDeep,
                      borderRadius: 3, overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${pct}%`, height: "100%",
                        background: BRAND.gold,
                        transition: "width 200ms ease",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 10, color: BRAND.textMuted, fontWeight: 600,
                      minWidth: 30, textAlign: "right",
                    }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search answers, email, notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px",
          background: BRAND.obsidianDeep, color: BRAND.white,
          border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
          fontFamily: "Inter, sans-serif", fontSize: 13,
          marginBottom: 14, outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = BRAND.gold)}
        onBlur={(e) => (e.target.style.borderColor = BRAND.borderSubtle)}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: BRAND.textMuted }}>Loading feedback…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: BRAND.textMuted,
          background: BRAND.obsidianCard, borderRadius: 6,
          border: `1px solid ${BRAND.borderSubtle}`,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BRAND.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px", display: "block", opacity: 0.7 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.white, marginBottom: 4 }}>
            {items.length === 0 ? "No feedback yet." : "Nothing matches."}
          </div>
          <div style={{ fontSize: 13 }}>
            {items.length === 0
              ? "Submissions land here when partners use 'Share feedback' in their account menu."
              : "Try a different search term."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(item => {
            const isExp = expanded === item.id;
            const ansCount = QUESTIONS.filter(q => item[q.key] && item[q.key].trim()).length;
            return (
              <div key={item.id} style={{
                background: BRAND.obsidianCard,
                border: `1px solid ${isExp ? BRAND.borderGold : BRAND.borderSubtle}`,
                borderRadius: 8,
                overflow: "hidden",
                transition: "border-color 160ms ease",
              }}>
                {/* Header — clickable */}
                <button onClick={() => setExpanded(isExp ? null : item.id)} style={{
                  width: "100%", padding: "14px 16px",
                  background: "transparent", color: BRAND.white,
                  border: "none", cursor: "pointer", textAlign: "left",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  fontFamily: "Inter, sans-serif",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "3px 9px", borderRadius: 3,
                      background: "rgba(245,184,0,0.15)", color: BRAND.gold,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
                    }}>{(item.tier_at_submission || "—").toUpperCase()}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.email}</span>
                    <span style={{ color: BRAND.textMuted, fontSize: 11 }}>
                      · {ansCount} of {QUESTIONS.length} answered
                    </span>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: BRAND.textMuted }}>{fmtDate(item.submitted_at)}</span>
                    <span style={{
                      fontSize: 10, color: BRAND.textMuted,
                      transform: isExp ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 180ms ease",
                    }}>▸</span>
                  </span>
                </button>

                {/* Body — expanded answers */}
                {isExp && (
                  <div style={{
                    padding: "0 16px 18px",
                    borderTop: `1px solid ${BRAND.borderSubtle}`,
                  }}>
                    {QUESTIONS.map(q => {
                      const ans = item[q.key];
                      if (!ans || !ans.trim()) return null;
                      return (
                        <div key={q.key} style={{ marginTop: 14 }}>
                          <div style={{
                            fontSize: 10, fontWeight: 700, color: BRAND.gold,
                            letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6,
                          }}>{q.label}</div>
                          <div style={{
                            fontSize: 13, color: BRAND.white, lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                            padding: "10px 12px",
                            background: BRAND.obsidianDeep, borderRadius: 4,
                            borderLeft: `2px solid ${BRAND.gold}`,
                          }}>{ans}</div>
                        </div>
                      );
                    })}
                    {item.additional_notes && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: BRAND.textMuted,
                          letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 6,
                        }}>Additional notes</div>
                        <div style={{
                          fontSize: 13, color: BRAND.textSecondary, lineHeight: 1.55,
                          whiteSpace: "pre-wrap", fontStyle: "italic",
                          padding: "10px 12px",
                          background: BRAND.obsidianDeep, borderRadius: 4,
                        }}>{item.additional_notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
