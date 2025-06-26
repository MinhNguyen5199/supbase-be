import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };

    try {
        const { data: allQuests, error: questsError } = await supabase.from('quests').select('*').order('xp_reward');
        if (questsError) throw questsError;

        const { data: completedQuests, error: completedError } = await supabase.from('user_completed_quests').select('quest_id').eq('user_id', user.uid);
        if (completedError) throw completedError;
        
        const completedQuestIds = new Set(completedQuests.map(q => q.quest_id));

        const questsWithStatus = allQuests.map(quest => ({
            ...quest,
            is_completed: completedQuestIds.has(quest.quest_id)
        }));

        return { statusCode: 200, body: JSON.stringify({ data: questsWithStatus }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ message: error.message }) };
    }
};