import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
    const user = event.requestContext.authorizer;
    if (!user?.uid) {
        return { statusCode: 401, body: JSON.stringify({ message: 'User not authenticated.' }) };
    }

    const { review_id } = event.pathParameters;

    if (!review_id) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Review ID is required.' }) };
    }

    try {
        // First, verify the review belongs to the user
        const { data: existingReview, error: fetchError } = await supabase
            .from('reviews')
            .select('user_id')
            .eq('review_id', review_id)
            .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') { // Not found
            return { statusCode: 404, body: JSON.stringify({ message: 'Review not found.' }) };
          }
          throw fetchError;
        }

        if (existingReview.user_id !== user.uid) {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: You can only delete your own reviews.' }) };
        }

        // Now, delete the review
        const { error: deleteError } = await supabase
            .from('reviews')
            .delete()
            .eq('review_id', review_id);

        if (deleteError) throw deleteError;

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Review deleted successfully.' }),
        };
    } catch (error) {
        console.error('DeleteReview Error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Failed to delete review.' }) };
    }
};