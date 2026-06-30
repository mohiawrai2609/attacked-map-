// notify-application — Supabase Edge Function (Gmail SMTP backend)
// Sends transactional emails on partner application lifecycle.
//
// BRANDING: every mail shares the same shell() — branded shield image
// (hosted SVG) + Attacked.ai wordmark + tagline + full Inter font stack.
// Matches daily-digest visual treatment so receipts feel like one
// consistent product.
//
// Email backend: Gmail SMTP via denomailer. Sends to ANY recipient (no
// domain verification needed). Env vars: GMAIL_USER, GMAIL_APP_PASSWORD.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER         = Deno.env.get("GMAIL_USER")         ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const ADMIN_EMAIL        = Deno.env.get("ADMIN_EMAIL")        ?? "mohiniawari201@gmail.com";
const SENDER_NAME        = Deno.env.get("SENDER_NAME")        ?? "Attacked.ai";
const APP_URL            = Deno.env.get("APP_URL")            ?? "https://attackedmap.vercel.app";

const GOLD     = "#F5B800";
const OBSIDIAN = "#1A1A1A";
const DEEP     = "#080808";
const MUTED    = "#A8A8A8";
const GREEN    = "#34C759";

// Universal font stack — Inter first, then OS native fallbacks. Email
// clients block @font-face so Inter only renders for recipients who
// already have it; everyone else gets the closest system equivalent.
const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escape(s: unknown): string {
  return String(s ?? "").replace(/[&<>\"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c as string] || c));
}

// Shared shell — branded shield + wordmark header, Inter throughout,
// muted footer. Tagline second-line lets each email type label itself
// ("Partner application", "Approved", etc.) without rebuilding the header.
function shell(title: string, tagline: string, bodyHtml: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>` +
    `<body style="margin:0;padding:32px 16px;background:${DEEP};font-family:${INTER};color:#FFFFFF;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:${OBSIDIAN};border:1px solid #333;border-radius:8px;">` +
    `<tr><td style="padding:22px 28px 18px;border-bottom:1px solid #333;">` +
      `<div style="font-family:${INTER};font-size:22px;font-weight:700;color:#FFF;letter-spacing:-0.01em;line-height:1;">Attacked<span style="color:${GOLD};">.ai</span><sup style="font-size:11px;color:#FFF;margin-left:1px;font-weight:600;">™</sup></div>` +
      `<div style="font-family:${INTER};font-size:10.5px;color:${MUTED};letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;font-weight:600;">${escape(tagline)}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:28px;">${bodyHtml}</td></tr>` +
    `<tr><td style="padding:18px 28px;border-top:1px solid #333;font-family:${INTER};font-size:10.5px;color:#585858;letter-spacing:0.12em;text-transform:uppercase;text-align:center;font-weight:600;">` +
      `Attacked.ai · GUARD framework` +
    `</td></tr></table></body></html>`;
}

function adminAlertHtml(app: any) {
  return shell(
    `New partner application — ${app.full_name}`,
    `Inbound · design partner application`,
    `<div style="font-family:${INTER};font-size:10.5px;color:${GOLD};letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">New design partner application</div>` +
    `<h1 style="font-family:${INTER};font-size:24px;font-weight:800;color:#FFF;margin:0 0 14px;line-height:1.2;letter-spacing:-0.015em;">${escape(app.full_name)} <span style="color:${MUTED};font-weight:500;">@ ${escape(app.company)}</span></h1>` +
    `<div style="background:rgba(245,184,0,0.06);border-left:2px solid ${GOLD};padding:14px 16px;border-radius:4px;margin:14px 0;">` +
      `<table cellpadding="4" style="font-family:${INTER};font-size:13px;color:#FFF;line-height:1.6;width:100%;">` +
        `<tr><td style="color:${MUTED};width:120px;">Email:</td><td><a href="mailto:${escape(app.email)}" style="color:${GOLD};text-decoration:none;">${escape(app.email)}</a></td></tr>` +
        `<tr><td style="color:${MUTED};">Role:</td><td>${escape(app.role)}</td></tr>` +
        `<tr><td style="color:${MUTED};">Company:</td><td>${escape(app.company)}</td></tr>` +
        (app.sector ? `<tr><td style="color:${MUTED};">Sector:</td><td>${escape(app.sector)}</td></tr>` : "") +
        (app.linkedin_url ? `<tr><td style="color:${MUTED};">LinkedIn:</td><td><a href="${escape(app.linkedin_url)}" style="color:${GOLD};text-decoration:none;">${escape(app.linkedin_url)}</a></td></tr>` : "") +
        `<tr><td style="color:${MUTED};vertical-align:top;">Ref:</td><td><code style="background:#333;padding:1px 6px;border-radius:3px;font-family:${INTER};font-size:11px;">#${String(app.id).padStart(5,"0")}</code></td></tr>` +
      `</table>` +
    `</div>` +
    `<div style="font-family:${INTER};font-size:11px;color:${MUTED};letter-spacing:0.10em;text-transform:uppercase;font-weight:700;margin:18px 0 6px;">Why they're interested</div>` +
    `<div style="font-family:${INTER};font-size:13.5px;color:#FFF;line-height:1.55;background:${DEEP};padding:14px;border-radius:4px;">${escape(app.why_interested).replace(/\n/g,"<br>")}</div>` +
    `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #333;">` +
      `<a href="${APP_URL}/?admin" style="display:inline-block;padding:11px 22px;background:${GOLD};color:${OBSIDIAN};text-decoration:none;border-radius:4px;font-family:${INTER};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Open admin console →</a>` +
      `<div style="margin-top:14px;font-family:${INTER};font-size:11.5px;color:${MUTED};line-height:1.5;">Approve or reject from the Inbox tab. Action triggers the applicant email automatically.</div>` +
    `</div>`
  );
}

function userConfirmHtml(app: any) {
  const firstName = (app.full_name || "there").split(" ")[0];
  return shell(
    "We received your application",
    `Gate 2 · design partner application`,
    `<div style="font-family:${INTER};font-size:10.5px;color:${GOLD};letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Application received</div>` +
    `<h1 style="font-family:${INTER};font-size:26px;font-weight:800;color:#FFF;margin:0 0 14px;line-height:1.2;letter-spacing:-0.015em;">We've got it.</h1>` +
    `<p style="font-family:${INTER};font-size:14px;color:${MUTED};line-height:1.6;margin:0 0 14px;">Thanks, ${escape(firstName)} — your design partner application is in the queue.</p>` +
    `<div style="background:rgba(52,199,89,0.10);border:1px solid #34C75955;border-radius:4px;padding:12px 14px;margin:14px 0;font-family:${INTER};font-size:11.5px;color:${GREEN};letter-spacing:0.10em;font-weight:700;">REF #${String(app.id).padStart(5,"0")} · STATUS: PENDING</div>` +
    `<p style="font-family:${INTER};font-size:13.5px;color:#FFF;line-height:1.6;margin:14px 0;">We review applications within <b>48 hours</b>. You'll get another email here when you're approved — your account will unlock to the partner tier automatically.</p>` +
    `<div style="background:rgba(245,184,0,0.06);border-left:2px solid ${GOLD};padding:12px 14px;border-radius:4px;margin:18px 0;font-family:${INTER};font-size:12.5px;color:#FFF;line-height:1.55;"><b>Tip:</b> if you haven't signed in yet, do that now with this same email (<b>${escape(app.email)}</b>). When you're approved, your tier flips on the next refresh — no extra step.</div>` +
    `<div style="margin-top:20px;">` +
      `<a href="${APP_URL}" style="display:inline-block;padding:11px 22px;background:${GOLD};color:${OBSIDIAN};text-decoration:none;border-radius:4px;font-family:${INTER};font-size:12.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Go to Attacked.ai →</a>` +
    `</div>`
  );
}

// Small reusable bullet row for the benefits list — gold tick + copy.
function benefit(text: string) {
  return `<tr>` +
    `<td style="vertical-align:top;padding:0 10px 12px 0;width:18px;font-family:${INTER};font-size:14px;color:${GOLD};line-height:1.5;">▸</td>` +
    `<td style="vertical-align:top;padding:0 0 12px;font-family:${INTER};font-size:14px;color:#EDEDED;line-height:1.55;">${text}</td>` +
    `</tr>`;
}

// Feature card — icon glyph + title + one-line blurb. Used in the
// 3-up "Get started" row (mirrors McKinsey's top-articles cards).
function featureCard(iconUrl: string, title: string, body: string) {
  return `<td width="33%" style="vertical-align:top;padding:0 6px;">` +
    `<div style="background:${DEEP};border:1px solid #2A2A2A;border-radius:6px;padding:16px 14px;height:100%;">` +
      `<img src="${iconUrl}" width="30" height="30" alt="" style="display:block;margin-bottom:12px;border:0;">` +
      `<div style="font-family:${INTER};font-size:13px;font-weight:700;color:#FFF;line-height:1.3;margin-bottom:6px;letter-spacing:-0.01em;">${escape(title)}</div>` +
      `<div style="font-family:${INTER};font-size:11.5px;color:${MUTED};line-height:1.5;">${escape(body)}</div>` +
    `</div>` +
  `</td>`;
}

// Image/CTA section — left text block + button, right icon panel (hosted gold
// line-icon PNG on a dark tile — no emoji).
function ctaSection(title: string, body: string, btnLabel: string, btnHref: string, iconUrl: string) {
  return `<tr><td style="padding:24px 28px;border-top:1px solid #2A2A2A;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>` +
      `<td width="58%" style="vertical-align:top;padding-right:14px;">` +
        `<div style="font-family:${INTER};font-size:17px;font-weight:800;color:#FFF;line-height:1.25;margin-bottom:8px;letter-spacing:-0.015em;">${escape(title)}</div>` +
        `<div style="font-family:${INTER};font-size:13px;color:${MUTED};line-height:1.55;margin-bottom:14px;">${escape(body)}</div>` +
        `<a href="${btnHref}" style="display:inline-block;padding:11px 22px;background:${GOLD};color:${OBSIDIAN};text-decoration:none;border-radius:4px;font-family:${INTER};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escape(btnLabel)}</a>` +
      `</td>` +
      `<td width="42%" style="vertical-align:middle;">` +
        `<div style="background:${DEEP};border:1px solid #2A2A2A;border-radius:6px;height:96px;text-align:center;"><img src="${iconUrl}" width="40" height="40" alt="" style="display:inline-block;margin-top:28px;border:0;"></div>` +
      `</td>` +
    `</tr></table>` +
  `</td></tr>`;
}

function approvedHtml(app: any) {
  const firstName = (app.full_name || "there").split(" ")[0];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're in — full access unlocked</title></head>` +
    `<body style="margin:0;padding:32px 16px;background:${DEEP};font-family:${INTER};color:#FFFFFF;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:${OBSIDIAN};border:1px solid #333;border-radius:8px;overflow:hidden;">` +

    // ── Header: shield logo + wordmark ──────────────────────────
    `<tr><td style="padding:22px 28px 18px;border-bottom:1px solid #333;">` +
      `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        `<td style="vertical-align:middle;padding-right:12px;"><img src="${APP_URL}/attacked-ai-logo.png" alt="Attacked.ai" width="42" height="42" style="display:block;border:0;"></td>` +
        `<td style="vertical-align:middle;">` +
          `<div style="font-family:${INTER};font-size:22px;font-weight:700;color:#FFF;letter-spacing:-0.01em;line-height:1;">Attacked<span style="color:${GOLD};">.ai</span><sup style="font-size:11px;color:#FFF;margin-left:1px;font-weight:600;">™</sup></div>` +
          `<div style="font-family:${INTER};font-size:10.5px;color:${MUTED};letter-spacing:0.14em;text-transform:uppercase;margin-top:6px;font-weight:600;">Design partner · approved</div>` +
        `</td>` +
      `</tr></table>` +
    `</td></tr>` +

    // ── Hero band: branded blast-radius radar image + headline ──
    `<tr><td style="padding:0;">` +
      `<img src="${APP_URL}/email-hero-welcome.png" width="600" alt="" style="display:block;width:100%;border:0;">` +
    `</td></tr>` +
    `<tr><td style="padding:26px 28px 0;">` +
      `<div style="font-family:${INTER};font-size:11px;color:${GOLD};letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">You're in the cohort</div>` +
    `</td></tr>` +

    // ── Intro + benefits + primary CTA ──────────────────────────
    `<tr><td style="padding:28px 28px 24px;">` +
      `<div style="font-family:${INTER};font-size:21px;font-weight:800;color:#FFF;line-height:1.25;letter-spacing:-0.015em;margin-bottom:10px;">You're approved, ${escape(firstName)}. Now make the most of your access.</div>` +
      `<p style="font-family:${INTER};font-size:14px;color:${MUTED};line-height:1.6;margin:0 0 6px;">Your account is flipped to <b style="color:${GOLD};">PARTNER</b> — sign in with <b style="color:#FFF;">${escape(app.email)}</b> and the full map unlocks on the next refresh. What you now have:</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 4px;">` +
        benefit(`<b style="color:#FFF;">Named blast radius</b> on every breach — who's hit, how far it spreads`) +
        benefit(`<b style="color:#FFF;">Recommended actions</b> + adaptive GUARD controls`) +
        benefit(`<b style="color:#FFF;">Vendor Defence Ratings</b> across your supply chain`) +
        benefit(`<b style="color:#FFF;">Full article-grade write-ups</b> on every incident`) +
        benefit(`<b style="color:#FFF;">Daily intelligence digest</b> tuned to your sector`) +
      `</table>` +
      `<div style="margin:22px 0 4px;">` +
        `<a href="${APP_URL}" style="display:inline-block;padding:14px 30px;background:${GOLD};color:${OBSIDIAN};text-decoration:none;border-radius:4px;font-family:${INTER};font-size:13.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Sign in to the full map →</a>` +
      `</div>` +
    `</td></tr>` +

    // ── "Get started" 3-up feature cards ────────────────────────
    `<tr><td style="padding:8px 22px 24px;">` +
      `<div style="font-family:${INTER};font-size:18px;font-weight:800;color:#FFF;line-height:1.2;letter-spacing:-0.015em;margin:0 6px 14px;">Get started with these</div>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>` +
        featureCard(`${APP_URL}/icon-map.png`, "Open the live map", "See active campaigns and your exposure in real time.") +
        featureCard(`${APP_URL}/icon-shield.png`, "Tune GUARD controls", "Set adaptive defences for your stack and sector.") +
        featureCard(`${APP_URL}/icon-chart.png`, "Rate your vendors", "Check Defence Ratings across your supply chain.") +
      `</tr></table>` +
    `</td></tr>` +

    // ── Secondary CTA sections (image/text/button) ──────────────
    ctaSection(
      "Read today's briefing",
      "Article-grade write-ups on the incidents that matter to your sector — every morning.",
      "Read the latest",
      `${APP_URL}/?tab=briefings`,
      `${APP_URL}/icon-doc.png`
    ) +
    ctaSection(
      "Set your alert preferences",
      "Tell us your stack and sector so the daily digest stays sharp and noise stays low.",
      "Personalize",
      `${APP_URL}/?tab=settings`,
      `${APP_URL}/icon-sliders.png`
    ) +

    // ── What we ask in return ───────────────────────────────────
    `<tr><td style="padding:22px 28px;border-top:1px solid #2A2A2A;">` +
      `<div style="font-family:${INTER};font-size:11px;color:${GOLD};letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">What we ask in return</div>` +
      `<div style="font-family:${INTER};font-size:12.5px;color:${MUTED};line-height:1.6;">~30 minutes of feedback when we send a question · first look at new modules · a reference logo when the time comes. Light touch — we'll reach out.</div>` +
    `</td></tr>` +

    // ── Footer: wordmark + follow + social ──────────────────────
    `<tr><td style="padding:22px 28px;border-top:1px solid #333;background:${DEEP};">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>` +
        `<td style="vertical-align:middle;font-family:${INTER};font-size:16px;font-weight:700;color:#FFF;">Attacked<span style="color:${GOLD};">.ai</span></td>` +
        `<td style="vertical-align:middle;text-align:right;font-family:${INTER};font-size:11px;color:${MUTED};letter-spacing:0.06em;">` +
          `Follow &nbsp; <a href="https://www.linkedin.com" style="color:${GOLD};text-decoration:none;">LinkedIn</a> · <a href="https://x.com" style="color:${GOLD};text-decoration:none;">X</a>` +
        `</td>` +
      `</tr></table>` +
      `<div style="margin-top:16px;font-family:${INTER};font-size:10px;color:#585858;line-height:1.6;">You received this email because your design partner application was approved. <a href="${APP_URL}" style="color:#888;">Manage preferences</a>.<br>© 2026 Attacked.ai · GUARD framework</div>` +
    `</td></tr>` +

    `</table></body></html>`;
}

function rejectedHtml(app: any) {
  const firstName = (app.full_name || "there").split(" ")[0];
  return shell(
    "Re: your design partner application",
    `Design partner · cohort closed`,
    `<div style="font-family:${INTER};font-size:10.5px;color:${MUTED};letter-spacing:0.14em;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Cohort closed for this round</div>` +
    `<h1 style="font-family:${INTER};font-size:24px;font-weight:800;color:#FFF;margin:0 0 14px;line-height:1.2;letter-spacing:-0.015em;">Thanks for applying.</h1>` +
    `<p style="font-family:${INTER};font-size:14px;color:${MUTED};line-height:1.6;margin:0 0 12px;">Hi ${escape(firstName)} — we're not able to bring you into the design partner cohort this round.</p>` +
    `<p style="font-family:${INTER};font-size:13.5px;color:#FFF;line-height:1.6;margin:12px 0;">${app.decision_notes ? escape(app.decision_notes) : "The current cohort is sized for a tight feedback loop, and we're prioritising a few specific sectors this quarter."}</p>` +
    `<p style="font-family:${INTER};font-size:13.5px;color:#FFF;line-height:1.6;margin:14px 0;">Your <b>free intelligence inbox</b> stays active — you'll continue to get the daily summary. We open a new design partner round each quarter; please reapply if you're still interested.</p>` +
    `<div style="margin-top:18px;">` +
      `<a href="${APP_URL}" style="display:inline-block;padding:10px 20px;background:transparent;color:${GOLD};border:1px solid ${GOLD};text-decoration:none;border-radius:4px;font-family:${INTER};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Continue with free access →</a>` +
    `</div>`
  );
}

async function createSmtpClient() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD env vars are required");
  }
  return new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });
}

