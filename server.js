import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '/etc/connectfy-email.env' });
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';
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
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources)
    ? payload.projectResources.filter((resource) => resource && /^https?:\/\//i.test(resource.url)).slice(0, 4)
    : [];
  const consentLink = resources[0]?.url || '';
  const applicationDetails = payload.type === 'application'
    ? `<div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#0b5cff;">Application summary</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#334155;">Application reference: ${payload.applicationReference || 'Pending'}<br>Country: ${payload.applicantCountry || 'Not provided'}<br>Device: ${payload.applicantDevice || 'Not provided'}<br>uTest ID: ${payload.uTestId || 'Not provided'}<br>uTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}<br>Submitted: ${payload.submittedAt || 'Just now'}</p></div><div style="background:#eff6ff;border-left:4px solid #0b5cff;border-radius:8px;padding:14px 16px;margin:20px 0;font-size:13px;line-height:1.7;color:#1e3a8a;"><strong>Payment processing:</strong> Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided in your application.</div>`
    : '';
  const type = payload.type === 'invite' ? 'invite' : payload.type || 'application';
  const actionLabel = type === 'invite' ? 'Accept Invite' : 'Open Project';
  const greetingText = type === 'invite'
    ? `You have been invited to work on the live opportunity with ${projectCompany}.`
    : type === 'accepted'
      ? `Your invitation for the live opportunity with ${projectCompany} has been accepted.`
      : `Your project update from ${projectCompany} is ready.`;

  return `
    <div style="margin:0;padding:16px;background:#f6f9fc;font-family:Arial,sans-serif;color:#10213b;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfeaf5;border-radius:12px;overflow:hidden;">
        <div style="padding:20px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;">Hello ${payload.toName || 'there'},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${greetingText}</p>
          <h2 style="margin:0 0 8px;font-size:16px;color:#10213b;">Project Overview</h2>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${description}</p>
          ${consentLink ? `<p style="margin:0 0 18px;font-size:14px;"><a href="${consentLink}" style="color:#0b5cff;font-weight:700;">Submit Your Consent Here</a></p>` : ''}
          <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#10213b;">${deadline}</p>
          ${applicationDetails}
          <p style="font-size:14px;line-height:1.7;color:#334155;"><strong>What happens next:</strong> Our team will review your application. If selected, you will receive an invitation with the project instructions. Please keep your uTest account and email accessible.</p>
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
  const projectCompany = payload.projectCompany || 'Connectfy';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources) ? payload.projectResources.slice(0, 4) : [];
  const consentLink = resources[0]?.url || '';
  const applicationSummary = payload.type === 'application'
    ? `Application summary:\nCountry: ${payload.applicantCountry || 'Not provided'}\nDevice: ${payload.applicantDevice || 'Not provided'}\nuTest ID: ${payload.uTestId || 'Not provided'}\nuTest email: ${payload.uTestEmail || payload.toEmail || 'Not provided'}\nSubmitted: ${payload.submittedAt || 'Just now'}\n\nPayment processing: Connectfy does not collect participant payments directly. Approved payments are processed through uTest using the uTest ID and email provided.\n\nWhat happens next: Our team will review your application. If selected, you will receive an invitation with the project instructions.`
    : '';

  return [
    `Hello ${payload.toName || 'there'},`,
    `You have been invited to work on the live opportunity with ${projectCompany}.`,
    '',
    'Project Overview',
    description,
    '',
    consentLink ? `Submit Your Consent Here: ${consentLink}` : '',
    deadline,
    applicationSummary,
    '',
    `Open Project: ${projectLink}`,
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
      subject: payload.type === 'invite'
        ? `Project Invite: ${payload.projectTitle || 'New Opportunity'}`
        : payload.type === 'accepted'
          ? `Invite Accepted: ${payload.projectTitle || 'Project Update'}`
          : payload.type === 'rejected'
            ? `Application Update: ${payload.projectTitle || 'Project Review'}`
            : payload.type === 'declined'
              ? `Invite Declined: ${payload.projectTitle || 'Project Update'}`
              : `Application Received: ${payload.projectTitle || 'Project Review'}`,
      htmlContent: buildHtml({ ...payload, type }),
      textContent: buildText({ ...payload, type })
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

    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ ok: false, message });
  }
});

app.listen(port, host, () => {
  console.log(`Email backend running on http://${host}:${port}`);
});
