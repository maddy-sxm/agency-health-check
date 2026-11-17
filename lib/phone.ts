/**
 * US/Canada numbers as E.164 (+1XXXXXXXXXX) so the CRM can match, call and
 * text them. Anything else — international, short, typo'd — is passed
 * through as typed rather than guessed at.
 *
 * This is the display/CRM form. For comparing numbers use phoneIdentity()
 * below — formatting choices here (a typed "+" is kept as typed) must not
 * decide whether two submissions are the same person.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

/**
 * A strictly canonical form for comparing phone numbers, used by the
 * duplicate guard (lib/dedupe.ts): digits only, and an 11-digit number
 * starting with the US/Canada country code 1 loses that 1. So
 * "(555) 010-2026", "555-010-2026", "+5550102026", "1-555-010-2026" and
 * "+1 555 010 2026" are all "5550102026". Never shown or stored anywhere.
 */
export function phoneIdentity(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
