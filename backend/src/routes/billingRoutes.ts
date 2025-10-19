// src/routes/billingRoutes.ts
import { Router } from 'express';
import { billingController } from '../controllers/billingController.js';

const router = Router();

router.post('/billing/checkout', billingController.createCheckoutSession);
router.get('/billing/finalize', billingController.finalizeFromCheckout);
router.post('/billing/portal', billingController.createBillingPortal);
router.get('/billing/invoices', billingController.listInvoices);

export default router;
