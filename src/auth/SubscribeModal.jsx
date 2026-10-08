// SubscribeModal — the one upsell surface, shared by the dashboard, the map's
// gated panels, the landing page and pricing. Replaces PartnerApplicationModal.
//
// There is no application or approval any more: a signed-in reader presses
// Subscribe and set_own_subscription() flips profiles.tier to 'enterprise'
// (see supabase/migrations/20260921_set_own_subscription.sql). Anonymous
// visitors are sent to sign in first. Payment, when it arrives, plugs into the
// same tier via the existing sync_subscription_tier trigger.
//
// Styling comes from src/dashboard/dashboard.css (scoped under .dash). The
// wrapper below re-uses that scope without painting the .dash page background.

import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import "../dashboard/dashboard.css";

const UNLOCKS = [
  ["Named blast radius", "The companies each incident actually reaches, traced supplier to customer with the exposure channel named.", "21,912 mapped"],
  ["Adaptive GUARD controls", "The control objectives and master controls each incident maps to, so the next move is an action.", "13,297 mapped"],
  ["Peer watchlist", "Which of your peers carry the same exposure, ranked.", "10,234 entries"],
  ["Historical analogues", "What happened last time an incident like this hit your sector.", "9,577 matched"],
  ["Vendor defence ratings", "Which vendors defend against this class of incident, and how well.", "per incident"],
  ["The full daily brief", "Every incident with summary, rationale and blast radius, not headlines only.", "every morning"],
];

export function SubscribeModal({ open, onClose, onDone, onSignIn }) {
  const { user, subscriber, setSubscribed } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!open) return null;

  async function subscribe() {
    if (!user) { onSignIn ? onSignIn() : (window.location.href = "/?subscribe"); return; }
    setBusy(true); setMsg(null);
    try {
      const t = await setSubscribed(true);
      setMsg(t === "enterprise" || t === "admin" ? "You are now a subscriber. Everything is unlocked." : `Tier is now ${t}.`);
      onDone?.(t);
      setTimeout(onClose, 900);
    } catch (e) { setMsg(e?.message || "Could not subscribe."); }
    finally { setBusy(false); }
  }

  return (
    <div className="dash" style={{ position: "fixed", inset: 0, zIndex: 9000, minHeight: 0, background: "transparent", pointerEvents: "none" }}>
      <div className="modal-backdrop open" role="dialog" aria-modal="true" style={{ pointerEvents: "auto" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal">
          <div className="modal-head">
            <div>
              <div className="eyebrow">Subscribe · Attacked.ai</div>
              <h2>{subscriber ? "You already have full access." : "From what happened to who it reaches."}</h2>
              <p>{subscriber ? "Named blast radius, GUARD controls and the peer watchlist are open on every incident." : "Free shows every incident in your industry. Subscribing unlocks the operational layer we build behind each one."}</p>
            </div>
            <button className="close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="modal-body">
            <div className="unlock-list">{UNLOCKS.map(([b, s, n]) => <div key={b} className="unlock"><div className="tick">✓</div><div><b>{b}</b><span>{s}</span></div><span className="n">{n}</span></div>)}</div>
            {msg && <p style={{ fontSize: 12, color: /now a subscriber|unlocked/i.test(msg) ? "#1E7A3D" : "#B21F31", margin: "0 0 12px" }}>{msg}</p>}
            <div className="modal-actions">
              <span className="note">{user ? "Switches on now. Switch off any time." : "Create an account first; it takes a minute."} <a href="/?subscribe" style={{ color: "var(--gold-text, #8A6D00)", fontWeight: 700 }}>All plans and products →</a></span>
              <button className="secondary" onClick={onClose}>Not now</button>
              {subscriber
                ? <a className="primary" style={{ display: "inline-flex", alignItems: "center" }} href="/?dashboard">Open my dashboard →</a>
                : <button className="primary" disabled={busy} onClick={subscribe}>{busy ? "Subscribing…" : user ? "Subscribe →" : "Sign in to subscribe →"}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
