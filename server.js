import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { appendSlackFooterHtml, appendSlackFooterText } from './src/lib/emailSlackFooter.js';
import { getNextPlatformPayDate } from './src/lib/platformPayDate.js';
import { buildEmployeeContractPdf } from './src/lib/employeeContractPdf.js';
import { EmailProviderHttpError, sendWithEmailProviderFailover } from './src/lib/emailProviderFailover.js';
import nodemailer from 'nodemailer';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '/etc/connectfy-email.env' });
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const preferredPort = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';
const adminEmailTypes = new Set(['invite', 'rejected', 'utest_update_required', 'legacy_sheet_reapply', 'application_utest_details_request', 'applause_follow_up', 'employee_welcome']);
const APPLAUSE_SUPPORT_SLACK_LINK = 'https://app.slack.com/client/T0C8FU34030/C0C82GD0NMV';
const CONNECTFY_SLACK_INVITE_URL = 'https://join.slack.com/t/connectfyops/shared_invite/zt-4cmuhc6av-4dwkrhonBEtgxVaHBW6tJQ';
const SLACK_DOWNLOAD_URL = 'https://slack.com/downloads';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);
const createHttpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
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
  if (payload.type === 'employee_welcome') {
    const safeLink = escapeHtml(/^https?:\/\//i.test(projectLink) ? projectLink : 'https://connectfy.tech');
    const isContract = ['contract', 'contract_update'].includes(payload.employeeEmailPurpose);
    const isContractUpdate = payload.employeeEmailPurpose === 'contract_update';
    const isPayUpdate = payload.employeeEmailPurpose === 'pay_update' || isContractUpdate;
    const hasContractAttachment = Boolean(payload.contractPdfAttached);
    const heading = isContract
      ? isContractUpdate ? 'Your draft employment terms were updated' : 'Your draft employment terms'
      : isPayUpdate ? 'Your pay details were updated' : 'Welcome to the team';
    const body = isContract
      ? 'Your draft employment terms are attached as a PDF for your records and legal review. The document is not a signed or final employment agreement.'
      : isPayUpdate
      ? 'Your job title or compensation settings have changed. Sign in to Connectfy to review your current employee details. Your set pay rate is reviewed every two weeks, and any revisions are based on your performance.'
      : 'We’re glad to have you working with Connectfy. Your set pay rate is reviewed every two weeks, and any revisions are based on your performance. We’ll communicate any changes to you.';
    const preview = isContract
      ? 'Your draft employment terms PDF is attached for legal review.'
      : isPayUpdate ? 'Your Connectfy employee pay details were updated.' : 'Welcome to the Connectfy team. Here is how your pay rate is reviewed.';
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#0B132B;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f6fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #dce5ef;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:22px 28px;background-color:#0B132B;border-bottom:4px solid #00A3E0;">
                <span style="font-size:22px;line-height:28px;font-weight:700;letter-spacing:.2px;color:#ffffff;">Connectfy</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 20px;">
                <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#334155;">Hello ${escapeHtml(payload.toName || 'there')},</p>
                <h1 style="margin:0 0 18px;font-size:26px;line-height:34px;color:#0B132B;">${heading}</h1>
                <p style="margin:0 0 22px;font-size:16px;line-height:26px;color:#334155;">${body}</p>
                ${hasContractAttachment && !isContract ? '<p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#334155;">A draft copy of your employment terms is attached for legal review. It is not a signed agreement.</p>' : ''}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background-color:#E3F4F5;border-left:4px solid #00A3E0;border-radius:6px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;line-height:22px;color:#0B132B;"><strong style="color:#0056D6;">Pay review schedule</strong><br>Your set pay rate is reviewed fortnightly (every two weeks) based on performance.</td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:7px;background-color:#007AFF;">
                      <a href="${safeLink}" style="display:inline-block;padding:13px 20px;border:1px solid #007AFF;border-radius:7px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Open Connectfy</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:14px;line-height:22px;color:#475569;">If you have questions, contact <a href="mailto:support@connectfy.tech" style="color:#0056D6;text-decoration:underline;">support@connectfy.tech</a>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;line-height:19px;color:#64748b;">Best regards,<br><strong style="color:#0B132B;">Connectfy Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
  if (payload.type === 'applause_follow_up') {
    const messages = {
      settings_video: {
        subject: 'Action required: upload your uTest settings video',
        heading: 'Please upload your settings video',
        body: `Our records show that your settings video is still missing for <strong>${escapeHtml(payload.projectTitle || 'your project')}</strong>. Please sign in to your uTest account and upload the required video so your account is ready for the project.`
      },
      project_completion: {
        subject: 'Reminder: complete your project tasks',
        heading: 'Please complete your project tasks',
        body: `Please finish the remaining tasks for <strong>${escapeHtml(payload.projectTitle || 'your project')}</strong> by the project deadline. Completing the required work and approval steps is necessary for consideration in the upcoming payment cycle; payment remains subject to the project terms and approval.`
      },
      consent_signature: {
        subject: 'Action required: sign your project consent form',
        heading: 'Please sign your consent form',
        body: `Our records show that a consent form has been sent for <strong>${escapeHtml(payload.projectTitle || 'your project')}</strong>. Please review and sign it promptly. A signed consent form is required to continue with the project.`
      }
    };
    const message = messages[payload.applauseFollowUpKind];
    if (!message) throw new Error('Unsupported Applause follow-up email kind.');
    const safeLink = escapeHtml(/^https?:\/\//i.test(projectLink) ? projectLink : 'https://connectfy.tech');
    const slackInviteUrl = escapeHtml(CONNECTFY_SLACK_INVITE_URL);
    const slackDownloadUrl = escapeHtml(SLACK_DOWNLOAD_URL);
    return `<div style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="padding:18px 24px;background:#080808;color:#fff;font-size:20px;font-weight:700;">Connectfy</div><div style="padding:24px;"><p>Hello ${escapeHtml(payload.toName || 'there')},</p><h1 style="font-size:21px;">${message.heading}</h1><p style="line-height:1.7;">${message.body}</p><p style="margin:24px 0;"><a href="${safeLink}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#007AFF;color:#fff;text-decoration:none;font-weight:700;">Open Connectfy</a></p><div style="margin:20px 0;padding:16px;border-radius:10px;background:#f8fafc;"><h2 style="margin:0 0 8px;font-size:16px;">Join us on Slack for real-time communication</h2><p style="margin:0 0 12px;line-height:1.6;">Download the Slack app, then join the Connectfy Ops workspace so you can receive project updates and contact the team in real time.</p><p style="margin:0 0 10px;"><a href="${slackDownloadUrl}" style="color:#007f95;font-weight:700;">Download Slack</a></p><p style="margin:0;"><a href="${slackInviteUrl}" style="color:#007f95;font-weight:700;">Join the Connectfy Ops Slack workspace</a></p></div><p style="color:#475569;">If you need assistance, contact <a href="mailto:support@connectfy.tech">support@connectfy.tech</a>.</p><p>Best regards,<br>Connectfy Team</p></div></div></div>`;
  }
  if (payload.type === 'application_utest_details_request') {
    const projectTitle = escapeHtml(payload.projectTitle || 'your project');
    const reason = payload.reason === 'incorrect'
      ? 'We noticed the uTest ID on your project application may be incorrect.'
      : 'Your project application is missing a uTest ID.';
    const updateLink = escapeHtml(projectLink);
    return `<div style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="padding:18px 24px;background:#080808;color:#fff;font-size:20px;font-weight:700;">Connectfy</div><div style="padding:24px;"><p>Dear user,</p><p>${reason} If you do not have a uTest account, please create one, then add your uTest ID${payload.projectTitle ? ` for <strong>${projectTitle}</strong>` : ''} using the secure link below.</p><p style="margin:24px 0;"><a href="${updateLink}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#007AFF;color:#fff;text-decoration:none;font-weight:700;">Add uTest details</a></p><p>If the button does not work, open this link: <a href="${updateLink}">${updateLink}</a></p><p>Best,<br>Connectfy Team</p></div></div></div>`;
  }
  if (payload.type === 'sheet_consent_pending') {
    const greeting = 'Hello tester,';
    const projectTitle = escapeHtml(payload.projectTitle || 'your project');
    const amount = Number(payload.projectAmount || 0);
    const payout = Number.isFinite(amount) ? `$${amount.toFixed(2)} USD` : 'your approved payout';
    const lockDate = escapeHtml(payload.projectLockDate || 'To be confirmed');
    const slackInviteUrl = escapeHtml(CONNECTFY_SLACK_INVITE_URL);
    const slackDownloadUrl = escapeHtml(SLACK_DOWNLOAD_URL);
    return `<div style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="padding:18px 24px;background:#080808;color:#fff;font-size:20px;font-weight:700;">Connectfy</div><div style="padding:24px;"><p>${greeting}</p><h1 style="font-size:21px;">You’re one step away from claiming your payout</h1><p>Complete the remaining consent step for <strong>${projectTitle}</strong> to claim your payout of <strong>${payout}</strong>.</p><p><strong>This project locks on ${lockDate}.</strong> Please hurry so you have time to finish your testing.</p><p>Join us on Slack for real-time project communication. Download the Slack app and join the Connectfy Ops workspace:</p><p><a href="${slackDownloadUrl}">Download Slack</a> · <a href="${slackInviteUrl}">Join the Connectfy Ops workspace</a></p><p>For support, find us in Slack: <a href="${APPLAUSE_SUPPORT_SLACK_LINK}" style="color:#007f95;font-weight:700;">Find us in Slack</a></p><p style="margin:24px 0;"><a href="${APPLAUSE_SUPPORT_SLACK_LINK}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#4A154B;color:#fff;text-decoration:none;font-weight:700;">Open Slack support</a></p><p>Best,<br>Connectfy Team</p></div></div></div>`;
  }
  if (payload.type === 'sheet_project_approved') {
    const name = escapeHtml(payload.toName || 'there');
    const title = escapeHtml(payload.projectTitle || 'your project');
    const company = escapeHtml(payload.projectCompany || 'Connectfy');
    const amount = Number(payload.approvedAmount || 0);
    const amountLine = Number.isFinite(amount) && amount > 0
      ? `<p style="margin:0 0 12px;"><strong>Approved amount:</strong> $${amount.toFixed(2)} USD</p>`
      : '';
    const sentDate = escapeHtml(payload.expectedPaymentDate || 'To be confirmed');
    const deadline = payload.projectDeadline
      ? `<p style="margin:0 0 16px;"><strong>Deadline:</strong> ${escapeHtml(payload.projectDeadline)}</p>`
      : '';
    const logoUrl = escapeHtml(new URL('/connectfy-brand.svg', process.env.APP_URL || 'https://connectfy.tech').toString());
    return `<div style="margin:0;padding:24px 12px;background:#f1f3f5;font-family:Arial,Helvetica,sans-serif;color:#10213b;"><div style="max-width:560px;margin:0 auto;background:#fff;"><div style="padding:10px 18px;background:#080808;"><img src="${logoUrl}" width="112" height="62" alt="Connectfy" style="display:block;width:112px;height:62px;object-fit:contain;background:#fff;border-radius:3px;"></div><div style="height:8px;background:#00a6bd;font-size:0;line-height:0;">&nbsp;</div><div style="padding:20px 18px 24px;font-size:13px;line-height:1.55;"><p style="margin:0 0 16px;">Hi ${name},</p><p style="margin:0 0 16px;">Your project completion has been approved. Thank you for completing <strong>${title}</strong> with ${company}.</p><p style="margin:0 0 12px;font-weight:700;">${title}</p><p style="margin:0 0 16px;color:#334155;">${escapeHtml(payload.projectDescription || 'Your project completion has been confirmed.')}</p>${deadline}<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #00a6bd;color:#172b4d;">${amountLine}<p style="margin:0 0 12px;"><strong>Expected payment date:</strong> ${sentDate}</p><p style="margin:0;">Your payment will be sent to the payment profile linked to your Connectfy account. Please make sure your payment details are up to date.</p></div><p style="margin:0 0 16px;">You can sign in to Connectfy to review your project and payment details.</p><p style="margin:0 0 16px;"><a href="${escapeHtml(projectLink)}" style="color:#007f95;font-weight:700;">Open your Connectfy account</a></p><p style="margin:0 0 14px;">Thanks,<br>The Connectfy Team</p><p style="margin:0;color:#64748b;font-size:11px;">Need help? Contact support@connectfy.tech.</p></div><div style="height:8px;background:#00a6bd;font-size:0;line-height:0;">&nbsp;</div></div></div>`;
  }
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailHtml(payload.toName, projectLink, payload.supportEmail);
  }
  if (payload.type === 'invite') return buildProjectApprovalEmailHtml({ ...payload, projectLink });
  if (payload.type === 'application') {
    const fields = [
      ['Application reference', payload.applicationReference],
      ['Applicant', payload.applicantFullName],
      ['Country', payload.applicantCountry],
      ['Device', payload.applicantDevice || payload.applicantSmartphone],
      ['uTest ID', payload.uTestId],
      ['uTest email', payload.uTestEmail],
      ['Submitted', payload.submittedAt]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
    const details = fields.map(([label, value]) =>
      `<tr><td style="padding:9px 0;color:#64748b;border-bottom:1px solid #e8eef5;">${escapeHtml(label)}</td><td style="padding:9px 0;color:#172b4d;font-weight:600;text-align:right;border-bottom:1px solid #e8eef5;">${escapeHtml(value)}</td></tr>`
    ).join('');
    const projectTitle = escapeHtml(payload.projectTitle || 'Project opportunity');
    const projectCompany = escapeHtml(payload.projectCompany || 'Connectfy');
    const projectDescription = String(payload.projectDescription || '').replace(/\s+/g, ' ').trim().slice(0, 260);
    const projectDeadline = String(payload.projectDeadline || '').trim();
    const safeName = escapeHtml(payload.toName || 'Tester');
    const safeLink = /^https?:\/\//i.test(projectLink) ? escapeHtml(projectLink) : 'https://connectfy.tech';
    return `<div style="margin:0;padding:28px 16px;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#172b4d;"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="padding:18px 28px;background:#0b1b35;color:#fff;font-size:18px;font-weight:700;letter-spacing:.2px;">Connectfy</div><div style="padding:28px;"><p style="margin:0 0 12px;font-size:15px;">Hello ${safeName},</p><h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;color:#10213b;">Application received</h1><p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#475569;">Thank you for applying to <strong>${projectTitle}</strong>${projectCompany ? ` with ${projectCompany}` : ''}. Your application has been submitted successfully and is now under review.</p>${projectDescription ? `<div style="margin:0 0 20px;"><h2 style="margin:0 0 7px;font-size:15px;color:#10213b;">About this project</h2><p style="margin:0;font-size:13px;line-height:1.7;color:#475569;">${escapeHtml(projectDescription)}</p></div>` : ''}${projectDeadline ? `<p style="margin:0 0 18px;font-size:13px;color:#475569;"><strong>Application deadline:</strong> ${escapeHtml(projectDeadline)}</p>` : ''}${details ? `<div style="margin:22px 0;padding:16px 18px;border:1px solid #e5ebf3;border-radius:10px;background:#f8fafc;"><h2 style="margin:0 0 8px;font-size:14px;color:#10213b;">Application details</h2><table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;">${details}</table></div>` : ''}<p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:#475569;">Our team will review your application and contact you if you are selected. You can view the project and check for updates in your Connectfy account.</p><div style="text-align:center;margin:26px 0;"><a href="${safeLink}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0b5cff;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">View project</a></div><p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">Questions? Contact <a href="mailto:${escapeHtml(payload.supportEmail || 'support@connectfy.tech')}" style="color:#0b5cff;text-decoration:none;">${escapeHtml(payload.supportEmail || 'support@connectfy.tech')}</a>.</p><p style="margin:20px 0 0;font-size:13px;color:#475569;">Best regards,<br><strong>The Connectfy Team</strong></p></div></div></div>`;
  }
  if (payload.type === 'submission_approved') {
    return `<div style="margin:0;padding:24px;background:#f6f9fc;font-family:Arial,sans-serif;color:#10213b;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dfeaf5;border-radius:12px;padding:24px;"><p>Hello ${escapeHtml(payload.toName || 'Tester')},</p><h2>Your project submission has been approved</h2><p>Your work, “${escapeHtml(payload.submissionTitle)}”, for <strong>${escapeHtml(payload.projectTitle)}</strong> has been approved.</p><p style="font-size:18px;font-weight:700;color:#047857;">$${Number(payload.approvedAmount || 0).toFixed(2)} has been credited to your Connectfy wallet.</p><p>You can sign in to view your wallet and submission details.</p><p>Best,<br>Connectfy Team</p></div></div>`;
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
  const applicationDetails = payload.type === 'utest_update_required'
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:16px 18px;margin:20px 0;"><strong style="color:#9a4d00;">Action required</strong><p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#7c2d12;">Thank you for your interest in this project. We cannot move forward with your current application because the project requires a valid uTest account created within the last 7 days. Please create a new uTest account at <a href="https://www.utest.com/signup" style="color:#0b5cff;font-weight:700;">uTest account registration</a>, then return to Connectfy and reapply using the new account's uTest ID and email. Your application has been reopened for reapplication while the project is accepting applicants. Watch the setup guide here: <a href="https://www.youtube.com/watch?v=F_XmEVQZaHc" style="color:#0b5cff;font-weight:700;">https://www.youtube.com/watch?v=F_XmEVQZaHc</a></p></div>`
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
  if (payload.type === 'employee_welcome') {
    if (['contract', 'contract_update'].includes(payload.employeeEmailPurpose)) {
      return [
        `Hello ${payload.toName || 'there'},`,
        '',
        'Your draft employment terms are attached as a PDF for your records and legal review.',
        'The document is a draft only. It is not a signed or final employment agreement.',
        'Your set pay rate is reviewed every two weeks, and any revisions are based on your performance.',
        '',
        `Open Connectfy: ${projectLink}`,
        'If you have questions, contact support@connectfy.tech.',
        '',
        'Best regards,',
        'Connectfy Team'
      ].join('\n');
    }
    if (payload.employeeEmailPurpose === 'pay_update') {
      return [
        `Hello ${payload.toName || 'there'},`,
        '',
        'Your job title or compensation settings have changed. Sign in to Connectfy to review your current employee details.',
        'Your set pay rate is reviewed every two weeks, and any revisions are based on your performance.',
        '',
        `Open Connectfy: ${projectLink}`,
        'If you have questions, contact support@connectfy.tech.',
        '',
        'Best regards,',
        'Connectfy Team'
      ].join('\n');
    }
    return [
      `Hello ${payload.toName || 'there'},`,
      '',
      'Welcome to the Connectfy team.',
      ...(payload.contractPdfAttached
        ? ['', 'A draft copy of your employment terms is attached for legal review. It is not a signed agreement.']
        : []),
      'Your set pay rate is reviewed every two weeks, and revisions are based on your performance. Any changes will be communicated to you.',
      '',
      `Open Connectfy: ${projectLink}`,
      'If you have questions, contact support@connectfy.tech.',
      '',
      'Best regards,',
      'Connectfy Team'
    ].join('\n');
  }
  if (payload.type === 'applause_follow_up') {
    const messages = {
      settings_video: {
        subject: 'Action required: upload your uTest settings video',
        body: `Our records show that your settings video is still missing for ${payload.projectTitle || 'your project'}. Please sign in to your uTest account and upload the required video so your account is ready for the project.`
      },
      project_completion: {
        subject: 'Reminder: complete your project tasks',
        body: `Please finish the remaining tasks for ${payload.projectTitle || 'your project'} by the project deadline. Completing the required work and approval steps is necessary for consideration in the upcoming payment cycle; payment remains subject to the project terms and approval.`
      },
      consent_signature: {
        subject: 'Action required: sign your project consent form',
        body: `Our records show that a consent form has been sent for ${payload.projectTitle || 'your project'}. Please review and sign it promptly. A signed consent form is required to continue with the project.`
      }
    };
    const message = messages[payload.applauseFollowUpKind];
    if (!message) throw new Error('Unsupported Applause follow-up email kind.');
    return [
      `Hello ${payload.toName || 'there'},`,
      '',
      message.body,
      '',
      `Open Connectfy: ${projectLink}`,
      'Join the Connectfy Ops workspace on Slack for real-time project communication:',
      `Download Slack: ${SLACK_DOWNLOAD_URL}`,
      `Join the workspace: ${CONNECTFY_SLACK_INVITE_URL}`,
      'If you need assistance, contact support@connectfy.tech.',
      '',
      'Best regards,',
      'Connectfy Team'
    ].join('\n');
  }
  if (payload.type === 'application_utest_details_request') {
    const reason = payload.reason === 'incorrect'
      ? 'We noticed the uTest ID on your project application may be incorrect.'
      : 'Your project application is missing a uTest ID.';
    return [
      'Dear user,',
      '',
      reason,
      'If you do not have a uTest account, please create one, then add your uTest ID to your project application using this secure link:',
      projectLink,
      '',
      'Best,',
      'Connectfy Team'
    ].join('\n');
  }
  if (payload.type === 'sheet_consent_pending') {
    const amount = Number(payload.projectAmount || 0);
    const payout = Number.isFinite(amount) ? `$${amount.toFixed(2)} USD` : 'your approved payout';
    return [
      'Hello tester,',
      '',
      `You are one step away from claiming your payout of ${payout}.`,
      `Please complete the remaining consent step for ${payload.projectTitle || 'your project'}.`,
      `The project locks on ${payload.projectLockDate || 'a date to be confirmed'}; please hurry so you have time to finish your testing.`,
      'Download Slack and join the Connectfy Ops workspace for real-time project communication:',
      `Download Slack: ${SLACK_DOWNLOAD_URL}`,
      `Join the workspace: ${CONNECTFY_SLACK_INVITE_URL}`,
      '',
      'For support, find us in Slack:',
      APPLAUSE_SUPPORT_SLACK_LINK,
      '',
      'Connectfy Team'
    ].join('\n');
  }
  if (payload.type === 'sheet_project_approved') {
    return [
      `Hello ${payload.toName || 'there'},`,
      '',
      `Your ${payload.projectTitle || 'project'} completion has been approved. We confirmed it from the uTest project records for ${payload.projectCompany || 'Connectfy'}.`,
      Number(payload.approvedAmount) > 0 ? `Approved amount: $${Number(payload.approvedAmount).toFixed(2)} USD.` : '',
      `Expected payment date: ${payload.expectedPaymentDate || 'To be confirmed'}.`,
      'Payment will be sent to the payment profile linked to your Connectfy account. Please make sure your payment details are up to date.',
      payload.projectDescription || '',
      payload.projectDeadline ? `Project deadline: ${payload.projectDeadline}` : '',
      '',
      `Open Connectfy: ${projectLink}`,
      'Questions? Contact support@connectfy.tech.',
      '',
      'Best,',
      'Connectfy Team'
    ].filter(Boolean).join('\n');
  }
  if (payload.type === 'legacy_sheet_reapply') {
    return buildLegacySheetEmailText(payload.toName, projectLink, payload.supportEmail);
  }
  if (payload.type === 'invite') return buildProjectApprovalEmailText({ ...payload, projectLink });
  if (payload.type === 'application') {
    const fields = [
      ['Application reference', payload.applicationReference],
      ['Applicant', payload.applicantFullName],
      ['Country', payload.applicantCountry],
      ['Device', payload.applicantDevice || payload.applicantSmartphone],
      ['uTest ID', payload.uTestId],
      ['uTest email', payload.uTestEmail],
      ['Submitted', payload.submittedAt]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
    const projectDescription = String(payload.projectDescription || '').replace(/\s+/g, ' ').trim().slice(0, 260);
    return [
      `Hello ${payload.toName || 'Tester'},`,
      '',
      'APPLICATION RECEIVED',
      '',
      `Thank you for applying to ${payload.projectTitle || 'the project'}${payload.projectCompany ? ` with ${payload.projectCompany}` : ''}. Your application has been submitted successfully and is now under review.`,
      ...(projectDescription ? ['', 'ABOUT THIS PROJECT', projectDescription] : []),
      ...(payload.projectDeadline ? ['', `Application deadline: ${payload.projectDeadline}`] : []),
      ...(fields.length ? ['', 'APPLICATION DETAILS', ...fields.map(([label, value]) => `${label}: ${value}`)] : []),
      '',
      'Our team will review your application and contact you if you are selected. You can view the project and check for updates in your Connectfy account.',
      '',
      `View project: ${projectLink}`,
      `Questions? Contact ${payload.supportEmail || 'support@connectfy.tech'}.`,
      '',
      'Best regards,',
      'The Connectfy Team'
    ].join('\n');
  }
  if (payload.type === 'submission_approved') {
    return [
      `Hello ${payload.toName || 'Tester'},`,
      '',
      `Your project submission "${payload.submissionTitle}" for "${payload.projectTitle}" has been approved.`,
      `$${Number(payload.approvedAmount || 0).toFixed(2)} has been credited to your Connectfy wallet.`,
      '',
      'Sign in to Connectfy to view your wallet and submission details.',
      '',
      'Best,',
      'Connectfy Team'
    ].join('\n');
  }
  const projectCompany = payload.projectCompany || 'Connectfy';
  const deadline = payload.projectDeadline ? `Deadline: ${payload.projectDeadline}` : 'Deadline: To be confirmed';
  const description = String(payload.projectDescription || 'No summary provided yet.').replace(/\s+/g, ' ').trim().slice(0, 260);
  const resources = Array.isArray(payload.projectResources) ? payload.projectResources.slice(0, 4) : [];
  const consentLink = resources[0]?.url || '';
  const isLegacySheetReapply = payload.type === 'legacy_sheet_reapply';
  const applicationSummary = payload.type === 'utest_update_required'
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
  : type === 'employee_welcome'
    ? payload.employeeEmailPurpose === 'contract_update'
      ? 'Your updated draft employment terms from Connectfy'
      : payload.employeeEmailPurpose === 'contract'
        ? 'Your draft employment terms from Connectfy'
        : payload.employeeEmailPurpose === 'pay_update'
          ? 'Your Connectfy pay details were updated'
          : 'Welcome to the Connectfy team'
  : type === 'application'
    ? `Application received: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'applause_follow_up'
    ? ({
      settings_video: 'Action required: upload your uTest settings video',
      project_completion: 'Reminder: complete your project tasks',
      consent_signature: 'Action required: sign your project consent form'
    })[payload.applauseFollowUpKind] || 'Project follow-up'
  : type === 'submission_approved'
    ? `Project submission approved: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'sheet_project_approved'
    ? `Project completion approved: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'sheet_consent_pending'
    ? `Action required: complete your consent step for ${payload.projectTitle || 'your project'}`
  : type === 'application_utest_details_request'
    ? `Action required: add your uTest details for ${payload.projectTitle || 'your project'}`
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

const hasBrevoEmailProvider = () => Boolean(process.env.BREVO_API_KEY);
const hasMailjetEmailProvider = () => Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET);
const hasSenderEmailProvider = () => Boolean(process.env.SENDER_SMTP_USER && process.env.SENDER_SMTP_PASSWORD);
const hasEmailProvider = () => hasBrevoEmailProvider() || hasMailjetEmailProvider() || hasSenderEmailProvider();

const sendEmailThroughProvider = async (payload, type, provider) => {
  let toEmail = String(payload.toEmail || '').trim();
  let toName = String(payload.toName || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) throw new Error('Invalid recipient email');
  if (!toName) throw new Error('Recipient name is required');

  const projectLink = payload.projectLink || payload.actionUrl || 'https://connectfy.tech';
  const subject = projectEmailSubject(payload, type);
  const htmlContent = appendSlackFooterHtml(buildHtml({ ...payload, type, projectLink }));
  const textContent = appendSlackFooterText(buildText({ ...payload, type, projectLink }));
  let endpoint;
  let headers;
  let requestPayload;

  if (provider === 'brevo') {
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) throw new Error('BREVO_API_KEY is not configured.');
    endpoint = 'https://api.brevo.com/v3/smtp/email';
    headers = {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
      Accept: 'application/json'
    };
    requestPayload = {
      sender: { name: 'Connectfy', email: process.env.BREVO_SENDER_EMAIL || 'admin@connectfy.tech' },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent,
      textContent
    };
    if (type === 'employee_welcome' && Array.isArray(payload.emailAttachments) && payload.emailAttachments.length) {
      requestPayload.attachment = payload.emailAttachments;
    }
  } else if (provider === 'mailjet') {
    const mailjetApiKey = process.env.MAILJET_API_KEY;
    const mailjetApiSecret = process.env.MAILJET_API_SECRET;
    if (!mailjetApiKey || !mailjetApiSecret) throw new Error('MAILJET_API_KEY and MAILJET_API_SECRET are required.');
    endpoint = 'https://api.mailjet.com/v3.1/send';
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${mailjetApiKey}:${mailjetApiSecret}`).toString('base64')}`
    };
    const message = {
      From: {
        Email: process.env.MAILJET_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'admin@connectfy.tech',
        Name: process.env.MAILJET_SENDER_NAME || 'Connectfy'
      },
      To: [{ Email: toEmail, Name: toName }],
      Subject: subject,
      HTMLPart: htmlContent,
      TextPart: textContent
    };
    if (type === 'employee_welcome' && Array.isArray(payload.emailAttachments) && payload.emailAttachments.length) {
      message.Attachments = payload.emailAttachments.map((attachment) => ({
        ContentType: attachment.contentType || 'application/octet-stream',
        Filename: attachment.name,
        Base64Content: attachment.content
      }));
    }
    requestPayload = { Messages: [message] };
  } else {
    const smtpUser = process.env.SENDER_SMTP_USER;
    const smtpPassword = process.env.SENDER_SMTP_PASSWORD;
    if (!smtpUser || !smtpPassword) {
      throw new Error('SENDER_SMTP_USER and SENDER_SMTP_PASSWORD are required.');
    }
    const transport = nodemailer.createTransport({
      host: 'smtp.sender.net',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });
    try {
      const result = await transport.sendMail({
        from: {
          name: process.env.SENDER_SENDER_NAME || 'Connectfy',
          address: process.env.SENDER_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'admin@connectfy.tech'
        },
        to: { name: toName, address: toEmail },
        subject,
        html: htmlContent,
        text: textContent,
        attachments: type === 'employee_welcome' && Array.isArray(payload.emailAttachments)
          ? payload.emailAttachments.map((attachment) => ({
            filename: attachment.name,
            content: Buffer.from(attachment.content, 'base64'),
            contentType: attachment.contentType || 'application/octet-stream'
          }))
          : []
      });
      if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
        throw new Error('Sender SMTP did not confirm recipient acceptance.');
      }
      return { subject, messageId: result.messageId || null, provider };
    } catch (error) {
      const responseCode = Number(error?.responseCode);
      const responseText = String(error?.response || error?.message || '');
      if (responseCode >= 400 && responseCode < 600) {
        throw new EmailProviderHttpError(provider, responseCode, responseText);
      }
      throw error;
    } finally {
      transport.close();
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestPayload)
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new EmailProviderHttpError(provider, response.status, responseText);
  }

  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`${provider} returned an invalid success response.`);
    }
  }
  if (provider === 'mailjet' && result.Messages?.[0]?.Status !== 'success') {
    throw new Error('Mailjet did not confirm email acceptance.');
  }
  const messageId = provider === 'brevo'
    ? result.messageId || null
    : result.Messages?.[0]?.To?.[0]?.MessageID || null;
  return { subject, messageId, provider };
};

const sendEmailWithFailover = async (payload, type) => {
  const preferredProvider = process.env.EMAIL_PRIMARY_PROVIDER || 'brevo';
  const availableProviders = {
    brevo: hasBrevoEmailProvider(),
    mailjet: hasMailjetEmailProvider(),
    sender: hasSenderEmailProvider()
  };
  return sendWithEmailProviderFailover({
    preferredProvider,
    availableProviders,
    send: (provider) => sendEmailThroughProvider(payload, type, provider),
    onFailover: (primary, fallback) => {
      console.warn(`${primary} rejected an email because of a sending limit; retrying through ${fallback}.`);
    }
  });
};

const supabaseServiceUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outboxWorkerEnabled = process.env.PROJECT_INVITATION_EMAIL_AUTOMATION_ENABLED === 'true'
  && Boolean(supabaseServiceUrl && supabaseServiceRoleKey && hasEmailProvider());
const applicationScreenerWorkerEnabled = Boolean(supabaseServiceUrl && supabaseServiceRoleKey && hasEmailProvider());
let outboxWorkerBusy = false;
let applicationScreenerWorkerBusy = false;
let paypalPayoutPollBusy = false;
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

const callSlackApi = async (method, payload) => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('Slack status notifications are not configured. Set SLACK_BOT_TOKEN on the backend.');
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const error = new Error(`Slack ${method} failed: ${result.error || `HTTP ${response.status}`}`);
    error.slackCode = result.error || `http_${response.status}`;
    throw error;
  }
  return result;
};

const slackSafeText = (value, fallback = 'Not provided') => {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, 1500).replace(/@/g, '@\u200b');
};

const sendApplauseProjectStatusSlackDms = async (projectId) => {
  const projectRows = await callSupabaseRest(
    `projects?id=eq.${encodeURIComponent(projectId)}&select=id,title&limit=1`
  );
  const project = Array.isArray(projectRows) ? projectRows[0] : null;
  if (!project) throw new Error('Project not found.');

  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    if (offset >= 5000) {
      const extraRows = await callSupabaseRest(
        `project_applause_status?project_id=eq.${encodeURIComponent(projectId)}&select=status&limit=1`,
        { headers: { Range: '5000-5000' } }
      );
      if (Array.isArray(extraRows) && extraRows.length) {
        throw new Error('This project has more than 5,000 sheet rows. Narrow the synced sheet before sending Slack updates.');
      }
      break;
    }
    const page = await callSupabaseRest(
      `project_applause_status?project_id=eq.${encodeURIComponent(projectId)}&select=status,tester_email,google_email,consent_name,id_scan_status,issues&order=source_key.asc&limit=${pageSize}`,
      { headers: { Range: `${offset}-${offset + pageSize - 1}` } }
    );
    if (!Array.isArray(page)) throw new Error('Unable to load project status rows for Slack updates.');
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const recipients = new Map();
  let missingEmail = 0;
  for (const row of rows) {
    const email = String(row.google_email || '').trim() || String(row.tester_email || '').trim();
    if (!email) {
      missingEmail += 1;
      continue;
    }
    const normalizedEmail = email.toLowerCase();
    if (!recipients.has(normalizedEmail)) recipients.set(normalizedEmail, row);
  }

  const summary = { sent: 0, notFound: 0, missingEmail, failed: 0 };
  for (const [email, row] of recipients) {
    try {
      let member;
      try {
        member = await callSlackApi('users.lookupByEmail', { email });
      } catch (error) {
        if (error?.slackCode === 'users_not_found') {
          summary.notFound += 1;
          continue;
        }
        throw error;
      }
      const conversation = await callSlackApi('conversations.open', { users: member.user.id });
      const text = [
        `Project status update: ${slackSafeText(project.title, 'Project')}`,
        `Status: ${slackSafeText(row.status)}`,
        `Consent: ${slackSafeText(row.consent_name)}`,
        `ID scan: ${slackSafeText(row.id_scan_status)}`,
        `Issues: ${slackSafeText(row.issues, 'None reported')}`
      ].join('\n');
      await callSlackApi('chat.postMessage', {
        channel: conversation.channel.id,
        text,
        mrkdwn: false,
        link_names: false,
        parse: 'none'
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.error('Unable to deliver a project status Slack DM.', {
        slackCode: error?.slackCode || 'request_failed'
      });
    }
  }
  return summary;
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
  if (missing.length) {
    throw createHttpError(
      503,
      `Safaricom B2C configuration is incomplete: ${missing.join(', ')}. Configure these server environment variables and restart the payment backend.`
    );
  }
  let callbackBaseUrl;
  try {
    callbackBaseUrl = new URL(process.env.MPESA_CALLBACK_BASE_URL);
  } catch {
    throw createHttpError(503, 'MPESA_CALLBACK_BASE_URL must be a valid HTTPS URL. Update the payment backend configuration.');
  }
  if (callbackBaseUrl.protocol !== 'https:') {
    throw createHttpError(503, 'MPESA_CALLBACK_BASE_URL must use HTTPS. Update the payment backend configuration.');
  }
  const baseUrl = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
  return { baseUrl, callbackBaseUrl: callbackBaseUrl.toString().replace(/\/$/, '') };
};

const getMpesaAccessToken = async (baseUrl) => {
  const credentials = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  let response;
  try {
    response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    throw createHttpError(502, `Unable to reach the Safaricom token service: ${message}`);
  }
  const text = await response.text();
  if (!response.ok) throw createHttpError(502, `Safaricom token request failed (${response.status}): ${text}`);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw createHttpError(502, 'Safaricom returned an invalid access-token response.');
  }
  if (!body.access_token) throw createHttpError(502, 'Safaricom token response did not include an access token.');
  return body.access_token;
};

const getPayPalConfiguration = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal payouts are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on the backend.');
  }
  const environment = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  if (environment !== 'sandbox' && environment !== 'live') {
    throw new Error('PAYPAL_ENV must be either sandbox or live.');
  }
  return {
    clientId,
    clientSecret,
    apiBaseUrl: environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  };
};

const getPayPalAccessToken = async (configuration) => {
  const credentials = Buffer.from(`${configuration.clientId}:${configuration.clientSecret}`).toString('base64');
  const response = await fetch(`${configuration.apiBaseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `******`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000)
  });
  const responseText = await response.text();
  let body;
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error('PayPal returned an invalid access-token response.');
  }
  if (!response.ok || !body.access_token) {
    throw new Error(`PayPal authentication failed (${response.status}): ${body.error_description || responseText}`);
  }
  return body.access_token;
};

