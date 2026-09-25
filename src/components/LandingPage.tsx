import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Globe2,
  Menu,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Video,
  X,
  Camera,
  IdCard,
  UserRound,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

interface LandingPageProps {
  onGetStarted: (projectId?: string) => void;
  onLogin: () => void;
}

const countries = ['United States', 'India', 'Mexico', 'Kenya', 'Pakistan', 'Brazil', 'Indonesia'];

const projectTasks = [
  {
    icon: Mic,
    title: 'Voice Tasks',
    text: 'Short voice recordings, including reading numbers and sentences in quiet and normal/noisy environments.'
  },
  {
    icon: Camera,
    title: 'Image & Visual Tasks',
    text: 'Use your smartphone camera to complete short visual and data-collection activities.'
  },
  {
    icon: Video,
    title: 'Video Tasks',
    text: 'Participate in brief, remote video-based tasks using your smartphone camera.'
  },
  {
    icon: IdCard,
    title: 'Digital Identity Verification',
    text: 'Complete the required identity check using a valid government-issued ID.'
  }
];

const requirements = [
  'Age 18 or older',
  'Located in one of the eligible countries',
  'Smartphone on iOS or Android',
  'Stable internet connection',
  'Working camera and microphone',
  'Valid government-issued ID available',
  'Comfortable with short voice recordings',
  'Remote participation from home'
];

const steps = [
  'Create your uTest account through the official uTest registration page.',
  'Verify your email and log in to your verified uTest account.',
  'Return to this page and complete the project application.',
  'Submit the required identity and device details for review.'
];

