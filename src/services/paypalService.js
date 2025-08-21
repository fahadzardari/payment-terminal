import checkoutNodeJssdk from '@paypal/checkout-server-sdk';

// Creating environment and client
const createClient = () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PayPal client ID or secret');
  }

  const environment = process.env.PAYPAL_MODE === 'production'
    ? new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret)
    : new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);

  return new checkoutNodeJssdk.core.PayPalHttpClient(environment);
};

/**
 * Create a PayPal order for a payment
 * @param {object} payment - Payment object from database
 * @returns {object} PayPal order details
 */
export const createOrder = async (payment) => {
  try {
    // Create PayPal client
    const client = createClient();

    // Create order request
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();

    // Format the amount with exactly 2 decimal places
    const formattedAmount = Number(payment.amount).toFixed(2);

    // Set order details
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: payment.referenceId,
          description: `Payment for ${payment.serviceName}`,
          custom_id: payment.referenceId, // Used for identifying the payment in webhooks
          amount: {
            currency_code: payment.currency,
            value: formattedAmount
          }
        }
      ],
      application_context: {
        brand_name: payment.brand.name,
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        payment_method: {
          standard_entry_class_code: "WEB",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          disallowed_payment_methods: [
            {
              payment_method_type: "PAYLATER",
            }
          ]
        },
        stored_payment_source_expected: false,
        return_url: `${process.env.FRONTEND_URL || 'https://payment.nixxontech.com'}/payment/success/${payment.referenceId}`,
        cancel_url: `${process.env.FRONTEND_URL || 'https://payment.nixxontech.com'}/payment/cancel/${payment.referenceId}`
      }
    });

    // Execute the request
    const order = await client.execute(request);

    console.log('PayPal order created:', order.result);

    return {
      orderId: order.result.id,
      status: order.result.status,
      links: order.result.links
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    console.error('Error details:', error.details || 'No details available');
    throw new Error(`PayPal order creation failed: ${error.message}`);
  }
};

/**
 * Capture a PayPal payment
 * @param {string} orderId - PayPal order ID to capture
 * @returns {object} Capture details
 */
export const capturePayment = async (orderId) => {
  try {
    console.log(`Starting to capture payment for order: ${orderId}`);

    // Create PayPal client
    const client = createClient();

    // Create capture request
    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.prefer("return=representation");
    request.requestBody({}); // Empty request body

    console.log('Executing capture request');
    // Execute the request
    const capture = await client.execute(request);

    console.log('Capture response:', JSON.stringify(capture.result));

    return {
      captureId: capture.result.purchase_units[0].payments.captures[0].id,
      status: capture.result.status,
      result: capture.result
    };
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    if (error.details) {
      console.error('Capture error details:', JSON.stringify(error.details));
    }
    throw new Error(`PayPal payment capture failed: ${error.message}`);
  }
};

export default {
  createClient,
  createOrder,
  capturePayment
};