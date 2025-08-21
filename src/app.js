import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from './lib/prisma.js';
import paypalService from './services/paypalService.js';
import paymentRoutes from './routes/paymentRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import contactRequestRoutes from "./routes/contactRequestRoutes.js";
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';





// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use((req, res, next) => {
  if (req.originalUrl === '/api/brands/upload-logo') {
    // Skip JSON parsing for file uploads
    next();
  } else {
    // Apply JSON parsing for other routes
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: '*', // Allow all origins by default
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// API Routes
app.use('/api/auth', authRoutes);

// Make HTML routes public, but they'll check auth client-side
app.get('/agent/payments', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-links.html'));
});

app.get('/agent/contact-requests', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact-requests.html'));
});

app.get('/agent/brands', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'brands.html'));
});

app.get('/agent/create-link', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create-link.html'));
});

app.get('/invoice/:referenceId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

// Keep API routes protected
app.use('/api/payments', paymentRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/contact-requests', contactRequestRoutes);
app.use('/api/webhooks', webhookRoutes);

// Add this route before your payment route
app.get('/api/paypal-config', (req, res) => {
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID
  });
});

// Payment page route
app.get('/pay/:referenceId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// Success route handler
app.get('/payment/success/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { token, PayerID } = req.query;

    console.log(`Payment success for: ${referenceId}, token: ${token}, PayerID: ${PayerID}`);

    // Get payment details
    const payment = await prisma.payment.findUnique({
      where: { referenceId }
    });

    if (!payment || !payment.paypalOrderId) {
      console.error('Payment not found or missing PayPal order ID');
      return res.status(404).send('Payment not found');
    }

    // Capture the payment if not already completed
    if (payment.status !== 'completed') {
      try {
        console.log(`Capturing payment for order: ${payment.paypalOrderId}`);
        const captureResult = await paypalService.capturePayment(payment.paypalOrderId);
        console.log('Capture result:', captureResult);

        // Update payment status
        await prisma.payment.update({
          where: { referenceId },
          data: {
            status: 'completed'
          }
        });

        console.log(`Payment ${referenceId} captured successfully`);
      } catch (captureError) {
        console.error('Error capturing payment:', captureError);
        console.error('Error details:', captureError.details || 'No details');
        // Continue to show success page even if capture fails
      }
    }

    // Render success page
    res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
  } catch (error) {
    console.error('Error processing success page:', error);
    res.status(500).send('An error occurred while processing your payment');
  }
});

// Cancel route handler
app.get('/payment/cancel/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;

    console.log(`Payment cancelled for: ${referenceId}`);

    // Update payment status to cancelled
    await prisma.payment.update({
      where: { referenceId },
      data: { status: 'cancelled' }
    });

    // Render cancellation page
    res.sendFile(path.join(__dirname, 'public', 'payment-cancel.html'));
  } catch (error) {
    console.error('Error processing cancel page:', error);
    res.status(500).send('An error occurred');
  }
});

// Login page - public
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;