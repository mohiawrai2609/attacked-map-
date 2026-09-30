// cookieStorage.js — where the sign-in lives in the browser (2026-09-30).
//
// supabase-js keeps the session (access token, refresh token, user) in
// whatever storage it is given. Until now that was localStorage, which never
// expires. It now lives in first-party cookies:
//
//   attackmap.auth.0, .1, …   the session, split into chunks (a cookie holds
//                             ~4 KB and a session is larger). SameSite=Lax,
//                             Secure on https, Path=/.
//   attackmap.session_start   when this sign-in began (a timestamp).
//
// A sign-in lasts SESSION_DAYS from the moment it began — absolute, not
// sliding: refreshing the 1-hour access token rewrites the cookies with the
// SAME expiry, so using the site does not extend it. After that the browser
// drops the session cookies and enforceSessionLimit() signs the reader out
// (revoking that refresh token), so they sign in again.
//
// These are strictly-necessary cookies (they keep a signed-in reader signed
// in), so no consent banner is needed for them; the cookie policy lists them.
// They are set by the page itself, so they are readable by the page's own
// scripts (not HttpOnly) — the same exposure localStorage had. HttpOnly
// cookies need a server to set them, which comes with the hosted API.

export const SESSION_DAYS = 3;
export const SESSION_STORAGE_KEY = "attackmap.auth";
const START = "attackmap.session_start";
const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK = 3500;                 // encoded characters per cookie, safely under the 4 KB limit
const START_KEEP_DAYS = 30;         // the timestamp outlives the session so an expired sign-in is still recognised

const inBrowser = () => typeof document !== "undefined";
const secureAttr = () => (typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "");

// Raw (still URL-encoded) cookie values by name.
function jar() {
  const m = new Map();
  if (!inBrowser()) return m;
  for (const part of document.cookie.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    m.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return m;
}
function setRaw(name, raw, expires) {
  document.cookie = `${name}=${raw}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${secureAttr()}`;
}
function del(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr()}`;
}
function chunkNames(j, key) {
  const names = [];
  for (let i = 0; j.has(`${key}.${i}`); i++) names.push(`${key}.${i}`);
  return names;
}
function startOf(j) {
  const v = Number(j.get(START));
  return Number.isFinite(v) && v > 0 ? v : null;
}
const expiryFor = (start) => new Date(start + SESSION_DAYS * DAY_MS);
const expired = (start) => start != null && Date.now() >= start + SESSION_DAYS * DAY_MS;

export const cookieStorage = {
  getItem(key) {
    if (!inBrowser()) return null;
    const j = jar();
    const names = chunkNames(j, key);
    if (names.length) {
      if (key === SESSION_STORAGE_KEY && expired(startOf(j))) return null;
      try { return decodeURIComponent(names.map((n) => j.get(n)).join("")); } catch { return null; }
    }
    // One-time move of a pre-2026-09-30 sign-in out of localStorage, so
    // readers signed in before the switch stay signed in (their 3 days start now).
    try {
      const legacy = window.localStorage.getItem(key);
      if (legacy) { window.localStorage.removeItem(key); cookieStorage.setItem(key, legacy); return legacy; }
    } catch { /* storage blocked */ }
    return null;
  },

  setItem(key, value) {
    if (!inBrowser()) return;
    const j = jar();
    let exp;
    if (key === SESSION_STORAGE_KEY) {
      let start = startOf(j);
      if (expired(start)) { cookieStorage.removeItem(key); return; }   // the sign-in is over; never extend it
      if (!start) { start = Date.now(); setRaw(START, String(start), new Date(start + START_KEEP_DAYS * DAY_MS)); }
      exp = expiryFor(start);
    } else {
      exp = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    }
    const enc = encodeURIComponent(String(value));
    const n = Math.max(1, Math.ceil(enc.length / CHUNK));
    for (let i = 0; i < n; i++) setRaw(`${key}.${i}`, enc.slice(i * CHUNK, (i + 1) * CHUNK), exp);
    for (const name of chunkNames(j, key)) {                        // drop chunks left over from a larger value
      if (Number(name.slice(key.length + 1)) >= n) del(name);
    }
  },

  removeItem(key) {
    if (!inBrowser()) return;
    for (const name of chunkNames(jar(), key)) del(name);
    if (key === SESSION_STORAGE_KEY) del(START);
    try { window.localStorage.removeItem(key); } catch { /* storage blocked */ }
  },
};

// Signs the reader out once their sign-in is older than SESSION_DAYS: on load,
// whenever the tab comes back into view, and every ten minutes while open.
// scope "local" revokes only this browser's session, not the reader's others.
export function enforceSessionLimit(client) {
  if (!inBrowser() || !client?.auth) return;
  const check = async () => {
    if (!expired(startOf(jar()))) return;
    try { await client.auth.signOut({ scope: "local" }); } catch { /* offline: the cookies are cleared below */ }
    cookieStorage.removeItem(SESSION_STORAGE_KEY);
  };
  check();
  setInterval(check, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}

// Everything this site keeps in the browser, for the "Your privacy choices"
// control: the sign-in cookies, the session timestamp and the local flags.
export function clearSiteStorage() {
  if (!inBrowser()) return;
  for (const name of jar().keys()) if (name.startsWith("attackmap.") || name.startsWith("attacked_")) del(name);
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith("attackmap") || k.startsWith("attacked_") || k.startsWith("sb-")) window.localStorage.removeItem(k);
  } catch { /* storage blocked */ }
}

// Sign-in age, for the cookie page ("signed in since …, until …").
export function sessionWindow() {
  const s = startOf(jar());
  return s ? { since: new Date(s), until: expiryFor(s) } : null;
}