const callPayPalApi = async (configuration, accessToken, path, options = {}) => {
  const response = await fetch(`${configuration.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `******`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(20000)
  });
  const responseText = await response.text();
  let body = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(`PayPal returned an invalid response (${response.status}).`);
    }
  }
  return { response, body, responseText };
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

    const result = await sendEmailWithFailover({
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

const processOneApplauseApprovalEmail = async () => {
  const claimed = await callOutboxRpc('claim_project_applause_approval_email', {});
  const job = Array.isArray(claimed) ? claimed[0] : null;
  if (!job) return false;

  try {
    if (!job.id || !job.project_id || !job.profile_id || !job.recipient_email || !job.recipient_name) {
      throw new Error('Applause completion approval email has an invalid outbox payload.');
    }
    const projectLink = new URL(process.env.APP_URL || 'https://connectfy.tech');
    projectLink.searchParams.set('project', job.project_id);
    const result = await sendEmailWithFailover({
      type: 'sheet_project_approved',
      toEmail: job.recipient_email,
      toName: job.recipient_name,
      projectTitle: job.project_title,
      projectCompany: job.project_company,
      approvedAmount: Number(job.approved_amount || 0),
      expectedPaymentDate: getNextPlatformPayDate(job.created_at),
      projectDescription: job.project_description,
      projectDeadline: job.project_deadline,
      actionUrl: projectLink.toString(),
      projectLink: projectLink.toString(),
      supportEmail: 'support@connectfy.tech'
    }, 'sheet_project_approved');
    await callOutboxRpc('complete_project_applause_approval_email', {
      p_outbox_id: job.id,
      p_succeeded: true,
      p_provider_message_id: result.messageId,
      p_error: null
    });
    console.info('Applause project completion approval email delivered.', {
      outboxId: job.id,
      projectId: job.project_id,
      profileId: job.profile_id,
      subject: result.subject
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Applause approval email delivery error';
    try {
      await callOutboxRpc('complete_project_applause_approval_email', {
        p_outbox_id: job.id,
        p_succeeded: false,
        p_provider_message_id: null,
        p_error: message
      });
    } catch (completionError) {
      console.error('Unable to record Applause approval email delivery failure:', completionError);
      throw completionError;
    }
    console.error('Applause approval email delivery failed; retry policy applied.', {
      outboxId: job.id,
      projectId: job.project_id,
      profileId: job.profile_id,
      attemptCount: job.attempt_count,
      error: message
    });
  }
  return true;
};

const processOneApplauseConsentReminderEmail = async () => {
  const claimed = await callOutboxRpc('claim_project_applause_consent_reminder_email', {});
  const job = Array.isArray(claimed) ? claimed[0] : null;
  if (!job) return false;

  try {
    if (!job.id || !job.project_id || !job.recipient_email || !job.recipient_name) {
      throw new Error('Applause consent reminder email has an invalid outbox payload.');
    }
    const result = await sendEmailWithFailover({
      type: 'sheet_consent_pending',
      toEmail: job.recipient_email,
      toName: job.recipient_name,
      externalRecipient: Boolean(job.external_recipient),
      projectTitle: job.project_title,
      projectAmount: Number(job.project_amount || 0),
      projectLockDate: job.project_lock_date,
      supportEmail: 'support@connectfy.tech'
    }, 'sheet_consent_pending');
    await callOutboxRpc('complete_project_applause_consent_reminder_email', {
      p_outbox_id: job.id,
      p_succeeded: true,
      p_provider_message_id: result.messageId,
      p_error: null
    });
    console.info('Applause consent pending reminder delivered.', {
      outboxId: job.id,
      projectId: job.project_id,
      profileId: job.profile_id,
      subject: result.subject
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Applause consent reminder delivery error';
    await callOutboxRpc('complete_project_applause_consent_reminder_email', {
      p_outbox_id: job.id,
      p_succeeded: false,
      p_provider_message_id: null,
      p_error: message
    });
    console.error('Applause consent reminder delivery failed; retry policy applied.', {
      outboxId: job.id,
      projectId: job.project_id,
      profileId: job.profile_id,
      attemptCount: job.attempt_count,
      error: message
    });
  }
  return true;
};

const pollProjectEmailOutbox = async () => {
  if (!outboxWorkerEnabled || outboxWorkerBusy) return;
  outboxWorkerBusy = true;
  let projectEmailQueueAvailable = true;
  let applauseEmailQueueAvailable = true;
  let consentReminderQueueAvailable = true;
  try {
    while (true) {
      let processedProjectEmail = false;
      let processedApplauseEmail = false;
      let processedConsentReminderEmail = false;
      if (projectEmailQueueAvailable) {
        try {
          processedProjectEmail = await processOneProjectEmail();
        } catch (error) {
          projectEmailQueueAvailable = false;
          console.error('Project application email queue poll failed; other email queues will continue.', error);
        }
      }
      if (applauseEmailQueueAvailable) {
        try {
          processedApplauseEmail = await processOneApplauseApprovalEmail();
        } catch (error) {
          applauseEmailQueueAvailable = false;
          console.error('Applause approval email queue poll failed; other email queues will continue.', error);
        }
      }
      if (consentReminderQueueAvailable) {
        try {
          processedConsentReminderEmail = await processOneApplauseConsentReminderEmail();
        } catch (error) {
          consentReminderQueueAvailable = false;
          console.error('Applause consent reminder queue poll failed; other email queues will continue.', error);
        }
      }
      if (!processedProjectEmail && !processedApplauseEmail && !processedConsentReminderEmail) break;
    }
  } finally {
    outboxWorkerBusy = false;
  }
};

const pollPayPalPayouts = async () => {
  if (!process.env.PAYPAL_CLIENT_ID
    || !process.env.PAYPAL_CLIENT_SECRET
    || !process.env.SUPABASE_URL
    || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (paypalPayoutPollBusy) return;
  paypalPayoutPollBusy = true;
  try {
    const payouts = await callSupabaseRest(
      'payout_requests?method=eq.PayPal&status=eq.processing&paypal_payout_batch_id=not.is.null&select=id,paypal_payout_batch_id'
    );
    if (!Array.isArray(payouts) || payouts.length === 0) return;

    const configuration = getPayPalConfiguration();
    const accessToken = await getPayPalAccessToken(configuration);
    for (const payout of payouts) {
      try {
        const { response, body } = await callPayPalApi(
          configuration,
          accessToken,
          `/v1/payments/payouts/${encodeURIComponent(payout.paypal_payout_batch_id)}?fields=items&page=1&page_size=100`
        );
        if (!response.ok) {
          console.error('Unable to reconcile PayPal payout batch; payout remains processing.', {
            payoutId: payout.id,
            batchId: payout.paypal_payout_batch_id,
            status: response.status,
            response: body
          });
          continue;
        }

        const batchStatus = body?.batch_header?.batch_status;
        const item = body?.items?.[0];
        const itemStatus = item?.transaction_status;
        let finalStatus = null;
        if (itemStatus === 'SUCCESS') finalStatus = 'completed';
        else if (['FAILED', 'RETURNED', 'BLOCKED', 'REFUNDED'].includes(itemStatus)
          || ['DENIED', 'CANCELED'].includes(batchStatus)) finalStatus = 'failed';

        if (!finalStatus) continue;
        await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.processing`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: finalStatus,
            completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
            failure_reason: finalStatus === 'failed'
              ? `PayPal payout ${itemStatus || batchStatus || 'failed'}.`
              : null,
            paypal_result: body,
            updated_at: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('Unable to reconcile PayPal payout; payout remains processing.', {
          payoutId: payout.id,
          batchId: payout.paypal_payout_batch_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch (error) {
    console.error('PayPal payout reconciliation poll failed:', error);
  } finally {
    paypalPayoutPollBusy = false;
  }
};

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    approvalEmailOutbox: outboxWorkerEnabled ? 'enabled' : 'disabled',
    applicationScreenerWorker: applicationScreenerWorkerEnabled ? 'enabled' : 'disabled',
    slackStatusDms: process.env.SLACK_BOT_TOKEN ? 'configured' : 'disabled',
    paypalPayouts: process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
      ? (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
      : 'disabled'
  });
});

