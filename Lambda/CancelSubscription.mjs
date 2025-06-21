import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;

    if (!user?.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    }

    try {
        // Find the user's active or trialing subscription ID
        const { data, error: dbError } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('user_id', user.uid)
            .in('status', ['active', 'trialing'])
            .order('created_at', { ascending: false }) // Added order for consistency
            .limit(1)
            .maybeSingle();

        if (dbError) throw dbError;

        if (!data?.stripe_subscription_id) {
            return { statusCode: 404, body: JSON.stringify({ message: 'No active or trialing subscription found to cancel.' }) };
        }

        // Tell Stripe to cancel the subscription at the end of the period
        const updatedSubscription = await stripe.subscriptions.update(data.stripe_subscription_id, {
            cancel_at_period_end: true,
        });
        
        // --- FIX: Return the same body as the old version ---
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Subscription cancellation scheduled successfully.',
                cancel_at: updatedSubscription.cancel_at 
            }),
        };
    } catch (error) {
        console.error('Error canceling subscription:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to cancel subscription.' }) };
    }
};