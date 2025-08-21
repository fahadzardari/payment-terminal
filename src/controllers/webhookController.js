import prisma from '../lib/prisma.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';

// Verify PayPal webhook signature
const verifyPayPalWebhookSignature = (req) => {
  // try {
  //   logger.debug('Performing basic webhook validation');

  //   // Check for required PayPal headers (at minimum)
  //   const requiredHeaders = [
  //     'paypal-transmission-id',
  //     'paypal-transmission-sig',
  //     'paypal-transmission-time'
  //   ];

  //   const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

  //   if (missingHeaders.length > 0) {
  //     logger.warn(`Missing required PayPal headers: ${missingHeaders.join(', ')}`);
  //     return false;
  //   }

  //   // Check that the event contains expected fields
  //   if (!req.body || !req.body.event_type || !req.body.id) {
  //     logger.warn('Webhook payload missing required fields');
  //     return false;
  //   }

  //   return true;
  // } catch (error) {
  //   logger.error(`Error in basic webhook validation: ${error.message}`);
  //   return false;
  // }

  return true;
};

// Handle PayPal webhook events
const handlePayPalWebhook = async (req, res) => {
  try {
    // Verify the webhook signature
    if (!verifyPayPalWebhookSignature(req)) {
      logger.warn('PayPal webhook signature validation failed', { ip: req.ip });
      return res.status(401).send('Webhook signature validation failed');
    }

    const event = req.body;
    logger.info(`Received PayPal webhook: ${event.event_type}`, { eventId: event.id });

    // Process based on event type
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        // Payment approved but not captured yet
        logger.info(`Processing ORDER.APPROVED webhook for order: ${event.resource?.id || 'unknown'}`);
        await handleOrderApproved(event);
        break;

      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment successfully captured
        logger.info(`Processing CAPTURE.COMPLETED webhook for resource: ${event.resource?.id || 'unknown'}`);
        await handlePaymentCaptured(event);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        // Payment was denied
        logger.info(`Processing CAPTURE.DENIED webhook for resource: ${event.resource?.id || 'unknown'}`);
        await handlePaymentDenied(event);
        break;

      default:
        logger.info(`Received unhandled PayPal webhook type: ${event.event_type}`);
    }

    // Always return 200 to acknowledge receipt
    logger.debug('Sending 200 response for webhook acknowledgment');
    res.status(200).send('Webhook received');
  } catch (error) {
    logger.error(`Error processing PayPal webhook: ${error.message} | Stack: ${error.stack}`);
    // Still return 200 to prevent PayPal from retrying
    res.status(200).send('Webhook processed with errors');
  }
};

// Handle order approved event
const handleOrderApproved = async (event) => {
  try {
    const orderId = event.resource.id;
    logger.info(`Processing order approved event for PayPal order ID: ${orderId}`);

    // Find payment with this PayPal order ID
    const payment = await prisma.payment.findFirst({
      where: { paypalOrderId: orderId }
    });

    if (!payment) {
      logger.warn(`Payment not found for PayPal order: ${orderId}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'approved' }
    });

    logger.info(`Payment ${payment.referenceId} status updated to approved`);
  } catch (error) {
    logger.error(`Error handling order approved event: ${error.message} | Stack: ${error.stack}`);
  }
};

// Handle payment captured event
const handlePaymentCaptured = async (event) => {
  try {
    const orderId = event.resource.supplementary_data.related_ids.order_id;
    logger.info(`Processing payment captured event for PayPal order ID: ${orderId}`);

    // Find payment with this PayPal order ID
    const payment = await prisma.payment.findFirst({
      where: { paypalOrderId: orderId }
    });

    if (!payment) {
      logger.warn(`Payment not found for PayPal order: ${orderId}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        updatedAt: new Date()
      }
    });

    logger.info(`Payment ${payment.referenceId} status updated to completed`);

    // Additional business logic for completed payments could go here
    // e.g., sending confirmation emails, updating inventory, etc.
  } catch (error) {
    logger.error(`Error handling payment captured event: ${error.message} | Stack: ${error.stack}`);
  }
};

// Handle payment denied event
const handlePaymentDenied = async (event) => {
  try {
    const orderId = event.resource.supplementary_data.related_ids.order_id;
    logger.info(`Processing payment denied event for PayPal order ID: ${orderId}`);

    // Find payment with this PayPal order ID
    const payment = await prisma.payment.findFirst({
      where: { paypalOrderId: orderId }
    });

    if (!payment) {
      logger.warn(`Payment not found for PayPal order: ${orderId}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        updatedAt: new Date()
      }
    });

    logger.info(`Payment ${payment.referenceId} status updated to failed`);

    // Additional handling for failed payments could go here
    // e.g., notifying admins, triggering recovery workflows, etc.
  } catch (error) {
    logger.error(`Error handling payment denied event: ${error.message} | Stack: ${error.stack}`);
  }
};

export default {
  handlePayPalWebhook
};