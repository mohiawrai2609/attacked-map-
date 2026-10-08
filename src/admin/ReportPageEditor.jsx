// ReportPageEditor — the live preview, with an "Edit on page" mode (2026-09-28).
//
// Uploading a finished briefing is the fast path: the file already looks right,
// so the admin should be able to click a heading in the preview and recolour it
// rather than hunt for the matching form field. This turns the preview iframe
// into that editor.
//
// It works because the preview is a srcDoc iframe and therefore same-origin: the
// parent can reach contentDocument and drive the page directly, with no injected
// tooling and nothing to strip out of the saved file.
//
// Edits are NOT saved by serialising the edited page. A baked briefing ships a
// ~20-element skeleton and builds the other ~900 from its INCIDENT object on
// every load, so a serialised copy would carry the generated markup *and* the
// script that regenerates it — half again as large, and every edit wiped the
// next time it ran. Instead each edit is recorded against a stable selector and
// saved as data (see injectEdits/readEdits), which the page re-applies after it
// has built itself. Small, durable, and re-openable.
//
// While edit mode is on the iframe's srcDoc is FROZEN: the live DOM is the truth
// and gives instant feedback, and the parent's copy is updated underneath. Were
// srcDoc to follow, the page would reload on every colour drag and drop the
// caret. Turning edit mode off unfreezes it, so the reload doubles as proof that
// what you see is what was saved.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REPORT_FONTS, brandFontHref, brandStyleCss, injectEdits, readEdits } from "../lib/reportTemplate";

const UI = { gold: "#FCBD00", obsidian: "#1A1A1A", card: "#242424", deep: "#080808", white: "#FFFFFF", muted: "#A8A8A8", border: "#333333", sel: "#3B82F6" };

