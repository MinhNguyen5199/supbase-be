import { createClient } from "@supabase/supabase-js";
import { logQuestCompletionToReddit } from "../utils/reddit.mjs";
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  if (!user?.uid)
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Unauthorized" }),
    };

  const { questId } = event.body;
  if (!questId)
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "questId is required." }),
    };

  try {
    const [questDetails, profileDetails] = await Promise.all([
      supabase.from("quests").select("*").eq("quest_id", questId).single(),
      supabase
        .from("reddit_game_profiles")
        .select("game_stats, reddit_username")
        .eq("user_id", user.uid)
        .single(),
    ]);

    const { data: quest, error: questError } = questDetails;
    const { data: profile, error: profileError } = profileDetails;

    if (questError || !quest)
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Quest not found." }),
      };
    if (profileError || !profile || !profile.game_stats)
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Game profile not found." }),
      };

    const { error: completionError } = await supabase
      .from("user_completed_quests")
      .insert({ user_id: user.uid, quest_id: questId });
    if (completionError) {
      if (completionError.code === "23505")
        return {
          statusCode: 409,
          body: JSON.stringify({ message: "Quest already completed." }),
        };
      throw completionError;
    }

    const newStats = {
      ...profile.game_stats,
      xp: (profile.game_stats.xp || 0) + quest.xp_reward,
    };
    await supabase
      .from("reddit_game_profiles")
      .update({ game_stats: newStats })
      .eq("user_id", user.uid);

    const redditComment = `🎉 **${profile.reddit_username}** completed: **"${quest.name}"** | +${quest.xp_reward} XP | Total: ${newStats.xp} XP`;
    logQuestCompletionToReddit(redditComment).catch(console.error);

    if (quest.unlocks_badge_id) {
        console.log(
          `User ${user.uid} unlocked badge ${quest.unlocks_badge_id}! Triggering minting...`
        );
    
        axios.post(`http://localhost:${process.env.PORT || 4000}/gremlins/mint-achievement`, 
            {
                // The body of the request
                userId: user.uid,
                badgeId: quest.unlocks_badge_id
            }, 
            {
                // The configuration object, which includes headers
                headers: {
                    // (NEW) Add the secret key to the 'x-internal-secret' header
                    'X-Internal-Secret': process.env.INTERNAL_API_SECRET
                }
            }
        )
        .then(response => {
            console.log(`Successfully triggered mint for user ${user.uid}:`, response.data.message);
        })
        .catch(err => {
            console.error('Error calling mint-achievement endpoint:', err.response ? err.response.data : err.message);
        });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Quest '${quest.name}' completed!`,
        xp_gained: quest.xp_reward,
        new_xp_total: newStats.xp,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Server error" }),
    };
  }
};
