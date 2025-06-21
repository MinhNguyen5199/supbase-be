// Corrected Express Server File

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// New Supabase middleware
import { supabaseAuthMiddleware } from './Lambda/supabaseAuthMiddleware.mjs';

// --- Import ALL your handlers ---
import { handler as getUserProfileHandler } from './Lambda/GetUserProfile.mjs';
import { handler as createCheckoutSessionHandler } from './Lambda/CreateCheckoutSession.mjs';
import { handler as stripeWebhookHandler } from './Lambda/StripeWebhookHandler.mjs';
import { handler as createPortalSessionHandler } from './Lambda/CreatePortalSession.mjs';
import { handler as upgradeSubscriptionHandler } from './Lambda/UpgradeSubscription.mjs';
import { handler as cancelSubscriptionHandler } from './Lambda/CancelSubscription.mjs'; // Import new handler
import { handler as getInvoicesHandler } from './Lambda/GetInvoices.mjs'; // <-- 1. IMPORT THE NEW HANDLER


dotenv.config();
const app = express();

// CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// --- STEP 1: WEBHOOK ROUTE (needs raw body) ---
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// --- STEP 2: GLOBAL JSON PARSER for all other routes ---
app.use(express.json());

// This helper function adapts Express requests to the format your handlers expect
const adaptRequest = (handler) => async (req, res) => {
  const event = {
    requestContext: {
      authorizer: req.user ? {
        uid: req.user.id,
        email: req.user.email,
        displayName: req.user.user_metadata?.full_name,
      } : null,
    },
    body: req.body,
    headers: req.headers,
  };

  try {
    const result = await handler(event, {});
    // Set headers if the handler provides them
    if (result.headers) {
        res.set(result.headers);
    }
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error("Handler Error:", error);
    res.status(500).send({ message: "An internal server error occurred in the handler." });
  }
};

// --- API Routes ---
// All protected routes use the `supabaseAuthMiddleware` first.
app.get('/get-user-profile', supabaseAuthMiddleware, adaptRequest(getUserProfileHandler));
app.post('/create-checkout-session', supabaseAuthMiddleware, adaptRequest(createCheckoutSessionHandler));
app.post('/create-portal-session', supabaseAuthMiddleware, adaptRequest(createPortalSessionHandler));
app.post('/upgrade-subscription', supabaseAuthMiddleware, adaptRequest(upgradeSubscriptionHandler));
app.post('/cancel-subscription', supabaseAuthMiddleware, adaptRequest(cancelSubscriptionHandler));
app.post('/get-invoices', supabaseAuthMiddleware, adaptRequest(getInvoicesHandler));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Express backend running at http://localhost:${PORT}`);
});