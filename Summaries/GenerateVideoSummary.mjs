import { createClient } from "@supabase/supabase-js";
import axios from 'axios';

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

  try {
    let { data: existingVideo, error: existingVideoError } = await supabase
      .from("video_summaries")
      .select("*")
      .eq("summary_id", summary_id)
      .eq("user_id", user.uid)
      .single();

    if (existingVideo && existingVideo.status === "completed") {
      return { statusCode: 200, body: JSON.stringify(existingVideo) };
    }
    if (existingVideo && existingVideo.status === "processing") {
      return { statusCode: 202, body: JSON.stringify(existingVideo) };
    }

    const { data: userData } = await supabase.from('users').select('username').eq('id', user.uid).single();
    const { data: summaryData } = await supabase.from('summaries').select('books(title)').eq('summary_id', summary_id).single();

    if (!userData || !summaryData) {
      throw new Error('Could not fetch user or book details to generate script.');
    }

    const userName = userData.username || 'there';
    const bookTitle = summaryData.books.title;
    console.log("username:", userName);
    console.log("booktitle", bookTitle);
    // 3. Call the Tavus API with persona_id and replica_id.
    const script = `Hi ${userName}! 📚 Ready to explore ${bookTitle} in just minutes? Let’s dive in together — and I’ll be here to guide you.`;
    
    const tavusResponse = await axios.post('https://tavusapi.com/v2/conversations', 
      {
        // --- THIS IS THE ONLY CHANGE ---
        // Instead of a template_id, we use the specific persona and replica.
        persona_id: "p88964a7",
        replica_id: "rfb51183fe",
        custom_greeting: script,
        conversation_name: ` A Meeting with ${userName}`,
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
      .insert({
        summary_id: summary_id,
        user_id: user.uid,
        video_file_url: tavusResponse.data.conversation_url,
        tavus_video_id: tavusVideoId,
        status: tavusResponse.data.status
      })
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
