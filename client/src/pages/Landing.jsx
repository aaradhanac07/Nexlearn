import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useEffect, useRef } from 'react'
import './Landing.css'

const FEATURES = [
  {
    icon: '🎬',
    title: 'Any Content → Course',
    desc: 'Drop a YouTube video, PDF, or paste raw notes. AI builds a full course in under 60 seconds.',
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  },
  {
    icon: '🃏',
    title: 'Spaced Repetition',
    desc: 'Smart flashcards powered by the SM-2 algorithm — review only what you\'re about to forget.',
    gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
  },
  {
    icon: '🧠',
    title: 'Adaptive Quiz Engine',
    desc: 'MCQ, true/false & short-answer questions generated fresh from your course content.',
    gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
  },
  {
    icon: '🎤',
    title: 'AI Study Buddy',
    desc: 'Speak your explanation aloud — get Socratic feedback and a score instantly.',
    gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  },
  {
    icon: '🕸️',
    title: 'Knowledge Graph',
    desc: 'Visualise how concepts connect. See your mastery colour-coded on an interactive graph.',
    gradient: 'linear-gradient(135deg,#06b6d4,#6366f1)',
  },
  {
    icon: '🏫',
    title: 'Teacher Dashboard',
    desc: 'Create classrooms, share invite codes, and track every student\'s weak spots in real time.',
    gradient: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
  },
]

const STATS = [
  { value: '60s', label: 'Course created' },
  { value: 'SM-2', label: 'Spaced repetition' },
  { value: '∞', label: 'Concepts mastered' },
  { value: 'Live', label: 'AI feedback' },
]

