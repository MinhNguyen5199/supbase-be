import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  const { priceId } = event.body;

  if (!priceId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Error: priceId is required.' }) };
  }

  try {
    const { data: profile } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user.uid)
        .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_id: user.uid }
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.uid);
    }

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `http://localhost:3000/payment-success`,
      cancel_url: `http://localhost:3000/dashboard/upgrade`,
      // --- THIS IS THE FIX ---
      // We attach the metadata to the 'subscription_data' object.
      // This ensures the ID is on the subscription itself, which is what the webhook sees.
      subscription_data: {
        metadata: {
          supabase_id: user.uid 
        }
      }
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify({ sessionId: session.id }) 
    };

  } catch (error) {
    console.error("Stripe Error in CreateCheckoutSession:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ message: error.message }) 
    };
  }
};