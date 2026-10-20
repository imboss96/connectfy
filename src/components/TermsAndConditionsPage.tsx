import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

const sections = [
  {
    title: '1. About Connectfy',
    paragraphs: [
      'Connectfy is a marketplace that helps clients and independent participants find and complete testing, research, data collection, and related project work. These Terms & Conditions govern your access to and use of Connectfy, including your account, applications, project participation, submissions, and payments.'
    ]
  },
  {
    title: '2. Eligibility and your account',
    paragraphs: [
      'You must be legally able to enter into an agreement where you live and provide accurate, current information when you register and use the platform. Keep your login details secure and tell us promptly if you believe your account has been accessed without permission.',
      'You are responsible for activity carried out through your account. Do not create duplicate or misleading accounts, impersonate another person, or share an account in a way that misrepresents who completed project work.'
    ]
  },
  {
    title: '3. Projects and participation',
    paragraphs: [
      'Project listings describe the work, eligibility requirements, deliverables, deadlines, and compensation applicable to that opportunity. Review those details before applying. Applying does not guarantee selection, an invitation, a minimum amount of work, or payment.',
      'If selected, follow the project instructions, use only authorized systems and materials, and submit your own accurate work by the stated deadline. A client or reviewer may request clarification, ask for revisions, or reject work that does not meet the stated requirements.'
    ]
  },
  {
    title: '4. Compensation and payment schedule',
    paragraphs: [
      'Connectfy participants perform project work as independent participants, not as employees of Connectfy. References to salary or earnings on the platform mean project compensation for eligible work and do not create an employment relationship or guarantee a fixed income.',
      'Compensation is determined by the terms shown for the relevant project and is payable only for work that has been completed and approved under those terms. Eligible approved payments are processed twice monthly: on the 15th and on the last calendar day of each month. If either scheduled payment date falls on a Saturday or Sunday, that payment is forwarded to the next business day.',
      'Payments remain subject to completion of any required review, identity or account verification, and provision of accurate payout details. The amount, currency, available payout method, minimum withdrawal, and any applicable fees or conversion rates are shown in the platform or for the project. A payout request may require administrator review before transfer. Processing by banks, payment providers, weekends, public holidays, or other circumstances outside Connectfy’s control may affect when funds reach you.'
    ]
  },
  {
    title: '5. Referrals and ambassador rewards',
    paragraphs: [
      'Where the ambassador program is available, referral links and reward terms will be presented in the platform. Rewards are earned only when the stated eligibility conditions are met, such as a referred participant completing work that is approved. Connectfy may investigate suspected fraud, duplicate accounts, self-referrals, or other abuse and may withhold or reverse rewards that were not properly earned.'
    ]
  },
  {
    title: '6. Work, content, and confidentiality',
    paragraphs: [
      'You retain rights to materials you owned before participating in a project. For submitted work, you grant the client and Connectfy the permissions reasonably needed to review, administer, and use that work as described in the project instructions. Any transfer or license of ownership must be stated in the project terms.',
      'Keep non-public project information, test credentials, user data, research materials, and client information confidential. Do not publish, share, copy, or use them outside the project unless you have written authorization or the project instructions expressly permit it.'
    ]
  },
  {
    title: '7. Acceptable use',
    paragraphs: [
      'Do not interfere with the platform or a client’s systems, bypass project eligibility or security controls, submit fabricated results, manipulate referrals or payments, or use project access for unlawful or unauthorized purposes. Follow applicable laws and the safety, privacy, and security instructions supplied for each project.'
    ]
  },
  {
    title: '8. Account restrictions and availability',
    paragraphs: [
      'We may investigate reports of misuse and may suspend or restrict access when reasonably necessary to protect users, clients, projects, or the platform, or to comply with law. Where appropriate, we will provide notice and an opportunity to address the issue.',
      'We work to keep Connectfy available and accurate, but do not promise uninterrupted access or that every listing will remain available. We may update, suspend, or discontinue platform features.'
    ]
  },
  {
    title: '9. Disclaimers and liability',
    paragraphs: [
      'Connectfy is provided on an “as available” basis. To the extent permitted by law, we disclaim warranties that are not expressly stated in these Terms. Nothing here excludes rights or liability that cannot lawfully be excluded.',
      'To the extent permitted by law, Connectfy is not responsible for indirect or consequential losses arising from your use of the platform. These Terms do not limit liability for fraud, intentional misconduct, or any other liability that cannot legally be limited.'
    ]
  },
  {
    title: '10. Changes and contact',
    paragraphs: [
      'We may update these Terms as the platform changes or to meet legal requirements. We will post the updated version here and revise the “Last updated” date. Continued use after an update takes effect means you accept the updated Terms, except where applicable law requires another form of consent.',
      'For questions about these Terms or a payment, contact Connectfy through the support or contact channel provided on the platform.'
    ]
  }
];

export const TermsAndConditionsPage: React.FC = () => (
  <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
        <ArrowLeft className="h-4 w-4" />
        Back to Connectfy
      </a>

      <article className="mt-6 rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12">
        <ConnectfyLogo size="md" />
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Terms &amp; Conditions</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: October 20, 2026</p>
        <p className="mt-6 leading-7 text-slate-700">
          These Terms &amp; Conditions explain the rules for using Connectfy. By creating an account or using the platform, you agree to these Terms. Please read them carefully.
        </p>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-slate-950">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-7 text-slate-700">{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  </main>
);
