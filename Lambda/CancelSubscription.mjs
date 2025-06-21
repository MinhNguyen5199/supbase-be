import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    try {
        const { data } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('user_id', user.uid)
            .in('status', ['active', 'trialing'])
            .maybeSingle();

        if (!data?.stripe_subscription_id) {
            return { statusCode: 404, body: JSON.stringify({ message: 'No active subscription to cancel.' }) };
        }

        await stripe.subscriptions.update(data.stripe_subscription_id, {
            cancel_at_period_end: true,
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'Subscription cancellation scheduled.' }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};