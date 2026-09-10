/**
 * AGENCY HEALTH CHECK → GOOGLE SHEETS WEBHOOK
 *
 * Google Apps Script that receives one HTTPS POST per completed submission
 * from the live tool (see lib/sheets-webhook.ts in the app repo) and appends
 * one row to the "Agency Tool Leads" tab of the SPEEDX lead spreadsheet.
 * Never overwrites existing rows.
 *
 * Opens the spreadsheet by ID, so it works both as a standalone project
 * (script.google.com) and as a script bound to the sheet. The deploying
 * account needs edit access to the sheet.
 *
 * Column lookup is by header name (row 1), so columns can be reordered in
 * the sheet without touching this script. Payload keys match the
 * "Webhook Setup" tab.
 *
 * DEPLOY: script.google.com → New project → paste this file → Deploy → New
 * deployment → type "Web app" → Execute as "Me" → Who has access
 * "Anyone" → Deploy. Copy the Web app URL into the app's LEAD_WEBHOOK_URL
 * env var. Re-deploy (new version) after any edit to this file.
 */

const SPREADSHEET_ID = '1OJRt-0Ua6n_9OrGa9R-TlSp4KofjDi4QndZJJZm2X88';
const SHEET_NAME = 'Agency Tool Leads';

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const flat = {
      'Submitted At': payload.submittedAt || new Date().toISOString(),
      'First Name': payload.firstName || '',
      'Last Name': payload.lastName || '',
      'Email': payload.email || '',
      'Phone': payload.phone || '',
      'Company': payload.company || '',
      'Website': payload.website || '',
      'Job Title': payload.jobTitle || '',
      'Monthly Marketing Budget': payload.monthlyMarketingBudget || '',
      'Current Agency': payload.currentAgency || '',
      'Services Selected': Array.isArray(payload.services) ? payload.services.join(', ') : (payload.services || ''),
      'Agency Score': payload.agencyScore ?? '',
      'Internal Lead Score': payload.leadScore ?? '',
      'Lead Tier': payload.leadTier || '',
      'Result / Archetype': payload.archetype || '',
      'Lowest-Scoring Pillar': payload.lowestPillar || '',
      'Lowest Pillar Score': payload.lowestPillarScore ?? '',
      'CTA Action': payload.ctaAction || '',
      'Source': payload.source || 'agency-health-check',
      'UTM Source': payload.utmSource || '',
      'UTM Medium': payload.utmMedium || '',
      'UTM Campaign': payload.utmCampaign || '',
      'UTM Content': payload.utmContent || '',
      'UTM Term': payload.utmTerm || '',
      'Referrer': payload.referrer || '',
      'Landing Page': payload.landingPage || '',
      'Submission ID': payload.submissionId || Utilities.getUuid(),
      'Answers JSON': JSON.stringify(payload.answers || {}),
      'Pillar Scores JSON': JSON.stringify(payload.pillarScores || {}),
      'Raw Payload JSON': JSON.stringify(payload),
      'Outreach Status': 'New',
      'Owner': '',
      'Notes': ''
    };

    const row = headers.map(h => Object.prototype.hasOwnProperty.call(flat, h) ? flat[h] : '');
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, submissionId: flat['Submission ID'] }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Health check — open the Web app URL in a browser to confirm it's deployed. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'agency-health-check-sheet-webhook' }))
    .setMimeType(ContentService.MimeType.JSON);
}
