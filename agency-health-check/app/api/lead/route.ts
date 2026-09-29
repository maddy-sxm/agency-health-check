import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { saveLead } from "@/lib/leads";
import { computePublicResult, trueAgencyHealthScore } from "@/lib/scoring";
import { computeInternalLeadScore } from "@/lib/internal-scoring";
import { sendAgencyHealthReportEmail } from "@/lib/email";
import { ROLE_OPTIONS } from "@/lib/types";
import type { DiagnosticAnswers, LeadRecord, QualificationAnswers, RoleId } from "@/lib/types";

export const runtime = "nodejs";

const utmSchema = z
  .object({
    utm_source: z.string().max(255).optional(),
    utm_medium: z.string().max(255).optional(),
    utm_campaign: z.string().max(255).optional(),
    utm_term: z.string().max(255).optional(),
    utm_content: z.string().max(255).optional(),
    landingUrl: z.string().max(2048).optional(),
  })
  .partial();

const roleEnumValues = ROLE_OPTIONS.map((r) => r.id) as [RoleId, ...RoleId[]];

// Permissive on purpose — phone formats vary internationally. Just checks
// there are at least 7 digits in there somewhere, same spirit as the email
// regex below (real validation, not a strict format lock).
const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .refine((v) => (v.match(/\d/g)?.length ?? 0) >= 7, "Phone number must include at least 7 digits"),
  role: z.enum(roleEnumValues),
});

// Answers are self-reported quiz responses, not sensitive lookups — kept as
// loose optional string maps. lib/scoring.ts and lib/internal-scoring.ts
// both fall back to 0 points for any key/value that isn't a real option id,
// so a malformed or tampered payload degrades to a lower score rather than
// throwing or fabricating credit.
const diagnosticAnswersSchema = z.record(z.string().max(64)).optional().default({});
const qualificationAnswersSchema = z.record(z.string().max(64)).optional().default({});

const requestSchema = z.object({
  contact: contactSchema,
  services: z.array(z.string().max(64)).max(20).optional().default([]),
  diagnosticAnswers: diagnosticAnswersSchema,
  qualificationAnswers: qualificationAnswersSchema,
  // "report" (default) = email the full report; "call" = respondent chose
  // to skip straight to booking instead. See ReportPreviewScreen.
  intent: z.enum(["report", "call"]).optional().default("report"),
  utm: utmSchema.optional().default({}),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Recompute the public result server-side from the raw answers rather
  // than trusting anything the client might have sent alongside them — the
  // client-side computation in AgencyHealthCheckExperience exists purely
  // for instant UI feedback, this is the value of record.
  const publicResult = computePublicResult(data.diagnosticAnswers as DiagnosticAnswers);

  // Internal SPEEDX lead score — computed here, in a server-only module,
  // and never included in the response below. See lib/internal-scoring.ts.
  // Deliberately uses the TRUE, uncapped 0-100 score for the agency-pain
  // input, not publicResult.score — the public score is hard-capped at 62
  // by product decision (see PUBLIC_SCORE_CEILING in lib/scoring.ts) so no
  // respondent ever looks "healthy," but that cap would otherwise flatten
  // every genuinely strong agency to the same inflated internal pain
  // signal. Sales still needs the accurate read.
  const internal = computeInternalLeadScore({
    qualification: data.qualificationAnswers as QualificationAnswers,
    role: data.contact.role,
    agencyHealthScore: trueAgencyHealthScore(data.diagnosticAnswers as DiagnosticAnswers),
  });

  const leadId = uuidv4();
  const record: LeadRecord = {
    leadId,
    contact: data.contact,
    services: data.services,
    diagnosticAnswers: data.diagnosticAnswers as DiagnosticAnswers,
    qualificationAnswers: data.qualificationAnswers as QualificationAnswers,
    publicResult,
    internalLeadScore: internal.score,
    internalClassification: internal.classification,
    intent: data.intent,
    utm: data.utm,
    source: "agency-health-check",
    createdAt: new Date().toISOString(),
  };

  await saveLead(record);

  // Fires for BOTH intents — the "report" and "call" CTAs are additive,
  // not alternatives: choosing to book a call doesn't forfeit the emailed
  // report. `intent` is stored on the record purely as sales context (did
  // they want the report reveal or to skip straight to a human) — it no
  // longer gates the email. A failure here shouldn't fail the whole
  // request: the lead is already saved either way, and
  // sendAgencyHealthReportEmail itself never throws (see lib/email.ts).
  await sendAgencyHealthReportEmail(record);

  // Only the public result goes back to the browser — never
  // internalLeadScore / internalClassification.
  return NextResponse.json({ leadId, result: publicResult });
}
