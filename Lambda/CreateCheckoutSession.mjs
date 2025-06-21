import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- LOGIC KEPT: This configuration map is the "brain" of your checkout logic ---
const TIER_CONFIG = {
    'pro-trial':  { type: 'trial', trialFeePriceId: process.env.STRIPE_PRO_TRIAL_PRICE_ID, recurringPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID },
    'pro-monthly':{ type: 'subscription', priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID },
    'pro-annual': { type: 'subscription', priceId: process.env.STRIPE_PRO_ANNUAL_ID },
    'vip-trial':  { type: 'trial', trialFeePriceId: process.env.STRIPE_VIP_TRIAL_PRICE_ID, recurringPriceId: process.env.STRIPE_VIP_MONTHLY_PRICE_ID },
    'vip-monthly':{ type: 'subscription', priceId: process.env.STRIPE_VIP_MONTHLY_PRICE_ID },
    'vip-annual': { type: 'subscription', priceId: process.env.STRIPE_VIP_ANNUAL_ID },
    'student-pro-monthly': { type: 'subscription', priceId: process.env.STRIPE_STUDENT_PRO_MONTHLY_ID },
    'student-pro-annual': { type: 'subscription', priceId: process.env.STRIPE_STUDENT_PRO_ANNUAL_ID },
    'student-vip-trial': { 
        type: 'trial', 
        trialFeePriceId: process.env.STRIPE_STUDENT_VIP_TRIAL_PRICE_ID,
        // THIS LINE IS THE KEY: It defines the future plan
        recurringPriceId: process.env.STRIPE_STUDENT_VIP_MONTHLY_ID 
    },
    'student-vip-monthly': { type: 'subscription', priceId: process.env.STRIPE_STUDENT_VIP_MONTHLY_ID },
    'student-vip-annual': { type: 'subscription', priceId: process.env.STRIPE_STUDENT_VIP_ANNUAL_ID }
};

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    // We expect a 'planIdentifier' from the frontend (e.g., 'pro-monthly')
    const { planIdentifier } = event.body;

    const config = TIER_CONFIG[planIdentifier];
    if (!config) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid plan identifier.' }) };
    }

    try {
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('stripe_customer_id, had_trial')
            .eq('id', user.uid)
            .single();

        if (profileError) throw profileError;

        // --- LOGIC KEPT: Check if user has already had a trial ---
        if (config.type === 'trial' && profile?.had_trial) {
            return { 
                statusCode: 403, // Forbidden
                body: JSON.stringify({ message: 'You have already used your one-time trial offer.' }) 
            };
        }

        let customerId = profile?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { supabase_id: user.uid }
            });
            customerId = customer.id;
            await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.uid);
        }

        let sessionConfig;

        // --- LOGIC KEPT: Configure session differently for a paid trial ---
        if (config.type === 'trial') {
            sessionConfig = {
                line_items: [
                    { price: config.recurringPriceId, quantity: 1 },
                    { price: config.trialFeePriceId, quantity: 1 }
                ],
                subscription_data: {
                    trial_period_days: 7,
                },
            };
        } else { // Configure for a direct subscription
            sessionConfig = {
                line_items: [{ price: config.priceId, quantity: 1 }],
            };
        }
        
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            success_url: `http://localhost:3000/payment-success`,
            cancel_url: `http://localhost:3000/dashboard/upgrade`,
            ...sessionConfig,
            subscription_data: {
                ...sessionConfig.subscription_data,
                metadata: { supabase_id: user.uid }
            }
        });

        return { statusCode: 200, body: JSON.stringify({ sessionId: session.id }) };
    } catch (error) {
        console.error("Stripe Error:", error);
        return { statusCode: 500, body: JSON.stringify({ message: "Failed to create checkout session." }) };
    }
};