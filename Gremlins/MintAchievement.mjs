import { createClient } from '@supabase/supabase-js';
import { mintNftBadge } from '../utils/algorand.mjs';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    // --- (NEW) SECURITY CHECK ---
    // Check for the secret header from the incoming request.
    const internalSecret = event.headers['x-internal-secret'];

    // If the secret is missing or doesn't match the one in our .env file, reject the request.
    if (internalSecret !== process.env.INTERNAL_API_SECRET) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }
    // --- END SECURITY CHECK ---
    
    const { userId, badgeId } = event.body;
    if (!userId || !badgeId) return { statusCode: 400, body: JSON.stringify({ message: 'User ID and Badge ID required' }) };

    try {
        const { data: badge, error: badgeError } = await supabase.from('nft_badges').select('*').eq('badge_id', badgeId).single();
        if (badgeError || !badge) return { statusCode: 404, body: JSON.stringify({ message: 'Badge not found' }) };

        const { assetId, txId } = await mintNftBadge(badge);

        const { data: awardedBadge, error: insertError } = await supabase.from('user_nft_badges').insert({
            user_id: userId,
            badge_id: badgeId,
            algorand_asset_id: assetId,
            algorand_tx_id: txId,
        }).select().single();
        
        if (insertError) throw insertError;
        return { statusCode: 201, body: JSON.stringify({ message: 'Achievement minted!', data: awardedBadge }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};