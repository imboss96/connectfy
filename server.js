import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';
import {
  buildLegacySheetEmailHtml,
  buildLegacySheetEmailText,
  LEGACY_SHEET_EMAIL_SUBJECT
} from './src/lib/legacySheetEmail.js';
import {
  buildProjectApprovalEmailHtml,
  buildProjectApprovalEmailSubject,
  buildProjectApprovalEmailText
} from './src/lib/projectApprovalEmail.js';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '/etc/connectfy-email.env' });
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const preferredPort = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';
const adminEmailTypes = new Set(['invite', 'rejected', 'utest_update_required', 'legacy_sheet_reapply']);
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://connectfy.tech',
  'https://www.connectfy.tech',
  'https://connectf.tech',
  'https://www.connectf.tech',
  ...(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
];

const buildHtml = (payload) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailHtml(payload.toName, projectLink, payload.supportEmail);
  }
  if (payload.type === 'invite') return buildProjectApprovalEmailHtml({ ...payload, projectLink });
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources)
    ? payload.projectResources.filter((resource) => resource && /^https?:\/\//i.test(resource.url)).slice(0, 4)
    : [];
  const consentLink = resources[0]?.url || '';
  const isLegacySheetReapply = payload.type === 'legacy_sheet_reapply';
  const applicationDetails = payload.type === 'application'
    ? `<div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#0b5cff;">Application summary</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#334155;">Application reference: ${payload.applicationReference || 'Pending'}<br>Country: ${payload.applicantCountry || 'Not provided'}<br>Device: ${payload.applicantDevice || 'Not provided'}<br>uTest ID: ${payload.uTestId || 'Not provided'}<br>uTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}<br>Submitted: ${payload.submittedAt || 'Just now'}</p></div><div style="background:#eff6ff;border-left:4px solid #0b5cff;border-radius:8px;padding:14px 16px;margin:20px 0;font-size:13px;line-height:1.7;color:#1e3a8a;"><strong>Payment processing:</strong> Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided in your application.</div>`
    : payload.type === 'utest_update_required'
      ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#9a4d00;">Action required</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#7c2d12;">Thank you for your interest in this project. We cannot move forward with your current application because the project requires a valid uTest account created within the last 7 days. Please create a new uTest account at <a href="https://www.utest.com/signup" style="color:#0b5cff;font-weight:700;">uTest account registration</a>, then return to Connectfy and reapply using the new account's uTest ID and email. Your application has been reopened for reapplication while the project is accepting applicants. Watch the setup guide here: <a href="https://www.youtube.com/watch?v=F_XmEVQZaHc" style="color:#0b5cff; font-weight:700;">https://www.youtube.com/watch?v=F_XmEVQZaHc</a></p></div>`
      : '';
  const type = payload.type === 'invite' ? 'invite' : payload.type || 'application';
  const actionLabel = type === 'invite' ? 'Accept Invite' : type === 'utest_update_required' ? 'Return to Project & Reapply' : isLegacySheetReapply ? 'Open Connectfy' : 'Open Project';
  const greetingText = type === 'invite'
    ? `You have been invited to work on the live opportunity with ${projectCompany}.`
    : type === 'accepted'
      ? `Your invitation for the live opportunity with ${projectCompany} has been accepted.`
      : type === 'utest_update_required'
        ? `Thank you for your interest in ${projectCompany}'s project. We cannot move forward with your current application because this project requires a valid uTest account created within the last 7 days.`
        : isLegacySheetReapply
          ? 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we are unable to proceed with your current uTest account for this project.'
        : `Your project update from ${projectCompany} is ready.`;
  const safeToName = String(payload.toName || 'there').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  return `
    <div style="margin:0;padding:16px;background:#f6f9fc;font-family:Arial,sans-serif;color:#10213b;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfeaf5;border-radius:12px;overflow:hidden;">
        <div style="padding:20px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;">Hello ${isLegacySheetReapply ? safeToName : payload.toName || 'there'},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${greetingText}</p>
          <h2 style="margin:0 0 8px;font-size:16px;color:#10213b;">Project Overview</h2>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${description}</p>
          ${consentLink ? `<p style="margin:0 0 18px;font-size:14px;"><a href="${consentLink}" style="color:#0b5cff;font-weight:700;">Submit Your Consent Here</a></p>` : ''}
          <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#10213b;">${deadline}</p>
          ${applicationDetails}
          ${isLegacySheetReapply ? `<div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong>What to do next</strong><p style="margin:10px 0 0;font-size:13px;line-height:1.7;color:#334155;">Please create a new uTest account, then return to Connectfy and apply for the project again using your new uTest ID and email address.</p><p style="margin:12px 0 0;font-size:13px;"><a href="https://www.utest.com/signup" style="color:#0b5cff;font-weight:700;">Create a uTest account</a></p></div>` : ''}
          ${isLegacySheetReapply ? '' : `<p style="font-size:14px;line-height:1.7;color:#334155;"><strong>${type === 'utest_update_required' ? 'Next steps:' : 'What happens next:'}</strong> ${type === 'utest_update_required' ? 'Create a new uTest account, then use the button below to return to the project and submit a new application with your new account details.' : type === 'invite' ? 'Use the button below to sign in and accept the invitation. If any tester details are missing from your profile, you will be asked to complete them before your project workspace opens.' : 'Our team will review your application. If selected, you will receive an invitation with the project instructions. Please keep your uTest account and email accessible.'}</p>`}
          <div style="text-align:center;margin:0 0 22px;"><a href="${projectLink}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">${actionLabel}</a></div>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#334155;">Best,<br>Connectfy Team</p>
          <p style="font-size:13px;line-height:1.7;color:#64748b;">Need help? Contact ${payload.supportEmail || 'support@connectfy.tech'}. Connectfy will never ask for your password or payment details.</p>
        </div>
      </div>
    </div>
  `;
};

