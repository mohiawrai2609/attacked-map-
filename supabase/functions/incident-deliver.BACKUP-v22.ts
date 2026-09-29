import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "mohiniawari201@gmail.com";
// Secret only — never hardcode a fallback password here (set GMAIL_APP_PASSWORD in Supabase secrets).
const GMAIL_PASS = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM");
// The dashboard moved from the Netlify site (not reachable from the owner's Netlify account) to its own
// Vercel project on 2026-09-17. A DASHBOARD_URL secret still naming the Netlify host is treated as stale,
// so the email can never point back at the frozen build.
const DASHBOARD_URL = (() => {
  const fromEnv = (Deno.env.get("DASHBOARD_URL") ?? "").trim();
  return fromEnv && !fromEnv.includes("sensational-ganache-31f0d0") ? fromEnv : "https://attacked-daily-brief.vercel.app";
})();
const TW_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TW_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TW_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");

const h = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };
function dashLink(sid: number) {
  if (!DASHBOARD_URL) return "";
  return `${DASHBOARD_URL}${DASHBOARD_URL.includes("?") ? "&" : "?"}sweep_id=${sid}`;
}

async function rpc(fn: string, body: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${await r.text()}`);
  return await r.json();
}
async function sel(path: string) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: h });
  if (!r.ok) throw new Error(`sel ${r.status}: ${await r.text()}`);
  return await r.json();
}
async function logDelivery(row: Record<string, unknown>) {
  await fetch(`${URL_}/rest/v1/delivery_log`, { method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(row) });
}

const SEVNAME = (s: number) => (s === 5 ? "CRITICAL" : s === 4 ? "HIGH" : s === 3 ? "MED" : s === 2 ? "LOW" : "MIN");
const SEVCOL = (s: number) => (s === 5 ? "#FF6B6B" : s === 4 ? "#FF8C5A" : s === 3 ? "#FCBD00" : s === 2 ? "#34C759" : "#8E8E93");
const arrow = (n: number) => (n > 0 ? `▲ ${n}` : n < 0 ? `▼ ${Math.abs(n)}` : "flat");

function emailHtml(rep: any, exec: boolean) {
  const t = rep.totals, d = rep.delta;
  const url = dashLink(rep.sweep_id);
  const btn = url ? `<div style="margin:18px 0"><a href="${url}" style="display:inline-block;background:#FCBD00;color:#1A1A1A;font-weight:600;font-size:13px;text-decoration:none;padding:11px 22px;border-radius:6px">→ View Live Dashboard (${rep.sweep_date})</a></div>` : "";
  const majors = (rep.major_incidents ?? []).map((m: any) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #333">
      <span style="font-family:monospace;font-size:11px;color:${SEVCOL(m.severity)}">S${m.severity} ${SEVNAME(m.severity)}</span>
      &nbsp;<b style="color:#fff">${m.headline}</b><br>
      <span style="color:#A8A8A8;font-size:12px">${m.category} · ${m.entity}${m.country ? " · " + m.country : ""}${m.threat_actor ? " · ⚔ " + m.threat_actor : ""}</span>
    </td></tr>`).join("");
  const cats = exec ? "" : (rep.categories ?? []).map((c: any) =>
    `<tr><td style="color:#A8A8A8;padding:3px 0">${c.label}</td><td style="font-family:monospace;text-align:right;color:#fff">${c.incidents}${c.major ? ` (${c.major}⚑)` : ""}</td></tr>`).join("");
  const fullLog = exec ? "" : (rep.incidents ?? []).map((m: any) => `
    <tr><td style="padding:12px 0;border-bottom:1px solid #2a2a2a">
      <span style="font-family:monospace;font-size:10px;color:${SEVCOL(m.severity)};border:1px solid ${SEVCOL(m.severity)}55;padding:1px 6px;border-radius:3px">S${m.severity} ${SEVNAME(m.severity)}</span>
      &nbsp;<b style="color:#fff;font-size:14px">${m.headline}</b>
      &nbsp;<span style="font-family:monospace;font-size:10px;color:#FCBD00">${m.category}</span><br>
      <span style="color:#777;font-size:11px;font-family:monospace">${m.entity ?? ""}${m.country ? " · " + m.country : ""}${m.sector ? " · " + m.sector : ""}</span>
      ${m.summary ? `<div style="color:#A8A8A8;font-size:13px;margin-top:5px;line-height:1.55">${m.summary}</div>` : ""}
    </td></tr>`).join("");
  return `<div style="background:#1A1A1A;color:#fff;font-family:Inter,Arial,sans-serif;padding:28px;max-width:680px;margin:0 auto">
    <div style="font-weight:600;font-size:16px">Attacked<span style="color:#FCBD00">.ai</span> <span style="color:#585858;font-size:11px;text-transform:uppercase;letter-spacing:1px">Incident Intelligence</span></div>
    <div style="font-family:monospace;color:#FCBD00;font-size:11px;letter-spacing:1px;margin-top:18px">SWEEP #${rep.sweep_id} · ${rep.sweep_date}${Number.isFinite(rep.lookback_hours) ? ` · LAST ${rep.lookback_hours}H` : ""}</div>
    <h1 style="font-family:Georgia,serif;font-size:30px;margin:6px 0 14px">${exec ? "Executive Brief" : "Daily Incident Brief"}</h1>
    <div style="border-left:2px solid #FCBD00;padding-left:14px;color:#A8A8A8;font-size:14px">${rep.exec_line}</div>
    ${btn}
    <table style="width:100%;margin:22px 0;border-collapse:collapse;text-align:center"><tr>
      <td><div style="font-family:monospace;font-size:26px;color:#FCBD00">${t.total}</div><div style="font-size:10px;color:#585858;text-transform:uppercase">Incidents</div><div style="font-size:10px;font-family:monospace;color:#A8A8A8">${arrow(d.total_change)}</div></td>
      <td><div style="font-family:monospace;font-size:26px;color:#FF8C5A">${t.major}</div><div style="font-size:10px;color:#585858;text-transform:uppercase">Major</div><div style="font-size:10px;font-family:monospace;color:#A8A8A8">${arrow(d.major_change)}</div></td>
      <td><div style="font-family:monospace;font-size:26px;color:#FF6B6B">${t.critical}</div><div style="font-size:10px;color:#585858;text-transform:uppercase">Critical</div></td>
      <td><div style="font-family:monospace;font-size:26px;color:#fff">${t.avg_severity}</div><div style="font-size:10px;color:#585858;text-transform:uppercase">Avg sev</div></td>
    </tr></table>
    <h3 style="font-family:Georgia,serif;color:#fff;font-size:18px;border-bottom:1px solid #FCBD00;padding-bottom:6px">Major Incidents</h3>
    <table style="width:100%;border-collapse:collapse">${majors || '<tr><td style="color:#585858;padding:10px 0">None at severity 4–5.</td></tr>'}</table>
    ${exec ? "" : `<h3 style="font-family:Georgia,serif;color:#fff;font-size:18px;border-bottom:1px solid #FCBD00;padding-bottom:6px;margin-top:24px">By Category</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${cats}</table>`}
    ${exec ? "" : `<h3 style="font-family:Georgia,serif;color:#fff;font-size:18px;border-bottom:1px solid #FCBD00;padding-bottom:6px;margin-top:24px">All Incidents — ${rep.incidents?.length ?? 0} total</h3><table style="width:100%;border-collapse:collapse">${fullLog}</table>`}
    <p style="color:#585858;font-size:11px;margin-top:26px">${url ? `<a href="${url}" style="color:#FCBD00;text-decoration:none">Open full dashboard →</a> · ` : ""}Attacked.ai — Confidential Intelligence · sweep #${rep.sweep_id}</p>
  </div>`;
}

