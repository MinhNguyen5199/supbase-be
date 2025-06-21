import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize clients at the top level
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
  // 1. Get the authenticated user from the middleware
  const user = event.requestContext.authorizer;
  if (!user?.uid) {
      return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
  }

  // 2. Access the already-parsed body object. No JSON.parse() needed.
  const { starting_after } = event.body || {};

  try {
      // 3. Use the Supabase client to get the user's profile and stripe_customer_id
      const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('stripe_customer_id')
          .eq('id', user.uid)
          .single();

      if (profileError) throw profileError;

      const customerId = profile?.stripe_customer_id;

      if (!customerId) {
          return {
              statusCode: 200,
              body: JSON.stringify({ data: [], has_more: false }),
          };
      }

      // 4. Build the parameters for the Stripe API call
      const listParams = {
          customer: customerId,
          limit: 10,
      };

      if (starting_after) {
          listParams.starting_after = starting_after;
      }

      // 5. Call the Stripe API
      const invoices = await stripe.invoices.list(listParams);

      return {
          statusCode: 200,
          body: JSON.stringify(invoices),
      };

  } catch(error) {
      console.error('GetInvoices Error:', error);
      const message = (error instanceof Error) ? error.message : "An unknown error occurred.";
      return { 
          statusCode: 500, 
          body: JSON.stringify({ message: message }) 
      };
  }
};