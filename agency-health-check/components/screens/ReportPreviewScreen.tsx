"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";
import { PILLARS } from "@/lib/pillars";
import ScoreRing from "@/components/ScoreRing";
import PillarCard from "@/components/PillarCard";
import BlurredReveal from "@/components/BlurredReveal";
import { ROLE_OPTIONS } from "@/lib/types";
import type { ContactInfo, PublicResult, RoleId } from "@/lib/types";

interface ReportPreviewScreenProps {
  result: PublicResult;
  /** Primary path — fires immediately on valid submit — the parent kicks
   *  off the API call and transitions to the "generating" screen right
   *  away, rather than this form awaiting the network itself. */
  onSubmitReport: (contact: ContactInfo) => void;
  /** Secondary path — same captured lead, but heads straight to booking a
   *  call instead of waiting on the emailed report. Fire-and-forget from
   *  this screen's perspective. */
  onSubmitCall: (contact: ContactInfo) => void;
  /** Set by the parent if a previous submit attempt's API call failed. */
  error?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive on purpose (matches the server-side check in
// app/api/lead/route.ts) — phone formats vary internationally, this just
// confirms there's a real number in there.
const PHONE_DIGITS_RE = /\d/g;
const MIN_PHONE_DIGITS = 7;

/**
 * The score reveal IS the lead-capture screen — one continuous page, not a
 * gate you fill out blind. Scrolling down from the score circle through
 * the (mostly blurred, but genuinely computed) report preview leads
 * straight into the same contact form and CTAs that used to live behind a
 * separate wall. See BlurredReveal for why the blurred content is real,
 * not placeholder.
 */
export default function ReportPreviewScreen({ result, onSubmitReport, onSubmitCall, error: externalError = null }: ReportPreviewScreenProps) {
  const { pillars, strengths, strengthsHeading, weaknesses, weaknessesHeading, synthesis } = result;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RoleId | "">("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const error = validationError ?? externalError;

  const validate = (): ContactInfo | null => {
    if (!name.trim() || !phone.trim() || !role) {
      setValidationError(COPY.errors.requiredField);
      return null;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setValidationError(COPY.errors.invalidEmail);
      return null;
    }
    if ((phone.match(PHONE_DIGITS_RE)?.length ?? 0) < MIN_PHONE_DIGITS) {
      setValidationError(COPY.errors.invalidPhone);
      return null;
    }
    setValidationError(null);
    return { name: name.trim(), email: email.trim(), phone: phone.trim(), role };
  };

  const handleSubmitCall = () => {
    const contact = validate();
    if (contact) onSubmitCall(contact);
  };

  const handleSubmitReport = () => {
    const contact = validate();
    if (contact) onSubmitReport(contact);
  };

  return (
    <div className="w-full max-w-lg mx-auto animate-reveal-scale">
      <div className="flex flex-col items-center text-center mb-8">
        <ScoreRing score={result.score} />
        <span className="mt-3 font-mono text-[11px] tracking-[0.2em] uppercase text-smoke">{COPY.results.scoreLabel}</span>
        <h1 className="font-display font-extrabold uppercase text-3xl md:text-4xl text-bone mt-4 mb-3">{result.tierLabel}</h1>
        <p className="font-sans text-[15px] text-bone/80 leading-relaxed max-w-sm">{result.tierMessage}</p>
      </div>

      <div className="mb-8">
        <div className="mb-3 font-mono text-[11px] tracking-[0.2em] uppercase text-smoke text-center">
          {COPY.results.pillarsHeading}
        </div>
        <div className="flex flex-col gap-3">
          {pillars.map((pillar) => {
            const meta = PILLARS.find((p) => p.key === pillar.key)!;
            return (
              <PillarCard key={pillar.key} pillar={pillar} description={meta.description} locked={pillar.key !== "communication"} />
            );
          })}
        </div>
      </div>

      {strengthsHeading && (
        <div className="mb-6">
          <div className="mb-3 font-mono text-[11px] tracking-[0.2em] uppercase text-keep-bright">{strengthsHeading}</div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2.5 bg-ink-2 border border-line rounded-[10px] px-4 py-3 text-[14px] text-bone/90">
              <span className="text-keep-bright mt-0.5 shrink-0" aria-hidden>
                ✓
              </span>
              {strengths[0].phrase}
            </li>
          </ul>
          {strengths.length > 1 && (
            <div className="mt-2">
              <BlurredReveal>
                <ul className="flex flex-col gap-2">
                  {strengths.slice(1).map((s) => (
                    <li
                      key={s.questionId}
                      className="flex items-start gap-2.5 bg-ink-2 border border-line rounded-[10px] px-4 py-3 text-[14px] text-bone/90"
                    >
                      <span className="text-keep-bright mt-0.5 shrink-0" aria-hidden>
                        ✓
                      </span>
                      {s.phrase}
                    </li>
                  ))}
                </ul>
              </BlurredReveal>
            </div>
          )}
        </div>
      )}

      {weaknessesHeading && (
        <div className="mb-6">
          <div className="mb-3 font-mono text-[11px] tracking-[0.2em] uppercase text-red">{weaknessesHeading}</div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2.5 bg-ink-2 border border-line rounded-[10px] px-4 py-3 text-[14px] text-bone/90">
              <span className="text-red-bright mt-0.5 shrink-0" aria-hidden>
                ●
              </span>
              {weaknesses[0].phrase}
            </li>
          </ul>
          {weaknesses.length > 1 && (
            <div className="mt-2">
              <BlurredReveal>
                <ul className="flex flex-col gap-2">
                  {weaknesses.slice(1).map((s) => (
                    <li
                      key={s.questionId}
                      className="flex items-start gap-2.5 bg-ink-2 border border-line rounded-[10px] px-4 py-3 text-[14px] text-bone/90"
                    >
                      <span className="text-red-bright mt-0.5 shrink-0" aria-hidden>
                        ●
                      </span>
                      {s.phrase}
                    </li>
                  ))}
                </ul>
              </BlurredReveal>
            </div>
          )}
        </div>
      )}

      {!weaknessesHeading && (
        <div className="mb-6 text-center bg-ink-2 border border-line rounded-[10px] px-4 py-4">
          <p className="text-[14px] text-bone/80">{COPY.results.noGapsMessage}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 font-mono text-[11px] tracking-[0.2em] uppercase text-smoke">
          {COPY.results.whatThisMeansHeading}
        </div>
        <BlurredReveal>
          <p className="text-[15px] leading-relaxed text-bone/90">{synthesis.whatThisMeans}</p>
        </BlurredReveal>
      </div>

      <div className="mb-10">
        <div className="mb-2 font-mono text-[11px] tracking-[0.2em] uppercase text-smoke">
          {COPY.results.recommendationHeading}
        </div>
        <BlurredReveal>
          <p className="text-[15px] leading-relaxed text-bone/90">{synthesis.recommendation}</p>
        </BlurredReveal>
      </div>

      <div className="text-center">
        <h2 className="font-display font-extrabold uppercase text-2xl leading-[1.1] text-bone mb-6 md:text-3xl">
          {COPY.leadGate.headline}
        </h2>
      </div>

      <div className="bg-ink-2 border border-line rounded-[14px] p-5 text-left">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={COPY.leadGate.fields.name}
          className="w-full bg-ink border border-line focus:border-red outline-none rounded-[7px] px-4 py-3 text-bone text-[15px] placeholder:text-smoke/50 transition-colors mb-3"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={COPY.leadGate.fields.email}
          className="w-full bg-ink border border-line focus:border-red outline-none rounded-[7px] px-4 py-3 text-bone text-[15px] placeholder:text-smoke/50 transition-colors mb-3"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={COPY.leadGate.fields.phone}
          className="w-full bg-ink border border-line focus:border-red outline-none rounded-[7px] px-4 py-3 text-bone text-[15px] placeholder:text-smoke/50 transition-colors mb-3"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleId)}
          className="w-full bg-ink border border-line focus:border-red outline-none rounded-[7px] px-4 py-3 text-bone text-[15px] transition-colors mb-1 appearance-none"
        >
          <option value="" disabled className="text-smoke">
            {COPY.leadGate.fields.rolePlaceholder}
          </option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.id} value={r.id} className="bg-ink text-bone">
              {r.label}
            </option>
          ))}
        </select>

        {error && <p className="text-[13px] text-red-400 mt-2">{error}</p>}

        <button
          onClick={handleSubmitCall}
          className="w-full mt-4 bg-red hover:bg-red-bright text-white font-sans font-semibold text-sm tracking-wide uppercase py-3.5 rounded-[7px] transition-colors"
        >
          {COPY.leadGate.bookCallCta} →
        </button>
        <p className="mt-2 text-[11px] text-bone/70 text-center">{COPY.leadGate.bookCallSub}</p>

        <div className="flex items-center gap-3 my-3" aria-hidden>
          <div className="flex-1 h-px bg-line" />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-smoke/70">{COPY.leadGate.orDivider}</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <button
          onClick={handleSubmitReport}
          className="w-full bg-transparent border-2 border-line hover:border-red text-bone font-sans font-semibold text-sm tracking-wide uppercase py-3.5 rounded-[7px] transition-colors"
        >
          {COPY.leadGate.cta} →
        </button>

        <p className="mt-3 text-[11px] text-smoke/70 text-center">{COPY.leadGate.privacyNote}</p>
      </div>
    </div>
  );
}
