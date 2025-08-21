import prisma from '../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import paypalService from '../services/paypalService.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import logger from '../utils/logger.js'; // Add logger import

// Create payment link
const createPaymentLink = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      brandId,
      serviceName,
      serviceDescription,
      amount,
      currency = 'USD'
    } = req.body;

    logger.info(`Creating payment link for customer: ${customerEmail}, brand: ${brandId}, service: ${serviceName}`);

    // Validate required fields
    if (!customerName || !customerEmail || !brandId || !serviceName || !amount) {
      logger.warn(`Missing required fields in payment link creation: ${JSON.stringify(req.body)}`);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if brand exists
    const brand = await prisma.brand.findUnique({
      where: { id: parseInt(brandId) }
    });

    if (!brand) {
      logger.warn(`Attempted to create payment for non-existent brand ID: ${brandId}`);
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Generate unique reference ID
    const referenceId = uuidv4();

    // Generate payment URL (front-end route)
    const baseUrl = process.env.FRONTEND_URL || `https://payment.nixxontech.com`;
    const paymentUrl = `${baseUrl}/pay/${referenceId}`;

    logger.debug(`Generated payment URL: ${paymentUrl} with reference ID: ${referenceId}`);

    // First create the payment record without PayPal order ID
    const initialPayment = await prisma.payment.create({
      data: {
        referenceId,
        customerName,
        customerEmail,
        customerPhone,
        brandId: parseInt(brandId),
        serviceName,
        serviceDescription,
        amount,
        currency,
        paymentUrl,
        status: 'pending'
      },
      include: {
        brand: true
      }
    });

    logger.info(`Created initial payment record: ${initialPayment.id}, reference: ${referenceId}`);

    // Create PayPal order (but don't redirect yet)
    try {
      logger.debug(`Creating PayPal order for payment: ${referenceId}`);
      const paypalOrder = await paypalService.createOrder(initialPayment);

      // Update payment with PayPal order ID
      await prisma.payment.update({
        where: { id: initialPayment.id },
        data: {
          paypalOrderId: paypalOrder.orderId
        }
      });

      logger.info(`PayPal order created successfully: ${paypalOrder.orderId} for payment: ${referenceId}`);

      // Return success with payment link
      res.status(201).json({
        success: true,
        data: {
          referenceId: initialPayment.referenceId,
          paymentUrl: initialPayment.paymentUrl,
          amount: initialPayment.amount,
          currency: initialPayment.currency,
          brandName: initialPayment.brand.name,
          paypalOrderId: paypalOrder.orderId
        }
      });
    } catch (paypalError) {
      logger.error(`Error creating PayPal order: ${paypalError.message} | Stack: ${paypalError.stack}`);

      // Delete the payment record since PayPal order creation failed
      await prisma.payment.delete({
        where: { id: initialPayment.id }
      });
      logger.info(`Deleted payment record ${initialPayment.id} due to PayPal order creation failure`);

      // Return error to client
      res.status(500).json({
        success: false,
        message: 'PayPal order could not be created. Please check PayPal configuration.',
        error: paypalError.message
      });
    }
  } catch (error) {
    logger.error(`Error creating payment link: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment link',
      error: error.message
    });
  }
};

// Get payment by reference ID (for payment page)
const getPaymentByReferenceId = async (req, res) => {
  try {
    const { referenceId } = req.params;
    logger.info(`Fetching payment by reference ID: ${referenceId}`);

    const payment = await prisma.payment.findUnique({
      where: { referenceId },
      include: { brand: true }
    });

    if (!payment) {
      logger.warn(`Payment not found with reference ID: ${referenceId}`);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment is expired (optional, if you implement expiration)
    const PAYMENT_EXPIRY_HOURS = 24; // Configure as needed
    const createdAt = new Date(payment.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

    if (payment.status === 'pending' && hoursSinceCreation > PAYMENT_EXPIRY_HOURS) {
      logger.info(`Payment ${referenceId} has expired after ${hoursSinceCreation.toFixed(2)} hours`);

      // Update the payment status to expired
      await prisma.payment.update({
        where: { referenceId },
        data: { status: 'expired' }
      });

      return res.status(400).json({
        success: false,
        message: 'Payment link has expired',
        data: {
          status: 'expired',
          referenceId: payment.referenceId
        }
      });
    }

    logger.info(`Retrieved payment ${referenceId}, status: ${payment.status}`);

    // Don't expose all payment details
    res.status(200).json({
      success: true,
      data: {
        referenceId: payment.referenceId,
        customerName: payment.customerName,
        serviceName: payment.serviceName,
        serviceDescription: payment.serviceDescription,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        brand: {
          name: payment.brand.name,
          logoUrl: payment.brand.logoUrl,
          description: payment.brand.description
        }
      }
    });
  } catch (error) {
    logger.error(`Error fetching payment: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
};

// Get list of payments (for agents)
const getPayments = async (req, res) => {
  try {
    logger.info('Fetching all payments');

    const payments = await prisma.payment.findMany({
      include: { brand: true },
      orderBy: { createdAt: 'desc' }
    });

    logger.info(`Retrieved ${payments.length} payments`);

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments.map(payment => ({
        id: payment.id,
        referenceId: payment.referenceId,
        customerName: payment.customerName,
        customerEmail: payment.customerEmail,
        serviceName: payment.serviceName,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        brandName: payment.brand.name
      }))
    });
  } catch (error) {
    logger.error(`Error fetching payments: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Update payment status (placeholder for future PayPal integration)
const updatePaymentStatus = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { status } = req.body;

    logger.info(`Updating payment status for ${referenceId} to: ${status}`);

    if (!['pending', 'processing', 'completed', 'failed', 'refunded'].includes(status)) {
      logger.warn(`Invalid status "${status}" provided for payment ${referenceId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const payment = await prisma.payment.update({
      where: { referenceId },
      data: { status }
    });

    logger.info(`Successfully updated payment ${referenceId} status to ${status}`);

    res.status(200).json({
      success: true,
      data: {
        referenceId: payment.referenceId,
        status: payment.status
      }
    });
  } catch (error) {
    logger.error(`Error updating payment status: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// Add a new method for initializing payment with PayPal
const initializePayPalPayment = async (req, res) => {
  try {
    const { referenceId } = req.params;
    logger.info(`Initializing PayPal payment for: ${referenceId}`);

    // Get payment from database
    const payment = await prisma.payment.findUnique({
      where: { referenceId },
      include: { brand: true }
    });

    if (!payment) {
      logger.warn(`Payment not found with reference ID: ${referenceId} during PayPal initialization`);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if we already have a PayPal order ID
    if (payment.paypalOrderId) {
      logger.info(`Using existing PayPal order ID: ${payment.paypalOrderId} for payment: ${referenceId}`);

      // Get order details from PayPal
      try {
        const client = paypalService.createClient();
        const request = new checkoutNodeJssdk.orders.OrdersGetRequest(payment.paypalOrderId);
        const order = await client.execute(request);

        // Find the approval link
        const approvalLink = order.result.links.find(link => link.rel === 'approve');

        if (!approvalLink || !approvalLink.href) {
          logger.error(`PayPal approval link not found for order: ${payment.paypalOrderId}`);
          throw new Error('PayPal approval link not found');
        }

        // Update status to processing
        await prisma.payment.update({
          where: { referenceId },
          data: { status: 'processing' }
        });

        logger.info(`Updated payment ${referenceId} status to processing, found approval link`);

        // Return approval link
        return res.status(200).json({
          success: true,
          data: {
            orderId: payment.paypalOrderId,
            approvalLink: approvalLink.href
          }
        });
      } catch (error) {
        logger.error(`Error getting existing PayPal order: ${error.message} | Stack: ${error.stack}`);
        // Order might be expired or invalid, create a new one
      }
    }

    // Create a new PayPal order
    logger.info(`Creating new PayPal order for payment: ${payment.referenceId}`);
    const paypalOrder = await paypalService.createOrder(payment);

    // Find the approval link
    const approvalLink = paypalOrder.links.find(link => link.rel === 'approve');

    if (!approvalLink || !approvalLink.href) {
      logger.error(`PayPal approval link not found in response for new order`);
      throw new Error('PayPal approval link not found in response');
    }

    // Update payment with PayPal order ID and status
    await prisma.payment.update({
      where: { referenceId },
      data: {
        paypalOrderId: paypalOrder.orderId,
        status: 'processing'
      }
    });

    logger.info(`Updated payment ${referenceId} with new PayPal order ID: ${paypalOrder.orderId}`);

    // Return PayPal order details
    res.status(200).json({
      success: true,
      data: {
        orderId: paypalOrder.orderId,
        approvalLink: approvalLink.href
      }
    });
  } catch (error) {
    logger.error(`Error initializing PayPal payment: ${error.message} | Stack: ${error.stack}`);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize PayPal payment',
      error: error.message
    });
  }
};

// Generate and download invoice
// const generateInvoice = async (req, res) => {
//   try {
//     const { referenceId } = req.params;
//     logger.info(`Generating invoice for payment: ${referenceId}`);

//     // Find the payment with brand information
//     const payment = await prisma.payment.findUnique({
//       where: { referenceId },
//       include: { brand: true }
//     });

//     if (!payment) {
//       logger.warn(`Payment not found with reference ID: ${referenceId} during invoice generation`);
//       return res.status(404).json({
//         success: false,
//         message: 'Payment not found'
//       });
//     }

//     // Check if payment is completed
//     if (payment.status !== 'completed') {
//       logger.warn(`Attempted to generate invoice for non-completed payment: ${referenceId}, status: ${payment.status}`);
//       return res.status(400).json({
//         success: false,
//         message: 'Invoice can only be generated for completed payments'
//       });
//     }

//     logger.info(`Starting PDF invoice generation for payment: ${referenceId}`);

//     // Using PDFKit to generate the invoice
//     const PDFDocument = await import('pdfkit');
//     const fs = await import('fs');
//     const path = await import('path');
//     const axios = await import('axios');

//     const doc = new PDFDocument.default({
//       margin: 50,
//       size: 'A4'
//     });

//     // Set response headers
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=invoice-${payment.referenceId}.pdf`);

//     // Pipe the PDF to the response
//     doc.pipe(res);

//     // Format the payment date
//     const paymentDate = new Date(payment.createdAt).toLocaleDateString('en-US', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric'
//     });

//     const invoiceNumber = `INV-${payment.referenceId.substring(0, 8).toUpperCase()}`;

//     // Define some styling constants
//     const primaryColor = '#4361ee'; // More vibrant blue
//     const secondaryColor = '#2d3748'; // Darker gray for text
//     const accentColor = '#38b2ac'; // Teal accent
//     const lightGray = '#f7fafc'; // Light background
//     const borderColor = '#cbd5e0'; // Border color

//     // Document background
//     doc.rect(0, 0, doc.page.width, doc.page.height)
//       .fill('#ffffff');

//     // Header area with brand info
//     doc.rect(0, 0, doc.page.width, 120).fill('#f0f4f8');  // Slightly darker background
//     doc.rect(0, 120, doc.page.width, 2).fill(primaryColor);

//     // Company logo
//     try {
//       if (payment.brand.logoUrl) {
//         const logoPath = payment.brand.logoUrl.startsWith('http')
//           ? payment.brand.logoUrl
//           : path.default.join(process.cwd(), '/src/public', payment.brand.logoUrl);

//         logger.info(`Attempting to load logo from path: ${logoPath}`);

//         if (payment.brand.logoUrl.startsWith('http')) {
//           logger.info(`Remote logo detected: ${payment.brand.logoUrl}`);
//           doc.fontSize(28)
//             .fillColor(primaryColor)
//             .text(payment.brand.name, 400, 50, { align: 'right' });
//         } else if (fs.default.existsSync(logoPath)) {
//           // Add a white rectangle behind the logo to improve visibility
//           doc.rect(45, 35, 160, 70).fill('#ffffff');

//           // Simplify the image rendering - avoid options causing NaN errors
//           try {
//             doc.image(logoPath, 50, 40, { width: 150 });
//             logger.info(`Successfully added logo from: ${logoPath}`);
//           } catch (imageError) {
//             // Fallback to even simpler rendering if we still have issues
//             logger.warn(`Error with logo options: ${imageError.message}, trying simpler approach`);
//             doc.image(logoPath, 50, 40);
//           }
//         } else {
//           logger.warn(`Logo file not found at path: ${logoPath}`);
//           doc.fontSize(28)
//             .fillColor(primaryColor)
//             .text(payment.brand.name, 400, 50, { align: 'right' });
//         }
//       } else {
//         doc.fontSize(28)
//           .fillColor(primaryColor)
//           .text(payment.brand.name, 400, 50, { align: 'right' });
//       }
//     } catch (logoError) {
//       logger.warn(`Error adding logo to invoice: ${logoError.message}`);
//       doc.fontSize(28)
//         .fillColor(primaryColor)
//         .text(payment.brand.name, 400, 50, { align: 'right' });
//     }

//     // Company details - right aligned
//     const emailDomain = payment.brand.email || `info@${payment.brand.name.toLowerCase().replace(/\s+/g, '')}.com`;

//     doc.fontSize(10)
//       .fillColor(secondaryColor)
//       .text(emailDomain, 400, 85, { align: 'right' });

//     // Invoice title and info - left aligned
//     doc.fontSize(28)
//       .fillColor(secondaryColor)
//       .text('INVOICE', 50, 160);

//     doc.fontSize(10)
//       .fillColor(secondaryColor)
//       .text(`Invoice Number: ${invoiceNumber}`, 50, 200)
//       .text(`Date: ${paymentDate}`, 50, 215)
//       .text(`Payment Status: ${payment.status.toUpperCase()}`, 50, 230);

//     // Bill to section
//     doc.fontSize(12)
//       .fillColor(primaryColor)
//       .text('BILL TO:', 50, 270);

//     doc.fontSize(11)
//       .fillColor(secondaryColor)
//       .text(payment.customerName, 50, 290)
//       .fontSize(10)
//       .text(payment.customerEmail, 50, 305);

//     if (payment.customerPhone) {
//       doc.text(payment.customerPhone, 50, 320);
//     }

//     // Item table header - with background
//     doc.rect(50, 360, 495, 25)
//       .fill(primaryColor);

//     doc.fillColor('#ffffff')
//       .fontSize(11)
//       .text('SERVICE', 70, 368)
//       .text('AMOUNT', 450, 368, { align: 'right' });

//     // Item row with alternate background
//     doc.rect(50, 385, 495, 30)
//       .fillAndStroke(lightGray, borderColor);

//     doc.fillColor(secondaryColor)
//       .text(payment.serviceName || 'General Service', 70, 397)
//       .text(`${payment.currency} ${parseFloat(payment.amount).toFixed(2)}`, 450, 397, { align: 'right' });

//     // Add service description if available
//     if (payment.serviceDescription) {
//       doc.fontSize(9)
//         .fillColor('#4b5563')  // Darker gray for better readability
//         .text(payment.serviceDescription, 70, 420, { width: 300 });
//     }

//     // Total section
//     doc.rect(350, 440, 195, 40)
//       .fill('#f1f5f9');

//     doc.fillColor(primaryColor)
//       .fontSize(12)
//       .text('TOTAL:', 370, 455)
//       .fillColor(secondaryColor)
//       .fontSize(14)
//       .text(`${payment.currency} ${parseFloat(payment.amount).toFixed(2)}`, 450, 455, { align: 'right' });

//     // Payment info section
//     doc.rect(50, 500, 495, 60)
//       .fillAndStroke('#f8fafc', borderColor);

//     doc.fillColor(primaryColor)
//       .fontSize(11)
//       .text('Payment Information:', 70, 510)
//       .fillColor(secondaryColor)
//       .fontSize(10)
//       .text(`Reference ID: ${payment.referenceId}`, 70, 530)
//       .text(`Payment Method: PayPal`, 70, 545);

//     // Footer
//     const footerY = doc.page.height - 100;

//     doc.rect(0, footerY, doc.page.width, 100)
//       .fill('#f8fafc');

//     doc.fillColor(secondaryColor)
//       .fontSize(10)
//       .text('Thank you for your business!', 0, footerY + 30, { align: 'center' })
//       .fontSize(9)
//       .fillColor('#64748b')
//       .text(`This invoice was generated on ${new Date().toLocaleString()}`, 0, footerY + 50, { align: 'center' });

//     // Add brand-specific footer content
//     if (payment.brand.name) {
//       doc.text(`© ${new Date().getFullYear()} ${payment.brand.name}. All rights reserved.`, 0, footerY + 70, { align: 'center' });
//     }

//     // Trim to the exact content - removes blank pages
//     doc.flushPages();

//     // Force single page by checking current page number
//     if (doc.bufferedPageRange().count > 1) {
//       // We have extra pages - log this for debugging
//       logger.warn(`Invoice for ${referenceId} generated with multiple pages, trimming to single page`);

//       // Only keep the first page
//       const range = doc.bufferedPageRange();
//       for (let i = 1; i < range.count; i++) {
//         doc.deletePage(i);
//       }
//     }
//     // Fix for multiple pages issue
//     logger.info(`Checking document page count before finalization`);


//     logger.info(`Successfully generated invoice ${invoiceNumber} for payment: ${referenceId}`);

//     // Now finalize the PDF
//     doc.end();
//   } catch (error) {
//     logger.error(`Error generating invoice: ${error.message} | Stack: ${error.stack}`);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to generate invoice',
//       error: error.message
//     });
//   }
// };



// We could use doc.flushPages() here but it's not needed
// since we're ending the document right away
export default {
  createPaymentLink,
  getPaymentByReferenceId,
  getPayments,
  updatePaymentStatus,
  initializePayPalPayment,
  // generateInvoice
};