function waText(rep: any) {
  const t = rep.totals;
  const top = (rep.major_incidents ?? []).slice(0, 3).map((m: any) => `• S${m.severity} ${m.headline}`).join("\n");
  const url = dashLink(rep.sweep_id);
  const link = url ? `\n\nDashboard: ${url}` : "";
  return `*Attacked.ai — Daily Brief* (${rep.sweep_date})\n${t.total} incidents · ${t.major} major · ${t.critical} critical (${arrow(rep.delta.total_change)} vs prior)\n\n${top || "No major incidents."}${link}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!GMAIL_USER || !GMAIL_PASS) return { status: "skipped", error: "Gmail creds missing" };
  try {
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: GMAIL_USER, password: GMAIL_PASS } },
    });
    const from = EMAIL_FROM && EMAIL_FROM.includes("<") ? EMAIL_FROM : `Attacked.ai Intel <${GMAIL_USER}>`;
    await client.send({ from, to, subject, html, content: "Daily incident brief — view in an HTML-capable mail client." });
    await client.close();
    return { status: "sent", provider_id: "gmail-smtp" };
  } catch (e) {
    return { status: "failed", error: String(e) };
  }
}

async function sendWhatsApp(to: string, body: string) {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) return { status: "skipped", error: "Twilio secrets not set" };
  const to_ = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const form = new URLSearchParams({ To: to_, From: TW_FROM, Body: body });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${TW_SID}:${TW_TOKEN}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body_ = await r.json().catch(() => ({}));
  return r.ok ? { status: "sent", provider_id: body_.sid } : { status: "failed", error: JSON.stringify(body_) };
}

Deno.serve(async (req) => {
  try {
    const input = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sweep_id = input.sweep_id ?? null;
    const force = input.force === true;
    const rep = await rpc("fn_sweep_report", { p_sweep_id: sweep_id });
    const sid = rep.sweep_id;

    if (!rep || !rep.totals || (rep.totals.total ?? 0) === 0) {
      return new Response(JSON.stringify({ sweep_id: sid, skipped: "no incidents loaded yet — will retry next check" }), { headers: { "Content-Type": "application/json" } });
    }

    const recipients = await sel(`report_recipients?active=eq.true&select=*`);
    const already = force ? [] : await sel(`delivery_log?sweep_id=eq.${sid}&status=eq.sent&select=channel,recipient`);
    const sentKey = new Set(already.map((a: any) => `${a.channel}|${a.recipient}`));

    const results: any[] = [];
    for (const rcpt of recipients) {
      if (sentKey.has(`${rcpt.channel}|${rcpt.address}`)) { results.push({ to: rcpt.address, status: "already_sent" }); continue; }
      const exec = rcpt.role === "exec";
      const kind = exec ? "daily_exec" : "daily_full";
      let res;
      if (rcpt.channel === "email") {
        const subj = `${exec ? "Exec Brief" : "Incident Brief"} — ${rep.totals.total} incidents, ${rep.totals.major} major (${rep.sweep_date})`;
        res = await sendEmail(rcpt.address, subj, emailHtml(rep, exec));
      } else {
        res = await sendWhatsApp(rcpt.address, waText(rep));
      }
      await logDelivery({ sweep_id: sid, kind, channel: rcpt.channel, recipient: rcpt.address, status: res.status, provider_id: res.provider_id ?? null, error: res.error ?? null, payload: { role: rcpt.role } });
      results.push({ to: rcpt.address, channel: rcpt.channel, ...res });
    }
    return new Response(JSON.stringify({ sweep_id: sid, sent: results }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
