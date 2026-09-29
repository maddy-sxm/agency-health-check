"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COPY, CTA_HREF } from "@/lib/copy";
import { trackCustomEvent, trackStandardEvent } from "@/lib/pixel";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/questions";
import { computePublicResult } from "@/lib/scoring";
import type { ContactInfo, DiagnosticAnswers, PublicResult, UtmParams } from "@/lib/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackgroundMark from "@/components/BackgroundMark";
import HeroScreen from "@/components/screens/HeroScreen";
import QuestionScreen from "@/components/screens/QuestionScreen";
import AnalyzingScreen from "@/components/screens/AnalyzingScreen";
import ReportPreviewScreen from "@/components/screens/ReportPreviewScreen";
import ReportSentScreen from "@/components/screens/ReportSentScreen";

// Stage names kept as-is even though their meaning shifted: "leadForm" now
// renders ReportPreviewScreen (the score/pillar/strengths preview WITH the
// contact form at the bottom of the same scrollable page, not a blind
// gate before it), and "results" now renders ReportSentScreen (a simple
// post-submission receipt — the respondent already saw the full preview
// before submitting, so there's nothing left to reveal here).
//
// The "qualification" stage (4 firmographic questions — revenue,
// marketing spend, agency spend, renewal timing) has been removed from
// this flow. The question definitions and scoring logic that consume
// them (lib/questions.ts's QUALIFICATION_QUESTIONS, lib/internal-scoring.ts)
// are left in place, not deleted — qualificationAnswers is now always sent
// as {}, which those functions already treat as "no answer" (0 points),
// so nothing crashes. Net effect: the internal SPEEDX lead score loses the
// revenue/budget/renewal components (65% of its weighting) since that data
// is no longer collected — see the note where submitLead is defined.
type Stage = "hero" | "diagnostic" | "analyzing-diagnostic" | "leadForm" | "generating" | "results";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export default function AgencyHealthCheckExperience() {
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>("hero");
  const [services, setServices] = useState<string[]>([]);
  const [diagnosticStep, setDiagnosticStep] = useState(0);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<DiagnosticAnswers>({});
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [publicResult, setPublicResult] = useState<PublicResult | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [utm, setUtm] = useState<UtmParams>({});

  // Holds the in-flight /api/lead request while the "generating" screen
  // plays out its few seconds — same pattern as the sibling tools' match
  // flow. Kicked off immediately on lead-form submit, not awaited until the
  // animation finishes (see handleGeneratingDone).
  const pendingLeadRef = useRef<Promise<Response> | null>(null);

  useEffect(() => {
    const utmParams: UtmParams = { landingUrl: typeof window !== "undefined" ? window.location.href : undefined };
    UTM_KEYS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) utmParams[key] = value;
    });
    setUtm(utmParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage, diagnosticStep]);

  const handleStart = useCallback((selectedServiceIds: string[]) => {
    trackCustomEvent("AgencyHealthCheck_Started", { serviceCount: selectedServiceIds.length });
    setServices(selectedServiceIds);
    setDiagnosticStep(0);
    setStage("diagnostic");
  }, []);

  const handleAnswerDiagnostic = useCallback(
    (optionId: string) => {
      const question = DIAGNOSTIC_QUESTIONS[diagnosticStep];
      const nextAnswers = { ...diagnosticAnswers, [question.id]: optionId };
      setDiagnosticAnswers(nextAnswers);
      trackCustomEvent("AgencyHealthCheck_DiagnosticAnswered", { questionId: question.id, optionId });

      if (diagnosticStep < DIAGNOSTIC_QUESTIONS.length - 1) {
        setDiagnosticStep((i) => i + 1);
        return;
      }
      // Last diagnostic question — score is a pure, instant local
      // computation, no network round trip needed for correctness.
      setPublicResult(computePublicResult(nextAnswers));
      setStage("analyzing-diagnostic");
    },
    [diagnosticStep, diagnosticAnswers]
  );

  const handleBackDiagnostic = useCallback(() => {
    if (diagnosticStep === 0) {
      setStage("hero");
      return;
    }
    setDiagnosticStep((i) => i - 1);
  }, [diagnosticStep]);

  // Goes straight to the report preview / lead form — the qualification
  // stage (4 firmographic questions) has been removed from this flow.
  const handleAnalyzingDiagnosticDone = useCallback(() => {
    setStage("leadForm");
  }, []);

  // Shared by both lead-form buttons — same payload shape, only `intent`
  // differs. Not awaited by either caller: the "report" path hands the
  // Promise to pendingLeadRef for the generating screen to await later;
  // the "call" path below fires it and moves on immediately.
  //
  // qualificationAnswers is always {} now — that data is no longer
  // collected from the respondent (see the Stage comment above). The API
  // route and computeInternalLeadScore both already treat a missing answer
  // as 0 points rather than throwing, so this degrades gracefully: the
  // internal lead score still computes, it just loses the revenue/budget/
  // renewal-timing components.
  const submitLead = useCallback(
    (submittedContact: ContactInfo, intent: "report" | "call") =>
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: submittedContact,
          services,
          diagnosticAnswers,
          qualificationAnswers: {},
          intent,
          utm,
        }),
      }),
    [services, diagnosticAnswers, utm]
  );

  const handleSubmitForReport = useCallback(
    (submittedContact: ContactInfo) => {
      setContact(submittedContact);
      setLeadError(null);
      pendingLeadRef.current = submitLead(submittedContact, "report");
      setStage("generating");
    },
    [submitLead]
  );

  // Skips the report and the "generating" screen entirely — the lead is
  // still captured (fire-and-forget; this screen doesn't block on it or
  // surface its errors, same trade-off the sibling tools make for
  // low-stakes background saves), and the respondent goes straight to
  // booking a call.
  const handleSubmitForCall = useCallback(
    (submittedContact: ContactInfo) => {
      setContact(submittedContact);
      submitLead(submittedContact, "call").catch(() => {
        // Best effort — the respondent is already headed to CTA_HREF below.
      });
      trackStandardEvent("Lead");
      trackCustomEvent("AgencyHealthCheck_BookCallChosen", {});
      window.location.href = CTA_HREF;
    },
    [submitLead]
  );

  const handleGeneratingDone = useCallback(async () => {
    const pending = pendingLeadRef.current;
    if (!pending || !publicResult) {
      setLeadError(COPY.errors.generic);
      setStage("leadForm");
      return;
    }
    try {
      const res = await pending;
      if (!res.ok) {
        setLeadError(COPY.errors.generic);
        setStage("leadForm");
        return;
      }
      trackStandardEvent("Lead");
      trackCustomEvent("AgencyHealthCheck_Completed", { tier: publicResult.tier, score: publicResult.score });
      setStage("results");
    } catch {
      setLeadError(COPY.errors.generic);
      setStage("leadForm");
    }
  }, [publicResult]);

  const handleStartOver = useCallback(() => {
    setStage("hero");
    setServices([]);
    setDiagnosticStep(0);
    setDiagnosticAnswers({});
    setContact(null);
    setPublicResult(null);
    setLeadError(null);
    pendingLeadRef.current = null;
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-ink">
      <BackgroundMark />
      <Header />
      <main className="flex-1 flex items-start justify-center px-5 py-12 md:py-16">
        {stage === "hero" && <HeroScreen onStart={handleStart} />}

        {stage === "diagnostic" &&
          (() => {
            const question = DIAGNOSTIC_QUESTIONS[diagnosticStep];
            return (
              <QuestionScreen
                key={question.id}
                eyebrow={question.eyebrow}
                headline={question.headline}
                sub={question.sub}
                options={question.options}
                onSelect={handleAnswerDiagnostic}
                onBack={handleBackDiagnostic}
                progress={{ current: diagnosticStep + 1, total: DIAGNOSTIC_QUESTIONS.length }}
              />
            );
          })()}

        {stage === "analyzing-diagnostic" && (
          <AnalyzingScreen messages={COPY.analyzing.diagnostic.messages} onDone={handleAnalyzingDiagnosticDone} />
        )}

        {stage === "leadForm" && publicResult && (
          <ReportPreviewScreen
            result={publicResult}
            onSubmitReport={handleSubmitForReport}
            onSubmitCall={handleSubmitForCall}
            error={leadError}
          />
        )}

        {stage === "generating" && (
          <AnalyzingScreen messages={COPY.analyzing.report.messages} onDone={handleGeneratingDone} />
        )}

        {stage === "results" && (
          <ReportSentScreen
            name={contact?.name ?? ""}
            email={contact?.email ?? ""}
            onStartOver={handleStartOver}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
