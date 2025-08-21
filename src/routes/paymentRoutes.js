import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from "../middlewares/authMiddleware.js"

const router = express.Router();

// Create payment link
router.post('/links', authenticate, paymentController.createPaymentLink);

// Get payment details by reference ID
router.get('/:referenceId', paymentController.getPaymentByReferenceId);

router.patch('/:referenceId/status', paymentController.updatePaymentStatus);

// Add this route
router.post('/:referenceId/paypal', paymentController.initializePayPalPayment);

// Add this route for invoice generation
// router.get('/:referenceId/invoice', paymentController.generateInvoice);

// Process payment
// router.post('/:referenceId/process', paymentController.processPayment);

// Get list of payments (for agents)
router.get('/', authenticate, paymentController.getPayments);

export default router;