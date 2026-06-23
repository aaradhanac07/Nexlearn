import { SignIn as ClerkSignIn } from '@clerk/clerk-react'
import './Auth.css'

/**
 * SignIn — wraps Clerk's hosted sign-in widget in a premium
 * full-screen dark layout matching the NexLearn design system.
 */
export default function SignIn() {
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
            Welcome back to <span className="grad-text">NexLearn</span>
          </h1>
          <p className="auth-subtitle">
            Your AI-powered learning companion. Sign in to continue.
          </p>
        </div>

        {/* Clerk widget */}
        <div className="auth-widget">
          <ClerkSignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
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
                socialButtonsBlockButton: 'clerk-social-btn',
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
