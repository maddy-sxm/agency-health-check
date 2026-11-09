/**
 * Server-side duplicate-submission guard.
 *
 * The client disables the CTAs after a valid submit (ReportPreviewScreen),
 * but a reload, a second tab, or a bot can still resubmit the same lead.
 * Before this existed one respondent produced 8 rows and 8 staff emails in
 * a minute. This marks (email, phone, CTA) as seen in Redis for a short
 * window; a repeat inside the window is still saved (so nothing is lost)
 * but is NOT forwarded to the Sheet or emailed again.
 *
 * Fails open: with no Redis, or if Redis errors, nothing is a duplicate.
 */

const WINDOW_SECONDS = 15 * 60;

export interface DedupeInput {
  email: string;
  phone: string;
  intent: "report" | "call";
}

/** Minimal slice of the Upstash client we need — injectable for tests. */
export interface DedupeClient {
  set(key: string, value: string, opts: { nx: true; ex: number }): Promise<string | null>;
}

export function duplicateKey(input: DedupeInput): string {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");
  return `agency-health-check:dedupe:${email}:${phone}:${input.intent}`;
}

/** True when an identical submission was already seen within the window. */
export async function isDuplicateSubmission(input: DedupeInput, client: DedupeClient | null): Promise<boolean> {
  if (!client) return false;
  try {
    const result = await client.set(duplicateKey(input), "1", { nx: true, ex: WINDOW_SECONDS });
    return result === null; // null => key already existed => duplicate
  } catch (err) {
    console.error("[agency-health-check] dedupe check failed (treating as new):", err);
    return false;
  }
}
