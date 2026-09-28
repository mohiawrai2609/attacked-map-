#!/usr/bin/env node
// dev-admin-session.mjs — a LOCAL-ONLY way to get a signed-in session for the
// admin account on the dev server, for QA of admin pages, without the email
// link round-trip (Supabase only redirects links to allow-listed URLs, and
// localhost is not on the list).
//
// It uses the Auth admin API with the project's secret key (read from
// api/.env, never printed): generate a magic-link token for the account, then
// exchange it for a session. The session JSON is written to dist/dev-session.json,
// which the dev server serves at /dist/dev-session.json and which neither git
// nor Vercel ever pick up (dist/ is in .gitignore and .vercelignore).
//
//   node scripts/dev-admin-session.mjs mohiniawari201@gmail.com
//
// Then, in the dev page's console:
//   const { supabase } = await import('/src/lib/supabaseClient.js');
//   const s = await (await fetch('/dist/dev-session.json')).json();
//   await supabase.auth.setSession(s); location.reload();
//
// Delete dist/dev-session.json when done (or run `npm run build`, which
// clears dist/). The tokens are for the real project: treat the file as a
// password while it exists.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readEnv = (f) => { try { return Object.fromEntries(readFileSync(resolve(ROOT, f), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })); } catch { return {}; } };
const env = readEnv(".env"), api = readEnv("api/.env");
const URL_ = env.VITE_SUPABASE_URL;
const SECRET = api.SUPABASE_SECRET_KEY || api.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const email = process.argv[2];
if (!URL_ || !SECRET || !email) { console.error("usage: node scripts/dev-admin-session.mjs <email>   (needs VITE_SUPABASE_URL in .env and SUPABASE_SECRET_KEY in api/.env)"); process.exit(1); }

const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };
const gen = await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }) });
if (!gen.ok) { console.error(`generate_link ${gen.status}: ${(await gen.text()).slice(0, 200)}`); process.exit(1); }
const link = await gen.json();
const tokenHash = link.hashed_token || link.properties?.hashed_token;
if (!tokenHash) { console.error("no hashed_token in the generate_link response"); process.exit(1); }

const ver = await fetch(`${URL_}/auth/v1/verify`, { method: "POST", headers: { apikey: env.VITE_SUPABASE_ANON_KEY || SECRET, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }) });
if (!ver.ok) { console.error(`verify ${ver.status}: ${(await ver.text()).slice(0, 200)}`); process.exit(1); }
const session = await ver.json();
if (!session.access_token || !session.refresh_token) { console.error("verify returned no session"); process.exit(1); }

mkdirSync(resolve(ROOT, "dist"), { recursive: true });
const out = resolve(ROOT, "dist/dev-session.json");
writeFileSync(out, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
console.log(`session for ${email} written to dist/dev-session.json (expires in ${session.expires_in}s). Load it from the dev page console; delete the file when done.`);
