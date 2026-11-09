/**
 * Server-side duplicate-submission guard.
 *
 * The client disables the CTAs after a valid submit (ReportPreviewScreen),
 * but a reload, a second tab, or a bot can still resubmit the same lead.
 * Before this existed one respondent produced 8 rows and 8 staff emails in
 * a minute. A repeat of the same (email, phone, CTA) inside a short window
 * is still stored in Redis (nothing is lost) but is not forwarded to the
 * Sheet or emailed again.
 *
 * Design notes (from security review):
 *  - The key is a SHA-256 of the identity, so no email/phone ever appears
 *    in Redis key names on the shared instance.
 *  - The window is short (5 min): long enough to absorb re-clicks and
 *    reloads, short enough that a planted marker can't suppress a real
 *    lead for long.
 *  - The marker is a *reservation*: callers release it if delivery fails,
 *    so a failed Sheet write never leaves a lead silently undelivered.
 *  - Fails open: with no Redis, or if Redis errors, nothing is a duplicate.
 */

import { createHash } from "node:crypto";

export const DEDUPE_WINDOW_SECONDS = 5 * 60;

export interface DedupeInput {
  email: string;
  phone: string;
  intent: "report" | "call";
}

/** Minimal slice of the Upstash client we need — injectable for tests. */
export interface DedupeClient {
  set(key: string, value: string, opts: { nx: true; ex: number }): Promise<string | null>;
  del(key: string): Promise<number>;
}

export function duplicateKey(input: DedupeInput): string {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.replace(/\D/g, "");
  const digest = createHash("sha256").update(`${email}|${phone}|${input.intent}`).digest("hex");
  return `agency-health-check:dedupe:${digest}`;
}

/**
 * Try to reserve this identity. Returns true if an identical submission
 * was already reserved within the window (i.e. this one is a duplicate).
 */
export async function isDuplicateSubmission(input: DedupeInput, client: DedupeClient | null): Promise<boolean> {
  if (!client) return false;
  try {
    const result = await client.set(duplicateKey(input), "1", { nx: true, ex: DEDUPE_WINDOW_SECONDS });
    return result === null; // null => key already existed => duplicate
  } catch (err) {
    console.error("[agency-health-check] dedupe check failed (treating as new):", err);
    return false;
  }
}

/** Give the reservation back so a retry can deliver (used when delivery failed). */
export async function releaseDuplicateReservation(input: DedupeInput, client: DedupeClient | null): Promise<void> {
  if (!client) return;
  try {
    await client.del(duplicateKey(input));
  } catch (err) {
    console.error("[agency-health-check] dedupe release failed:", err);
  }
}
