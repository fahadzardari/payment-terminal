import checkoutNodeJssdk from '@paypal/checkout-server-sdk';

// Creating an environment
function environment() {
  let clientId = process.env.PAYPAL_CLIENT_ID;
  let clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // Check if in production or sandbox mode
  return process.env.PAYPAL_MODE === 'production'
    ? new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret)
    : new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
}

// Creating a client
function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

export default { client };