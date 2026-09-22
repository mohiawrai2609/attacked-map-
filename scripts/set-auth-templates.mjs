#!/usr/bin/env node
// set-auth-templates.mjs — make every sign-in email a 6-DIGIT CODE, through the
// Supabase Management API:
//   • both auth templates (Confirm signup + Magic Link) become otp_code.html, so
//     new AND returning addresses receive the code — no more login links
//   • the code length becomes 6 (the project issued 8; codes starting with 0
//     kept losing the zero between the inbox and the box → "expired or invalid")
//   • the code stays valid for 1 hour
//
//   Confirm signup  → sent to a NEW address that signs up through the code flow
//   Magic Link      → sent to an EXISTING address that signs in with a code
//
// Needs a personal access token from https://supabase.com/dashboard/account/tokens
// in the environment; it is read once and never written anywhere.
//
//   set SUPABASE_ACCESS_TOKEN=sbp_...            (PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_...")
//   node scripts/set-auth-templates.mjs --dry-run   → shows current subjects, changes nothing
//   node scripts/set-auth-templates.mjs             → applies, then reads back to confirm
//
// Project ref comes from VITE_SUPABASE_URL in .env (override with --project <ref>).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error("SUPABASE_ACCESS_TOKEN is not set. Create one at https://supabase.com/dashboard/account/tokens and set it in this shell only."); process.exit(1); }

let ref = args.includes("--project") ? args[args.indexOf("--project") + 1] : null;
if (!ref) {
  const env = Object.fromEntries(readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
  ref = (env.VITE_SUPABASE_URL || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || null;
}
if (!ref) { console.error("Could not find the project ref (VITE_SUPABASE_URL in .env, or pass --project <ref>)."); process.exit(1); }

const html = readFileSync(resolve(ROOT, "supabase_email_templates/otp_code.html"), "utf8");
if (!html.includes("{{ .Token }}")) { console.error("otp_code.html has no {{ .Token }} — refusing to install a template that would not carry the code."); process.exit(1); }
const SUBJECT = "Your Attacked.ai sign-in code: {{ .Token }}";

const API = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const OTP_LENGTH = 6, OTP_EXP = 3600;
const show = (c) => ({
  otp_length: c.mailer_otp_length, otp_exp_seconds: c.mailer_otp_exp,
  magic_link_subject: c.mailer_subjects_magic_link,
  magic_link_has_token: /\{\{\s*\.Token\s*\}\}/.test(c.mailer_templates_magic_link_content || ""),
  confirm_signup_subject: c.mailer_subjects_confirmation,
  confirm_signup_has_token: /\{\{\s*\.Token\s*\}\}/.test(c.mailer_templates_confirmation_content || ""),
});

const before = await fetch(API, { headers: H });
if (!before.ok) { console.error(`GET ${before.status}: ${await before.text()}`); process.exit(1); }
console.log(`project ${ref} — before:`, show(await before.json()));

if (dry) { console.log(`--dry-run: nothing changed. Would set both templates to otp_code.html (subject: ${SUBJECT}), otp length ${OTP_LENGTH}, expiry ${OTP_EXP}s`); process.exit(0); }

const body = {
  mailer_otp_length: OTP_LENGTH,
  mailer_otp_exp: OTP_EXP,
  mailer_subjects_magic_link: SUBJECT,
  mailer_templates_magic_link_content: html,
  mailer_subjects_confirmation: SUBJECT,
  mailer_templates_confirmation_content: html,
};
const patch = await fetch(API, { method: "PATCH", headers: H, body: JSON.stringify(body) });
if (!patch.ok) { console.error(`PATCH ${patch.status}: ${await patch.text()}`); process.exit(1); }

const after = await fetch(API, { headers: H });
const conf = await after.json();
console.log("after: ", show(conf));
const ok = /\{\{\s*\.Token\s*\}\}/.test(conf.mailer_templates_magic_link_content || "") && /\{\{\s*\.Token\s*\}\}/.test(conf.mailer_templates_confirmation_content || "");
console.log(ok ? "\nDone — both templates now carry the 6-digit code." : "\nSomething did not stick; check the dashboard.");
process.exit(ok ? 0 : 1);
