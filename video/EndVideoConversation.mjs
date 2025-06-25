import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    const { summary_id } = event.pathParameters;
    if (!user || !user.uid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  if (!summary_id) return { statusCode: 400, body: JSON.stringify({ message: 'Missing summary_id' }) };

  try{
    const { data: record, error: fetchError } = await supabase
      .from('video_summaries')
      .select('tavus_video_id, status')
      .eq('summary_id', summary_id)
      .eq('user_id', user.uid)
      .single();

    if (fetchError || !record) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Record not found.' }) };
    }
    if (record.status !== 'active') {
      return { statusCode: 400, body: JSON.stringify({ message: `Session is not active.` }) };
    }

    await axios.post(
    `https://tavusapi.com/v2/conversations/${record.tavus_video_id}/end`,
    null, // or {}
    {
        headers: {
            'x-api-key': process.env.TAVUS_API_KEY
        }
    }
);

        const { data: updatedRecord, error: updateError } = await supabase
        .from('video_summaries')
        .update({ status: 'ended' })
        .eq('summary_id', summary_id)
        .select().single();
        if (updateError) throw updateError;

        return { statusCode: 200, body: JSON.stringify(updatedRecord) };
      } catch (error) {
        console.error("End Conversation Error:", error.response ? error.response.data : error.message);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to end the conversation.' }) };
      }
}