// Fonts offered per element: the four brand faces, plus stacks every machine
// already has, which need no network at all.
const SYSTEM_FONTS = [
  { id: "Georgia", label: "Georgia (serif)", css: "Georgia, 'Times New Roman', serif" },
  { id: "Times", label: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { id: "Arial", label: "Arial / Helvetica", css: "Arial, Helvetica, sans-serif" },
  { id: "Verdana", label: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { id: "Courier", label: "Courier New (mono)", css: "'Courier New', Courier, monospace" },
  { id: "JetBrains", label: "JetBrains Mono", css: "'JetBrains Mono', ui-monospace, monospace" },
];
const FONT_CHOICES = [...REPORT_FONTS.map((f) => ({ id: f.id, label: f.label, css: f.css, gf: f.gf })), ...SYSTEM_FONTS];
const WEIGHTS = [["", "unchanged"], ["400", "400 regular"], ["500", "500 medium"], ["600", "600 semibold"], ["700", "700 bold"], ["800", "800 extrabold"], ["900", "900 black"]];
const ALIGNS = [["", "unchanged"], ["left", "left"], ["center", "centre"], ["right", "right"], ["justify", "justify"]];

// Page furniture: selecting it is never what the admin meant.
const SKIP = new Set(["HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "LINK", "META"]);

const label = { display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: UI.muted, margin: "0 0 4px" };
const field = { background: UI.deep, color: UI.white, border: `1px solid ${UI.border}`, borderRadius: 4, padding: "5px 7px", fontFamily: "Inter, sans-serif", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" };
const chip = (on) => ({ padding: "5px 9px", borderRadius: 4, border: `1px solid ${on ? UI.gold : UI.border}`, background: on ? UI.gold : "transparent", color: on ? UI.obsidian : UI.white, fontSize: 11, fontWeight: 700, cursor: "pointer" });

const describe = (el) => {
  if (!el) return "";
  const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  return el.tagName + (cls ? " · " + cls : "");
};

// A colour input needs #rrggbb; computed styles come back as rgb().
function toHex(v, fallback) {
  const m = String(v || "").match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return /^#[0-9a-f]{6}$/i.test(v || "") ? v : fallback;
  return "#" + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("");
}

// A selector that will still find this element after the report rebuilds itself.
// Prefer an id, then a class that is unique in the document, then a structural
// path — the DOM is generated deterministically from the same data, so the
// position of an element is as stable as its class.
function selectorFor(el, d) {
  const uniq = (s) => { try { return d.querySelectorAll(s).length === 1; } catch { return false; } };
  if (el.id && uniq("#" + CSS.escape(el.id))) return "#" + CSS.escape(el.id);
  const classes = (el.getAttribute("class") || "").split(/\s+/).filter((c) => c && !c.startsWith("data-ae"));
  for (const c of classes) { const s = "." + CSS.escape(c); if (uniq(s)) return s; }
  if (classes.length > 1) { const s = el.tagName.toLowerCase() + classes.map((c) => "." + CSS.escape(c)).join(""); if (uniq(s)) return s; }
  const parts = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && cur.tagName !== "HTML") {
    if (cur.id && uniq("#" + CSS.escape(cur.id))) { parts.unshift("#" + CSS.escape(cur.id)); break; }
    const parent = cur.parentElement;
    let part = cur.tagName.toLowerCase();
    if (parent) {
      const sibs = Array.from(parent.children).filter((n) => n.tagName === cur.tagName);
      if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  const path = parts.join(">");
  return uniq(path) ? path : "";
}

export function ReportPageEditor({ html, brand, onChange, height = "78vh" }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const [gen, setGen] = useState(0);            // bumped on iframe load, to re-bind
  const [sel, setSel] = useState(null);         // the selected element
  const [selKey, setSelKey] = useState("");     // and its selector
  const [textMode, setTextMode] = useState(false);
  const [, force] = useState(0);
  const edits = useRef({});
  const [editCount, setEditCount] = useState(0);
  const syncCount = useCallback(() => setEditCount(Object.keys(edits.current).length), []);
  const undo = useRef([]);
  const frozen = useRef(html);

  // srcDoc follows the parent only while we are NOT editing; see the note above.
  if (!on) frozen.current = html;
  const src = frozen.current;
  const doc = () => ref.current?.contentDocument || null;

  // Whatever was saved into this report before is what we start from.
  useEffect(() => { if (!on) { edits.current = readEdits(html); syncCount(); } }, [html, on, syncCount]);

  const commitTimer = useRef(null);
  const commit = useCallback(() => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onChange(injectEdits(frozen.current, edits.current)), 250);
  }, [onChange]);

  const record = useCallback((key, patch) => {
    const before = JSON.stringify(edits.current[key] || null);
    undo.current.push({ key, before });
    if (undo.current.length > 100) undo.current.shift();
    const cur = edits.current[key] || {};
    const next = { ...cur, ...patch, style: { ...(cur.style || {}), ...(patch.style || {}) } };
    for (const k of Object.keys(next.style)) if (!next.style[k]) delete next.style[k];
    if (!Object.keys(next.style).length) delete next.style;
    if (next.html == null) delete next.html;
    if (!Object.keys(next).length) delete edits.current[key]; else edits.current[key] = next;
    syncCount(); commit();
  }, [commit, syncCount]);

  // ── selection ──────────────────────────────────────────────────────────
  useEffect(() => {
    const d = doc(); if (!d) return;
    if (!on) {
      d.querySelectorAll("[data-ae-sel],[data-ae-hover]").forEach((n) => { n.removeAttribute("data-ae-sel"); n.removeAttribute("data-ae-hover"); });
      d.getElementById("ae-chrome")?.remove();
      return;
    }
    let chrome = d.getElementById("ae-chrome");
    if (!chrome) { chrome = d.createElement("style"); chrome.id = "ae-chrome"; d.head.appendChild(chrome); }
    chrome.textContent = `[data-ae-hover]{outline:2px dashed ${UI.sel}99 !important;outline-offset:2px;cursor:pointer !important}
[data-ae-sel]{outline:2px solid ${UI.sel} !important;outline-offset:2px}
[contenteditable="true"]{caret-color:${UI.sel}}`;

    let hovered = null;
    const pick = (e) => { const el = e.target; return el && el.nodeType === 1 && !SKIP.has(el.tagName) ? el : null; };
    const onOver = (e) => {
      const el = pick(e); if (el === hovered) return;
      hovered?.removeAttribute("data-ae-hover");
      hovered = el; if (el && !el.hasAttribute("data-ae-sel")) el.setAttribute("data-ae-hover", "1");
    };
    const onOut = () => { hovered?.removeAttribute("data-ae-hover"); hovered = null; };
    const onClick = (e) => {
      const el = pick(e); if (!el) return;
      // The briefing has its own click handlers (contents nav, print). While
      // editing, a click means "select this", nothing else.
      if (!el.isContentEditable) { e.preventDefault(); e.stopPropagation(); }
      d.querySelectorAll("[data-ae-sel]").forEach((n) => n.removeAttribute("data-ae-sel"));
      el.removeAttribute("data-ae-hover");
      el.setAttribute("data-ae-sel", "1");
      setSel(el); setSelKey(selectorFor(el, d)); setTextMode(el.isContentEditable);
    };
    d.addEventListener("mouseover", onOver, true);
    d.addEventListener("mouseout", onOut, true);
    d.addEventListener("click", onClick, true);
    return () => {
      d.removeEventListener("mouseover", onOver, true);
      d.removeEventListener("mouseout", onOut, true);
      d.removeEventListener("click", onClick, true);
    };
  }, [on, gen]);

  // A fresh document invalidates the selection.
  useEffect(() => { setSel(null); setSelKey(""); setTextMode(false); }, [gen]);

  // Brand changes while editing: swap the injected block rather than reload.
  useEffect(() => {
    if (!on) return;
    const d = doc(); if (!d) return;
    const st = d.querySelector("style[data-cms-brand]");
    if (st) st.textContent = brandStyleCss(brand);
    const ln = d.querySelector("link[data-cms-brand]");
    if (ln) ln.setAttribute("href", brandFontHref(brand));
  }, [brand, on, gen]);

  // ── actions ────────────────────────────────────────────────────────────
  const setStyle = (prop, value) => {
    if (!sel) return;
    if (!selKey) { force((n) => n + 1); return; }
    if (value) sel.style.setProperty(prop, value, "important"); else sel.style.removeProperty(prop);
    record(selKey, { style: { [prop]: value || "" } });
    force((n) => n + 1);
  };

  const setFont = (id) => {
    if (!sel) return;
    const f = FONT_CHOICES.find((x) => x.id === id);
    if (!f) { setStyle("font-family", ""); return; }
    // A brand face the document is not already loading needs its own link, and
    // that link is part of the saved file so the report keeps the face.
    const d = doc();
    if (f.gf && d && !d.querySelector(`link[data-ae-font="${f.id}"]`)) {
      const ln = d.createElement("link");
      ln.rel = "stylesheet"; ln.setAttribute("data-ae-font", f.id);
      ln.href = `https://fonts.googleapis.com/css2?family=${f.gf}&display=swap`;
      d.head.appendChild(ln);
    }
    setStyle("font-family", f.css);
  };

  const toggleText = () => {
    if (!sel || !selKey) return;
    const next = !sel.isContentEditable;
    if (next) { sel.setAttribute("contenteditable", "true"); sel.focus(); }
    else { sel.removeAttribute("contenteditable"); record(selKey, { html: sel.innerHTML }); }
    setTextMode(next);
  };

  const clearElement = () => {
    if (!sel || !selKey) return;
    sel.removeAttribute("style");
    const before = JSON.stringify(edits.current[selKey] || null);
    undo.current.push({ key: selKey, before });
    delete edits.current[selKey];
    syncCount(); commit(); force((n) => n + 1);
  };

  const undoLast = () => {
    const last = undo.current.pop(); if (!last) return;
    const prev = last.before ? JSON.parse(last.before) : null;
    if (prev) edits.current[last.key] = prev; else delete edits.current[last.key];
    syncCount();
    const d = doc(); const el = d && last.key ? d.querySelector(last.key) : null;
    if (el) {
      el.removeAttribute("style");
      const st = prev && prev.style;
      if (st) for (const p of Object.keys(st)) el.style.setProperty(p, st[p], "important");
      if (prev && prev.html != null) el.innerHTML = prev.html;
    }
    commit(); force((n) => n + 1);
  };

  const done = () => {
    // Leaving the mode flushes immediately, so the reload shows the saved state.
    if (sel?.isContentEditable) { sel.removeAttribute("contenteditable"); if (selKey) record(selKey, { html: sel.innerHTML }); }
    clearTimeout(commitTimer.current);
    onChange(injectEdits(frozen.current, edits.current));
    setOn(false); setSel(null); setSelKey(""); setTextMode(false);
  };

  // What the toolbar shows: the element's own value where it has one, otherwise
  // what it actually renders as.
  const current = useMemo(() => {
    if (!sel) return null;
    const d = doc(); if (!d?.defaultView) return null;
    const cs = d.defaultView.getComputedStyle(sel);
    const inline = sel.style;
    const first = (v) => String(v || "").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
    const fam = first(inline.fontFamily || cs.fontFamily);
    const match = FONT_CHOICES.find((f) => fam && first(f.css) === fam);
    return {
      color: toHex(inline.color || cs.color, "#141414"),
      bg: toHex(inline.backgroundColor || cs.backgroundColor, "#ffffff"),
      size: Math.round(parseFloat(inline.fontSize || cs.fontSize) || 16),
      weight: inline.fontWeight || "",
      align: inline.textAlign || "",
      font: match ? match.id : "",
      italic: (inline.fontStyle || cs.fontStyle) === "italic",
      underline: /underline/.test(inline.textDecorationLine || cs.textDecorationLine || ""),
    };
  }, [sel, gen, on]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ ...label, margin: 0, flex: "1 1 auto" }}>
          {on ? "Edit on page · click anything in the report" : "Live preview · exactly what readers see"}
          {editCount > 0 && <span style={{ color: UI.gold, marginLeft: 8 }}>{editCount} edited element{editCount === 1 ? "" : "s"}</span>}
        </div>
        {on && <button onClick={undoLast} disabled={!undo.current.length} style={{ ...chip(false), opacity: undo.current.length ? 1 : 0.4 }}>↶ Undo</button>}
        <button onClick={() => (on ? done() : setOn(true))} style={chip(on)}>{on ? "✓ Done editing" : "✏️ Edit on page"}</button>
      </div>

      {on && (
        <div style={{ background: UI.card, border: `1px solid ${UI.border}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
          {!sel ? (
            <div style={{ fontSize: 12, color: UI.muted, lineHeight: 1.6 }}>
              Click any heading, paragraph, chip or panel in the preview below. Colour, typeface, size, weight and alignment appear here and apply to that element only. Changes are saved with the report.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: UI.gold, background: `${UI.gold}1A`, border: `1px solid ${UI.gold}55`, borderRadius: 3, padding: "2px 7px" }}>{describe(sel)}</span>
                <button onClick={toggleText} style={chip(textMode)}>{textMode ? "✓ Editing text" : "Edit text"}</button>
                <button onClick={clearElement} style={chip(false)}>Reset element</button>
                <button onClick={() => { doc()?.querySelectorAll("[data-ae-sel]").forEach((n) => n.removeAttribute("data-ae-sel")); setSel(null); setSelKey(""); setTextMode(false); }} style={chip(false)}>Deselect</button>
              </div>

              {!selKey && <div style={{ fontSize: 11.5, color: "#FF9F0A" }}>This element cannot be given a stable address, so a change to it would not survive saving. Pick the panel or heading around it instead.</div>}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(118px, calc(50% - 4px)), 1fr))", gap: 8, opacity: selKey ? 1 : 0.45, pointerEvents: selKey ? "auto" : "none" }}>
                <div>
                  <label style={label}>Text colour</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="color" value={current?.color || "#141414"} onChange={(e) => setStyle("color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
                    <button onClick={() => setStyle("color", "")} style={{ ...chip(false), padding: "4px 7px", fontWeight: 400, minWidth: 24 }} title="Back to the report's own colour">⨯</button>
                  </div>
                </div>
                <div>
                  <label style={label}>Background</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="color" value={current?.bg || "#ffffff"} onChange={(e) => setStyle("background-color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", padding: 0, cursor: "pointer" }} />
                    <button onClick={() => setStyle("background-color", "")} style={{ ...chip(false), padding: "4px 7px", fontWeight: 400, minWidth: 24 }} title="Back to the report's own background">⨯</button>
                  </div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={label}>Typeface</label>
                  <select style={field} value={current?.font || ""} onChange={(e) => setFont(e.target.value)}>
                    <option value="">Unchanged (from the report)</option>
                    {FONT_CHOICES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Size · {current?.size || 16}px</label>
                  <input type="range" min="9" max="72" value={current?.size || 16} onChange={(e) => setStyle("font-size", e.target.value + "px")} style={{ width: "100%", height: 24, margin: 0, accentColor: UI.gold }} />
                </div>
                <div>
                  <label style={label}>Weight</label>
                  <select style={field} value={current?.weight || ""} onChange={(e) => setStyle("font-weight", e.target.value)}>
                    {WEIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Alignment</label>
                  <select style={field} value={current?.align || ""} onChange={(e) => setStyle("text-align", e.target.value)}>
                    {ALIGNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Style</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setStyle("font-style", current?.italic ? "" : "italic")} style={{ ...chip(current?.italic), fontStyle: "italic", minWidth: 24 }}>I</button>
                    <button onClick={() => setStyle("text-decoration-line", current?.underline ? "" : "underline")} style={{ ...chip(current?.underline), textDecoration: "underline", minWidth: 24 }}>U</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <iframe
        ref={ref}
        title="Report preview"
        srcDoc={src}
        onLoad={() => setGen((n) => n + 1)}
        style={{ width: "100%", height, border: `1px solid ${on ? UI.sel : UI.border}`, borderRadius: 8, background: "#fff" }}
      />
    </div>
  );
}
