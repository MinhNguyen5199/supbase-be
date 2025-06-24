import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  if (!user?.uid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "User not authenticated." }),
    };
  }

  const { review_id } = event.pathParameters;
  const { rating, review_text } = event.body;

  if (!review_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Review ID is required." }),
    };
  }

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Rating must be between 1 and 5." }),
    };
  }

  try {
    // First, verify the review belongs to the user
    const { data: existingReview, error: fetchError } = await supabase
      .from("reviews")
      .select("user_id")
      .eq("review_id", review_id)
      .single();

    if (fetchError) throw fetchError;

    if (!existingReview) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Review not found." }),
      };
    }

    if (existingReview.user_id !== user.uid) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: "Forbidden: You can only edit your own reviews.",
        }),
      };
    }

    // Now, update the review
    const { data: updatedReview, error: updateError } = await supabase
      .from("reviews")
      .update({ rating, review_text, created_at: new Date().toISOString() }) // Also update the timestamp
      .eq("review_id", review_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Review updated successfully.",
        review: updatedReview,
      }),
    };
  } catch (error) {
    console.error("UpdateReview Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message || "Failed to update review.",
      }),
    };
  }
};
