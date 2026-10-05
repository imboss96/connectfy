// @ts-check

/** @param {string} [projectTitle] */
export const buildProjectApprovalEmailSubject = (projectTitle) =>
  `Congratulations! Approved for ${projectTitle || 'a Connectfy project'}`;

/** @param {unknown} value */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character] || character);

/** @param {unknown} value */
const safeLink = (value) => {
  const link = String(value || '');
  return /^https?:\/\//i.test(link) ? link : 'https://connectfy.tech';
};

/**
 * @param {Record<string, unknown>} payload
 */
export const buildProjectApprovalEmailHtml = (payload) => {
  const name = escapeHtml(payload.toName || 'there');
  const title = escapeHtml(payload.projectTitle || 'Connectfy project');
  const company = escapeHtml(payload.projectCompany || 'Connectfy');
  const category = escapeHtml(payload.projectCategory || 'QA / testing');
  const description = escapeHtml(payload.projectDescription || 'Project details are available in your Connectfy workspace.');
  const deadline = payload.projectDeadline ? escapeHtml(payload.projectDeadline) : 'To be confirmed';
  const projectLink = escapeHtml(safeLink(payload.projectLink || payload.actionUrl));
  const supportEmail = escapeHtml(payload.supportEmail || 'support@connectfy.tech');

  return `
    <div style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124;">
      <div style="max-width:560px;margin:0 auto;background:#fff;">
        <div style="padding:16px 24px;background:#080808;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Connectfy</div>
        <div style="height:12px;background:#00a6bd;font-size:0;line-height:0;">&nbsp;</div>
        <div style="padding:24px 28px 28px;font-size:14px;line-height:1.55;">
          <p style="margin:0 0 18px;">Hi ${name},</p>
          <p style="margin:0 0 18px;">Congratulations! Your application has been approved for the project below. Your invitation is ready in Connectfy.</p>
          <p style="margin:0 0 8px;font-weight:700;">${title}</p>
          <p style="margin:0 0 14px;color:#444;">${company} · ${category}</p>
          <p style="margin:0 0 14px;">${description}</p>
          <p style="margin:0 0 18px;"><strong>Deadline:</strong> ${deadline}</p>
          <p style="margin:0 0 18px;">Sign in and accept your invitation to view the project instructions and next steps.</p>
          <p style="margin:0 0 18px;"><a href="${projectLink}" style="color:#007f95;font-weight:700;">Accept your project invitation</a></p>
          <p style="margin:0 0 18px;color:#555;">If the link does not open, copy this address into your browser:<br><a href="${projectLink}" style="color:#007f95;word-break:break-all;">${projectLink}</a></p>
          <p style="margin:0 0 18px;">Thanks,<br>The Connectfy Team</p>
          <p style="margin:0;color:#666;font-size:12px;">Need help? Contact ${supportEmail}.</p>
        </div>
        <div style="height:12px;background:#00a6bd;font-size:0;line-height:0;">&nbsp;</div>
      </div>
    </div>
  `;
};

/**
 * @param {Record<string, unknown>} payload
 */
export const buildProjectApprovalEmailText = (payload) => {
  const projectTitle = String(payload.projectTitle || 'Connectfy project');
  const projectCompany = String(payload.projectCompany || 'Connectfy');
  const projectCategory = String(payload.projectCategory || 'QA / testing');
  const projectDescription = String(payload.projectDescription || 'Project details are available in your Connectfy workspace.');
  const deadline = payload.projectDeadline ? String(payload.projectDeadline) : 'To be confirmed';
  const projectLink = safeLink(payload.projectLink || payload.actionUrl);
  const supportEmail = String(payload.supportEmail || 'support@connectfy.tech');

  return [
    `Hi ${String(payload.toName || 'there')},`,
    '',
    `Congratulations! Your application has been approved for "${projectTitle}". Your invitation is ready in Connectfy.`,
    '',
    `${projectTitle} | ${projectCompany} | ${projectCategory}`,
    projectDescription,
    `Deadline: ${deadline}`,
    '',
    'Sign in and accept your invitation to view the project instructions and next steps.',
    `Accept your project invitation: ${projectLink}`,
    '',
    'Thanks,',
    'The Connectfy Team',
    '',
    `Need help? Contact ${supportEmail}.`
  ].join('\n');
};