const buildText = (payload) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailText(payload.toName, projectLink, payload.supportEmail);
  }
  if (payload.type === 'invite') return buildProjectApprovalEmailText({ ...payload, projectLink });
  const projectCompany = payload.projectCompany || 'Connectfy';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources) ? payload.projectResources.slice(0, 4) : [];
  const consentLink = resources[0]?.url || '';
  const isLegacySheetReapply = payload.type === 'legacy_sheet_reapply';
  const applicationSummary = payload.type === 'application'
    ? `Application summary:\nCountry: ${payload.applicantCountry || 'Not provided'}\nDevice: ${payload.applicantDevice || 'Not provided'}\nuTest ID: ${payload.uTestId || 'Not provided'}\nuTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}\nSubmitted: ${payload.submittedAt || 'Just now'}\n\nPayment processing: Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided.\n\nWhat happens next: Our team will review your application. If selected, you will receive an invitation with the project instructions.`
    : payload.type === 'utest_update_required'
      ? `Action required:\nThank you for your interest in this project. We cannot move forward with your current application because the project requires a valid uTest account created within the last 7 days. Please create a new uTest account, then return to Connectfy and reapply using the new account's uTest ID and email. Your application has been reopened for reapplication while the project is accepting applicants.`
      : '';

  return [
    `Hello ${payload.toName || 'Tester'},`,
    payload.type === 'utest_update_required'
      ? `Thank you for your interest in ${projectCompany}'s project. We cannot move forward with your current application because this project requires a valid uTest account created within the last 7 days.`
      : isLegacySheetReapply
        ? 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we are unable to proceed with your current uTest account for this project.'
      : `You have been invited to work on the live opportunity with ${projectCompany}.`,
    '',
    payload.type === 'utest_update_required'
      ? 'Please create a new uTest account at https://www.utest.com/signup, then use the project link below to reapply with your new uTest ID and email.'
      : isLegacySheetReapply
        ? 'Please create a new uTest account, then return to Connectfy and apply for the project again using your new uTest ID and email address.\nCreate a uTest account: https://www.utest.com/signup'
      : 'Project Overview',
    description,
    '',
    consentLink ? `Submit Your Consent Here: ${consentLink}` : '',
    deadline,
    applicationSummary,
    payload.type === 'invite' ? 'Use the link below to sign in and accept the invitation. Any missing uTest ID, legal name, date of birth, email, or phone details can be completed on the secure Connectfy form before your workspace opens.' : '',
    '',
    payload.type === 'invite'
      ? `Accept Invite: ${projectLink}`
      : payload.type === 'utest_update_required'
      ? `Return to the project and reapply: ${projectLink}`
      : isLegacySheetReapply
        ? `Open Connectfy: ${projectLink}`
      : `Open Project: ${projectLink}`,
    `Support: ${payload.supportEmail || 'support@connectfy.tech'}`,
    'Connectfy will never ask for your password or payment details.',
    '',
    'Best,',
    'Connectfy Team'
  ].join('\n');
};

