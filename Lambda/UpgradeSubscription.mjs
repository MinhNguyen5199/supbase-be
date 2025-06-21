import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    const { newPriceId } = event.body;

    try {
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('user_id', user.uid)
            .eq('status', 'active')
            .maybeSingle();

        if (!sub?.stripe_subscription_id) {
            return { statusCode: 404, body: JSON.stringify({ message: 'No active subscription found to upgrade.' }) };
        }
        
        const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        await stripe.subscriptions.update(sub.stripe_subscription_id, {
            items: [{
                id: subscription.items.data[0].id,
                price: newPriceId,
            }],
            proration_behavior: 'always_invoice',
            cancel_at_period_end: false,
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'Subscription upgraded successfully.' }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};