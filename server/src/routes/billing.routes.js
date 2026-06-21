import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { attachUser }  from '../middleware/attachUser.js'
import { createOrder, verifyPayment, getBillingStatus, cancelPro } from '../controllers/billing.controller.js'

const router = Router()
router.use(requireAuth, attachUser)

router.post('/create-order', createOrder)
router.post('/verify',       verifyPayment)
router.get('/status',        getBillingStatus)
router.post('/cancel',       cancelPro)

export default router