const projectEmailSubject = (payload, type) => type === 'invite'
  ? buildProjectApprovalEmailSubject(payload.projectTitle)
  : type === 'accepted'
    ? `Invite Accepted: ${payload.projectTitle || 'Project Update'}`
    : type === 'rejected'
      ? `Application Update: ${payload.projectTitle || 'Project Review'}`
      : type === 'declined'
        ? `Invite Declined: ${payload.projectTitle || 'Project Update'}`
        : type === 'utest_update_required'
          ? `Action Required: Create a new uTest account and reapply for ${payload.projectTitle || 'your application'}`
          : type === 'legacy_sheet_reapply'
            ? LEGACY_SHEET_EMAIL_SUBJECT
            : `Application Received: ${payload.projectTitle || 'Project Review'}`;

const sendEmailThroughBrevo = async (payload, type) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) throw new Error('Missing BREVO_API_KEY');

  const toEmail = String(payload.toEmail || '').trim();
  const toName = String(payload.toName || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) throw new Error('Invalid recipient email');
  if (!toName) throw new Error('Recipient name is required');

  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  const subject = projectEmailSubject(payload, type);
  const requestPayload = {
    sender: { name: 'Connectfy', email: process.env.BREVO_SENDER_EMAIL || 'admin@connectfy.tech' },
    to: [{ email: toEmail, name: toName }],
    subject,
    htmlContent: buildHtml({ ...payload, type, projectLink }),
    textContent: buildText({ ...payload, type, projectLink })
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
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Brevo request failed (${response.status}): ${responseText}`);
  }

  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('Brevo returned an invalid success response.');
    }
  }
  return { subject, messageId: result.messageId || null };
};

const supabaseServiceUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outboxWorkerEnabled = Boolean(supabaseServiceUrl && supabaseServiceRoleKey && process.env.BREVO_API_KEY);
let outboxWorkerBusy = false;
let cachedKesRate = null;

const callSupabaseRest = async (path, options = {}) => {
  if (!supabaseServiceUrl || !supabaseServiceRoleKey) {
    throw new Error('Payment backend is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  const response = await fetch(`${supabaseServiceUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text}`);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Supabase returned an invalid payment response.');
  }
};

const getAuthUser = async (authorization) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Payment backend is missing Supabase public authentication configuration.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization }
  });
  if (!response.ok) throw new Error('Your session is invalid or has expired. Sign in again.');
  return response.json();
};

const requireAdmin = async (authorization) => {
  if (!authorization) throw new Error('Sign in as an administrator to manage payouts.');
  const user = await getAuthUser(authorization);
  const profiles = await callSupabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role`);
  if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
    throw new Error('Only administrators can manage payouts.');
  }
  return user;
};