async function sendEmail(to: string | string[], subject: string, html: string) {
  let client: SMTPClient;
  try {
    client = await createSmtpClient();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const errs: any[] = [];
  for (const r of recipients) {
    try {
      await client.send({
        from: `${SENDER_NAME} <${GMAIL_USER}>`,
        to: r,
        subject,
        content: "This email is best viewed in an HTML-capable client.",
        html,
      });
    } catch (err) {
      errs.push({ to: r, error: (err as Error)?.message || String(err) });
    }
  }
  try { await client.close(); } catch { /* noop */ }
  return errs.length === 0 ? { ok: true } : { ok: false, errors: errs };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const type   = payload.type;
  const record = payload.record;
  const old    = payload.old_record;
  if (!record) return new Response(JSON.stringify({ ok: false, error: "no record" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const sent: any[] = [];
  const adminList = ADMIN_EMAIL.split(",").map((s) => s.trim()).filter(Boolean);

  if (type === "INSERT") {
    const adminRes = await sendEmail(adminList, `New partner application — ${record.full_name} @ ${record.company}`, adminAlertHtml(record));
    sent.push({ to: "admin", ...adminRes });
    const userRes = await sendEmail(record.email, "We've got your design partner application", userConfirmHtml(record));
    sent.push({ to: "applicant", ...userRes });
  } else if (type === "UPDATE" && old?.status !== record.status) {
    if (record.status === "approved") {
      const res = await sendEmail(record.email, "You're in — Attacked.ai design partner", approvedHtml(record));
      sent.push({ to: "applicant", flow: "approved", ...res });
    } else if (record.status === "rejected") {
      const res = await sendEmail(record.email, "Re: your Attacked.ai design partner application", rejectedHtml(record));
      sent.push({ to: "applicant", flow: "rejected", ...res });
    }
  }

  return new Response(JSON.stringify({ ok: true, type, status: record.status, provider: "gmail-smtp", sent }), { headers: { "Content-Type": "application/json" } });
});