app.post('/api/admin/applause-status-slack-dms', async (req, res) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ ok: false, message: 'Sign in as an administrator before sending Slack status updates.' });
    }
    try {
      await requireAdmin(authorization);
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Unable to verify administrator access.';
      const status = /invalid|expired|sign in/i.test(message) ? 401 : 403;
      return res.status(status).json({ ok: false, message });
    }
    const projectId = String(req.body?.projectId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
      return res.status(400).json({ ok: false, message: 'A valid project ID is required.' });
    }
    if (!process.env.SLACK_BOT_TOKEN) {
      return res.status(503).json({ ok: false, message: 'Slack status DMs are not configured. Set SLACK_BOT_TOKEN on the backend.' });
    }
    const result = await sendApplauseProjectStatusSlackDms(projectId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send Slack status updates.';
    console.error('Unable to send project status Slack DMs:', error);
    return res.status(500).json({ ok: false, message });
  }
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
    const supportedMethods = ['PayPal', 'Safaricom M-Pesa'];
    if (!supportedMethods.includes(method)) return res.status(400).json({ ok: false, message: 'Unsupported payout method.' });
    if (!destinationAccount) return res.status(400).json({ ok: false, message: 'Enter your payout destination.' });
    if (method === 'PayPal' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinationAccount)) {
      return res.status(400).json({ ok: false, message: 'Enter a valid PayPal recipient email address.' });
    }

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

