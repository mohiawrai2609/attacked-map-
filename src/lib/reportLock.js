// reportLock.js — the free-reader gate for the 310 baked reports
// (public/reports/<ref>.html), shared by the dashboard's report view and the
// public Attacked Hub so the two never disagree about what is free.
//
// The rule is the product's rule: what happened is free; who it reaches and
// what to do about it is subscriber. Inside a report that is three sections —
//   #r-blast  Who else is exposed
//   #r-ctrl   GUARD controls against the scenario
//   #r-vend   Vendor intelligence
// For a free reader each one is capped, blurred and carries a Subscribe button.
// Everything else in the report reads in full. Subscribers see it untouched.
//
// The report is served same-origin, so the host page reaches into the frame
// after load. prepareReportFrame() is the one entry point: call it from the
// iframe's load handler (and once more if the document is already complete).

export const LOCKED_SECTIONS = ["r-blast", "r-ctrl", "r-vend"];

const LOCK_CSS = `
  .dash-locked{position:relative;max-height:260px;overflow:hidden}
  .dash-locked::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.75) 45%,#fff 100%);pointer-events:none}
  .dash-locked > *:not(.r-sec-title):not(.dash-lock){filter:blur(4px);user-select:none}
  .dash-lock{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:2;display:flex;align-items:center;gap:12px;background:#0f0f0f;color:#fff;border:1px solid #F5B800;padding:12px 16px;border-radius:10px;font:600 13px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);white-space:nowrap;max-width:calc(100% - 24px)}
  .dash-lock b{color:#F5B800;font-weight:700}
  .dash-lock button{background:#F5B800;color:#0f0f0f;border:0;border-radius:7px;padding:8px 12px;font:700 11px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
  @media (max-width:640px){.dash-lock{white-space:normal;flex-direction:column;text-align:center}}`;

export function lockReportForFreeReader(doc, onSubscribe) {
  if (!doc || !doc.body) return 0;
  if (!doc.getElementById("dash-lock-style")) {
    const st = doc.createElement("style"); st.id = "dash-lock-style"; st.textContent = LOCK_CSS;
    doc.head.appendChild(st);
  }
  let n = 0;
  for (const id of LOCKED_SECTIONS) {
    const sec = doc.getElementById(id);
    if (!sec || sec.classList.contains("dash-locked")) continue;
    sec.classList.add("dash-locked");
    const box = doc.createElement("div"); box.className = "dash-lock";
    box.innerHTML = "<span><b>Subscriber layer.</b> Who it reaches, and what to do about it.</span>";
    const b = doc.createElement("button"); b.type = "button"; b.textContent = "Subscribe →";
    b.onclick = () => onSubscribe?.();
    box.appendChild(b); sec.appendChild(box); n++;
  }
  return n;
}

// Stamp the licence line the report prints, hide any in-report navigation the
// host page owns, and gate the subscriber sections for free readers.
export function prepareReportFrame(frame, { subscriber, onSubscribe, readerName } = {}) {
  let doc; try { doc = frame.contentDocument; } catch { return false; }
  if (!doc || !doc.body || !doc.body.children.length) return false;
  try { frame.contentWindow.__ATTACKED_LICENSE__ = { name: readerName || "Registered reader", role: subscriber ? "Subscriber" : "Free reader" }; } catch { /* noop */ }
  doc.querySelectorAll('a[href*="?hub"], .r-back').forEach((el) => { el.style.display = "none"; });
  if (!subscriber) lockReportForFreeReader(doc, onSubscribe);
  return true;
}
