// ─────────────────────────────────────────────────────────────────────────
// AdminUsers — Phase 2 of /admin.
//
// List every signed-in user with tier + meta. Admin can change tier via
// dropdown (calls admin_set_user_tier RPC). Self-demotion allowed but
// warns first to prevent locking out the only admin.
//
// Data comes from admin_list_users() SECURITY DEFINER view-function so
// the UI never needs direct auth.users access.
// ─────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";

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

const TIER_OPTIONS = [
  { v: "free",       label: "FREE",       color: "#4FC3D7" },
  { v: "partner",    label: "PARTNER",    color: "#F5B800" },
  { v: "enterprise", label: "ENTERPRISE", color: "#9D7BEC" },
  { v: "vendor",     label: "VENDOR",      color: "#34C759" },
  { v: "admin",      label: "ADMIN",       color: "#9D7BEC" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch { return iso; }
}

function fmtRel(iso) {
  if (!iso) return "never";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)        return "just now";
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
}

export function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      setError(e?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeTier(userId, newTier, email, currentTier) {
    if (newTier === currentTier) return;
    // Soft guard: demoting yourself from admin → confirm
    if (userId === me?.id && currentTier === "admin" && newTier !== "admin") {
      const ok = window.confirm(
        "You are about to demote YOURSELF from admin. You will lose access to /admin immediately. Continue?"
      );
      if (!ok) return;
    }
    // Soft guard: only-admin demotion → block (count admins)
    if (currentTier === "admin" && newTier !== "admin") {
      const adminCount = users.filter(u => u.tier === "admin").length;
      if (adminCount <= 1) {
        const ok = window.confirm(
          "This is the LAST admin account. Demoting will lock the team out of /admin. Continue anyway?"
        );
        if (!ok) return;
      }
    }
    setBusy(userId);
    try {
      const { error } = await supabase.rpc("admin_set_user_tier", {
        p_user_id: userId,
        p_new_tier: newTier,
      });
      if (error) throw error;
      setToast({ tone: "ok", text: `${email} → ${newTier.toUpperCase()}` });
      await load();
    } catch (e) {
      setToast({ tone: "err", text: e?.message || "Tier change failed." });
    } finally {
      setBusy(null);
    }
  }

  const filtered = users.filter(u => {
    if (tierFilter !== "all" && u.tier !== tierFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${u.email || ""} ${u.company || ""} ${u.role || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tierCounts = TIER_OPTIONS.reduce((acc, t) => {
    acc[t.v] = users.filter(u => u.tier === t.v).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 14, flexWrap: "wrap", gap: 12,
      }}>
        <h1 style={{
          fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 28,
          letterSpacing: "-0.015em", color: BRAND.white, margin: 0,
        }}>
          Users
          <span style={{
            marginLeft: 12, fontSize: 14, fontWeight: 600,
            color: BRAND.gold, letterSpacing: "0.06em",
          }}>{users.length} total</span>
        </h1>
        <button onClick={load} style={{
          padding: "7px 14px", background: "transparent", color: BRAND.textSecondary,
          border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 4,
          fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
        }}>↻ Refresh</button>
      </div>

      {/* Tier breakdown pills */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14,
      }}>
        <button onClick={() => setTierFilter("all")} style={pillStyle(tierFilter === "all", BRAND.white)}>
          All {users.length}
        </button>
        {TIER_OPTIONS.map(t => (
          <button key={t.v} onClick={() => setTierFilter(t.v)} style={pillStyle(tierFilter === t.v, t.color)}>
            {t.label} {tierCounts[t.v] || 0}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by email, company, role…"
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

      {/* Toast */}
      {toast && (
        <div style={{
          marginBottom: 12, padding: "10px 14px", borderRadius: 4,
          background: toast.tone === "ok" ? "rgba(52,199,89,0.08)" : "rgba(255,107,107,0.08)",
          border: `1px solid ${toast.tone === "ok" ? BRAND.green : BRAND.red}55`,
          color: toast.tone === "ok" ? BRAND.green : BRAND.red,
          fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} style={{
            background: "none", border: "none", color: "inherit",
            cursor: "pointer", fontSize: 16, padding: 0,
          }}>×</button>
        </div>
      )}

      {error && (
        <div style={{
          padding: 14, marginBottom: 14, borderRadius: 4,
          background: "rgba(255,107,107,0.08)", border: `1px solid ${BRAND.red}55`,
          color: BRAND.red, fontSize: 13,
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: BRAND.textMuted }}>Loading users…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center", color: BRAND.textMuted,
          background: BRAND.obsidianCard, borderRadius: 6,
          border: `1px solid ${BRAND.borderSubtle}`,
        }}>
          No users match the filter.
        </div>
      ) : (
        <div className="r-tablewrap" style={{
          background: BRAND.obsidianCard,
          border: `1px solid ${BRAND.borderSubtle}`,
          borderRadius: 6, overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 2fr) 110px minmax(140px, 1fr) 120px 160px",
            gap: 12, padding: "12px 18px",
            background: BRAND.obsidian,
            borderBottom: `1px solid ${BRAND.borderSubtle}`,
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            color: BRAND.textMuted, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            <div>User</div>
            <div>Tier</div>
            <div>Company / Role</div>
            <div>Joined</div>
            <div>Change tier</div>
          </div>

          {/* Rows */}
          {filtered.map(u => {
            const isMe = u.id === me?.id;
            const tierMeta = TIER_OPTIONS.find(t => t.v === u.tier) || { label: u.tier?.toUpperCase() || "—", color: BRAND.textMuted };
            const isBusy = busy === u.id;
            return (
              <div key={u.id} style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 2fr) 110px minmax(140px, 1fr) 120px 160px",
                gap: 12, padding: "14px 18px",
                borderBottom: `1px solid ${BRAND.borderSubtle}`,
                alignItems: "center",
                background: isMe ? "rgba(245,184,0,0.04)" : "transparent",
              }}>
                {/* User col */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 600, color: BRAND.white,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {u.email}
                    {isMe && (
                      <span style={{
                        marginLeft: 8, fontSize: 9, fontWeight: 700,
                        padding: "1px 6px", borderRadius: 2,
                        background: "rgba(245,184,0,0.15)", color: BRAND.gold,
                        letterSpacing: "0.10em",
                      }}>YOU</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: BRAND.textMuted, marginTop: 2,
                    fontFamily: "Inter, sans-serif", letterSpacing: "0.02em",
                  }}>
                    Last seen {fmtRel(u.last_sign_in_at)}
                  </div>
                </div>

                {/* Tier badge */}
                <div>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 8px", borderRadius: 3,
                    background: `${tierMeta.color}15`,
                    border: `1px solid ${tierMeta.color}55`,
                    color: tierMeta.color,
                    fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}>{tierMeta.label}</span>
                </div>

                {/* Company / Role */}
                <div style={{ fontSize: 12, color: BRAND.textSecondary, minWidth: 0 }}>
                  {u.company || u.role ? (
                    <>
                      <div style={{
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{u.company || "—"}</div>
                      <div style={{
                        fontSize: 10, color: BRAND.textMuted, marginTop: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{u.role || ""}</div>
                    </>
                  ) : (
                    <span style={{ color: BRAND.textMuted, fontSize: 11 }}>—</span>
                  )}
                </div>

                {/* Joined */}
                <div style={{
                  fontSize: 12, color: BRAND.textSecondary,
                  fontFamily: "Inter, sans-serif", letterSpacing: "0.01em",
                }}>
                  {fmtDate(u.created_at)}
                </div>

                {/* Tier dropdown */}
                <div>
                  <select
                    value={u.tier}
                    disabled={isBusy}
                    onChange={(e) => changeTier(u.id, e.target.value, u.email, u.tier)}
                    style={{
                      width: "100%", padding: "6px 8px",
                      background: BRAND.obsidian, color: BRAND.white,
                      border: `1px solid ${BRAND.borderSubtle}`, borderRadius: 3,
                      fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
                      cursor: isBusy ? "wait" : "pointer",
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    {TIER_OPTIONS.map(t => (
                      <option key={t.v} value={t.v}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: 14, fontSize: 11, color: BRAND.textMuted, lineHeight: 1.6,
      }}>
        Tier changes take effect on the user's next page refresh. Promote to <b>admin</b> only with intent —
        admins see this page + can promote/demote others.
      </div>
    </div>
  );
}

function pillStyle(active, color) {
  return {
    padding: "5px 12px", borderRadius: 999,
    background: active ? `${color}20` : "transparent",
    color: active ? color : BRAND.textSecondary,
    border: `1px solid ${active ? color + "66" : BRAND.borderSubtle}`,
    fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.05em", cursor: "pointer",
    transition: "all 140ms ease",
  };
}
