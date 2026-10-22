import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

const sections = [
  {
    title: '1. Scope and who we are',
    paragraphs: [
      'This Privacy Policy explains how Connectfy collects, uses, stores, and shares information when you visit connectfy.tech, create an account, or use our project marketplace and related services. Connectfy connects clients with participants for testing, research, data collection, and related project work.',
      'For privacy questions or requests, contact support@connectfy.tech.'
    ]
  },
  {
    title: '2. Information we collect',
    paragraphs: [
      'Account information may include your name, email address, profile photo, login provider, role, country, city, company, and preferences. If you choose Google sign-in, Google shares basic account information such as your email address, name, and profile picture according to the permissions shown during authorization. We do not receive your Google password.',
      'For project participation, we may collect applications, eligibility information, selected devices, project communications, work submissions, feedback, ratings, and related files. Depending on a project’s requirements, information may include your uTest ID and email, legal name, date of birth, phone number, country, and screenshots or other verification evidence.',
      'For payments and referrals, we may process approved work amounts, payout requests, transaction references, referral codes, referral activity, and reward records. Payment details needed to process a payout are handled according to the selected payment method and may also be processed by its provider.',
      'If you are engaged as an employee or contractor for Connectfy operations, we may process HR information such as job and compensation terms, onboarding tasks, attendance, leave requests, and performance records.',
      'We also receive technical and usage information necessary to operate and secure the service, such as authentication/session data, device and browser information, and records of actions taken in the platform.'
    ]
  },
  {
    title: '3. How we use information',
    paragraphs: [
      'We use information to create and secure accounts; authenticate users; operate profiles; match participants with projects; review applications, eligibility, and submitted work; communicate about projects and account activity; administer referrals and rewards; process and reconcile payouts; provide HR services; prevent fraud and misuse; troubleshoot, maintain, and improve Connectfy; and comply with legal obligations.',
      'We use Google OAuth only to let you authenticate with Google and receive the basic profile information needed to create or access your Connectfy account. Email/password registration and password-reset messages are handled by Supabase Auth.'
    ]
  },
  {
    title: '4. Project-specific information and sharing',
    paragraphs: [
      'Some projects require us to submit participant-provided details or screener answers to a project client or service designated for that project, including Applause/uTest or a project form hosted by Google. We submit such information only for project administration and eligibility where the relevant project information and required consent or authorization have been provided. Review project instructions before participating.',
      'We may share information with service providers that help us operate Connectfy, including Supabase for hosting, database, and authentication; Google for OAuth and project forms or sheets; Cloudinary for file storage; email providers for transactional messages; Slack for support or explicitly initiated status communications; and payment providers or mobile-money services when a payout is requested.',
      'We may also disclose information when reasonably necessary to protect users, investigate suspected fraud or security incidents, enforce platform terms, respond to lawful requests, or protect rights and safety. We do not sell personal information.'
    ]
  },
  {
    title: '5. Cookies, local storage, and security',
    paragraphs: [
      'Connectfy and its authentication provider use browser storage and similar technologies to maintain sign-in sessions, remember preferences, and support essential platform functionality. Your browser settings can control or clear local storage, but doing so may sign you out or affect features.',
      'We use reasonable technical and organizational safeguards to protect information. No online service or transmission can be guaranteed completely secure. Keep your password and account credentials private and contact us if you suspect unauthorized access.'
    ]
  },
  {
    title: '6. Retention and international processing',
    paragraphs: [
      'We retain information for as long as needed to provide the service, administer projects and payments, maintain business records, resolve disputes, enforce agreements, and meet legal or security obligations. Retention periods can vary by information type and project requirements. When information is no longer needed, we take reasonable steps to delete or de-identify it, subject to backups and lawful retention requirements.',
      'Connectfy and its service providers may process or store information in countries other than the country where you live. Those countries may have different data-protection rules.'
    ]
  },
  {
    title: '7. Your choices and privacy requests',
    paragraphs: [
      'You can review and update some profile information in your account settings. You may disconnect Google access through your Google Account settings; this does not itself delete your Connectfy account. You can ask us to access, correct, or delete personal information, or raise another privacy concern, by emailing support@connectfy.tech. We may need to verify your identity and may retain information where required or permitted by law or needed to complete a project, payout, or dispute.',
      'Depending on where you live, you may have additional rights under applicable privacy law. We will handle requests in accordance with the requirements that apply to your request.'
    ]
  },
  {
    title: '8. Children and policy changes',
    paragraphs: [
      'Connectfy is not intended for children who are not legally able to participate in work or enter into applicable agreements. We do not knowingly collect personal information from children in violation of applicable law. If you believe a child has provided us information, contact us so we can review it.',
      'We may update this Privacy Policy as the service or legal requirements change. We will post the revised policy here and update the date below. Material changes may also be communicated through the platform where appropriate.'
    ]
  }
];

export const PrivacyPolicyPage: React.FC = () => (
  <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
        <ArrowLeft className="h-4 w-4" />
        Back to Connectfy
      </a>

      <article className="mt-6 rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12">
        <ConnectfyLogo size="md" />
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Legal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: October 22, 2026</p>
        <p className="mt-6 leading-7 text-slate-700">
          This policy describes how Connectfy handles information when you use our website and services. Please read it together with our <a href="/terms" className="font-semibold text-teal-800 underline">Terms &amp; Conditions</a>.
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