const getUsdKesRate = async () => {
  if (cachedKesRate && Date.now() - cachedKesRate.fetchedAt < 15 * 60 * 1000) return cachedKesRate;
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Exchange-rate service failed (${response.status}).`);
  const data = await response.json();
  const rate = Number(data?.rates?.KES);
  const updateUnix = Number(data?.time_last_update_unix);
  if (data?.result !== 'success' || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(updateUnix)) {
    throw new Error('Exchange-rate service returned an invalid USD/KES quote.');
  }
  cachedKesRate = {
    rate,
    source: 'ExchangeRate-API (open.er-api.com)',
    quotedAt: new Date(updateUnix * 1000).toISOString(),
    fetchedAt: Date.now(),
    expiresAt: new Date(Number(data.time_next_update_unix) * 1000).toISOString()
  };
  return cachedKesRate;
};

const normalizeKenyanPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `254${digits.slice(1)}` : digits.startsWith('254') ? digits : '';
  if (!/^254[17]\d{8}$/.test(normalized)) {
    throw new Error('Enter a valid Kenyan Safaricom mobile number, for example 0712345678 or +254712345678.');
  }
  return normalized;
};

const getMpesaConfiguration = () => {
  const required = [
    'MPESA_CONSUMER_KEY',
    'MPESA_CONSUMER_SECRET',
    'MPESA_SECURITY_CREDENTIAL',
    'MPESA_INITIATOR_NAME',
    'MPESA_SHORTCODE',
    'MPESA_CALLBACK_BASE_URL',
    'MPESA_CALLBACK_TOKEN'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Safaricom B2C configuration is incomplete: ${missing.join(', ')}.`);
  const callbackBaseUrl = new URL(process.env.MPESA_CALLBACK_BASE_URL);
  if (callbackBaseUrl.protocol !== 'https:') throw new Error('MPESA_CALLBACK_BASE_URL must use HTTPS.');
  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
  return { baseUrl, callbackBaseUrl: callbackBaseUrl.toString().replace(/\/$/, '') };
};

const getMpesaAccessToken = async (baseUrl) => {
  const credentials = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Safaricom token request failed (${response.status}): ${text}`);
  const body = JSON.parse(text);
  if (!body.access_token) throw new Error('Safaricom token response did not include an access token.');
  return body.access_token;
};

const updatePayoutCallback = async (body, timedOut) => {
  const result = body?.Result || body?.result;
  const conversationId = result?.ConversationID || result?.conversationId;
  if (!conversationId) {
    console.error('Safaricom callback did not include a conversation ID.');
    return;
  }
  const rows = await callSupabaseRest(`payout_requests?safaricom_conversation_id=eq.${encodeURIComponent(conversationId)}&status=eq.processing&select=id`);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('Safaricom callback did not match a processing payout.', { conversationId });
    return;
  }
  const resultCode = Number(result?.ResultCode ?? result?.resultCode);
  const succeeded = !timedOut && resultCode === 0;
  const parameters = result?.ResultParameters?.ResultParameter || [];
  const parameterValue = (name) => parameters.find((item) => item.Key === name)?.Value;
  const updates = {
    status: succeeded ? 'completed' : 'failed',
    completed_at: succeeded ? new Date().toISOString() : null,
    failure_reason: succeeded ? null : String(result?.ResultDesc || result?.resultDesc || (timedOut ? 'Safaricom B2C request timed out; contact support before retrying.' : 'Safaricom reported a failed payout.')).slice(0, 1000),
    safaricom_transaction_id: parameterValue('TransactionReceipt') || result?.TransactionID || null,
    safaricom_result: body,
    updated_at: new Date().toISOString()
  };

  const isValidMpesaCallback = (providedToken) => {
    const configuredToken = process.env.MPESA_CALLBACK_TOKEN || '';
    const receivedToken = String(providedToken || '');
    if (!configuredToken || !receivedToken) return false;
    const expected = Buffer.from(configuredToken);
    const received = Buffer.from(receivedToken);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  };

  const buildMpesaCallbackUrl = (baseUrl, endpoint) => {
    const url = new URL(`${baseUrl}/api/mpesa/b2c/${endpoint}`);
    url.searchParams.set('token', process.env.MPESA_CALLBACK_TOKEN);
    return url.toString();
  };
  await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(rows[0].id)}&status=eq.processing`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(updates)
  });
  console.info('Safaricom payout callback recorded.', { payoutId: rows[0].id, succeeded });
};

