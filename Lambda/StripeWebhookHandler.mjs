import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize the Stripe client with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize a special Supabase client with the Service Role Key.
// This client has admin privileges to bypass Row Level Security,
// which is necessary because webhooks come from Stripe, not a logged-in user.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  let stripeEvent;
  const signature = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    // Verify that the event is genuinely from Stripe
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed.`, err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Get the main data object from the event
  const dataObject = stripeEvent.data.object;

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = dataObject;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const supabaseUserId = subscription.metadata.supabase_id;

        // Create or update the subscription record in your database
        await supabase
          .from('subscriptions')
          .upsert({
            stripe_subscription_id: subscription.id,
            user_id: supabaseUserId,
            status: subscription.status,
            tier_id: subscription.items.data[0].price.lookup_key,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.current_period_end,
          }, { onConflict: 'stripe_subscription_id' });

        // Update the user's table with their new tier and Stripe customer ID
        await supabase
          .from('users')
          .update({
            current_tier: subscription.items.data[0].price.lookup_key,
            stripe_customer_id: subscription.customer,
          })
          .eq('id', supabaseUserId);

        console.log(`✅ checkout.session.completed: Handled for user ${supabaseUserId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = dataObject;
        const supabaseUserId = subscription.metadata.supabase_id;
        
        // Update the subscription record with the latest status
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            tier_id: subscription.items.data[0].price.lookup_key,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.current_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);
        
        // Update the user's current tier, unless they have canceled
        if (!subscription.cancel_at_period_end) {
            await supabase
                .from('users')
                .update({ current_tier: subscription.items.data[0].price.lookup_key })
                .eq('id', supabaseUserId);
        }

        console.log(`✅ customer.subscription.updated: Handled for user ${supabaseUserId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = dataObject;
        const supabaseUserId = subscription.metadata.supabase_id;

        // Mark the subscription as 'canceled' (or you could delete it)
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', cancel_at_period_end: true })
          .eq('stripe_subscription_id', subscription.id);
          
        // Downgrade the user to the 'basic' tier
        await supabase
          .from('users')
          .update({ current_tier: 'basic' })
          .eq('id', supabaseUserId);

        console.log(`✅ customer.subscription.deleted: Handled for user ${supabaseUserId}`);
        break;
      }

      default:
        console.log(`Unhandled event type ${stripeEvent.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};