const STEPS = [
  { n: '01', title: 'Add any content', desc: 'Paste a YouTube URL, upload a PDF, or paste your notes — whatever you have.', icon: '📥' },
  { n: '02', title: 'AI builds the course', desc: 'Concepts extracted, flashcards generated, quiz questions ready — all in under a minute.', icon: '⚡' },
  { n: '03', title: 'Learn, practice, master', desc: 'Flashcards, quizzes, AI study buddy & a personalised study plan guide you to mastery.', icon: '🏆' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useUser()
  const heroRef = useRef(null)

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/dashboard', { replace: true })
  }, [isLoaded, isSignedIn])

  // Mouse-parallax for hero orbs
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const onMove = (e) => {
      const { left, top, width, height } = hero.getBoundingClientRect()
      const x = ((e.clientX - left) / width - 0.5) * 30
      const y = ((e.clientY - top) / height - 0.5) * 20
      hero.style.setProperty('--mx', `${x}px`)
      hero.style.setProperty('--my', `${y}px`)
    }
    hero.addEventListener('mousemove', onMove)
    return () => hero.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="lp-root">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-logo">
            <div className="lp-nav-logo-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white"/>
              </svg>
            </div>
            <span>NexLearn</span>
          </div>

          <nav className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={() => navigate('/sign-in')}>Sign in</button>
            <button className="lp-btn-primary" onClick={() => navigate('/sign-up')}>Get started free</button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="lp-hero" ref={heroRef}>
        {/* Ambient orbs */}
        <div className="lp-orb lp-orb--indigo" />
        <div className="lp-orb lp-orb--purple" />
        <div className="lp-orb lp-orb--cyan" />

        {/* Grid overlay */}
        <div className="lp-grid-overlay" />

        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            AI-Powered Learning Platform
          </div>

          <h1 className="lp-hero-title">
            Turn anything into<br />
            <span className="lp-grad-text">a course you'll master</span>
          </h1>

          <p className="lp-hero-sub">
            Drop a YouTube video, PDF, or raw notes. NexLearn's AI generates flashcards,
            quizzes, a knowledge graph, and a personalised study plan — in under 60 seconds.
          </p>

          <div className="lp-hero-actions">
            <button className="lp-btn-hero" onClick={() => navigate('/sign-up')} id="hero-get-started">
              Start learning free
              <span className="lp-btn-arrow">→</span>
            </button>
            <button className="lp-btn-demo" onClick={() => navigate('/sign-in')}>
              Sign in
            </button>
          </div>

          <div className="lp-hero-proof">
            <div className="lp-proof-avatars">
              {['A', 'B', 'C', 'D'].map(l => (
                <div key={l} className="lp-proof-avatar">{l}</div>
              ))}
            </div>
            <span className="lp-proof-text">Join thousands of students learning smarter</span>
          </div>
        </div>

        {/* Hero visual — floating course card */}
        <div className="lp-hero-visual">
          <div className="lp-mock-card glass">
            <div className="lp-mock-header">
              <div className="lp-mock-strip" />
              <div className="lp-mock-title-row">
                <span className="lp-mock-icon">🎬</span>
                <span className="lp-mock-badge lp-mock-badge--green">READY</span>
              </div>
              <div className="lp-mock-title">Introduction to Neural Networks</div>
              <div className="lp-mock-desc">AI-generated from a 45-min YouTube lecture</div>
            </div>
            <div className="lp-mock-meta">
              <span className="lp-mock-chip">🧠 12 concepts</span>
              <span className="lp-mock-chip">🃏 48 cards</span>
              <span className="lp-mock-chip">🔥 7d streak</span>
            </div>
            <div className="lp-mock-bar-wrap">
              <div className="lp-mock-bar-row">
                <span>Mastery</span>
                <span className="lp-mock-pct" style={{ color: '#10b981' }}>74%</span>
              </div>
              <div className="lp-mock-bar-track">
                <div className="lp-mock-bar-fill" style={{ width: '74%', background: '#10b981' }} />
              </div>
            </div>
            <div className="lp-mock-actions">
              <button className="lp-mock-btn">🃏 Review</button>
              <button className="lp-mock-btn lp-mock-btn--accent">🧠 Quiz</button>
            </div>
          </div>

          {/* Floating mini cards */}
          <div className="lp-float-card lp-float-card--tl glass">
            <span>🎯</span>
            <span>Quiz score: 92%</span>
          </div>
          <div className="lp-float-card lp-float-card--br glass">
            <span>⚡</span>
            <span>Course ready in 53s</span>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <section className="lp-stats">
        {STATS.map(s => (
          <div key={s.value} className="lp-stat">
            <div className="lp-stat-value">{s.value}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="lp-features" id="features">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow">Everything you need</div>
          <h2 className="lp-section-title">From raw content to confident knowledge</h2>
          <p className="lp-section-sub">One platform. Six AI-powered tools. Zero fluff.</p>
        </div>

        <div className="lp-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="lp-feature-card glass card-hover">
              <div className="lp-feature-icon-wrap" style={{ background: f.gradient }}>
                <span>{f.icon}</span>
              </div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow">Simple as 1-2-3</div>
          <h2 className="lp-section-title">Get started in minutes</h2>
        </div>

        <div className="lp-steps">
          {STEPS.map((step, i) => (
            <div key={step.n} className="lp-step">
              <div className="lp-step-num">{step.n}</div>
              <div className="lp-step-icon">{step.icon}</div>
              <h3 className="lp-step-title">{step.title}</h3>
              <p className="lp-step-desc">{step.desc}</p>
              {i < STEPS.length - 1 && <div className="lp-step-connector" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-section-header">
          <div className="lp-section-eyebrow">Simple pricing</div>
          <h2 className="lp-section-title">Start free. Upgrade when ready.</h2>
        </div>

        <div className="lp-plans">
          {/* Free */}
          <div className="lp-plan glass">
            <div className="lp-plan-label">Free</div>
            <div className="lp-plan-price">₹0<span>/month</span></div>
            <p className="lp-plan-desc">Everything you need to get started</p>
            <ul className="lp-plan-features">
              {['Up to 3 courses', '50 flashcards', 'Quiz generation', 'Knowledge graph', 'Anki export'].map(f => (
                <li key={f}><span className="lp-check lp-check--dim">✓</span> {f}</li>
              ))}
            </ul>
            <button className="lp-plan-btn lp-plan-btn--outline" onClick={() => navigate('/sign-up')}>
              Get started free
            </button>
          </div>

          {/* Pro */}
          <div className="lp-plan lp-plan--pro glass">
            <div className="lp-plan-popular">Most Popular</div>
            <div className="lp-plan-label">Pro</div>
            <div className="lp-plan-price lp-plan-price--pro">₹299<span>/month</span></div>
            <p className="lp-plan-desc">Everything, unlimited</p>
            <ul className="lp-plan-features">
              {['Unlimited courses', 'Unlimited flashcards', 'AI Study Buddy (voice)', 'Teacher Dashboard', 'Study Room (multiplayer)', 'Priority AI responses', 'Multi-source merge'].map(f => (
                <li key={f}><span className="lp-check">✓</span> {f}</li>
              ))}
            </ul>
            <button className="lp-plan-btn lp-plan-btn--primary" onClick={() => navigate('/sign-up')}>
              ⭐ Upgrade to Pro
            </button>
            <p className="lp-plan-secure">🔒 Razorpay · UPI, Cards, Net Banking</p>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-cta-orb" />
        <div className="lp-cta-content">
          <h2 className="lp-cta-title">Ready to learn smarter?</h2>
          <p className="lp-cta-sub">Free forever. No credit card required. Start in 30 seconds.</p>
          <button className="lp-btn-hero lp-btn-hero--large" onClick={() => navigate('/sign-up')} id="cta-get-started">
            Start for free
            <span className="lp-btn-arrow">→</span>
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-nav-logo">
              <div className="lp-nav-logo-icon">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="white"/>
                </svg>
              </div>
              <span>NexLearn</span>
            </div>
            <p>AI-powered learning for the next generation.</p>
          </div>
          <div className="lp-footer-copy">© 2026 NexLearn. Built with ❤️ for learners.</div>
        </div>
      </footer>
    </div>
  )
}
