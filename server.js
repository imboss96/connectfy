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
  const description = payload.projectDescription || 'No summary provided yet.';
  const type = payload.type === 'accepted' ? 'accepted' : payload.type === 'rejected' ? 'rejected' : payload.type === 'declined' ? 'declined' : payload.type === 'invite' ? 'invite' : 'application';
  const actionLabel = type === 'invite' ? 'Accept Invite' : type === 'accepted' ? 'View Dashboard' : type === 'rejected' ? 'Browse More Projects' : type === 'declined' ? 'Review Status' : 'Review Project';

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
          <p style="font-size: 15px; color: #334155; line-height: 1.7;">Hello ${payload.toName || 'there'},</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.7;">
            ${type === 'invite'
              ? `You have been invited to work on a live opportunity with ${projectCompany}.`
              : type === 'accepted'
                ? `You accepted the invite for ${projectCompany}'s ${projectTitle} project and the project workspace is ready.`
                : type === 'rejected'
                  ? `Your application for ${projectCompany}'s ${projectTitle} project was not selected for this cycle.`
                  : type === 'declined'
                    ? `You declined the project invite for ${projectCompany}'s ${projectTitle} project.`
                    : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`}
          </p>
          <div style="background: #f8fbff; border: 1px solid #dfeaf5; border-radius: 12px; padding: 16px 18px; margin: 20px 0;">
            <div style="font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: #4c7cff; font-weight: bold;">Project overview</div>
            <div style="margin-top: 12px; font-size: 22px; font-weight: 700; color: #0f172a;">${projectTitle}</div>
            <div style="margin-top: 6px; font-size: 14px; color: #475569; font-weight: 600;">${projectCompany} • ${projectCategory}</div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #475569; line-height: 1.7;">${description}</p>
            <p style="margin: 14px 0 0; font-size: 13px; color: #0f172a; font-weight: 600;">${deadline}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${projectLink}" style="display: inline-block; background: #0b5cff; color: white; text-decoration: none; padding: 14px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">${actionLabel}</a>
          </div>
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
  const description = payload.projectDescription || 'No summary provided yet.';

  return [
    `Hello ${payload.toName || 'there'},`,
    payload.type === 'invite'
      ? `You have been invited to work on a live opportunity with ${projectCompany}.`
      : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`,
    '',
    `${projectTitle} | ${projectCompany} | ${projectCategory}`,
    description,
    deadline,
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