app.get('/api/admin/applause-approval-emails', async (req, res) => {
  try {
    await requireAdmin(req.headers.authorization);
    const requestedLimit = Number(req.query.limit ?? 100);
    const requestedOffset = Number(req.query.offset ?? 0);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200
      || !Number.isInteger(requestedOffset) || requestedOffset < 0) {
      return res.status(400).json({ ok: false, message: 'Invalid email log page request.' });
    }

    const filters = [];
    if (typeof req.query.projectId === 'string' && req.query.projectId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.query.projectId)) {
        return res.status(400).json({ ok: false, message: 'Invalid project filter.' });
      }
      filters.push(`project_id=eq.${encodeURIComponent(req.query.projectId)}`);
    }
    if (typeof req.query.status === 'string' && req.query.status && req.query.status !== 'all') {
      if (!['pending', 'processing', 'sent', 'failed'].includes(req.query.status)) {
        return res.status(400).json({ ok: false, message: 'Invalid email status filter.' });
      }
      filters.push(`status=eq.${encodeURIComponent(req.query.status)}`);
    }

    const query = [
      'select=id,project_id,profile_id,source_key,recipient_email,recipient_name,project_title,project_company,status,attempt_count,provider_message_id,last_error,created_at,updated_at,sent_at',
      'order=created_at.desc',
      `limit=${requestedLimit + 1}`,
      `offset=${requestedOffset}`,
      ...filters
    ].join('&');
    const rows = await callSupabaseRest(`project_applause_approval_email_outbox?${query}`);
    const hasMore = Array.isArray(rows) && rows.length > requestedLimit;
    return res.json({
      ok: true,
      emails: Array.isArray(rows) ? rows.slice(0, requestedLimit) : [],
      hasMore
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load approval email history.';
    console.error('Unable to load admin Applause approval email history:', error);
    return res.status(400).json({ ok: false, message });
  }
});

