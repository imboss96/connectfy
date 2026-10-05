import dotenv from 'dotenv';
import express from 'express';
import {
  buildLegacySheetEmailHtml,
  buildLegacySheetEmailText,
  LEGACY_SHEET_EMAIL_SUBJECT
} from './src/lib/legacySheetEmail.js';

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
  res.json({ ok: true, service: 'connectfy-email-backend' });
});

app.post('/api/project-email', async (req, res) => {
  try {
    const payload = req.body || {};
    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'admin@connectfy.tech';

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

    if (!brevoApiKey) {
      return res.status(500).json({ ok: false, message: 'Missing BREVO_API_KEY' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({ ok: false, message: 'Invalid recipient email' });
    }

    if (!toName) {
      return res.status(400).json({ ok: false, message: 'Recipient name is required' });
    }

    const requestPayload = {
      sender: { name: 'Connectfy', email: senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: requestType === 'invite'
        ? `Project Invite: ${payload.projectTitle || 'New Opportunity'}`
        : requestType === 'accepted'
          ? `Invite Accepted: ${payload.projectTitle || 'Project Update'}`
          : requestType === 'rejected'
            ? `Application Update: ${payload.projectTitle || 'Project Review'}`
            : requestType === 'declined'
              ? `Invite Declined: ${payload.projectTitle || 'Project Update'}`
              : requestType === 'utest_update_required'
                ? `Action Required: Create a new uTest account and reapply for ${payload.projectTitle || 'your application'}`
                : requestType === 'legacy_sheet_reapply'
                  ? LEGACY_SHEET_EMAIL_SUBJECT
                : `Application Received: ${payload.projectTitle || 'Project Review'}`,
      htmlContent: buildHtml({ ...payload, type: requestType }),
      textContent: buildText({ ...payload, type: requestType })
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

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ ok: false, message: `Brevo request failed (${response.status}): ${text}` });
    }

    return res.json({ ok: true, emailType: requestType, subject: requestPayload.subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ ok: false, message });
  }
});

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
