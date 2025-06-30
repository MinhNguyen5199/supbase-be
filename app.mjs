// Corrected Express Server File

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import jwt from 'jsonwebtoken';

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

// --- for books

import { handler as createBookHandler } from './Books/CreateBook.mjs';
import { handler as getBookWithSummaryHandler } from './Books/GetBookWithSummary.mjs';
import { handler as createUpdateSummaryHandler } from './Books/CreateUpdateSummary.mjs'; // NEW: Import the new handler

// --- Import your new review handlers ---
import { handler as createReviewHandler } from './Reviews/CreateReview.mjs';
import { handler as getReviewsHandler } from './Reviews/GetReviews.mjs';
import { handler as updateReviewHandler } from './Reviews/UpdateReview.mjs';
import { handler as deleteReviewHandler } from './Reviews/DeleteReview.mjs';

// Import the new audio summary handler
import { handler as generateAudioSummaryHandler } from './Summaries/GenerateAudioSummary.mjs';
import { handler as getAudioSummaryHandler } from './Summaries/GetAudioSummary.mjs';


// --- (NEW) Import the refactored video summary handlers ---
// Renamed for clarity and new functionality
import { handler as createVideoConversationHandler } from './video/GenerateVideoSummary.mjs';
import { handler as endVideoConversationHandler } from './video/EndVideoConversation.mjs';
import { handler as deleteVideoConversationHandler } from './video/DeleteVideoConversation.mjs';
import { handler as getVideoStatusHandler } from './video/GetVideoSummary.mjs';

// --- (NEW) Import Quest and Game Handlers ---
import { handler as linkRedditProfileHandler } from './Gremlins/LinkRedditProfile.mjs';
import { handler as adoptGremlinHandler } from './Gremlins/AdoptGremlin.mjs';
import { handler as mintAchievementHandler } from './Gremlins/MintAchievement.mjs';
import { handler as getQuestsHandler } from './Quests/GetQuests.mjs';
import { handler as completeQuestHandler } from './Quests/CompleteQuest.mjs';
import { handler as redditOAuthHandler } from './Auth/RedditOAuth.mjs';
import serverless from 'serverless-http';

dotenv.config();
const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 4001;

// CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// --- STEP 1: WEBHOOK ROUTE (needs raw body) ---
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// --- STEP 2: GLOBAL JSON PARSER for all other routes ---
app.use(express.json());

