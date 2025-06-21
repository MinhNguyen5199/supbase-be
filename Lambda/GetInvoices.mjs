import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    const { starting_after } = event.body;

    try {
        const { data: profile } = await supabase.from('users').select('stripe_customer_id').eq('id', user.uid).single();

        if (!profile?.stripe_customer_id) {
            return { statusCode: 200, body: JSON.stringify({ data: [], has_more: false }) };
        }
        
        const invoices = await stripe.invoices.list({
            customer: profile.stripe_customer_id,
            limit: 10,
            starting_after: starting_after,
        });

        return { statusCode: 200, body: JSON.stringify(invoices) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};