const callOutboxRpc = async (functionName, body) => {
  const response = await fetch(`${supabaseServiceUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${functionName} failed (${response.status}): ${responseText}`);
  }
  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Supabase ${functionName} returned an invalid response.`);
  }
};

const processOneProjectEmail = async () => {
  const claimed = await callOutboxRpc('claim_project_email_outbox', {});
  const job = Array.isArray(claimed) ? claimed[0] : null;
  if (!job) return false;

  try {
    if (job.payload?.type !== 'invite' || !job.payload?.applicationId || !job.payload?.projectId) {
      throw new Error('Outbox item has an invalid approval email payload.');
    }

    const projectLink = new URL(process.env.APP_URL || 'https://connectfy.tech');
    projectLink.searchParams.set('project', job.payload.projectId);
    projectLink.searchParams.set('application', job.payload.applicationId);
    projectLink.searchParams.set('accept', '1');

    const result = await sendEmailThroughBrevo({
      ...job.payload,
      actionUrl: projectLink.toString(),
      projectLink: projectLink.toString(),
      supportEmail: 'support@connectfy.tech'
    }, 'invite');
    await callOutboxRpc('complete_project_email_outbox', {
      p_outbox_id: job.id,
      p_succeeded: true,
      p_provider_message_id: result.messageId,
      p_error: null
    });
    console.info('Project approval email delivered.', { outboxId: job.id, subject: result.subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown project email delivery error';
    try {
      await callOutboxRpc('complete_project_email_outbox', {
        p_outbox_id: job.id,
        p_succeeded: false,
        p_provider_message_id: null,
        p_error: message
      });
    } catch (completionError) {
      console.error('Unable to record project approval email delivery failure:', completionError);
      throw completionError;
    }
    console.error('Project approval email delivery failed; retry policy applied.', {
      outboxId: job.id,
      attemptCount: job.attempt_count,
      error: message
    });
  }
  return true;
};

const pollProjectEmailOutbox = async () => {
  if (!outboxWorkerEnabled || outboxWorkerBusy) return;
  outboxWorkerBusy = true;
  try {
    while (await processOneProjectEmail()) {
      // Drain available jobs without blocking concurrent polls.
    }
  } catch (error) {
    console.error('Project email outbox poll failed:', error);
  } finally {
    outboxWorkerBusy = false;
  }
};

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'connectfy-email-backend',
    approvalEmailOutbox: outboxWorkerEnabled ? 'enabled' : 'disabled'
  });
});

app.get('/api/mpesa/quote', async (req, res) => {
  try {
    const usdAmount = Number(req.query.usdAmount);
    if (!Number.isFinite(usdAmount) || usdAmount <= 0 || usdAmount > 100000) {
      return res.status(400).json({ ok: false, message: 'Enter a valid USD amount for the exchange-rate quote.' });
    }
    const rate = await getUsdKesRate();
    return res.json({
      usdAmount: Number(usdAmount.toFixed(2)),
      kesAmount: Math.round(usdAmount * rate.rate),
      exchangeRate: rate.rate,
      source: rate.source,
      quotedAt: rate.quotedAt,
      expiresAt: rate.expiresAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to get the current USD/KES quote.';
    console.error('Unable to quote M-Pesa payout:', error);
    return res.status(502).json({ ok: false, message });
  }
});

app.post('/api/payout-requests', async (req, res) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) return res.status(401).json({ ok: false, message: 'Sign in before requesting a payout.' });
    const user = await getAuthUser(authorization);
    const amount = Number(req.body?.amount);
    const method = req.body?.method;
    const destinationAccount = String(req.body?.destinationAccount || '').trim();
    if (!Number.isFinite(amount) || amount < 10 || amount > 100000) {
      return res.status(400).json({ ok: false, message: 'Payout amount must be between USD 10 and USD 100,000.' });
    }
    const supportedMethods = ['PayPal', 'Payoneer', 'Direct Bank Wire', 'Wise', 'Safaricom M-Pesa'];
    if (!supportedMethods.includes(method)) return res.status(400).json({ ok: false, message: 'Unsupported payout method.' });
    if (!destinationAccount) return res.status(400).json({ ok: false, message: 'Enter your payout destination.' });

    let rate = null;
    let phone = destinationAccount;
    let kesAmount = null;
    if (method === 'Safaricom M-Pesa') {
      phone = normalizeKenyanPhone(destinationAccount);
      rate = await getUsdKesRate();
      kesAmount = Math.round(amount * rate.rate);
    }
    const transactionRef = `PAY-${crypto.randomUUID()}`;
    const result = await callOutboxRpc('create_payout_request', {
      p_tester_id: user.id,
      p_amount: Number(amount.toFixed(2)),
      p_method: method,
      p_destination_account: phone,
      p_transaction_ref: transactionRef,
      p_exchange_rate: rate?.rate ?? null,
      p_kes_amount: kesAmount,
      p_exchange_rate_source: rate?.source ?? null,
      p_exchange_rate_at: rate?.quotedAt ?? null
    });
    return res.status(201).json({ ok: true, payout: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create this payout request.';
    console.error('Payout request rejected:', error);
    return res.status(400).json({ ok: false, message });
  }
});

app.get('/api/admin/payout-requests', async (req, res) => {
  try {
    await requireAdmin(req.headers.authorization);
    const payouts = await callSupabaseRest(
      'payout_requests?status=eq.pending&select=id,tester_id,amount,method,destination_account,status,transaction_ref,requested_at,currency,exchange_rate,exchange_rate_source,exchange_rate_at,kes_amount'
      + '&order=requested_at.asc'
    );
    const testerIds = [...new Set((payouts || []).map((payout) => payout.tester_id).filter(Boolean))];
    const profiles = testerIds.length
      ? await callSupabaseRest(`profiles?id=in.(${testerIds.map(encodeURIComponent).join(',')})&select=id,name,email,profile_data`)
      : [];
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const results = (payouts || []).map((payout) => ({
      ...payout,
      tester: profileById.get(payout.tester_id) || null
    }));
    return res.json({ ok: true, payouts: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load payout requests.';
    return res.status(400).json({ ok: false, message });
  }
});

app.post('/api/admin/payout-requests/:id/approve', async (req, res) => {
  let payout;
  let dispatchClaimed = false;
  try {
    const admin = await requireAdmin(req.headers.authorization);
    const payoutId = req.params.id;
    const rows = await callSupabaseRest(
      `payout_requests?id=eq.${encodeURIComponent(payoutId)}&status=eq.pending&select=*`
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      return res.status(409).json({ ok: false, message: 'This payout is no longer pending review.' });
    }
    payout = rows[0];
    if (payout.method !== 'Safaricom M-Pesa') {
      await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
      return res.json({ ok: true, status: 'completed' });
    }

    const approvedKesAmount = Number(req.body?.approvedKesAmount);
    if (!Number.isInteger(approvedKesAmount) || approvedKesAmount < 1 || approvedKesAmount > 1000000000) {
      return res.status(400).json({ ok: false, message: 'Confirm a valid whole-number payout amount in KES.' });
    }
    const { baseUrl, callbackBaseUrl } = getMpesaConfiguration();
    const accessToken = await getMpesaAccessToken(baseUrl);
    const callbackUpdates = {
      status: 'processing',
      approved_kes_amount: approvedKesAmount,
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
      failure_reason: null,
      updated_at: new Date().toISOString()
    };
    const claimed = await callSupabaseRest(
      `payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.pending&select=id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(callbackUpdates)
      }
    );
    if (!Array.isArray(claimed) || claimed.length !== 1) {
      return res.status(409).json({ ok: false, message: 'This payout has already been approved by another admin.' });
    }
    dispatchClaimed = true;

    const result = await fetch(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        InitiatorName: process.env.MPESA_INITIATOR_NAME,
        SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: process.env.MPESA_B2C_COMMAND_ID || 'BusinessPayment',
        Amount: approvedKesAmount,
        PartyA: process.env.MPESA_SHORTCODE,
        PartyB: normalizeKenyanPhone(payout.destination_account),
        Remarks: `Connectfy payout ${payout.transaction_ref}`.slice(0, 100),
        QueueTimeOutURL: buildMpesaCallbackUrl(callbackBaseUrl, 'timeout'),
        ResultURL: buildMpesaCallbackUrl(callbackBaseUrl, 'result'),
        Occasion: payout.transaction_ref.slice(0, 100)
      }),
      signal: AbortSignal.timeout(25000)
    });
    const responseText = await result.text();
    let responseBody = {};
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error('Safaricom returned an invalid B2C response. The payout was left processing for reconciliation.');
    }
    if (!result.ok) {
      await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.processing`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          failure_reason: `Safaricom rejected the B2C request (${result.status}): ${responseText}`.slice(0, 1000),
          safaricom_result: responseBody,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(502).json({ ok: false, message: `Safaricom rejected the payout request: ${responseBody.errorMessage || responseText}` });
    }

    const conversationId = responseBody.ConversationID;
    const originatorConversationId = responseBody.OriginatorConversationID;
    if (!conversationId || !originatorConversationId) {
      console.error('Safaricom accepted a payout without returning conversation identifiers.', { payoutId: payout.id });
      return res.status(502).json({ ok: false, message: 'Safaricom accepted the request but returned no reconciliation IDs. The payout remains processing; do not resend it.' });
    }
    await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.processing`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        safaricom_conversation_id: conversationId,
        safaricom_originator_conversation_id: originatorConversationId,
        safaricom_result: responseBody,
        updated_at: new Date().toISOString()
      })
    });
    return res.json({ ok: true, status: 'processing', conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to approve payout.';
    if (dispatchClaimed && payout) {
      console.error('Safaricom B2C outcome is ambiguous; payout remains processing for manual reconciliation.', {
        payoutId: payout.id,
        error: message
      });
      return res.status(502).json({ ok: false, message: 'Safaricom did not return a definitive response. The payout remains processing; verify it in Safaricom before retrying.' });
    }
    console.error('Payout approval failed:', error);
    return res.status(400).json({ ok: false, message });
  }
});

