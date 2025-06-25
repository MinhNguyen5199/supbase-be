import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// The actual serverless handler for the DELETE operation
export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    const { summary_id } = event.pathParameters;

    // --- Input Validation ---
    if (!user || !user.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }
    if (!summary_id) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing summary_id' }) };
    }

    try {
        // --- Fetch the record to get the external video ID ---
        const { data: record, error: fetchError } = await supabase
            .from('video_summaries')
            .select('tavus_video_id')
            .eq('summary_id', summary_id)
            .eq('user_id', user.uid)
            .single();

        // If there was an error fetching (besides not found), it's a server issue.
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is Supabase's 'not found' code
             console.error("Supabase fetch error:", fetchError);
             throw new Error('Could not fetch record from database.');
        }

        // --- If the record exists, attempt to delete from the external API ---
        if (record && record.tavus_video_id) {
            try {
                // We don't need to wait for this to finish, but we can.
                // The important part is that an error here shouldn't stop us from deleting our own record.
                await axios.delete(`https://tavusapi.com/v2/conversations/${record.tavus_video_id}`, {
                    headers: { 'x-api-key': process.env.TAVUS_API_KEY }
                });
            } catch (tavusError) {
                // If the video is already gone from Tavus (404), that's okay.
                // For other errors, we log them but still proceed to delete our local record.
                if (tavusError.response?.status !== 404) {
                    console.error("Tavus API deletion warning:", tavusError.response?.data || tavusError.message);
                }
            }
        }

        // --- Delete the record from our database ---
        const { error: deleteError } = await supabase
            .from('video_summaries')
            .delete()
            .eq('summary_id', summary_id)
            .eq('user_id', user.uid);

        if (deleteError) {
            // If deleting from our own DB fails, that's a critical error.
            console.error("Supabase delete error:", deleteError);
            throw new Error('Failed to delete the record from the database.');
        }

        // --- SUCCESS! Return a response object. ---
        // This is the missing piece. 204 No Content is perfect for a successful DELETE.
        return { statusCode: 204 }; // or { statusCode: 200, body: JSON.stringify({ message: 'Deleted' }) }

    } catch (error) {
        console.error("Delete Handler Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ message: 'An internal server error occurred.' }) };
    }
};