// This helper function adapts Express requests to the format your handlers expect
const adaptRequest = (handler) => async (req, res) => {
  const event = {
    requestContext: {
      authorizer: req.user ? { uid: req.user.id, email: req.user.email } : null,
    },
    body: req.body,
    headers: req.headers,
  };
  try {
    const result = await handler(event, {});
    if (result.headers) { res.set(result.headers); }
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error("Handler Error:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

const adaptRequestWithParams = (handler) => async (req, res) => {
  const event = {
    requestContext: {
      authorizer: req.user ? { uid: req.user.id, email: req.user.email } : null,
    },
    body: req.body,
    headers: req.headers,
    pathParameters: req.params // Pass path parameters
  };
  try {
    const result = await handler(event, {});
    if (result.headers) { res.set(result.headers); }
    res.status(result.statusCode).send(result.body);
  } catch (error) {
    console.error("Handler Error:", error);
    res.status(500).send({ message: "An internal server error occurred." });
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

// Book Management Routes
app.post('/admin/books', supabaseAuthMiddleware, adaptRequest(createBookHandler)); // Admin-only route for creating books
app.post('/books/details', adaptRequest(getBookWithSummaryHandler)); // Route to get book details with summary

// NEW: Summary Management Route (Admin only)
app.post('/admin/summaries', supabaseAuthMiddleware, adaptRequest(createUpdateSummaryHandler));

// Review Management Routes
app.post('/reviews', supabaseAuthMiddleware, adaptRequest(createReviewHandler));
app.get('/books/:book_id/reviews', adaptRequestWithParams(getReviewsHandler));
app.put('/reviews/:review_id', supabaseAuthMiddleware, adaptRequestWithParams(updateReviewHandler));
app.delete('/reviews/:review_id', supabaseAuthMiddleware, adaptRequestWithParams(deleteReviewHandler));

// --- AI Summary Generation Routes ---
// This is the new route you will add
app.post('/summaries/:summary_id/audio', supabaseAuthMiddleware, adaptRequestWithParams(generateAudioSummaryHandler));
app.get('/summaries/:summary_id/audio', supabaseAuthMiddleware, adaptRequestWithParams(getAudioSummaryHandler));

// --- (UPDATED) Video Summary Generation Routes ---
// This is the main endpoint to start the video creation process.
app.post('/summaries/:summary_id/video', supabaseAuthMiddleware, adaptRequestWithParams(createVideoConversationHandler));

// (NEW) Endpoint to explicitly end a video session.
app.post('/videos/:summary_id/end', supabaseAuthMiddleware, adaptRequestWithParams(endVideoConversationHandler));

// (NEW) Endpoint to permanently delete a video.
app.delete('/videos/:summary_id', supabaseAuthMiddleware, adaptRequestWithParams(deleteVideoConversationHandler));
app.get('/videos/:summary_id/status', supabaseAuthMiddleware, adaptRequestWithParams(getVideoStatusHandler));

// --- (NEW) Subreddit Gremlins & Quest Board Routes ---
// Should be called after Reddit OAuth to link accounts
app.post('/reddit/link', supabaseAuthMiddleware, adaptRequest(linkRedditProfileHandler));

// Called once by a user to initialize their game profile
app.post('/gremlins/adopt', supabaseAuthMiddleware, adaptRequest(adoptGremlinHandler));

// An internal route to mint an NFT, likely called by another service or handler
app.post('/gremlins/mint-achievement', adaptRequest(mintAchievementHandler)); // Consider adding admin/service-level auth

// Public-facing quest routes for the frontend
app.get('/quests', supabaseAuthMiddleware, adaptRequest(getQuestsHandler));
app.post('/quests/complete', supabaseAuthMiddleware, adaptRequest(completeQuestHandler));


// NEW (Placeholder for AdminSummaryEditor to get book list):
// You'll need an endpoint to list books, e.g., a simple GET:
app.get('/books/list-simple', adaptRequest(async (event, context) => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: booksData, error } = await supabase
    .from('books')
    .select(`
      book_id,
      title,
      authors(name),
      genres(name),
      description,
      cover_image_url
    `)
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching simple book list:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to fetch book list.' }) };
  }

  // Flatten the author and genre arrays as expected by the frontend
  const formattedBooks = booksData.map(book => ({
    ...book,
    authors: book.authors ? book.authors.map(a => a.name) : [],
    genres: book.genres ? book.genres.map(g => g.name) : [],
  }));

  return { statusCode: 200, body: JSON.stringify({ data: formattedBooks }) };
}));

app.get('/auth/reddit/initiate', supabaseAuthMiddleware, (req, res) => {
  console.log('Initiate Reddit OAuth for Supabase user:', req.user?.id);
  const payload = {
      supabase_user_id: req.user.id,
  };
  // Create a short-lived token to use as the state
  const state = jwt.sign(payload, process.env.INTERNAL_API_SECRET, { expiresIn: '5m' });

  const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${process.env.REDDIT_CLIENT_ID}&response_type=code&state=${state}&redirect_uri=${process.env.REDDIT_REDIRECT_URI}&duration=temporary&scope=identity&prompt=consent`;
  console.log('Generated Reddit OAuth URL:', authUrl);
  // Send the URL back as JSON instead of redirecting
res.status(200).json({ url: authUrl });
});

app.get('/auth/reddit/callback', redditOAuthHandler);

// app.listen(PORT, () => {
//   console.log(`✅ Express backend running at http://localhost:${PORT}`);
// });

export const handler = serverless(app);