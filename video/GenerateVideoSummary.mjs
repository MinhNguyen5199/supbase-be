import { createClient } from "@supabase/supabase-js";
import axios from 'axios';
import { getUserTier } from "../Summaries/GetAudioSummary.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const user = event.requestContext?.authorizer;

  const { summary_id } = event.pathParameters || {};
  console.log(event)

  if (!user || !user.uid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Unauthorized" }),
    };
  }
  if (!summary_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing summary_id" }),
    };
  }
  const userTier = await getUserTier(user.uid);
  console.log("User Tier:", userTier);

  if (!userTier.includes('vip')) {
    console.log('Access denied: User is not VIP');
    return { statusCode: 403, body: JSON.stringify({ message: "Access restricted to VIP users only." }) };
  }

  try {
    let { data: existingVideo, error: existingVideoError } = await supabase
      .from("video_summaries")
      .select("*")
      .eq("summary_id", summary_id)
      .eq("user_id", user.uid)
      .single();
      console.log("Existing Video Data:", existingVideo);

      if (existingVideo && (existingVideo.status === "active" || existingVideo.status === "processing")) {
        return { statusCode: 200, body: JSON.stringify(existingVideo) };
      }
    

    const { data: userData } = await supabase.from('users').select('username').eq('id', user.uid).single();
    const { data: summaryData } = await supabase.from('summaries').select('books(title)').eq('summary_id', summary_id).single();

    if (!userData || !summaryData) {
      throw new Error('Could not fetch user or book details to generate script.');
    }

    // 3. Call the Tavus API with persona_id and replica_id.
    const script = `Hi ${userData.username || 'there'}! 📚 Ready to explore ${summaryData.books.title} in just minutes? Let’s dive in together — and I’ll be here to guide you.`;
    
    const tavusResponse = await axios.post('https://tavusapi.com/v2/conversations', 
      {
        // --- THIS IS THE ONLY CHANGE ---
        // Instead of a template_id, we use the specific persona and replica.
        persona_id: "p88964a7",
        replica_id: "rfb51183fe",
        custom_greeting: script,
        properties:{
          enable_closed_captions: true,
        }
      }, 
      {
        headers: {
          'x-api-key': process.env.TAVUS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(tavusResponse)

    const tavusVideoId = tavusResponse.data.conversation_id;
    if (!tavusVideoId) throw new Error('Tavus API did not return a video_id.');


    // 4. Create a new record in your database. This logic remains the same.
    const { data: newVideoRecord, error: insertError } = await supabase
      .from('video_summaries')
      .upsert({
        summary_id: summary_id,
        user_id: user.uid,
        video_file_url: null,
        tavus_video_id: tavusVideoId,
        status: 'processing',
      }, { onConflict: 'summary_id,user_id' })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. Respond with 202 Accepted. This logic remains the same.
    return { statusCode: 202, body: JSON.stringify(newVideoRecord) };

  } catch (error) {
    console.error("Handler Error:", error.response ? error.response.data : error.message);
    return { statusCode: 500, body: JSON.stringify({ message: "An internal server error occurred." }) };
  }
};
