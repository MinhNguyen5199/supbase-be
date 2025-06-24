import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// This helper function remains the same.
// It checks if the user trying to access the audio owns the original summary.
async function checkUserAccess(userId, summaryId) {
  const { data, error } = await supabase
    .from("audio_summaries")
    .select("cloned_from_user_id")
    .eq("summary_id", summaryId)
    .single();
    console.log('123')
    console.log(data)

  if (error || !data) return false;
  return data.cloned_from_user_id === userId;
}


// --- THE COMBINED HANDLER ---
export const handler = async (event) => {
  // 1. Authentication: Check if the user is logged in.
  const user = event.requestContext?.authorizer;
  if (!user?.uid) {
    return { statusCode: 401, body: JSON.stringify({ message: "User not authenticated." }) };
  }

  const { summary_id } = event.pathParameters || {};
  if (!summary_id) {
    return { statusCode: 400, body: JSON.stringify({ message: "Summary ID is required." }) };
  }
  console.log(user.uid, summary_id);
  // 2. Authorization: Check if this specific user has permission to access this summary.
  // We'll keep this check for clarity and security.
  const hasAccess = await checkUserAccess(user.uid, summary_id);
  if (!hasAccess) {
    return { statusCode: 403, body: JSON.stringify({ message: "Access denied." }) };
  }

  try {
    // 3. Fetch all audio metadata (from your first function)
    const { data: audioSummary, error: fetchError } = await supabase
      .from("audio_summaries")
      .select(
        `
          *,
          users:cloned_from_user_id (
            username
          )
        `
      )
      .eq("summary_id", summary_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!audioSummary) {
      // This is not an error, it just means no audio exists yet.
      // Return null data, which your frontend is designed to handle.
      return { statusCode: 200, body: JSON.stringify({ data: null }) };
    }
    console.log(audioSummary.audio_file_url);
    // 4. Generate a Signed URL for the private audio file
    // We need to extract the file path from the full URL stored in the database.
    const filePath = audioSummary.audio_file_url; 

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("audio") // The name of your private bucket
      .createSignedUrl(filePath, 60); // The URL will be valid for 60 seconds

    if (signedUrlError) throw signedUrlError;

    // 5. Add the new signed URL to the data object we're returning.
    audioSummary.signed_audio_url = signedUrlData.signedUrl;


    // 6. Return all the data in a single JSON response
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Or your frontend domain
      },
      body: JSON.stringify({ data: audioSummary }),
    };

  } catch (error) {
    console.error('Error in get-audio-summary handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "An internal error occurred." }),
    };
  }
};