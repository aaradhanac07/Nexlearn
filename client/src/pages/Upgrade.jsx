import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAxios } from '../hooks/useAxios'
import { useUser } from '@clerk/clerk-react'
import './Upgrade.css'

const FEATURES = [
  { icon: '📚', free: '3 courses',        pro: 'Unlimited courses' },
  { icon: '🃏', free: '50 flashcards',    pro: 'Unlimited flashcards' },
  { icon: '🧠', free: 'Quiz generation',  pro: 'Quiz generation' },
  { icon: '🕸️', free: 'Knowledge graph',  pro: 'Knowledge graph' },
  { icon: '📊', free: 'Basic analytics',  pro: 'Full analytics dashboard' },
  { icon: '🏫', free: '—',               pro: 'Teacher dashboard' },
  { icon: '📤', free: 'Anki export',      pro: 'Anki export' },
  { icon: '🔔', free: 'Notifications',    pro: 'Priority notifications' },
  { icon: '⚡', free: '—',               pro: 'Priority AI responses' },
]

export default function Upgrade() {
  const api      = useAxios()
  const navigate = useNavigate()
  const { user } = useUser()
  const [loading,    setLoading]    = useState(false)
  const [isPro,      setIsPro]      = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)

  // Load Razorpay checkout script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  // Check current plan
  useEffect(() => {
    api.get('/api/billing/status')
      .then(r => { setIsPro(r.data.isPro); setStatusLoading(false) })
      .catch(() => setStatusLoading(false))
  }, [])

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      // Step 1: Create Razorpay order on server
      const { data } = await api.post('/api/billing/create-order')

      // Step 2: Open Razorpay checkout
      const options = {
        key:          data.keyId,
        amount:       data.amount,
        currency:     data.currency,
        name:         'NexLearn',
        description:  'Pro Plan — ₹299/month',
        order_id:     data.orderId,
        prefill: {
          name:  user?.fullName || '',
          email: user?.primaryEmailAddress?.emailAddress || data.email,
        },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          // Step 3: Verify payment on server
          try {
            const { data: verifyData } = await api.post('/api/billing/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            })
            if (verifyData.success) {
              setIsPro(true)
              setLoading(false)
            }
          } catch {
            alert('Payment verification failed. Please contact support.')
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => setLoading(false)
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (err) {
      alert(err.response?.data?.error || 'Could not initiate payment. Try again.')
      setLoading(false)
    }
  }

  if (statusLoading) return (
    <div className="up-loading"><div className="fc-spinner"/></div>
  )

  return (
    <div className="up-root">
      <div className="up-bg-glow" />

      <button className="fc-back up-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>

      {isPro ? (
        /* ── Already Pro ── */
        <div className="up-pro-card">
          <div className="up-pro-badge">⭐ PRO</div>
          <h1 className="up-title">You're on NexLearn Pro!</h1>
          <p className="up-sub">You have unlimited access to all features.</p>
          <button className="up-btn-outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      ) : (
        /* ── Upgrade prompt ── */
        <div className="up-container">
          <div className="up-header">
            <div className="up-eyebrow">Upgrade Today</div>
            <h1 className="up-title">Unlock Everything in NexLearn</h1>
            <p className="up-sub">One flat price. Unlimited learning. Cancel anytime.</p>
          </div>

          {/* Pricing card */}
          <div className="up-plans">
            {/* Free */}
            <div className="up-plan up-plan--free">
              <div className="up-plan-label">Free</div>
              <div className="up-plan-price">₹0 <span>/month</span></div>
              <p className="up-plan-desc">Get started for free</p>
              <div className="up-plan-features">
                {FEATURES.map(f => (
                  <div key={f.icon} className="up-feature-row">
                    <span className="up-feature-icon">{f.icon}</span>
                    <span className={f.free === '—' ? 'up-na' : ''}>{f.free}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro */}
            <div className="up-plan up-plan--pro">
              <div className="up-plan-popular">Most Popular</div>
              <div className="up-plan-label">Pro</div>
              <div className="up-plan-price">₹299 <span>/month</span></div>
              <p className="up-plan-desc">Everything, unlimited</p>
              <div className="up-plan-features">
                {FEATURES.map(f => (
                  <div key={f.icon} className="up-feature-row">
                    <span className="up-feature-icon">{f.icon}</span>
                    <span className="up-pro-feature">{f.pro}</span>
                    <span className="up-check">✓</span>
                  </div>
                ))}
              </div>
              <button
                className="up-btn-primary"
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? <span className="quiz-spinner"/> : '⚡ Upgrade to Pro — ₹299/month'}
              </button>
              <p className="up-secure">🔒 Secured by Razorpay · UPI, Cards, Net Banking</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
