/**
 * US/Canada numbers as E.164 (+1XXXXXXXXXX) so the CRM can match, call and
 * text them. Anything else — international, short, typo'd — is passed
 * through as typed rather than guessed at.
 *
 * Shared by the CRM payload (lib/ghl-webhook.ts) and the duplicate guard
 * (lib/dedupe.ts) so both see "(555) 010-2026", "555-010-2026" and
 * "+1 555 010 2026" as the same number.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}
