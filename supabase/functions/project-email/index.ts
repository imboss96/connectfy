// @ts-nocheck
declare const Deno: { env: { get(name: string): string | undefined } };

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  buildLegacySheetEmailHtml,
  buildLegacySheetEmailText,
  LEGACY_SHEET_EMAIL_SUBJECT
} from '../../../src/lib/legacySheetEmail.js';

const allowedOrigins = [
  'https://connectfy.tech',
  'https://www.connectfy.tech',
  'http://localhost:5173',
  'http://localhost:3000'
];
const adminEmailTypes = new Set(['invite', 'rejected', 'utest_update_required', 'legacy_sheet_reapply']);

const isAllowedOrigin = (value?: string | null) => {
  if (!value) return false;

  return allowedOrigins.includes(value)
    || value.startsWith('http://localhost:')
    || value.startsWith('http://127.0.0.1:')
    || value.startsWith('http://[::1]:');
};

const corsHeadersFor = (origin?: string | null) => {
  const originHeader = isAllowedOrigin(origin) ? origin : 'https://connectfy.tech';

  return {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
};

const verifyAdminRequest = async (authorization: string | null) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization) {
    return { status: 401, message: 'Sign in with an administrator account to send this email.' };
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return { status: 500, message: 'Email backend is missing SUPABASE_URL or SUPABASE_ANON_KEY configuration.' };
  }

  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const authResponse = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization }
  });
  if (!authResponse.ok) {
    return { status: 401, message: 'Your admin session is invalid or has expired. Please sign in again.' };
  }

  const user = await authResponse.json();
  const roleResponse = await fetch(`${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization }
  });
  if (!roleResponse.ok) {
    return { status: 403, message: 'Unable to verify your admin access.' };
  }
  const profiles = await roleResponse.json();
  if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
    return { status: 403, message: 'Only administrators can send this email.' };
  }

  return null;
};

const formatProjectDescription = (description: string) => {
  if (!description) return 'No summary provided yet.';
  const clean = description.replace(/\s+/g, ' ').trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
};

const buildHtml = (payload: Record<string, any>) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailHtml(payload.toName, projectLink, payload.supportEmail);
  }
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const projectDescription = formatProjectDescription(payload.projectDescription || '');
  const isLegacySheetReapply = payload.type === 'legacy_sheet_reapply';
  const applicationDetails = payload.type === 'application'
    ? `<div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#0b5cff;">Application summary</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#334155;">Application reference: ${payload.applicationReference || 'Pending'}<br>Country: ${payload.applicantCountry || 'Not provided'}<br>Device: ${payload.applicantDevice || 'Not provided'}<br>uTest ID: ${payload.uTestId || 'Not provided'}<br>uTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}<br>Submitted: ${payload.submittedAt || 'Just now'}</p></div><div style="background:#eff6ff;border-left:4px solid #0b5cff;border-radius:8px;padding:14px 16px;margin:20px 0;font-size:13px;line-height:1.7;color:#1e3a8a;"><strong>Payment processing:</strong> Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided in your application.</div>`
    : payload.type === 'utest_update_required'
      ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#9a4d00;">Action required</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#7c2d12;">Thank you for your interest in this project. We cannot move forward with your current application because the project requires a valid uTest account created within the last 7 days. Please create a new uTest account at <a href="https://www.utest.com/signup" style="color:#0b5cff;font-weight:700;">uTest account registration</a>, then return to Connectfy and reapply using the new account's uTest ID and email. Your application has been reopened for reapplication while the project is accepting applicants. Watch the setup guide here: <a href="https://www.youtube.com/watch?v=F_XmEVQZaHc" style="color:#0b5cff; font-weight:700;">https://www.youtube.com/watch?v=F_XmEVQZaHc</a></p></div>`
      : '';
  const type = payload.type === 'accepted' ? 'accepted' : payload.type === 'rejected' ? 'rejected' : payload.type === 'declined' ? 'declined' : payload.type === 'invite' ? 'invite' : payload.type === 'utest_update_required' ? 'utest_update_required' : isLegacySheetReapply ? 'legacy_sheet_reapply' : 'application';
  const actionLabel = type === 'invite' ? 'Accept Invite' : type === 'accepted' ? 'View Dashboard' : type === 'rejected' ? 'Browse More Projects' : type === 'declined' ? 'Review Status' : type === 'utest_update_required' ? 'Return to Project & Reapply' : isLegacySheetReapply ? 'Open Connectfy' : 'Review Project';
  const safeToName = String(payload.toName || 'there').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  return `
    <div style="font-family: Arial, sans-serif; background: #f6f9fc; padding: 32px; color: #10213b;">
      <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #dfeaf5; border-radius: 18px; overflow: hidden;">
        <div style="padding: 24px 28px; background: linear-gradient(135deg, #0f172a 0%, #0b5cff 100%); color: white;">
          <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.8;">
            ${type === 'invite' ? 'Project Invite' : type === 'accepted' ? 'Invite Accepted' : type === 'rejected' ? 'Application Update' : type === 'declined' ? 'Invite Declined' : 'Project Application'}
          </div>
          <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.2;">${projectTitle}</h1>
        </div>
        <div style="padding: 28px;">
          <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.7;">
            Hello ${isLegacySheetReapply ? safeToName : payload.toName || 'there'},
          </p>
          <p style="font-size: 15px; color: #334155; line-height: 1.7;">
            ${type === 'invite'
              ? `You have been invited to work on a live opportunity with ${projectCompany}.`
              : type === 'accepted'
                ? `You accepted the invite for ${projectCompany}'s ${projectTitle} project and the project workspace is ready.`
                : type === 'rejected'
                  ? `Your application for ${projectCompany}'s ${projectTitle} project was not selected for this cycle.`
                  : type === 'declined'
                    ? `You declined the project invite for ${projectCompany}'s ${projectTitle} project.`
                    : type === 'utest_update_required'
                      ? `Thank you for your interest in ${projectCompany}'s ${projectTitle} project. We cannot move forward with your current application because this project requires a valid uTest account created within the last 7 days.`
                      : isLegacySheetReapply
                        ? 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we are unable to proceed with your current uTest account for this project.'
                      : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`}
          </p>
          <div style="background: #f8fbff; border: 1px solid #dfeaf5; border-radius: 12px; padding: 16px 18px; margin: 20px 0;">
            <div style="font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: #4c7cff; font-weight: bold;">Project overview</div>
            <div style="margin-top: 12px; font-size: 22px; font-weight: 700; color: #0f172a;">${projectTitle}</div>
            <div style="margin-top: 6px; font-size: 14px; color: #475569; font-weight: 600;">${projectCompany} • ${projectCategory}</div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #475569; line-height: 1.7;">${projectDescription}</p>
            <p style="margin: 14px 0 0; font-size: 13px; color: #0f172a; font-weight: 600;">${deadline}</p>
          </div>
          ${applicationDetails}
          ${isLegacySheetReapply ? `<div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong>What to do next</strong><p style="margin:10px 0 0;font-size:13px;line-height:1.7;color:#334155;">Please create a new uTest account, then return to Connectfy and apply for the project again using your new uTest ID and email address.</p><p style="margin:12px 0 0;font-size:13px;"><a href="https://www.utest.com/signup" style="color:#0b5cff;font-weight:700;">Create a uTest account</a></p></div>` : ''}
          ${isLegacySheetReapply ? '' : `<p style="font-size:14px;color:#334155;line-height:1.7;"><strong>${type === 'utest_update_required' ? 'Next steps:' : 'What happens next:'}</strong> ${type === 'utest_update_required' ? 'Create a new uTest account, then use the button below to return to the project and submit a new application with your new account details.' : 'Our team will review your application. If selected, you will receive an invitation with the project instructions. Please keep your uTest account and email accessible.'}</p>`}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${projectLink}" style="display: inline-block; background: #0b5cff; color: white; text-decoration: none; padding: 14px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">${actionLabel}</a>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.7; margin-bottom: 0;">
            If the button does not work, copy this link into your browser:<br>
            <a href="${projectLink}" style="color: #0b5cff; word-break: break-all;">${projectLink}</a>
          </p>
          <p style="font-size:13px;color:#64748b;line-height:1.7;margin:16px 0 0;">Need help? Contact ${payload.supportEmail || 'support@connectfy.tech'}. Connectfy will never ask for your password or payment details.</p>
        </div>
      </div>
    </div>
  `;
};

