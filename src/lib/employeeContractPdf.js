import PDFDocument from 'pdfkit';

const field = (value) => String(value ?? '').trim() || 'Not specified';

const formatHireDate = (value) => {
  if (!value) return 'Not specified';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
};

export function buildEmployeeContractPdf({ employee, profile }) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 48, right: 54, bottom: 54, left: 54 },
      compress: false,
      info: {
        Title: `Draft Employment Terms - ${field(profile.name)}`,
        Author: 'Connectfy HR',
        Subject: 'Draft employment terms for legal review'
      }
    });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    const pageWidth = document.page.width;
    const contentWidth = pageWidth - 108;
    document.rect(54, 48, contentWidth, 72).fill('#0B132B');
    document.font('Helvetica-Bold').fontSize(21).fillColor('#FFFFFF').text('Connectfy', 72, 64);
    document.font('Helvetica').fontSize(10).fillColor('#BFEFFF').text('EMPLOYEE TERMS', 72, 93);

    document.moveDown(3);
    document.fillColor('#0B132B').font('Helvetica-Bold').fontSize(20).text('Draft Employment Terms', 54, 143);
    document.fillColor('#B94F4F').font('Helvetica-Bold').fontSize(10)
      .text('DRAFT - FOR LEGAL REVIEW - NOT A SIGNED AGREEMENT', 54, 172);
    document.fillColor('#475569').font('Helvetica').fontSize(9)
      .text(`Prepared ${new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date())}`, 54, 190);

    let y = 225;
    const section = (title) => {
      document.fillColor('#007AFF').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), 54, y);
      y += 20;
    };
    const row = (label, value) => {
      document.fillColor('#64748B').font('Helvetica').fontSize(9).text(label, 58, y, { width: 145 });
      document.fillColor('#0B132B').font('Helvetica-Bold').fontSize(10).text(field(value), 205, y, { width: contentWidth - 151 });
      y += Math.max(23, document.heightOfString(field(value), { width: contentWidth - 151, font: 'Helvetica-Bold', fontSize: 10 }) + 9);
      document.moveTo(54, y - 5).lineTo(pageWidth - 54, y - 5).strokeColor('#E2E8F0').lineWidth(0.6).stroke();
    };

    section('Employee');
    row('Full name', profile.name);
    row('Email', profile.email);
    row('Job title', employee.job_title);
    row('Department', employee.department);
    row('Employment type', String(employee.employment_type || '').replaceAll('_', ' '));
    row('Employment status', String(employee.employment_status || '').replaceAll('_', ' '));
    row('Effective / hire date', formatHireDate(employee.hire_date));

    y += 14;
    section('Compensation terms');
    row('Compensation basis', employee.compensation_type);
    row('Set pay rate', `${field(employee.compensation_currency)} ${Number(employee.compensation_rate || 0).toFixed(2)}`);
    row('Pay frequency', String(employee.pay_frequency || '').replaceAll('_', ' '));
    row('Pay review', 'Every two weeks based on performance. Any revisions will be communicated to the employee.');

    y += 16;
    document.roundedRect(54, y, contentWidth, 78, 6).fill('#FFF4D6');
    document.fillColor('#7C5312').font('Helvetica-Bold').fontSize(10).text('Draft notice', 68, y + 12);
    document.fillColor('#59451F').font('Helvetica').fontSize(9).text(
      'This document summarizes HR information currently recorded in Connectfy and is provided as a draft for legal review. It is not a final employment contract, has not been signed, and does not replace an agreement approved by the organization.',
      68,
      y + 29,
      { width: contentWidth - 28, lineGap: 2 }
    );

    document.end();
  });
}
