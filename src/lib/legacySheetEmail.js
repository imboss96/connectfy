// @ts-check

export const LEGACY_SHEET_EMAIL_SUBJECT = 'Action required: Create a new uTest account and reapply';
export const LEGACY_SHEET_EMAIL_INTRO = 'Thank you for showing interest in our project. This opportunity requires a valid uTest account created within the last seven days. Based on the information provided, we’re unable to proceed with your current uTest account for this project.';
export const LEGACY_SHEET_EMAIL_INSTRUCTIONS = 'Please create a new uTest account, then return to Connectfy and apply for the project again using your new uTest ID and email address.';
export const LEGACY_SHEET_EMAIL_SIGN_OFF = 'Kind regards,\nThe Connectfy Team';
export const LEGACY_SHEET_EMAIL_SUPPORT = 'Need help? Contact support@connectfy.tech. Connectfy will never ask for your password or payment details.';
export const LEGACY_SHEET_EMAIL_UTEST_SIGNUP = 'https://www.utest.com/signup';

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

/** @param {string} toName @param {string} projectLink @param {string} [supportEmail] */
export const buildLegacySheetEmailHtml = (toName, projectLink, supportEmail = 'support@connectfy.tech') => {
  const name = escapeHtml(toName || 'there');
  const connectfyUrl = escapeHtml(safeLink(projectLink));
  const supportAddress = escapeHtml(supportEmail);

  return `
    <div style="margin:0;padding:16px;background:#f6f9fc;font-family:Arial,sans-serif;color:#10213b;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfeaf5;border-radius:12px;overflow:hidden;">
        <div style="padding:20px;">
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;">Hello ${name},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(LEGACY_SHEET_EMAIL_INTRO)}</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(LEGACY_SHEET_EMAIL_INSTRUCTIONS)}</p>
          <p style="margin:0 0 14px;font-size:14px;"><a href="${LEGACY_SHEET_EMAIL_UTEST_SIGNUP}" style="color:#0b5cff;font-weight:700;">Create a uTest account</a></p>
          <p style="margin:0 0 18px;font-size:14px;"><a href="${connectfyUrl}" style="color:#0b5cff;font-weight:700;">Open Connectfy</a></p>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#334155;">${escapeHtml(LEGACY_SHEET_EMAIL_SIGN_OFF).replace(/\n/g, '<br>')}</p>
          <p style="font-size:13px;line-height:1.7;color:#64748b;">Need help? Contact ${supportAddress}. Connectfy will never ask for your password or payment details.</p>
        </div>
      </div>
    </div>
  `;
};

/** @param {string} toName @param {string} projectLink @param {string} [supportEmail] */
export const buildLegacySheetEmailText = (toName, projectLink, supportEmail = 'support@connectfy.tech') => [
  `Hello ${toName || 'there'},`,
  '',
  LEGACY_SHEET_EMAIL_INTRO,
  '',
  LEGACY_SHEET_EMAIL_INSTRUCTIONS,
  '',
  `Create a uTest account: ${LEGACY_SHEET_EMAIL_UTEST_SIGNUP}`,
  `Open Connectfy: ${safeLink(projectLink)}`,
  '',
  LEGACY_SHEET_EMAIL_SIGN_OFF,
  '',
  LEGACY_SHEET_EMAIL_SUPPORT.replace('support@connectfy.tech', supportEmail)
].join('\n');
