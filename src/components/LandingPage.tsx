import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Menu,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const brands = ['PELOTON', 'instacart', 'Square', 'Uber', 'SONY', 'Expedia', 'Google', 'PayPal', 'ESPN', 'PRADA'];

const tracks = [
  {
    label: 'Functional',
    title: 'Find and fix problems as a functional tester.',
    description: 'Enjoy the satisfaction of catching and resolving bugs before new apps, devices and experiences are released into any market.',
    points: ['Conduct basic functionality testing', 'Provide feedback on product performance', 'Spot broken links, missing buttons and inaccuracies'],
    image: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=900&q=85'
  },
  {
    label: 'UX research',
    title: 'Help teams make digital products feel effortless.',
    description: 'Share thoughtful feedback from your perspective and help product teams understand what real people need.',
    points: ['Join flexible research sessions', 'Share honest, structured feedback', 'Influence products before launch'],
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85'
  },
  {
    label: 'Artificial intelligence',
    title: 'Teach the next generation of technology.',
    description: 'Evaluate AI experiences, compare responses and bring human judgment to products built for a changing world.',
    points: ['Review AI responses and conversations', 'Evaluate safety and usefulness', 'Work on projects matched to your expertise'],
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=85'
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState(0);
  const track = tracks[activeTrack];

  const jumpTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-white text-[#111827]">
      <div className="landing-alert">Stay secure: use Connectfy only through official Connectfy channels and verified opportunities.</div>

      <header className="landing-header">
        <div className="landing-nav">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Connectfy home">
            <ConnectfyLogo size="md" />
          </button>
          <nav className="hidden items-center gap-8 md:flex">
            <button onClick={() => jumpTo('why-connectfy')}>Why Connectfy</button>
            <button onClick={() => jumpTo('opportunities')}>Opportunities</button>
            <button onClick={() => jumpTo('tracks')}>Testing tracks</button>
            <button onClick={() => jumpTo('community')}>Community</button>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onLogin} className="landing-login">Log in</button>
            <button onClick={onGetStarted} className="landing-nav-cta">Join Connectfy</button>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="landing-menu-button md:hidden" aria-label="Open menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="landing-mobile-menu md:hidden">
            <button onClick={() => jumpTo('why-connectfy')}>Why Connectfy</button>
            <button onClick={() => jumpTo('opportunities')}>Opportunities</button>
            <button onClick={() => jumpTo('tracks')}>Testing tracks</button>
            <button onClick={() => jumpTo('community')}>Community</button>
            <button onClick={onGetStarted} className="landing-nav-cta">Join Connectfy</button>
          </div>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><Sparkles /> A better way to shape technology</div>
            <h1>Amazing digital experiences start with you.</h1>
            <p>As a paid tester with Connectfy, try out new products from your favorite brands and make them even better.</p>
            <button onClick={onGetStarted} className="landing-primary-button">Get started <ArrowRight /></button>
            <div className="landing-proof-row"><ShieldCheck /> Trusted opportunities. Flexible work. Real impact.</div>
          </div>
          <div className="landing-hero-art">
            <div className="landing-hero-orb" />
            <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1000&q=85" alt="Tester using a phone" />
            <div className="landing-float-card"><span className="landing-status-dot" /><strong>Project complete</strong><small>Payout has been sent</small></div>
          </div>
        </section>

        <section id="opportunities" className="landing-video-section landing-container">
          <div className="landing-video-frame">
            <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85" alt="Person testing a mobile product" />
            <button className="landing-play-button" aria-label="Play Connectfy introduction"><span /></button>
          </div>
          <div className="landing-video-copy">
            <h2>Flexible, paid product testing for the Connectfy community.</h2>
            <h3>At home, on the go or onsite, participate in rewarding testing projects.</h3>
            <p>Take digital experiences from functional to exceptional. Brands turn to the Connectfy community for feedback from people like you, so you can grow your skills, delight users and help set the bar for quality experiences.</p>
          </div>
        </section>

        <section className="landing-brand-strip" aria-label="Brands that trust Connectfy">
          <p>Your favorite brands rely on Connectfy</p>
          <div>{brands.map(brand => <span key={brand}>{brand}</span>)}</div>
        </section>

        <section id="why-connectfy" className="landing-section landing-container">
          <div className="landing-section-heading"><p className="landing-kicker">Built around real people</p><h2>Find powerful, meaningful work in technology.</h2><p>Whether you are new or experienced, a domain expert or simply passionate about making technology better, there is a place for you here.</p></div>
          <div className="landing-benefit-grid">
            <article><Users /><h3>Join a community of innovators</h3><p>Make connections and collaborate with fellow members around the world.</p></article>
            <article><MessageCircle /><h3>Get paid to influence products</h3><p>Choose from secure, flexible projects from leading brands.</p></article>
            <article><GraduationCap /><h3>Develop your testing skills</h3><p>Learn best practices and grow through practical project experience.</p></article>
          </div>
        </section>

        <section id="tracks" className="landing-track-section">
          <div className="landing-container">
            <div className="landing-section-heading"><p className="landing-kicker">Your testing adventure</p><h2>Choose work that fits your strengths.</h2><p>Pick from projects that match your interests, skills and everyday experience.</p></div>
            <div className="landing-track-tabs">{tracks.map((item, index) => <button key={item.label} onClick={() => setActiveTrack(index)} className={activeTrack === index ? 'active' : ''}>{item.label}</button>)}</div>
            <div className="landing-track-content">
              <div><h3>{track.title}</h3><p>{track.description}</p><ul>{track.points.map(point => <li key={point}><Check />{point}</li>)}</ul><button onClick={onGetStarted} className="landing-outline-button">View opportunities <ArrowRight /></button></div>
              <img src={track.image} alt={track.label} />
            </div>
          </div>
        </section>

        <section id="community" className="landing-testimonial landing-container">
          <div className="landing-quote-mark">“</div>
          <blockquote>Having the freedom to manage my testing time as I see fit is incredibly liberating. I feel truly in control of my work and the products I help improve.</blockquote>
          <div className="landing-person"><img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" alt="Connectfy community member" /><strong>Eric M.</strong><span>Canada</span></div>
        </section>

        <section className="landing-cta"><div><h2>Ready to start testing?</h2><p>You experience technology every day. Why not get paid to make those experiences even better?</p><button onClick={onGetStarted} className="landing-primary-button">Get started <ArrowRight /></button><button onClick={() => jumpTo('why-connectfy')} className="landing-light-button">Learn more</button></div></section>
      </main>

      <footer className="landing-footer"><div className="landing-container landing-footer-grid"><ConnectfyLogo size="lg" /><div><p>Connectfy helps real people shape better digital experiences.</p><div className="landing-footer-links"><button onClick={() => jumpTo('why-connectfy')}>Why Connectfy</button><button onClick={() => jumpTo('opportunities')}>Opportunities</button><button onClick={onGetStarted}>Join the community</button></div></div></div><div className="landing-container landing-footer-bottom"><span>© 2026 Connectfy Marketplace</span><span>Terms of use &nbsp; Privacy policy &nbsp; Help & support</span></div></footer>
    </div>
  );
};
