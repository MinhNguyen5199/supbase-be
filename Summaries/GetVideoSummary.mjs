import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export const handler = async (event, context) => {
  // Use your database's primary key to fetch the record
  const { video_summary_id } = event.pathParameters;
  const user = event.requestContext.authorizer;

  if (!user || !user.uid) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get the job record from your database.
    let { data: videoRecord, error: fetchError } = await supabase
      .from('video_summaries')
      .select('*')
      .eq('video_id', video_summary_id)
      .eq('user_id', user.uid) // Security: ensure user owns this record
      .single();

    if (fetchError) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Video summary record not found.' }) };
    }

    // 2. If already completed, return the record immediately.
    if (videoRecord.status === 'ended') {
        return { statusCode: 200, body: JSON.stringify(videoRecord) };
      }
    
    // 3. Poll the Tavus API for the latest status.
    const tavusResponse = await axios.get(`https://tavusapi.com/v2/conversations/${videoRecord.tavus_video_id}`, {
      headers: { 'x-api-key': process.env.TAVUS_API_KEY }
    });
    
    const tavusStatus = tavusResponse.data.status;
    const tavusUrl = tavusResponse.data.conversation_url;

    if (tavusStatus === 'ended') {
    // 4. If Tavus is done, update your database with the final URL and 'completed' status.
      const { data: updatedRecord, error: updateError } = await supabase
        .from('video_summaries')
        .update({
          status: tavusStatus,
          video_file_url: tavusUrl,
          updated_at: new Date().toISOString()
        })
        .eq('video_id', video_summary_id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return { statusCode: 200, body: JSON.stringify(updatedRecord) };
    }

    // 5. If still processing, return the current record (status is still 'processing').
    return { statusCode: 200, body: JSON.stringify(videoRecord) };

  } catch (error) {
    console.error("Handler Error:", error.response ? error.response.data : error.message);
    return { statusCode: 500, body: JSON.stringify({ message: "An internal server error occurred." }) };
  }
};