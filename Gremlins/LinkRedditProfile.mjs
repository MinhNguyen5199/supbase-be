import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };

    const { redditProfile } = event.body;
    if (!redditProfile?.id || !redditProfile?.name) return { statusCode: 400, body: JSON.stringify({ message: 'Reddit profile data required' }) };

    try {
        const { data, error } = await supabase.from('reddit_game_profiles').insert({
            user_id: user.uid,
            reddit_user_id: redditProfile.id,
            reddit_username: redditProfile.name,
        }).select();
        if (error) {
            if (error.code === '23505') return { statusCode: 409, body: JSON.stringify({ message: 'Account already linked' }) };
            throw error;
        }
        return { statusCode: 201, body: JSON.stringify({ message: 'Reddit profile linked', data }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};