const buildText = (payload: Record<string, any>) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailText(payload.toName, projectLink, payload.supportEmail);
  }
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = formatProjectDescription(payload.projectDescription || '');
  const isLegacySheetReapply = payload.type === 'legacy_sheet_reapply';
  const applicationSummary = payload.type === 'application'
    ? `Application summary:\nCountry: ${payload.applicantCountry || 'Not provided'}\nDevice: ${payload.applicantDevice || 'Not provided'}\nuTest ID: ${payload.uTestId || 'Not provided'}\nuTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}\nSubmitted: ${payload.submittedAt || 'Just now'}\n\nPayment processing: Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided.\n\nWhat happens next: Our team will review your application. If selected, you will receive an invitation with the project instructions.`
    : payload.type === 'utest_update_required'
      ? `Action required:\nThank you for your interest in this project. We cannot move forward with your current application because the project requires a valid uTest account created within the last 7 days. Please create a new uTest account, then return to Connectfy and reapply using the new account's uTest ID and email. Your application has been reopened for reapplication while the project is accepting applicants.`
      : isLegacySheetReapply
        ? 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we are unable to proceed with your current uTest account for this project.'
      : '';

  return [
    `Hello ${payload.toName || 'Tester'},`,
    payload.type === 'invite'
      ? `You have been invited to work on a live opportunity with ${projectCompany}.`
      : payload.type === 'utest_update_required'
        ? `Thank you for your interest in ${projectCompany}'s ${projectTitle} project. We cannot move forward with your current application because this project requires a valid uTest account created within the last 7 days.`
        : isLegacySheetReapply
          ? 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we are unable to proceed with your current uTest account for this project.'
        : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`,
    '',
    payload.type === 'utest_update_required'
      ? 'Please create a new uTest account at https://www.utest.com/signup, then use the project link below to reapply with your new uTest ID and email.'
      : isLegacySheetReapply
        ? 'Please create a new uTest account, then return to Connectfy and apply for the project again using your new uTest ID and email address.\nCreate a uTest account: https://www.utest.com/signup'
      : `${projectTitle} | ${projectCompany} | ${projectCategory}`,
    description,
    deadline,
    applicationSummary,
    '',
    payload.type === 'utest_update_required'
      ? `Return to the project and reapply: ${projectLink}`
      : isLegacySheetReapply
        ? `Open Connectfy: ${projectLink}`
      : `Open the project: ${projectLink}`
  ].join('\n');
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const payload = await req.json();
    const type = payload?.type;
    if (adminEmailTypes.has(type)) {
      const authorization = req.headers.get('authorization');
      const adminFailure = await verifyAdminRequest(authorization);
      if (adminFailure) {
        return new Response(JSON.stringify({ ok: false, message: adminFailure.message }), {
          status: adminFailure.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Request body must be a JSON object.');
    }

    if (!['application', 'invite', 'accepted', 'rejected', 'declined', 'utest_update_required', 'legacy_sheet_reapply'].includes(type)) {
      errors.push(`Invalid email type: ${String(type ?? 'missing')}. Expected 'application', 'invite', 'accepted', 'rejected', 'declined', 'utest_update_required', or 'legacy_sheet_reapply'.`);
    }

    if (!payload?.toEmail || typeof payload.toEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.toEmail.trim())) {
      errors.push(`Invalid recipient email: ${String(payload?.toEmail ?? 'missing')}.`);
    }

    if (!payload?.toName || typeof payload.toName !== 'string' || !payload.toName.trim()) {
      errors.push('Recipient name is required.');
    }

    if (!payload?.projectTitle || typeof payload.projectTitle !== 'string' || !payload.projectTitle.trim()) {
      errors.push('Project title is required.');
    }

    if (!payload?.projectCompany || typeof payload.projectCompany !== 'string' || !payload.projectCompany.trim()) {
      errors.push('Project company is required.');
    }

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'admin@connectfy.tech';
    const appUrl = Deno.env.get('APP_URL') || 'https://connectfy.tech';

    if (!brevoApiKey) {
      errors.push('Missing BREVO_API_KEY environment variable.');
    }

    if (!senderEmail || typeof senderEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim())) {
      errors.push(`Invalid BREVO_SENDER_EMAIL: ${String(senderEmail ?? 'missing')}.`);
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const toEmail = payload.toEmail.trim();
    const toName = payload.toName.trim();
    const projectLink = payload.projectLink || payload.actionUrl || `${appUrl}/?project=${encodeURIComponent(payload.projectTitle || 'project')}`;
    const requestPayload = {
      sender: { name: 'Connectfy', email: senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: payload.type === 'invite'
        ? `Project Invite: ${payload.projectTitle || 'New Opportunity'}`
        : payload.type === 'accepted'
          ? `Invite Accepted: ${payload.projectTitle || 'Project Update'}`
          : payload.type === 'rejected'
            ? `Application Update: ${payload.projectTitle || 'Project Review'}`
            : payload.type === 'declined'
              ? `Invite Declined: ${payload.projectTitle || 'Project Update'}`
              : payload.type === 'utest_update_required'
                ? `Action Required: Create a new uTest account and reapply for ${payload.projectTitle || 'your application'}`
                : payload.type === 'legacy_sheet_reapply'
                  ? LEGACY_SHEET_EMAIL_SUBJECT
                : `Application Received: ${payload.projectTitle || 'Project Review'}`,
      htmlContent: buildHtml({ ...payload, projectLink }),
      textContent: buildText({ ...payload, projectLink })
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey,
        Accept: 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Brevo request failed (${response.status}): ${responseText}`);
    }

    return new Response(JSON.stringify({ ok: true, emailType: payload.type, subject: requestPayload.subject }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
