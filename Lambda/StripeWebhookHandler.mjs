import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const sub = stripeEvent.data.object;

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = await stripe.checkout.sessions.retrieve(sub.id, {
          expand: ["subscription"],
        });
        const subscription = session.subscription;
        const supabaseUserId = subscription.metadata.supabase_id;

        // --- LOGIC REPLICATION: Handle trial dates exactly like the old code ---
        let startDate, expiresAt;
        if (subscription.status === "trialing") {
          startDate = subscription.trial_start;
          expiresAt = subscription.trial_end;
          // Also update the user's `had_trial` flag
          await supabase.from('users').update({ had_trial: true }).eq('id', supabaseUserId);
        } else {
          startDate = subscription.current_period_start;
          expiresAt = subscription.current_period_end;
        }

        // Update the user's main tier and Stripe customer ID
        await supabase
          .from('users')
          .update({
            current_tier: subscription.items.data[0].price.lookup_key,
            stripe_customer_id: subscription.customer,
          })
          .eq('id', supabaseUserId);
        
        // Insert the subscription with the correct dates
        await supabase.from('subscriptions').insert({
            user_id: supabaseUserId,
            tier_id: subscription.items.data[0].price.lookup_key,
            status: subscription.status,
            start_date: startDate,
            expires_at: expiresAt,
            stripe_subscription_id: subscription.id,
            subscription_interval: subscription.items.data[0].plan.interval,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.current_period_end,
        });
        break;
      }

      case "invoice.paid": {
        if (sub.subscription) {
            const subscription = await stripe.subscriptions.retrieve(sub.subscription);
            await supabase
                .from('subscriptions')
                .update({
                    status: subscription.status,
                    current_period_end: subscription.current_period_end,
                })
                .eq('stripe_subscription_id', subscription.id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const supabaseUserId = sub.metadata.supabase_id;
        const newTier = sub.items.data[0].price.lookup_key;

        // --- LOGIC REPLICATION: Update all fields exactly like the old code ---
        await supabase
          .from('subscriptions')
          .update({
            tier_id: newTier,
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at,
            start_date: sub.current_period_start,
            expires_at: sub.current_period_end,
            created_at: sub.created,
          })
          .eq('stripe_subscription_id', sub.id);
        
        if (!sub.cancel_at_period_end) {
          await supabase
            .from('users')
            .update({ current_tier: newTier })
            .eq('id', supabaseUserId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const supabaseUserId = sub.metadata.supabase_id;
        await supabase
          .from('users')
          .update({ current_tier: 'basic' })
          .eq('id', supabaseUserId);
        
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id);
        break;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error(`Error processing '${stripeEvent.type}':`, error);
    return {
      statusCode: 500,
      body: "Internal server error while processing webhook.",
    };
  }
};