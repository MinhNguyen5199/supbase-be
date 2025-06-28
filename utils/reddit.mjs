import snoowrap from 'snoowrap';
import dotenv from 'dotenv';

// dotenv.config();

// These credentials should be for a specific bot account, e.g., "BookWiseQuestBot"
const r = new snoowrap({
    userAgent: `ISummarize Quest Bot v1.0 by u/${process.env.REDDIT_USERNAME}`,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD
});

// ID of a specific submission (thread) on your subreddit to post comments to.
// You can create a weekly "Completed Quests" thread and update this ID.
const QUEST_LOG_THREAD_ID = process.env.REDDIT_QUEST_LOG_THREAD_ID;

/**
 * Posts a comment to the official quest log thread on Reddit.
 * @param {string} text - The content of the comment to post.
 */
export const logQuestCompletionToReddit = async (text) => {
    if (!QUEST_LOG_THREAD_ID) {
        console.warn("REDDIT_QUEST_LOG_THREAD_ID not set. Skipping post to Reddit.");
        return;
    }
    try {
        await r.getSubmission(QUEST_LOG_THREAD_ID).reply(text);
        console.log("Successfully posted quest completion to Reddit.");
    } catch (error) {
        console.error("Failed to post comment to Reddit:", error);
    }
};