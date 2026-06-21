import { createRequire } from 'module'
import crypto from 'crypto'
import { User } from '../models/User.js'

// Use createRequire to safely import CJS package in ESM context
const require = createRequire(import.meta.url)
const Razorpay = require('razorpay')

// Lazy-init so env vars are guaranteed loaded
let _rzp = null
function getRazorpay() {
  if (!_rzp) {
    const keyId     = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      throw new Error('Razorpay keys not configured in .env')
    }
    _rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })
  }
  return _rzp
}

const AMOUNT   = parseInt(process.env.PRO_PLAN_AMOUNT || '29900') // paise
const CURRENCY = 'INR'

// POST /api/billing/create-order
export const createOrder = async (req, res, next) => {
  try {
    if (req.user.plan === 'pro') {
      return res.status(400).json({ error: 'Already on Pro plan' })
    }

    const rzp   = getRazorpay()
    const order = await rzp.orders.create({
      amount:   AMOUNT,
      currency: CURRENCY,
      receipt:  `nx_${req.user._id}_${Math.floor(Date.now()/1000)}`,
      notes: {
        userId: req.user._id.toString(),
        email:  req.user.email || '',
      }
    })

    res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      name:     req.user.name  || 'NexLearn User',
      email:    req.user.email || '',
    })
  } catch (err) {
    console.error('[Billing] createOrder error:', err?.error || err?.message || err)
    // Return readable error to frontend
    const msg = err?.error?.description || err?.message || 'Payment service error'
    res.status(500).json({ error: msg })
  }
}

// POST /api/billing/verify
export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' })
    }

    const body     = `${razorpay_order_id}|${razorpay_payment_id}`
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature invalid' })
    }

    await User.findByIdAndUpdate(req.user._id, {
      plan: 'pro',
      razorpayPaymentId: razorpay_payment_id,
    })

    res.json({ success: true, plan: 'pro', message: '🎉 Welcome to NexLearn Pro!' })
  } catch (err) {
    console.error('[Billing] verifyPayment error:', err?.message)
    next(err)
  }
}

// GET /api/billing/status
export const getBillingStatus = async (req, res) => {
  res.json({
    plan:    req.user.plan,
    isPro:   req.user.plan === 'pro',
    limits: req.user.plan === 'pro'
      ? { courses: 'unlimited', cards: 'unlimited' }
      : { courses: 3, cards: 50 }
  })
}

// POST /api/billing/cancel
export const cancelPro = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { plan: 'free' })
    res.json({ success: true, plan: 'free' })
  } catch (err) { next(err) }
}
