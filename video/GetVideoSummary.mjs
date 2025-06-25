import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  const { summary_id } = event.pathParameters;

  if (!user || !user.uid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  if (!summary_id) return { statusCode: 400, body: JSON.stringify({ message: 'Missing summary_id' }) };

  try {
    // 1. Get the current record from your database.
    let { data: videoRecord, error: fetchError } = await supabase
      .from('video_summaries')
      .select('*')
      .eq('summary_id', summary_id)
      .eq('user_id', user.uid)
      .single();

    if (fetchError || !videoRecord) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Video record not found.' }) };
    }

    // 2. If status is no longer 'processing', return the record immediately.
    if (videoRecord.status !== 'processing') {
      return { statusCode: 200, body: JSON.stringify(videoRecord) };
    }

    // 3. If it is 'processing', poll the Tavus API for the latest status.
    const tavusResponse = await axios.get(`https://tavusapi.com/v2/conversations/${videoRecord.tavus_video_id}`, {
      headers: { 'x-api-key': process.env.TAVUS_API_KEY }
    });

    const tavusStatus = tavusResponse.data.status;
    const tavusUrl = tavusResponse.data.conversation_url;

    // 4. If the status from Tavus has changed, update your database.
    if (['active', 'ended'].includes(tavusStatus)) {
      const { data: updatedRecord, error: updateError } = await supabase
        .from('video_summaries')
        .update({
          status: tavusStatus,
          video_file_url: tavusUrl,
          updated_at: new Date().toISOString()
        })
        .eq('summary_id', summary_id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return { statusCode: 200, body: JSON.stringify(updatedRecord) };
    }

    // 5. If still processing, return the current record from your DB.
    return { statusCode: 200, body: JSON.stringify(videoRecord) };

  } catch (error) {
    console.error("Get Status Handler Error:", error.response ? error.response.data : error.message);
    return { statusCode: 500, body: JSON.stringify({ message: "An internal server error occurred." }) };
  }
};