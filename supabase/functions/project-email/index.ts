import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const formatProjectDescription = (description: string) => {
  if (!description) return 'No summary provided yet.';
  const clean = description.replace(/\s+/g, ' ').trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
};

const buildHtml = (payload: Record<string, any>) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const projectDescription = formatProjectDescription(payload.projectDescription || '');
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
          <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.7;">
            Hello ${payload.toName || 'there'},
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
                    : `Your application for ${projectCompany}'s ${projectTitle} project has been received successfully.`}
          </p>
          <div style="background: #f8fbff; border: 1px solid #dfeaf5; border-radius: 12px; padding: 16px 18px; margin: 20px 0;">
            <div style="font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: #4c7cff; font-weight: bold;">Project overview</div>
            <div style="margin-top: 12px; font-size: 22px; font-weight: 700; color: #0f172a;">${projectTitle}</div>
            <div style="margin-top: 6px; font-size: 14px; color: #475569; font-weight: 600;">${projectCompany} • ${projectCategory}</div>
            <p style="margin: 12px 0 0; font-size: 14px; color: #475569; line-height: 1.7;">${projectDescription}</p>
            <p style="margin: 14px 0 0; font-size: 13px; color: #0f172a; font-weight: 600;">${deadline}</p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${projectLink}" style="display: inline-block; background: #0b5cff; color: white; text-decoration: none; padding: 14px 22px; border-radius: 10px; font-weight: 700; font-size: 14px;">${actionLabel}</a>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.7; margin-bottom: 0;">
            If the button does not work, copy this link into your browser:<br>
            <a href="${projectLink}" style="color: #0b5cff; word-break: break-all;">${projectLink}</a>
          </p>
        </div>
      </div>
    </div>
  `;
};

const buildText = (payload: Record<string, any>) => {
  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  const projectTitle = payload.projectTitle || 'Connectfy project';
  const projectCompany = payload.projectCompany || 'Connectfy';
  const projectCategory = payload.projectCategory || 'QA / testing';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = formatProjectDescription(payload.projectDescription || '');

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

serve(async (req) => {
  try {
    const payload = await req.json();
    const type = payload?.type;

    const errors: string[] = [];

    if (!payload || typeof payload !== 'object') {
      errors.push('Request body must be a JSON object.');
    }

    if (!['application', 'invite', 'accepted', 'rejected', 'declined'].includes(type)) {
      errors.push(`Invalid email type: ${String(type ?? 'missing')}. Expected 'application', 'invite', 'accepted', 'rejected', or 'declined'.`);
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
