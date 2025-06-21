import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    try {
        const { data: profile } = await supabase.from('users').select('stripe_customer_id').eq('id', user.uid).single();

        if (!profile?.stripe_customer_id) {
            return { statusCode: 404, body: JSON.stringify({ message: 'Stripe customer not found.' }) };
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `http://localhost:3000/dashboard/upgrade`,
        });

        return { statusCode: 200, body: JSON.stringify({ url: portalSession.url }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};