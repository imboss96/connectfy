// @ts-check

export const CONNECTFY_SLACK_INVITE_URL = 'https://join.slack.com/t/connectfyops/shared_invite/zt-4cmuhc6av-4dwkrhonBEtgxVaHBW6tJQ';
export const CONNECTFY_SLACK_SUPPORT_URL = 'https://app.slack.com/client/T0C8FU34030/C0C82GD0NMV';

/**
 * @param {string} html
 */
export const appendSlackFooterHtml = (html) => {
  if (html.includes(CONNECTFY_SLACK_INVITE_URL)) return html;

  return `${html}
    <div style="margin:16px auto;padding:14px 20px;max-width:520px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#475569;text-align:center;">
      Join us on Slack:
      <a href="${CONNECTFY_SLACK_INVITE_URL}" style="color:#007f95;font-weight:700;">Connectfy Ops workspace</a>
      · <a href="${CONNECTFY_SLACK_SUPPORT_URL}" style="color:#007f95;font-weight:700;">Slack support</a>
    </div>`;
};

/**
 * @param {string} text
 */
export const appendSlackFooterText = (text) => {
  if (text.includes(CONNECTFY_SLACK_INVITE_URL)) return text;

  return `${text}

Join us on Slack:
Connectfy Ops workspace: ${CONNECTFY_SLACK_INVITE_URL}
Slack support: ${CONNECTFY_SLACK_SUPPORT_URL}`;
};