app.get('/api/admin/applause-consent-reminder-emails', async (req, res) => {
  try {
    await requireAdmin(req.headers.authorization);
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
      return res.status(400).json({ ok: false, message: 'A valid project is required to load consent reminder email history.' });
    }

    const rows = await callSupabaseRest(
      `project_applause_consent_reminder_email_outbox?project_id=eq.${encodeURIComponent(projectId)}`
      + '&select=id,project_id,profile_id,external_recipient,queued_by,source_key,recipient_email,recipient_name,project_title,status,attempt_count,provider_message_id,last_error,created_at,updated_at,sent_at'
      + '&order=created_at.desc&limit=1000'
    );
    return res.json({ ok: true, emails: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load consent reminder email history.';
    console.error('Unable to load admin Applause consent reminder email history:', error);
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
    if (payout.method === 'PayPal') {
      const configuration = getPayPalConfiguration();
      const accessToken = await getPayPalAccessToken(configuration);
      const senderBatchId = `CF${crypto.createHash('sha256').update(payout.id).digest('hex').slice(0, 28)}`;
      const claimed = await callSupabaseRest(
        `payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.pending&select=id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'processing',
            approved_by: admin.id,
            approved_at: new Date().toISOString(),
            failure_reason: null,
            updated_at: new Date().toISOString()
          })
        }
      );
      if (!Array.isArray(claimed) || claimed.length !== 1) {
        return res.status(409).json({ ok: false, message: 'This payout has already been approved by another admin.' });
      }
      dispatchClaimed = true;

      const { response, body, responseText } = await callPayPalApi(
        configuration,
        accessToken,
        '/v1/payments/payouts',
        {
          method: 'POST',
          headers: { 'PayPal-Request-Id': senderBatchId },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: senderBatchId,
              email_subject: 'Your Connectfy payout is on its way',
              email_message: 'Connectfy has sent your approved tester payout.'
            },
            items: [{
              recipient_type: 'EMAIL',
              amount: { value: Number(payout.amount).toFixed(2), currency: 'USD' },
              receiver: payout.destination_account,
              note: `Connectfy tester payout ${payout.transaction_ref}`.slice(0, 400),
              sender_item_id: String(payout.transaction_ref || payout.id).slice(0, 30)
            }]
          })
        }
      );

      if (!response.ok) {
        if (response.status >= 500) {
          console.error('PayPal payout submission response is ambiguous; payout remains processing.', {
            payoutId: payout.id,
            senderBatchId,
            status: response.status,
            response: body
          });
          return res.status(502).json({
            ok: false,
            status: 'processing',
            message: 'PayPal did not return a definitive result. The payout remains processing; verify it in PayPal before retrying.'
          });
        }
        await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.processing`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'failed',
            failure_reason: `PayPal rejected the payout (${response.status}): ${responseText}`.slice(0, 1000),
            paypal_result: body,
            updated_at: new Date().toISOString()
          })
        });
        dispatchClaimed = false;
        return res.status(502).json({
          ok: false,
          status: 'failed',
          message: `PayPal rejected the payout: ${body?.message || body?.name || responseText}`
        });
      }

      const batchId = body?.batch_header?.payout_batch_id;
      if (!batchId) {
        console.error('PayPal accepted a payout without returning a batch ID; payout remains processing.', {
          payoutId: payout.id,
          senderBatchId,
          response: body
        });
        return res.status(502).json({
          ok: false,
          status: 'processing',
          message: 'PayPal accepted the request but returned no reconciliation ID. The payout remains processing; do not resend it.'
        });
      }
      await callSupabaseRest(`payout_requests?id=eq.${encodeURIComponent(payout.id)}&status=eq.processing`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          paypal_payout_batch_id: batchId,
          paypal_result: body,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(202).json({ ok: true, status: 'processing', paypalBatchId: batchId });
    }

    if (payout.method !== 'Safaricom M-Pesa') {
      return res.status(400).json({ ok: false, message: 'Unsupported payout method.' });
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
      console.error('Safaricom B2C outcome is ambiguous; payout remains processing for reconciliation.', {
        payoutId: payout.id,
        error: message
      });
      const provider = payout.method === 'PayPal' ? 'PayPal' : 'Safaricom';
      return res.status(502).json({ ok: false, message: `${provider} did not return a definitive response. The payout remains processing; verify it with the provider before retrying.` });
    }
    console.error('Payout approval failed:', error);
    return res.status(error?.statusCode || 400).json({ ok: false, message });
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

const runApplicationScreener = (submission) => new Promise((resolve, reject) => {
  const pythonCommand = process.env.PYTHON_EXECUTABLE
    || (process.platform === 'win32' ? 'python' : 'python3');
  const scriptPath = path.join(serverDirectory, 'submit_google_form.py');
  const child = spawn(pythonCommand, ['-u', scriptPath], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true
  });
  let stdout = '';
  let completed = false;
  const timeout = setTimeout(() => {
    child.kill();
    if (!completed) {
      completed = true;
      resolve({ timedOut: true, result: null });
    }
  }, 90000);

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    if (stdout.length > 50000) {
      child.kill();
    }
  });
  child.on('error', (error) => {
    clearTimeout(timeout);
    if (!completed) {
      completed = true;
      reject(error);
    }
  });
  child.on('close', () => {
    clearTimeout(timeout);
    if (completed) return;
    completed = true;
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    try {
      resolve({ timedOut: false, result: lines.length ? JSON.parse(lines[lines.length - 1]) : null });
    } catch {
      resolve({ timedOut: false, result: null });
    }
  });
  child.stdin.on('error', (error) => {
    clearTimeout(timeout);
    if (!completed) {
      completed = true;
      reject(error);
    }
  });
  child.stdin.end(JSON.stringify(submission));
});