app.post('/api/mpesa/b2c/result', async (req, res) => {
  if (!isValidMpesaCallback(req.query.token)) {
    return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized callback' });
  }
  try {
    await updatePayoutCallback(req.body, false);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Unable to process Safaricom B2C result callback:', error);
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Callback processing failed' });
  }
});

app.post('/api/mpesa/b2c/timeout', async (req, res) => {
  if (!isValidMpesaCallback(req.query.token)) {
    return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized callback' });
  }
  try {
    await updatePayoutCallback(req.body, true);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Unable to process Safaricom B2C timeout callback:', error);
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Callback processing failed' });
  }
});

app.post('/api/project-email', async (req, res) => {
  try {
    const payload = req.body || {};

    const type = payload.type || 'application';
    const toEmail = String(payload.toEmail || '').trim();
    const toName = String(payload.toName || '').trim();

    const requestType = type === 'utest_update_required' ? 'utest_update_required' : type;
    const supportedTypes = ['application', 'invite', 'accepted', 'rejected', 'declined', 'utest_update_required', 'legacy_sheet_reapply'];

    if (!supportedTypes.includes(requestType)) {
      return res.status(400).json({ ok: false, message: `Unsupported email type: ${requestType}` });
    }

    if (adminEmailTypes.has(requestType)) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).json({ ok: false, message: 'Sign in with an administrator account to send this email.' });
      }
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ ok: false, message: 'Email backend is missing SUPABASE_URL or SUPABASE_ANON_KEY configuration.' });
      }

      const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization }
      });
      if (!authResponse.ok) {
        return res.status(401).json({ ok: false, message: 'Your admin session is invalid or has expired. Please sign in again.' });
      }

      const user = await authResponse.json();
      const roleResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization }
      });
      if (!roleResponse.ok) {
        return res.status(403).json({ ok: false, message: 'Unable to verify your admin access.' });
      }
      const profiles = await roleResponse.json();
      if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
        return res.status(403).json({ ok: false, message: 'Only administrators can send this email.' });
      }
    }

    if (!process.env.BREVO_API_KEY) {
      return res.status(500).json({ ok: false, message: 'Missing BREVO_API_KEY' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({ ok: false, message: 'Invalid recipient email' });
    }
    if (!toName) {
      return res.status(400).json({ ok: false, message: 'Recipient name is required' });
    }

    const result = await sendEmailThroughBrevo(payload, requestType);
    return res.json({ ok: true, emailType: requestType, subject: result.subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ ok: false, message });
  }
});

if (outboxWorkerEnabled) {
  console.info('Project approval email outbox worker enabled.');
  setInterval(() => void pollProjectEmailOutbox(), 5000);
  void pollProjectEmailOutbox();
} else {
  console.warn('Project approval email outbox worker disabled: configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and BREVO_API_KEY.');
}

const startServer = (portToUse = preferredPort) => {
  const server = app.listen(portToUse, host, () => {
    console.log(`Email backend running on http://${host}:${portToUse}`);
  });

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE' && portToUse < preferredPort + 20) {
      const nextPort = portToUse + 1;
      console.warn(`Port ${portToUse} is busy. Retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
};

startServer();
