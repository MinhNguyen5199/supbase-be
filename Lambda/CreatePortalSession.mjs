import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const studentProducts = [
    {
        product: process.env.STRIPE_STUDENT_PRO_PRODUCTID,
        prices: [process.env.STRIPE_STUDENT_PRO_MONTHLY_ID, process.env.STRIPE_STUDENT_PRO_ANNUAL_ID]
    },
    {
        product: process.env.STRIPE_STUDENT_VIP_PRODUCTID,
        prices: [process.env.STRIPE_STUDENT_VIP_MONTHLY_ID, process.env.STRIPE_STUDENT_VIP_ANNUAL_ID]
    }
];

const regularProducts = [
    {
        product: process.env.STRIPE_PRO_PRODUCTID,
        prices: [process.env.STRIPE_PRO_MONTHLY_PRICE_ID, process.env.STRIPE_PRO_ANNUAL_ID]
    },
    {
        product: process.env.STRIPE_VIP_PRODUCTID,
        prices: [process.env.STRIPE_VIP_MONTHLY_PRICE_ID, process.env.STRIPE_VIP_ANNUAL_ID]
    }
];

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    
    if (!user?.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    }
    
    try {
        const { data: userData, error: dbError } = await supabase
            .from('users')
            .select(`is_student, stripe_customer_id, subscriptions!inner(stripe_subscription_id)`)
            .eq('id', user.uid)
            .in('subscriptions.status', ['active', 'trialing'])
            .limit(1)
            .maybeSingle();

        if (dbError) throw dbError;
        
        const customerId = userData?.stripe_customer_id;
        const subscriptionId = userData?.subscriptions?.[0]?.stripe_subscription_id;
        
        if (!customerId || !subscriptionId) {
            return { statusCode: 404, body: JSON.stringify({ message: 'Stripe customer or active subscription not found.' }) };
        }

        const allowedUpdates = userData.is_student ? studentProducts : regularProducts;
        const returnUrl = `${process.env.FRONTEND_URL}/dashboard/upgrade`;

        const config = await stripe.billingPortal.configurations.create({
            business_profile: { headline: 'BookWise Subscription Management' },
            features: {
                invoice_history: { enabled: true },
                payment_method_update: { enabled: true },
                subscription_update: {
                    enabled: true,
                    default_allowed_updates: ['price'],
                    products: allowedUpdates,
                    proration_behavior: "none"
                },
            },
        });

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
            configuration: config.id,
            // --- THIS LOGIC IS NOW ADDED BACK TO MATCH THE ORIGINAL ---
            flow_data: {
                type: 'subscription_update',
                subscription_update: {
                    subscription: subscriptionId,
                },
                after_completion: {
                    type: 'redirect',
                    redirect: {
                        return_url: returnUrl,
                    },
                }
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ url: portalSession.url }),
        };

    } catch (error) {
        console.error('Error creating Stripe customer portal session:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to create customer portal session.' }) };
    }
};