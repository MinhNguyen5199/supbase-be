import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * The main handler for the Reddit OAuth callback.
 * It exchanges the temporary code for an access token, fetches the user's Reddit profile,
 * and links it to their Supabase account.
 */
export const handler = async (req, res) => {
    // Reddit sends back a temporary 'code' and the 'state' JWT we sent.
    const { code, state } = req.query;
    console.log('Callback received with code:', code);
  console.log('Callback received with state:', state);

    if (!code || !state) {
        return res.status(400).send('Error: Invalid request from Reddit. Code or state is missing.');
    }

    try {
        // --- Step 1: Verify the state JWT to get the Supabase User ID securely ---
        let supabaseUserId;
        try {
            // Verify the token sent back in the 'state' parameter against our secret.
            const decodedState = jwt.verify(state, process.env.INTERNAL_API_SECRET);
            supabaseUserId = decodedState.supabase_user_id;
            
            if (!supabaseUserId) {
                // This will be caught by the outer catch block.
                throw new Error("User ID not found in JWT payload.");
            }
        } catch (err) {
            // This error means the state was tampered with or has expired.
            throw new Error("Invalid or expired state token. Please try linking your account again.");
        }

        // --- Step 2: Exchange the code for an access token ---
        const tokenResponse = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.REDDIT_REDIRECT_URI,
            }),
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) {
            throw new Error("Failed to retrieve access token from Reddit.");
        }

        // --- Step 3: Use the access token to get the user's Reddit profile ---
        const profileResponse = await axios.get('https://oauth.reddit.com/api/v1/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const redditProfile = {
            id: profileResponse.data.id,
            name: profileResponse.data.name
        };
        
        // --- Step 4: Link the profile to the Supabase user ---
        // The supabaseUserId is now securely retrieved from the verified JWT.
        const { error: linkError } = await supabase.from('reddit_game_profiles').insert({
            user_id: supabaseUserId,
            reddit_user_id: redditProfile.id,
            reddit_username: redditProfile.name,
        });

        if (linkError && linkError.code !== '23505') { // Ignore if already linked (code 23505 is unique_violation)
            throw linkError;
        }

        // --- Step 5: Redirect back to the frontend ---
        // On success, send the user back to their profile page.
        res.redirect(`${process.env.FRONTEND_URL}/dashboard/gremlin`);

    } catch (error) {
        console.error('Reddit OAuth Error:', error.response ? error.response.data : error.message);
        // On failure, redirect to the profile page with an error flag.
        res.redirect(`${process.env.FRONTEND_URL}/dashboard/gremlin?error=oauth_failed`);
    }
};
