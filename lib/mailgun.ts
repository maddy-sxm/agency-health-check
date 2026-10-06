/**
 * Minimal Mailgun transport (HTTP API, no SDK). Server-side only.
 *
 * Configuration (hosting project env vars):
 *   MAILGUN_API_KEY   private API key ("key-…" or the newer long form)
 *   MAILGUN_DOMAIN    sending domain verified in Mailgun, e.g. mg.speedxmedia.com
 *   MAILGUN_REGION    "us" (default) or "eu" — must match the domain's region
 *   MAIL_FROM         e.g. "SPEEDXMEDIA Agency Health Check <noreply@mg.speedxmedia.com>"
 *                     (defaults to postmaster@MAILGUN_DOMAIN)
 *
 * Without MAILGUN_API_KEY + MAILGUN_DOMAIN every send is a logged no-op, so
 * local dev and preview deployments never send mail by accident.
 */

const SEND_TIMEOUT_MS = 8000;

export interface MailgunConfig {
  endpoint: string;
  apiKey: string;
  from: string;
}

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "a@x.com, b@x.com; c@x.com" -> ["a@x.com", "b@x.com", "c@x.com"] (lower-cased, deduped, invalid dropped). */
export function parseRecipientList(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]/)) {
    const email = part.trim().toLowerCase();
    if (email && EMAIL_RE.test(email)) seen.add(email);
  }
  return [...seen];
}

export function resolveMailgunConfig(env: Record<string, string | undefined>): MailgunConfig | null {
  const apiKey = env.MAILGUN_API_KEY?.trim();
  const domain = env.MAILGUN_DOMAIN?.trim();
  if (!apiKey || !domain) return null;
  const host = (env.MAILGUN_REGION ?? "us").trim().toLowerCase() === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
  return {
    endpoint: `https://${host}/v3/${domain}/messages`,
    apiKey,
    from: env.MAIL_FROM?.trim() || `Agency Health Check <postmaster@${domain}>`,
  };
}

/** Pure request builder — what gets POSTed to Mailgun. */
export function buildMailgunRequest(config: MailgunConfig, message: MailMessage): { url: string; headers: Record<string, string>; body: string } {
  const body = new URLSearchParams();
  body.set("from", config.from);
  for (const recipient of message.to) body.append("to", recipient);
  body.set("subject", message.subject);
  body.set("text", message.text);
  if (message.html) body.set("html", message.html);
  if (message.replyTo) body.set("h:Reply-To", message.replyTo);
  return {
    url: config.endpoint,
    headers: {
      Authorization: "Basic " + Buffer.from(`api:${config.apiKey}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  };
}

/** Send via Mailgun. Resolves true on acceptance, false otherwise. Never throws. */
export async function sendMail(message: MailMessage, label: string): Promise<boolean> {
  const config = resolveMailgunConfig(process.env);
  if (!config) {
    console.warn(`[agency-health-check] Mailgun not configured — ${label} to ${message.to.join(", ")} was NOT sent.`);
    return false;
  }
  if (message.to.length === 0) {
    console.warn(`[agency-health-check] ${label}: no recipients — nothing sent.`);
    return false;
  }
  const req = buildMailgunRequest(config, message);
  try {
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`[agency-health-check] Mailgun rejected ${label} (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[agency-health-check] Mailgun request failed for ${label}:`, err);
    return false;
  }
}