const faqs = [
  {
    question: 'How long does the project take?',
    answer: 'The complete activity is expected to take less than 30 minutes.'
  },
  {
    question: 'Do I need special equipment?',
    answer: 'No. You only need a compatible smartphone with a working camera, microphone and stable internet connection.'
  },
  {
    question: 'Do I need a government-issued ID?',
    answer: 'Yes. A valid government-issued ID is required for the identity-verification portion of the project.'
  },
  {
    question: 'Can I participate from home?',
    answer: 'Yes. The project is designed as a remote data-collection activity.'
  },
  {
    question: 'Can anyone apply?',
    answer: 'The project is limited to adults aged 18+ who are located in one of the seven eligible countries and meet the other requirements.'
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const jumpTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-white text-[#111827]">
      <div className="landing-alert">Featured project • applications are currently open • limited participant slots available</div>

      <header className="landing-header">
        <div className="landing-nav">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Connectfy home">
            <ConnectfyLogo size="md" />
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            <button onClick={() => jumpTo('overview')}>Overview</button>
            <button onClick={() => jumpTo('requirements')}>Requirements</button>
            <button onClick={() => jumpTo('apply')}>Apply</button>
            <button onClick={() => jumpTo('faq')}>FAQ</button>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onLogin} className="landing-login">Log in</button>
            <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-nav-cta">Apply now</button>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="landing-menu-button md:hidden" aria-label="Open menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="landing-mobile-menu md:hidden">
            <button onClick={() => jumpTo('overview')}>Overview</button>
            <button onClick={() => jumpTo('requirements')}>Requirements</button>
            <button onClick={() => jumpTo('apply')}>Apply</button>
            <button onClick={() => jumpTo('faq')}>FAQ</button>
            <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-nav-cta">Apply now</button>
          </div>
        )}
      </header>

      <main>
        <section id="overview" className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><Sparkles /> Featured Project | Limited Participant Slots</div>
            <h1>Participants Needed for Quick Image, Voice & Video Tech Testing</h1>
            <p>
              Connectfy.tech is recruiting adults to participate in a short, remote technology testing and data collection project.
              The activity combines image, voice, video and digital identity verification tasks designed to help improve platform quality, reliability and user experience.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-primary-button">Apply for the project <ArrowRight /></button>
              <button onClick={onLogin} className="landing-login">Already have a verified uTest account?</button>
            </div>
            <div className="landing-proof-row"><MapPin /> USA • India • Mexico • Kenya • Pakistan • Brazil • Indonesia</div>
          </div>

          <div className="landing-hero-art">
            <div className="landing-hero-orb" />
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=85"
              alt="Participant testing mobile technology"
            />
            <div className="landing-float-card">
              <span className="landing-status-dot" />
              <strong>Remote activity</strong>
              <small>Less than 30 minutes</small>
            </div>
          </div>
        </section>

        <section className="landing-video-section landing-container">
          <div className="landing-video-frame">
            <img
              src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85"
              alt="Smartphone testing and image capture"
            />
            <button className="landing-play-button" aria-label="Play project overview"><span /></button>
          </div>

          <div className="landing-video-copy">
            <h2>What will you do?</h2>
            <h3>If selected, you will complete a short series of smartphone-based tasks.</h3>
            <p>
              The testing flow includes voice recordings, visual tasks using your camera, short video-based tasks and a digital identity verification step to help improve age-data accuracy and abuse-prevention measures.
            </p>
          </div>
        </section>

        <section className="landing-section landing-container">
          <div className="landing-section-heading">
            <p className="landing-kicker">Project Tasks</p>
            <h2>Short, remote, smartphone-friendly testing.</h2>
          </div>
          <div className="landing-benefit-grid">
            {projectTasks.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="requirements" className="landing-track-section">
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-kicker">Project Requirements</p>
              <h2>Eligibility and device checklist.</h2>
            </div>

            <div className="landing-track-content">
              <div>
                <ul>
                  {requirements.map((item) => (
                    <li key={item}><CheckCircle2 />{item}</li>
                  ))}
                </ul>
                <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-outline-button">
                  Confirm eligibility <ArrowRight />
                </button>
              </div>

              <div className="rounded-[24px] border border-[#9ddce9] bg-white/80 p-6 shadow-[0_30px_60px_rgba(15,47,64,0.08)]">
                <div className="mb-6 flex items-center gap-3 text-[#0f172a]">
                  <ShieldCheck className="h-5 w-5 text-[#0a9ab9]" />
                  <strong className="text-lg font-black">Eligible locations</strong>
                </div>

                <div className="grid gap-3">
                  {countries.map((country) => (
                    <div key={country} className="flex items-center justify-between rounded-2xl border border-[#dfeaf0] bg-[#f7fcfe] px-4 py-3 text-sm font-semibold text-slate-700">
                      <span>{country}</span>
                      <Globe2 className="h-4 w-4 text-[#0a9ab9]" />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3 rounded-2xl border border-[#dfeaf0] bg-[#ecfbff] p-4 text-sm text-slate-700">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#0a9ab9]" />
                  <span>Complete the full activity remotely in under 30 minutes.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-container">
          <div className="landing-section-heading">
            <p className="landing-kicker">Before You Apply</p>
            <h2>Complete your uTest setup first.</h2>
          </div>

          <div className="landing-benefit-grid">
            {steps.map((step, index) => (
              <article key={step}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#dff7fb] text-sm font-black text-[#0a9ab9]">
                  {index + 1}
                </div>
                <p className="text-base leading-7 text-slate-700">{step}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href="https://www.utest.com/signup" target="_blank" rel="noreferrer" className="landing-primary-button">
              Create your uTest account <ChevronRight />
            </a>
            <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-login">Apply for the project</button>
          </div>
        </section>

        <section id="apply" className="landing-container pb-24 pt-12">
          <div className="rounded-[32px] border border-[#cfeaf2] bg-[#f5fdff] p-6 shadow-[0_30px_60px_rgba(15,47,64,0.08)] md:p-8">
            <div className="mb-8 text-center">
              <p className="landing-kicker">Participant Application</p>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-900 md:text-4xl">Complete your project application.</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {[
                'Full Identity Name',
                'uTest Tester ID',
                'uTest Email',
                'Date of Birth',
                'Age Range',
                'Country',
                'Smartphone',
                'Device Confirmation'
              ].map((field) => (
                <label key={field} className="flex flex-col gap-2 text-sm font-bold text-slate-700">
                  {field}
                  <input
                    className="rounded-2xl border border-[#cfe3eb] bg-white px-4 py-3 text-sm text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-[#0a9ab9]"
                    placeholder={field}
                  />
                </label>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-[#dfeaf0] bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#0a9ab9]" />
                I have a valid government-issued ID available and understand that ID verification is required to participate.
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[#dfeaf0] bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#0a9ab9]" />
                I am willing to complete short voice recordings, including recordings in both quiet and normal/noisy environments.
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={() => onGetStarted('proj-ai-voice-05')} className="landing-primary-button">Submit application <ArrowRight /></button>
              <button onClick={onLogin} className="landing-login">Back to login</button>
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
                  <Check className="mt-0.5 h-5 w-5 text-[#0a9ab9]" />
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
            <h2>Ready to Participate?</h2>
            <p>Create and verify your uTest account, then return here to complete your application.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="https://www.utest.com/signup" target="_blank" rel="noreferrer" className="landing-primary-button">
                Create Your uTest Account <ArrowRight />
              </a>
              <button onClick={onLogin} className="landing-light-button">Already have a verified account?</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <ConnectfyLogo size="lg" />
          <div>
            <p>Connectfy.tech • Participant Recruitment & Technology Testing</p>
            <div className="landing-footer-links">
              <button onClick={() => jumpTo('overview')}>Overview</button>
              <button onClick={() => jumpTo('requirements')}>Requirements</button>
              <button onClick={() => onGetStarted('proj-ai-voice-05')}>Apply</button>
            </div>
          </div>
        </div>
        <div className="landing-container landing-footer-bottom">
          <span>© 2026 Connectfy</span>
          <span>Limited slots • Applications close when sufficient participants have been recruited</span>
        </div>
      </footer>
    </div>
  );
};
