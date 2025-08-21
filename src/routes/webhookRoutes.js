import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

// PayPal webhook endpoint
router.post('/paypal', webhookController.handlePayPalWebhook);

export default router;