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
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);
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
  if (payload.type === 'sheet_consent_pending') {
    const name = escapeHtml(payload.toName || 'there');
    const greeting = payload.externalRecipient ? `Hello uTest tester ${name},` : `Hello ${name},`;
    const projectTitle = escapeHtml(payload.projectTitle || 'your project');
    const amount = Number(payload.projectAmount || 0);
    const payout = Number.isFinite(amount) ? `$${amount.toFixed(2)} USD` : 'your approved payout';
    const lockDate = escapeHtml(payload.projectLockDate || 'To be confirmed');
    const whatsappLink = /^https:\/\/wa\.me\/254794502268\?text=/i.test(String(payload.whatsappLink || ''))
      ? escapeHtml(payload.whatsappLink)
      : 'https://wa.me/254794502268';
    return `<div style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,sans-serif;color:#202124;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><div style="padding:18px 24px;background:#080808;color:#fff;font-size:20px;font-weight:700;">Connectfy</div><div style="padding:24px;"><p>${greeting}</p><h1 style="font-size:21px;">You’re one step away from claiming your payout</h1><p>Complete the remaining consent step for <strong>${projectTitle}</strong> to claim your payout of <strong>${payout}</strong>.</p><p><strong>This project locks on ${lockDate}.</strong> Please hurry so you have time to finish your testing.</p><p>If you have issues completing the project, our Kenyan support team can help you on WhatsApp.</p><p style="margin:24px 0;"><a href="${whatsappLink}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#128c7e;color:#fff;text-decoration:none;font-weight:700;">Chat with Kenyan support on WhatsApp</a></p><p style="font-size:12px;color:#64748b;">The WhatsApp message will be prefilled with your uTest ID. Review it before sending.</p><p>Best,<br>Connectfy Team</p></div></div></div>`;
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
  if (payload.type === 'sheet_consent_pending') {
    const amount = Number(payload.projectAmount || 0);
    const payout = Number.isFinite(amount) ? `$${amount.toFixed(2)} USD` : 'your approved payout';
    return [
      `${payload.externalRecipient ? 'Hello uTest tester' : 'Hello'} ${payload.toName || 'there'},`,
      '',
      `You are one step away from claiming your payout of ${payout}.`,
      `Please complete the remaining consent step for ${payload.projectTitle || 'your project'}.`,
      `The project locks on ${payload.projectLockDate || 'a date to be confirmed'}; please hurry so you have time to finish your testing.`,
      'If you have issues completing the project, contact our Kenyan support team on WhatsApp:',
      payload.whatsappLink || 'https://wa.me/254794502268',
      '',
      'The message is prefilled with your uTest ID. Review it before sending.',
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
  : type === 'application'
    ? `Application received: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'submission_approved'
    ? `Project submission approved: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'sheet_project_approved'
    ? `Project completion approved: ${payload.projectTitle || 'Connectfy project'}`
  : type === 'sheet_consent_pending'
    ? `Action required: complete your consent step for ${payload.projectTitle || 'your project'}`
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

  let toEmail = String(payload.toEmail || '').trim();
  let toName = String(payload.toName || '').trim();
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

const processOneApplauseApprovalEmail = async () => {
  const claimed = await callOutboxRpc('claim_project_applause_approval_email', {});
  const job = Array.isArray(claimed) ? claimed[0] : null;
  if (!job) return false;

  try {
    if (!job.id || !job.project_id || !job.recipient_email || !job.recipient_name) {
      throw new Error('Applause completion approval email has an invalid outbox payload.');
    }
    const projectLink = new URL(process.env.APP_URL || 'https://connectfy.tech');
    projectLink.searchParams.set('project', job.project_id);
    const result = await sendEmailThroughBrevo({
      type: 'sheet_project_approved',
      toEmail: job.recipient_email,
      toName: job.recipient_name,
      projectTitle: job.project_title,
      projectCompany: job.project_company,
      approvedAmount: Number(job.approved_amount || 0),
      expectedPaymentDate: job.expected_payment_date || '',
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
    if (!job.id || !job.project_id || !job.profile_id || !job.recipient_email || !job.recipient_name) {
      throw new Error('Applause consent reminder email has an invalid outbox payload.');
    }
    const utestId = String(job.utest_id || '').trim();
    const message = `Hello, please help me finish my testing of ${utestId || 'my uTest account'} for ${job.project_title || 'my project'}.`;
    const whatsappLink = `https://wa.me/254794502268?text=${encodeURIComponent(message)}`;
    const result = await sendEmailThroughBrevo({
      type: 'sheet_consent_pending',
      toEmail: job.recipient_email,
      toName: job.recipient_name,
      externalRecipient: Boolean(job.external_recipient),
      projectTitle: job.project_title,
      projectAmount: Number(job.project_amount || 0),
      projectLockDate: job.project_lock_date,
      utestId,
      whatsappLink,
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
    paypalPayouts: process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
      ? (process.env.PAYPAL_ENV || 'sandbox').toLowerCase()
      : 'disabled'
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
      console.error(`${payout.method} payout outcome is ambiguous; payout remains processing for reconciliation.`, {
        payoutId: payout.id,
        error: message
      });
      const provider = payout.method === 'PayPal' ? 'PayPal' : 'Safaricom';
      return res.status(502).json({ ok: false, message: `${provider} did not return a definitive response. The payout remains processing; verify it with the provider before retrying.` });
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
    const supportedTypes = ['application', 'invite', 'accepted', 'rejected', 'declined', 'utest_update_required', 'legacy_sheet_reapply', 'submission_approved'];

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
      const roleResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization }
      });
      if (!roleResponse.ok) {
        return res.status(403).json({ ok: false, message: 'Unable to verify your admin access.' });
      }
      const profiles = await roleResponse.json();
      if (!Array.isArray(profiles) || !profiles[0]) {
        return res.status(403).json({ ok: false, message: 'Unable to verify your account access.' });
      }

      if (requestType === 'submission_approved') {
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
        if (!project || !submission || !tester || tester.role !== 'tester' || !tester.email) {
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
