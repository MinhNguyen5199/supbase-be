import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };

    try {
        const { data: profile, error } = await supabase.from('reddit_game_profiles').select('game_stats').eq('user_id', user.uid).single();
        if (error || !profile) return { statusCode: 404, body: JSON.stringify({ message: 'Link Reddit profile first' }) };
        if (profile.game_stats) return { statusCode: 409, body: JSON.stringify({ message: 'Gremlin already adopted' }) };

        const initialStats = { xp: 0, level: 1 };
        const { data: updatedProfile, error: updateError } = await supabase.from('reddit_game_profiles').update({
            game_stats: initialStats,
            last_played: new Date().toISOString()
        }).eq('user_id', user.uid).select().single();
        
        if (updateError) throw updateError;
        return { statusCode: 200, body: JSON.stringify({ message: 'Gremlin adopted!', data: updatedProfile }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};