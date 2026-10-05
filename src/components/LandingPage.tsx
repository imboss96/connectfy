import React, { useState } from 'react';
import {
  ArrowRight,
  Globe2,
  Menu,
  X,
  Bug,
  Mic,
  Brain,
  Eye,
  MapPin,
  Users,
  DollarSign,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ClipboardCheck
} from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';
import heroImage from '../../hero image2.png';

interface LandingPageProps {
  onGetStarted: (projectId?: string) => void;
  onLogin: () => void;
}

const specialties = [
  {
    icon: Bug,
    title: 'Software QA',
    text: 'Test websites and apps, explore workflows, and report reproducible defects.'
  },
  {
    icon: Mic,
    title: 'Voice & Data Collection',
    text: 'Contribute recordings, language samples, and structured real-world data.'
  },
  {
    icon: Brain,
    title: 'AI Evaluation',
    text: 'Review model responses, evaluate prompts, and assess quality and safety.'
  },
  {
    icon: Eye,
    title: 'UX Research',
    text: 'Share feedback on user experiences, prototypes, and digital products.'
  }
];

const steps = [
  { icon: Users, title: 'Create your profile', text: 'Add your skills, location, and devices so projects can find the right fit.' },
  { icon: Globe2, title: 'Find an opportunity', text: 'Browse open projects and apply to work that matches your interests.' },
  { icon: ClipboardCheck, title: 'Complete approved work', text: 'Follow the task brief, submit your work, and track review and slot payouts.' }
];

const faqs = [
  {
    question: 'What kind of freelance work is available?',
    answer: 'Opportunities include software QA, voice and data collection, AI evaluation, UX research, and in-field studies.'
  },
  {
    question: 'Do I need special equipment?',
    answer: 'Requirements vary by project. Each listing explains the devices, skills, location, and deliverables needed before you apply.'
  },
  {
    question: 'How do slot payouts work?',
    answer: 'Each listing shows its payout rates. Payouts are credited for work approved by the project reviewer.'
  },
  {
    question: 'Are all projects remote?',
    answer: 'Many projects are remote, while some research or audit opportunities require local participation. Check each listing for details.'
  },
  {
    question: 'Do I need a uTest account?',
    answer: 'Only projects that use uTest require a uTest account. The listing and application will tell you when it is needed.'
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasProjectApplicationLink = new URLSearchParams(window.location.search).get('apply') === '1'
    && Boolean(new URLSearchParams(window.location.search).get('project'));

  const jumpTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-white text-[#111827]">
      <header className="landing-header">
        <div className="landing-nav">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Connectfy home">
            <ConnectfyLogo size="md" />
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            <button onClick={() => jumpTo('opportunities')}>Opportunities</button>
            <button onClick={() => jumpTo('specialties')}>Project types</button>
            <button onClick={() => jumpTo('how-it-works')}>How it works</button>
            <button onClick={() => jumpTo('faq')}>FAQ</button>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onLogin} className="landing-login">Log in</button>
            <button onClick={() => onGetStarted()} className="landing-nav-cta">Join Connectfy</button>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="landing-menu-button md:hidden" aria-label="Open menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="landing-mobile-menu md:hidden">
            <button onClick={() => jumpTo('overview')}>Overview</button>
            <button onClick={() => jumpTo('opportunities')}>Opportunities</button>
            <button onClick={() => jumpTo('specialties')}>Project types</button>
            <button onClick={() => jumpTo('how-it-works')}>How it works</button>
            <button onClick={() => jumpTo('faq')}>FAQ</button>
            <button onClick={() => onGetStarted()} className="landing-nav-cta">Join Connectfy</button>
          </div>
        )}
      </header>

      <main>
        {hasProjectApplicationLink && (
          <section className="mx-auto mt-5 flex max-w-6xl flex-col items-start justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-bold text-blue-950">Ready to apply for this project?</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-800">Sign in or create a Connectfy account. We’ll take you straight to the project application.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={onLogin} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100">Log in</button>
              <button type="button" onClick={() => onGetStarted()} className="rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#005fce]">Create account</button>
            </div>
          </section>
        )}
        <section id="overview" className="landing-hero">
          <div className="landing-hero-art" aria-hidden="true">
            <img
              src={heroImage}
              alt=""
            />
          </div>
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><Sparkles /> The Connectfy freelance marketplace</div>
            <h1>Find freelance testing work that fits your skills.</h1>
            <p>
              Explore software QA, voice and data collection, AI evaluation, UX research, and in-field opportunities from one profile.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onGetStarted()} className="landing-primary-button">Explore opportunities <ArrowRight /></button>
              <button onClick={() => jumpTo('how-it-works')} className="landing-light-button">How it works</button>
            </div>
            <div className="landing-proof-row"><Globe2 /> Remote and in-field projects · requirements shown before you apply</div>
          </div>
        </section>

        <section id="opportunities" className="landing-container landing-featured-section">
          <article className="landing-featured-card">
            <div className="landing-featured-copy">
              <p className="landing-featured-label"><span /> Featured opportunity</p>
              <h2>Participants Needed for Quick Image, Voice & Video Tech Testing</h2>
              <p>Remote smartphone tasks combining image, voice, video, and data collection.</p>
              <div className="landing-featured-meta"><span>AI evaluation</span><span>Remote</span><span>Limited slots</span></div>
            </div>
            <button onClick={() => onGetStarted()} className="landing-featured-button">Explore opportunities <ArrowRight /></button>
          </article>
        </section>

        <section id="specialties" className="landing-section landing-container">
          <div className="landing-section-heading">
            <p className="landing-kicker">Explore opportunities</p>
            <h2>Different skills. Real projects. Flexible work.</h2>
            <p>Find opportunities across quality assurance, research, and data tasks.</p>
          </div>
          <div className="landing-benefit-grid">
            {specialties.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="landing-track-section">
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-kicker">A clear path from profile to payout</p>
              <h2>How Connectfy works</h2>
            </div>

            <div className="landing-track-content">
              <div className="landing-steps-grid">
                {steps.map(({ icon: Icon, title, text }, index) => (
                  <article key={title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <Icon />
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
              <div className="landing-requirements-note">
                <ShieldCheck />
                <div><strong>Requirements vary by project</strong><p>Review the location, device, skill, and deliverable requirements on each listing before applying.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="landing-testimonial landing-container">
          <div className="landing-quote-mark">?</div>
          <h2 className="mb-8 text-3xl font-black tracking-[-0.04em] text-slate-900 md:text-4xl">Frequently Asked Questions</h2>
          <div className="space-y-4 text-left">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-[#dfeaf0] bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[#0a9ab9]" />
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{faq.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <h2>Ready to find your next project?</h2>
            <p>Create your Connectfy profile, explore opportunities, and apply to work that fits your skills.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => onGetStarted()} className="landing-primary-button">Join Connectfy <ArrowRight /></button>
              <button onClick={onLogin} className="landing-light-button">Log in</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <ConnectfyLogo size="lg" />
          <div>
            <p>Connectfy.tech • Freelance QA, data collection, and research marketplace</p>
            <div className="landing-footer-links">
              <button onClick={() => jumpTo('overview')}>Overview</button>
              <button onClick={() => jumpTo('specialties')}>Project types</button>
              <button onClick={() => onGetStarted()}>Join</button>
            </div>
          </div>
        </div>
        <div className="landing-container landing-footer-bottom">
          <span>© 2026 Connectfy</span>
          <span>Remote and in-field opportunities · requirements vary by project</span>
        </div>
      </footer>
    </div>
  );
};
