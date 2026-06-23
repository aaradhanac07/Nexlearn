import { SignUp as ClerkSignUp } from '@clerk/clerk-react'
import './Auth.css'

/**
 * SignUp — wraps Clerk's hosted sign-up widget in the same
 * premium full-screen dark layout as SignIn.
 */
export default function SignUp() {
  return (
    <div className="auth-root">
      {/* Ambient orbs */}
      <div className="auth-orb auth-orb--indigo" />
      <div className="auth-orb auth-orb--purple" />

      <div className="auth-container">
        {/* Branding */}
        <div className="auth-brand">
          <div className="auth-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                fill="white"
              />
            </svg>
          </div>
          <h1 className="auth-title">
            Start learning smarter with <span className="grad-text">NexLearn</span>
          </h1>
          <p className="auth-subtitle">
            AI-powered flashcards, quizzes, and knowledge graphs. Free to start.
          </p>

          {/* Feature pills */}
          <div className="auth-pills">
            {[
              '🃏 AI Flashcards',
              '🧠 Adaptive Quiz',
              '🕸️ Knowledge Graph',
              '📊 Analytics',
            ].map(pill => (
              <span key={pill} className="auth-pill">{pill}</span>
            ))}
          </div>
        </div>

        {/* Clerk widget */}
        <div className="auth-widget">
          <ClerkSignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            afterSignUpUrl="/dashboard"
            appearance={{
              variables: {
                colorBackground:       '#111118',
                colorInputBackground:  '#1a1a25',
                colorText:             '#f1f5f9',
                colorTextSecondary:    '#94a3b8',
                colorPrimary:          '#6366f1',
                colorInputText:        '#f1f5f9',
                borderRadius:          '12px',
                fontFamily:            'Inter, system-ui, sans-serif',
              },
              elements: {
                card:             'clerk-card',
                headerTitle:      { display: 'none' },
                headerSubtitle:   { display: 'none' },
                formButtonPrimary: 'clerk-primary-btn',
                footerActionLink: 'clerk-link',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