const completeApplicationScreenerJob = (applicationId, status, error = null) =>
  callOutboxRpc('complete_application_screener_submission', {
    p_application_id: applicationId,
    p_status: status,
    p_error: error
  });

const processOneApplicationScreenerJob = async () => {
  const claimed = await callOutboxRpc('claim_application_screener_submission', {});
  const job = Array.isArray(claimed) ? claimed[0] : null;
  if (!job) return false;
  let externalSubmissionStarted = false;

  try {
    const applicationRows = await callSupabaseRest(
      `applications?id=eq.${encodeURIComponent(job.application_id)}&select=id,status,invite_status&limit=1`
    );
    const detailsRows = await callSupabaseRest(
      `application_utest_details?application_id=eq.${encodeURIComponent(job.application_id)}&select=application_id,tester_id,full_name,utest_id,utest_email,date_of_birth,phone_number,country,gmail_email,gender,gender_other,fluent_languages,language_other,has_valid_id,recording_space_available,screener_device_type,screener_device_other,screener_os_version,screener_consent,screener_consent_at,screener_submission_status,utest_account_screenshot_url&limit=1`
    );
    const application = Array.isArray(applicationRows) ? applicationRows[0] : null;
    const details = Array.isArray(detailsRows) ? detailsRows[0] : null;
    if (job.resume_approval && !application) {
      await completeApplicationScreenerJob(
        job.application_id,
        'approval_failed',
        'Google confirmed the screener, but the application record is unavailable for automatic approval.'
      );
      return true;
    }
    if (job.resume_approval && application
      && application.status !== 'pending'
      && !(application.status === 'approved' && application.invite_status === 'invited')) {
      await completeApplicationScreenerJob(
        job.application_id,
        'approval_failed',
        'Google confirmed the screener, but the application status changed before automatic approval. Review the application and invitation manually.'
      );
      return true;
    }
    if (job.resume_approval && !details) {
      await completeApplicationScreenerJob(
        job.application_id,
        'approval_failed',
        'Google confirmed the screener, but the saved application details are unavailable for automatic approval.'
      );
      return true;
    }
    if (!application || !details) {
      await completeApplicationScreenerJob(job.application_id, 'failed', 'Application or saved screener answers were not found.');
      return true;
    }

    if (job.resume_approval) {
      try {
        await callOutboxRpc('approve_application_after_screener', {
          p_application_id: job.application_id
        });
        await completeApplicationScreenerJob(job.application_id, 'submitted');
        console.info('Application screener approval completed.', { applicationId: job.application_id });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Automatic application approval failed.';
        await completeApplicationScreenerJob(job.application_id, 'approval_pending', message);
        console.error('Application screener was confirmed; approval will be retried without resubmitting the form.', {
          applicationId: job.application_id,
          error: message
        });
      }
      return true;
    }

    const missingAnswers = [
      ['application status', application.status === 'pending'],
      ['applicant consent', details.screener_consent === true && Boolean(details.screener_consent_at)],
      ['full legal name', Boolean(String(details.full_name || '').trim())],
      ['uTest ID beginning with 30', /^30\d+$/.test(String(details.utest_id || '').trim())],
      ['uTest email', Boolean(String(details.utest_email || '').trim())],
      ['phone number', Boolean(String(details.phone_number || '').trim())],
      ['profile Gmail address', /^[^\s@]+@gmail\.com$/i.test(String(details.gmail_email || '').trim())],
      ['date of birth', Boolean(details.date_of_birth)],
      ['country', Boolean(String(details.country || '').trim())],
      ['gender', Boolean(String(details.gender || '').trim())],
      ['fluent languages', Array.isArray(details.fluent_languages) && details.fluent_languages.length > 0],
      ['ID confirmation', typeof details.has_valid_id === 'boolean'],
      ['recording-space confirmation', typeof details.recording_space_available === 'boolean'],
      ['mobile device', Boolean(String(details.screener_device_type || '').trim())],
      ['OS version', Boolean(String(details.screener_os_version || '').trim())],
      ['uTest account screenshot', /^https?:\/\/[^\s]+$/i.test(String(details.utest_account_screenshot_url || '').trim())]
    ].filter(([, valid]) => !valid).map(([label]) => label);

    if (missingAnswers.length) {
      await completeApplicationScreenerJob(
        job.application_id,
        'failed',
        `Submission blocked: missing or invalid ${missingAnswers.join(', ')}.`
      );
      return true;
    }

    const submission = {
      full_name: details.full_name,
      utest_id: details.utest_id,
      utest_email: details.utest_email,
      phone: details.phone_number,
      gmail_email: details.gmail_email,
      country: details.country,
      date_of_birth: details.date_of_birth,
      gender: details.gender,
      gender_other: details.gender_other,
      languages: details.fluent_languages,
      language_other: details.language_other,
      has_valid_id: details.has_valid_id,
      recording_space_available: details.recording_space_available,
      device_type: details.screener_device_type,
      device_other: details.screener_device_other,
      os_version: details.screener_os_version,
      screener_consent: details.screener_consent
    };
    externalSubmissionStarted = true;
    const processResult = await runApplicationScreener(submission);

    if (processResult?.result?.submitted === true && processResult.result.ok === true) {
      await completeApplicationScreenerJob(job.application_id, 'approval_pending');
      try {
        await callOutboxRpc('approve_application_after_screener', {
          p_application_id: job.application_id
        });
        await completeApplicationScreenerJob(job.application_id, 'submitted');
        console.info('Application screener submitted and application approved; invitation email remains manual.', {
          applicationId: job.application_id
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Automatic application approval failed.';
        await completeApplicationScreenerJob(job.application_id, 'approval_pending', message);
        console.error('Application screener was confirmed; approval will be retried without resubmitting the form.', {
          applicationId: job.application_id,
          error: message
        });
      }
    } else if (!processResult?.timedOut && processResult?.result?.submitted === false) {
      await completeApplicationScreenerJob(
        job.application_id,
        'failed',
        processResult.result.error || 'The external screener did not accept the response.'
      );
    } else {
      await completeApplicationScreenerJob(
        job.application_id,
        'ambiguous',
        processResult?.result?.error || 'The external form may have received the response, but confirmation was not received. Reconcile it before retrying.'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Application screener worker failed.';
    console.error('Application screener job failed before a confirmed result:', {
      applicationId: job.application_id,
      error: message
    });
    await completeApplicationScreenerJob(
      job.application_id,
      externalSubmissionStarted ? 'ambiguous' : 'failed',
      externalSubmissionStarted
        ? `${message} External delivery is uncertain; reconcile the form before retrying.`
        : message
    );
  }
  return true;
};

const pollApplicationScreenerQueue = async () => {
  if (!applicationScreenerWorkerEnabled || applicationScreenerWorkerBusy) return;
  applicationScreenerWorkerBusy = true;
  try {
    while (await processOneApplicationScreenerJob()) {
      // Drain queued submissions serially so Google Forms is not opened concurrently.
    }
  } catch (error) {
    console.error('Application screener queue poll failed:', error);
  } finally {
    applicationScreenerWorkerBusy = false;
  }
};

app.post('/api/admin/reconcile-application-screener', async (req, res) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ ok: false, message: 'Sign in as an administrator to reconcile a screener response.' });
  }
  try {
    await requireAdmin(authorization);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify administrator access.';
    const status = /invalid|expired|sign in/i.test(message) ? 401 : 403;
    return res.status(status).json({ ok: false, message });
  }

  const applicationId = String(req.body?.applicationId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId)) {
    return res.status(400).json({ ok: false, message: 'A valid application ID is required.' });
  }

  try {
    await callOutboxRpc('reconcile_confirmed_application_screener', {
      p_application_id: applicationId,
      p_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSeEPV0KzYwNLeLGlhvtvotOSt7goCnw4GB8bonAqJEQjqCLzA/viewform'
    });
    return res.json({
      ok: true,
      message: 'The confirmed screener response was reconciled. The form was not resubmitted.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reconcile the confirmed screener response.';
    console.error('Unable to reconcile externally confirmed application screener:', {
      applicationId,
      error: message
    });
    return res.status(409).json({ ok: false, message });
  }
});

app.post('/api/application-screener', async (req, res) => {
  return res.status(410).json({
    ok: false,
    retryable: false,
    message: 'Application screeners are submitted by the protected background queue worker.'
  });

  const authorization = req.headers.authorization;
  const applicationId = String(req.body?.applicationId || '').trim();
  if (!authorization) {
    return res.status(401).json({ ok: false, retryable: true, message: 'Sign in as a project manager or super admin to submit application screeners.' });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    return res.status(400).json({ ok: false, retryable: false, message: 'A valid application ID is required.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ ok: false, retryable: true, message: 'Screener service is missing Supabase configuration.' });
  }

  const supabaseBase = supabaseUrl.replace(/\/$/, '');
  const restBase = `${supabaseBase}/rest/v1`;
  const headers = {
    apikey: supabaseAnonKey,
    Authorization: authorization
  };

  try {
    let user;
    try {
      user = await getAuthUser(authorization);
    } catch {
      return res.status(401).json({ ok: false, retryable: true, message: 'Your session is invalid or has expired. Sign in again.' });
    }
    const adminProfiles = await callSupabaseRest(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=role,admin_access_level&limit=1`
    );
    const adminProfile = Array.isArray(adminProfiles) ? adminProfiles[0] : null;
    if (adminProfile?.role !== 'admin'
      || !['super_admin', 'project_manager'].includes(adminProfile.admin_access_level)) {
      return res.status(403).json({ ok: false, retryable: false, message: 'Only project managers and super admins can submit application screeners.' });
    }

    const applicationQuery = new URLSearchParams({
      id: `eq.${applicationId}`,
      select: 'id,status',
      limit: '1'
    });
    const applicationResponse = await fetch(`${restBase}/applications?${applicationQuery}`, { headers });
    if (!applicationResponse.ok) {
      console.error('Unable to load the application for admin screener submission:', await applicationResponse.text());
      return res.status(500).json({ ok: false, retryable: true, message: 'Unable to load the application. Refresh and try again.' });
    }
    const applicationRows = await applicationResponse.json();
    const application = Array.isArray(applicationRows) ? applicationRows[0] : null;
    if (!application) {
      return res.status(404).json({ ok: false, retryable: false, message: 'The application was not found or is not visible to your admin account.' });
    }
    if (application.status !== 'pending' && application.status !== 'approved') {
      return res.status(409).json({ ok: false, retryable: false, message: 'Only pending applications can be submitted to the screener.' });
    }
    const detailsQuery = new URLSearchParams({
      application_id: `eq.${applicationId}`,
      select: 'application_id,tester_id,full_name,utest_id,utest_email,date_of_birth,phone_number,country,gmail_email,gender,gender_other,fluent_languages,language_other,has_valid_id,recording_space_available,screener_device_type,screener_device_other,screener_os_version,screener_consent,screener_consent_at,screener_submission_status'
    });
    const detailsResponse = await fetch(`${restBase}/application_utest_details?${detailsQuery}`, { headers });
    if (!detailsResponse.ok) {
      console.error('Unable to read the application screener fields from Supabase:', await detailsResponse.text());
      return res.status(500).json({ ok: false, retryable: true, message: 'Unable to load the saved screener answers. Apply the application screener migration and try again.' });
    }
    const detailRows = await detailsResponse.json();
    const details = Array.isArray(detailRows) ? detailRows[0] : null;
    if (!details) {
      return res.status(404).json({ ok: false, retryable: false, message: 'The application screener details were not found for your account.' });
    }
    if (!/^30\d+$/.test(String(details.utest_id || '').trim())) {
      return res.status(400).json({
        ok: false,
        retryable: false,
        message: 'The Applause screener is available only for uTest IDs that start with 30 and contain digits only.'
      });
    }
    if (details.screener_submission_status === 'submitted') {
      try {
        await callOutboxRpc('approve_application_after_screener', {
          p_application_id: applicationId
        });
        return res.json({
          ok: true,
          message: 'The external screener was already submitted and the application is approved. An admin can send the invitation manually.'
        });
      } catch (error) {
        console.error('Unable to complete automatic application approval after screener confirmation:', error);
        return res.status(503).json({
          ok: false,
          screenerConfirmed: true,
          retryable: true,
          message: 'The screener is confirmed, but automatic application approval could not be completed. Retry to finish approval; the screener will not be submitted again.'
        });
      }
    }
    if (details.screener_submission_status === 'pending') {
      return res.status(409).json({
        ok: false,
        retryable: false,
        message: 'The screener may already have been submitted, but confirmation is pending. Contact support before retrying to avoid a duplicate response.'
      });
    }
    if (!['not_started', 'failed'].includes(details.screener_submission_status)
      || details.screener_consent !== true
      || !details.screener_consent_at
      || !details.full_name
      || !details.utest_id
      || !details.utest_email
      || !details.phone_number
      || !details.country
      || !details.gmail_email
      || !details.date_of_birth
      || !details.gender
      || !Array.isArray(details.fluent_languages)
      || details.fluent_languages.length === 0
      || typeof details.has_valid_id !== 'boolean'
      || typeof details.recording_space_available !== 'boolean'
      || !details.screener_device_type
      || !details.screener_os_version) {
      return res.status(400).json({ ok: false, retryable: false, message: 'The saved screener answers are incomplete or consent was not recorded.' });
    }

    const claimQuery = new URLSearchParams({
      application_id: `eq.${applicationId}`,
      tester_id: `eq.${details.tester_id}`,
      screener_submission_status: 'in.(not_started,failed)'
    });
    const claimResponse = await fetch(`${restBase}/application_utest_details?${claimQuery}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ screener_submission_status: 'pending' })
    });
    if (!claimResponse.ok) {
      console.error('Unable to reserve an application screener submission:', await claimResponse.text());
      return res.status(500).json({ ok: false, retryable: true, message: 'Unable to reserve the screener submission. Please retry.' });
    }
    const claimedRows = await claimResponse.json();
    if (!Array.isArray(claimedRows) || claimedRows.length !== 1) {
      return res.status(409).json({ ok: false, retryable: false, message: 'A screener submission is already in progress. Contact support before retrying.' });
    }

    const submission = {
      full_name: details.full_name,
      utest_id: details.utest_id,
      utest_email: details.utest_email,
      phone: details.phone_number,
      gmail_email: details.gmail_email,
      country: details.country,
      date_of_birth: details.date_of_birth,
      gender: details.gender,
      gender_other: details.gender_other,
      languages: details.fluent_languages,
      language_other: details.language_other,
      has_valid_id: details.has_valid_id,
      recording_space_available: details.recording_space_available,
      device_type: details.screener_device_type,
      device_other: details.screener_device_other,
      os_version: details.screener_os_version,
      screener_consent: details.screener_consent
    };

    let processResult;
    try {
      processResult = await runApplicationScreener(submission);
    } catch (error) {
      console.error('Unable to start the application screener process:', error);
      try {
        const markFailed = await fetch(`${restBase}/application_utest_details?${new URLSearchParams({
          application_id: `eq.${applicationId}`,
          tester_id: `eq.${details.tester_id}`,
          screener_submission_status: 'eq.pending'
        })}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ screener_submission_status: 'failed' })
        });
        const failedRows = markFailed.ok ? await markFailed.json() : [];
        if (Array.isArray(failedRows) && failedRows.length === 1) {
          return res.status(503).json({ ok: false, retryable: true, message: 'The Python screener service could not start. Your application is saved; retry the screener.' });
        }
      } catch (statusError) {
        console.error('Unable to save the Python screener startup failure:', statusError);
      }
      return res.status(503).json({ ok: false, retryable: false, message: 'The Python screener service could not start. Contact support before retrying.' });
    }

    if (processResult?.result?.submitted === true && processResult.result.ok === true) {
      const markSubmitted = await fetch(`${restBase}/application_utest_details?${new URLSearchParams({
        application_id: `eq.${applicationId}`,
        tester_id: `eq.${details.tester_id}`,
        screener_submission_status: 'eq.pending'
      })}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          screener_submission_status: 'submitted',
          screener_submitted_at: new Date().toISOString()
        })
      });
      if (!markSubmitted.ok) {
        console.error('The form confirmed submission, but Supabase could not save its status:', await markSubmitted.text());
        return res.status(502).json({ ok: false, retryable: false, message: 'Applause confirmed the response, but Connectfy could not save the confirmation. Contact support; do not retry the form.' });
      }
      const submittedRows = await markSubmitted.json();
      if (!Array.isArray(submittedRows) || submittedRows.length !== 1) {
        return res.status(502).json({ ok: false, retryable: false, message: 'Applause confirmed the response, but Connectfy could not save the confirmation. Contact support; do not retry the form.' });
      }
      try {
        await callOutboxRpc('approve_application_after_screener', {
          p_application_id: applicationId
        });
      } catch (error) {
        console.error('Screener was confirmed, but automatic application approval failed:', error);
        return res.status(503).json({
          ok: false,
          screenerConfirmed: true,
          retryable: true,
          message: 'The screener is confirmed, but automatic application approval could not be completed. Retry to finish approval; the screener will not be submitted again.'
        });
      }
      return res.json({
        ok: true,
        message: 'The external Applause screener was submitted and the application was approved. An admin can send the invitation manually.'
      });
    }

    if (!processResult?.timedOut && processResult?.result?.submitted === false) {
      const markFailed = await fetch(`${restBase}/application_utest_details?${new URLSearchParams({
        application_id: `eq.${applicationId}`,
        tester_id: `eq.${details.tester_id}`,
        screener_submission_status: 'eq.pending'
      })}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ screener_submission_status: 'failed' })
      });
      if (!markFailed.ok) {
        console.error('Unable to save the failed application screener status:', await markFailed.text());
        return res.status(502).json({ ok: false, retryable: false, message: 'The screener did not submit, but Connectfy could not save that status. Contact support before retrying.' });
      }
      const failedRows = await markFailed.json();
      if (!Array.isArray(failedRows) || failedRows.length !== 1) {
        return res.status(502).json({ ok: false, retryable: false, message: 'The screener did not submit, but Connectfy could not save that status. Contact support before retrying.' });
      }
      return res.status(502).json({ ok: false, retryable: true, message: 'The external screener could not be submitted. Your application is saved; retry the screener.' });
    }

    return res.status(502).json({
      ok: false,
      retryable: false,
      message: 'The screener service could not confirm whether Applause received the response. Contact support before retrying to avoid a duplicate submission.'
    });
  } catch (error) {
    console.error('Application screener request failed:', error);
    return res.status(500).json({ ok: false, retryable: true, message: 'The application screener service failed. Your application is saved; retry the screener.' });
  }
});

app.post('/api/project-email', async (req, res) => {
  try {
    const payload = req.body || {};
    delete payload.emailAttachments;
    delete payload.contractAttachmentFilename;
    delete payload.contractPdfAttached;

    const type = payload.type || 'application';
    let toEmail = String(payload.toEmail || '').trim();
    let toName = String(payload.toName || '').trim();
    let contractAttachmentFilename;

    const requestType = type === 'utest_update_required' ? 'utest_update_required' : type;
    const supportedTypes = ['application', 'invite', 'accepted', 'rejected', 'declined', 'utest_update_required', 'legacy_sheet_reapply', 'submission_approved', 'application_utest_details_request', 'applause_follow_up', 'employee_welcome'];

    if (!supportedTypes.includes(requestType)) {
      return res.status(400).json({ ok: false, message: `Unsupported email type: ${requestType}` });
    }

    if (requestType === 'application') {
      const requiredApplicationFields = ['applicationReference', 'applicantCountry', 'applicantDevice', 'uTestId', 'uTestEmail', 'submittedAt'];
      const missingApplicationFields = requiredApplicationFields.filter((field) => !String(payload[field] || '').trim());
      if (missingApplicationFields.length > 0) {
        return res.status(400).json({
          ok: false,
          message: `Application confirmation is missing required submitted details: ${missingApplicationFields.join(', ')}.`
        });
      }
    }
    if (requestType === 'applause_follow_up'
      && !['settings_video', 'project_completion', 'consent_signature'].includes(payload.applauseFollowUpKind)) {
      return res.status(400).json({ ok: false, message: 'Choose a supported Applause follow-up email.' });
    }

    if (adminEmailTypes.has(requestType) || requestType === 'submission_approved') {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).json({ ok: false, message: 'Sign in to your account before sending this email.' });
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
      const roleResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,admin_access_level`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization }
      });
      if (!roleResponse.ok) {
        return res.status(403).json({ ok: false, message: 'Unable to verify your admin access.' });
      }
      const profiles = await roleResponse.json();
      if (!Array.isArray(profiles) || !profiles[0]) {
        return res.status(403).json({ ok: false, message: 'Unable to verify your account access.' });
      }

      if (requestType === 'employee_welcome') {
        const requester = profiles[0];
        if (requester.role !== 'admin' || requester.admin_access_level !== 'super_admin') {
          return res.status(403).json({ ok: false, message: 'Only Super Admins can send employee welcome emails.' });
        }

        const employeeProfileId = String(payload.employeeProfileId || '').trim();
        if (!employeeProfileId) {
          return res.status(400).json({ ok: false, message: 'The employee account is required.' });
        }
        if (payload.employeeEmailPurpose !== undefined
          && !['welcome', 'pay_update', 'contract', 'contract_update'].includes(payload.employeeEmailPurpose)) {
          return res.status(400).json({ ok: false, message: 'Choose a supported employee email purpose.' });
        }
        const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
        const restHeaders = { apikey: supabaseAnonKey, Authorization: authorization };
        const [employeeResponse, employeeProfileResponse] = await Promise.all([
          fetch(`${restBase}/hr_employees?profile_id=eq.${encodeURIComponent(employeeProfileId)}&select=profile_id,job_title,department,employment_type,employment_status,hire_date,compensation_type,compensation_rate,compensation_currency,pay_frequency`, { headers: restHeaders }),
          fetch(`${restBase}/profiles?id=eq.${encodeURIComponent(employeeProfileId)}&select=id,name,email`, { headers: restHeaders })
        ]);
        if (!employeeResponse.ok || !employeeProfileResponse.ok) {
          return res.status(403).json({ ok: false, message: 'Unable to verify the HR employee account.' });
        }
        const [employeeRows, employeeProfiles] = await Promise.all([
          employeeResponse.json(), employeeProfileResponse.json()
        ]);
        const employee = Array.isArray(employeeRows)
          ? employeeRows.find((row) => row.profile_id === employeeProfileId)
          : null;
        const employeeProfile = employeeProfiles[0];
        if (!employee
          || !employeeProfile || !employeeProfile.email) {
          return res.status(404).json({ ok: false, message: 'The linked employee account or email could not be found.' });
        }
        payload.toEmail = employeeProfile.email;
        payload.toName = employeeProfile.name || employeeProfile.email.split('@')[0];
        toEmail = payload.toEmail;
        toName = payload.toName;
        if (['welcome', 'contract', 'contract_update'].includes(payload.employeeEmailPurpose)) {
          const pdf = await buildEmployeeContractPdf({ employee, profile: employeeProfile });
          const safeName = String(employeeProfile.name || 'employee')
            .normalize('NFKD')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .toLowerCase() || 'employee';
          contractAttachmentFilename = `connectfy-draft-employment-terms-${safeName}.pdf`;
          payload.emailAttachments = [{
            name: contractAttachmentFilename,
            content: pdf.toString('base64'),
            contentType: 'application/pdf'
          }];
          payload.contractPdfAttached = true;
        }
      } else if (requestType === 'applause_follow_up') {
        const requester = profiles[0];
        if (requester.role !== 'admin'
          || !['super_admin', 'project_manager'].includes(requester.admin_access_level)) {
          return res.status(403).json({ ok: false, message: 'Only project managers and super admins can send Applause follow-up emails.' });
        }
        const projectId = String(payload.projectId || '');
        const sourceKey = String(payload.sourceKey || '');
        if (!projectId || !sourceKey) {
          return res.status(400).json({ ok: false, message: 'Project and Applause row identifiers are required.' });
        }
        const expectedStatuses = {
          settings_video: 'ready for settings check',
          project_completion: 'in progress',
          consent_signature: 'consent form sent'
        };
        const expectedStatus = expectedStatuses[payload.applauseFollowUpKind];
        const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
        const restHeaders = { apikey: supabaseAnonKey, Authorization: authorization };
        const [statusResponse, projectResponse] = await Promise.all([
          fetch(`${restBase}/project_applause_status?project_id=eq.${encodeURIComponent(projectId)}&source_key=eq.${encodeURIComponent(sourceKey)}&select=status,tester_email,google_email`, { headers: restHeaders }),
          fetch(`${restBase}/projects?id=eq.${encodeURIComponent(projectId)}&select=title`, { headers: restHeaders })
        ]);
        if (!statusResponse.ok || !projectResponse.ok) {
          return res.status(403).json({ ok: false, message: 'Unable to verify the Applause row and project.' });
        }
        const [statusRows, projectRows] = await Promise.all([statusResponse.json(), projectResponse.json()]);
        const statusRow = statusRows[0];
        const project = projectRows[0];
        const acceptedEmails = [statusRow?.tester_email, statusRow?.google_email]
          .map((email) => String(email || '').trim().toLowerCase())
          .filter(Boolean);
        if (!statusRow || String(statusRow.status || '').trim().toLowerCase() !== expectedStatus
          || !acceptedEmails.includes(toEmail.toLowerCase())) {
          return res.status(400).json({ ok: false, message: 'The recipient or project status no longer matches this follow-up. Sync the sheet and try again.' });
        }
        if (!project) {
          return res.status(404).json({ ok: false, message: 'The project could not be found.' });
        }
        payload.projectTitle = project.title;
      } else if (requestType === 'submission_approved') {
        const projectId = String(payload.projectId || '');
        const submissionId = String(payload.submissionId || '');
        const testerId = String(payload.testerId || '');
        if (!projectId || !submissionId || !testerId) {
          return res.status(400).json({ ok: false, message: 'Submission, project, and tester IDs are required.' });
        }

        const restHeaders = { apikey: supabaseAnonKey, Authorization: authorization };
        const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
        const [projectResponse, submissionResponse, testerResponse] = await Promise.all([
          fetch(`${restBase}/projects?id=eq.${encodeURIComponent(projectId)}&select=id,client_id,title`, { headers: restHeaders }),
          fetch(`${restBase}/submissions?id=eq.${encodeURIComponent(submissionId)}&project_id=eq.${encodeURIComponent(projectId)}&tester_id=eq.${encodeURIComponent(testerId)}&status=eq.approved&select=id,title,bounty_earned`, { headers: restHeaders }),
          fetch(`${restBase}/profiles?id=eq.${encodeURIComponent(testerId)}&select=id,name,email,role`, { headers: restHeaders })
        ]);
        if (!projectResponse.ok || !submissionResponse.ok || !testerResponse.ok) {
          return res.status(403).json({ ok: false, message: 'Unable to verify the approved submission details.' });
        }
        const [projectRows, submissionRows, testerRows] = await Promise.all([
          projectResponse.json(), submissionResponse.json(), testerResponse.json()
        ]);
        const project = projectRows[0];
        const submission = submissionRows[0];
        const tester = testerRows[0];
        const requester = profiles[0];
        const isProjectOwner = requester.role === 'client' && project?.client_id === user.id;
        if (requester.role !== 'admin' && !isProjectOwner) {
          return res.status(403).json({ ok: false, message: 'Only the project owner or an administrator can send this approval email.' });
        }
        if (!project || !submission || !tester || !['tester', 'admin'].includes(tester.role) || !tester.email) {
          return res.status(404).json({ ok: false, message: 'The approved submission or tester email could not be found.' });
        }

        payload.toEmail = tester.email;
        payload.toName = tester.name || tester.email.split('@')[0];
        toEmail = payload.toEmail;
        toName = payload.toName;
        payload.projectTitle = project.title;
        payload.submissionTitle = submission.title;
        payload.approvedAmount = Number(submission.bounty_earned);
      } else if (profiles[0].role !== 'admin') {
        return res.status(403).json({ ok: false, message: 'Only administrators can send this email.' });
      }
    }

    if (!hasEmailProvider()) {
      return res.status(500).json({ ok: false, message: 'Configure BREVO_API_KEY, both MAILJET_API_KEY and MAILJET_API_SECRET, or SENDER_SMTP_USER and SENDER_SMTP_PASSWORD.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return res.status(400).json({ ok: false, message: 'Invalid recipient email' });
    }
    if (!toName) {
      return res.status(400).json({ ok: false, message: 'Recipient name is required' });
    }

    const result = await sendEmailWithFailover(payload, requestType);
    return res.json({
      ok: true,
      emailType: requestType,
      subject: result.subject,
      emailProvider: result.provider,
      ...(contractAttachmentFilename ? { attachmentFilename: contractAttachmentFilename } : {}),
      ...(result.messageId && { messageId: result.messageId })
    });
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
  console.info('Automatic project invitation emails are disabled; admins can send invitations manually.');
}

if (applicationScreenerWorkerEnabled) {
  console.info('Application screener queue worker enabled.');
  void pollApplicationScreenerQueue();
  setInterval(() => void pollApplicationScreenerQueue(), 5000);
} else {
  console.warn('Application screener queue worker disabled: configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and at least one email provider.');
}

setInterval(() => void pollPayPalPayouts(), 30000);
void pollPayPalPayouts();

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
