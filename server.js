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
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources)
    ? payload.projectResources.filter((resource) => resource && /^https?:\/\//i.test(resource.url)).slice(0, 4)
    : [];
  const type = payload.type === 'accepted' ? 'accepted' : payload.type === 'rejected' ? 'rejected' : payload.type === 'declined' ? 'declined' : payload.type === 'invite' ? 'invite' : 'application';
  const actionLabel = type === 'invite' ? 'Accept Invite' : type === 'accepted' ? 'View Dashboard' : type === 'rejected' ? 'Browse More Projects' : type === 'declined' ? 'Review Status' : 'Review Project';

  return `
    <div style="margin:0;padding:16px;background:#f6f9fc;font-family:Arial,sans-serif;color:#10213b;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfeaf5;border-radius:12px;overflow:hidden;">
        <div style="padding:18px 20px;background:#10213b;color:#fff;">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">${type === 'invite' ? 'Project invite' : type === 'accepted' ? 'Invite accepted' : 'Project update'}</div>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;">${projectTitle}</h1>
        </div>
        <div style="padding:20px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Hello ${payload.toName || 'there'},</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155;">${type === 'invite' ? `You have been invited by ${projectCompany}.` : type === 'accepted' ? 'Your project workspace is ready.' : `Your ${projectTitle} project update is ready.`}</p>
          <div style="padding:14px;background:#f8fbff;border:1px solid #dfeaf5;border-radius:10px;">
            <div style="font-size:12px;color:#475569;font-weight:700;">${projectCompany} - ${projectCategory}</div>
            <p style="margin:9px 0 0;font-size:14px;line-height:1.55;color:#334155;">${description}</p>
            <p style="margin:10px 0 0;font-size:12px;font-weight:700;color:#10213b;">${deadline}</p>
            ${resources.length > 0 ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #dfeaf5;"><div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;">Project resources</div>${resources.map((resource) => `<div style="margin-top:5px;font-size:13px;"><a href="${resource.url}" style="color:#0b5cff;">${resource.label || resource.url}</a></div>`).join('')}</div>` : ''}
          </div>
          <div style="text-align:center;margin:18px 0 2px;"><a href="${projectLink}" style="display:inline-block;background:#0b5cff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">${actionLabel}</a></div>
          <p style="margin:12px 0 0;text-align:center;font-size:11px;line-height:1.4;color:#64748b;">Open the project page for the complete scope, requirements, and attachments.</p>
        </div>
      </div>
    </div>
  `;
};

const buildText = (payload) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources) ? payload.projectResources.slice(0, 4) : [];

  return [
    `Hello ${payload.toName || 'there'},`,
    payload.type === 'invite'
      ? `You have been invited to work on a live opportunity with ${projectCompany}.`
      : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`,
    '',
    `${projectTitle} | ${projectCompany} | ${projectCategory}`,
    description,
    deadline,
    resources.length > 0 ? `Resources: ${resources.map((resource) => `${resource.label || 'Link'} - ${resource.url}`).join('; ')}` : '',
    '',
    `Open the project: ${projectLink}`
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
